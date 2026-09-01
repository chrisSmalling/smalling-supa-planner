-- Superplan schema: one household, one `items` table for every category,
-- `item_status` for per-occurrence done/skip. See CLAUDE build spec.
--
-- `profiles` holds every household member who can be assigned an item —
-- not just the two parents who log in. `user_id` is set for a member who
-- has an account (the parents) and null for one who doesn't (the kids):
-- `who` and `created_by` reference `profiles(id)` either way, so "Emma" is
-- assignable exactly like "Dad" is, without Emma needing to sign in.

create extension if not exists "pgcrypto";

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  created_at timestamptz default now()
);

create index profiles_household_id_idx on profiles (household_id);

create table items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  title text not null,
  category text not null check (
    category in ('activity', 'meal', 'chore', 'project', 'appointment', 'milestone', 'note')
  ),
  starts_on date not null,
  start_time time,
  who uuid references profiles(id) on delete set null,
  notes text,
  subtasks jsonb,
  repeat_freq text not null default 'none' check (
    repeat_freq in ('none', 'daily', 'weekly', 'monthly', 'yearly')
  ),
  repeat_interval int not null default 1 check (repeat_interval >= 1),
  repeat_weekdays int[],
  repeat_until date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index items_household_starts_on_idx on items (household_id, starts_on);

create table item_status (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade not null,
  occurrence_date date not null,
  status text not null check (status in ('done', 'skipped')),
  by uuid references profiles(id) on delete set null,
  at timestamptz default now(),
  unique (item_id, occurrence_date)
);

create index item_status_item_id_idx on item_status (item_id);

-- ---------------------------------------------------------------------------
-- RLS: every row is visible/writable only to members of its own household.
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table profiles enable row level security;
alter table items enable row level security;
alter table item_status enable row level security;

-- Looks up the caller's household without recursing back into `profiles`
-- through RLS (security definer bypasses RLS for this one lookup).
create function auth_household_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from profiles where user_id = auth.uid()
$$;

create policy "member can view own household" on households
  for select using (id = auth_household_id());

create policy "member can view household profiles" on profiles
  for select using (household_id = auth_household_id());

create policy "member can update own profile" on profiles
  for update using (user_id = auth.uid());

create policy "member can view household items" on items
  for select using (household_id = auth_household_id());

create policy "member can insert household items" on items
  for insert with check (household_id = auth_household_id());

create policy "member can update household items" on items
  for update using (household_id = auth_household_id());

create policy "member can delete household items" on items
  for delete using (household_id = auth_household_id());

create policy "member can view household item_status" on item_status
  for select using (
    exists (select 1 from items where items.id = item_status.item_id and items.household_id = auth_household_id())
  );

create policy "member can insert household item_status" on item_status
  for insert with check (
    exists (select 1 from items where items.id = item_status.item_id and items.household_id = auth_household_id())
  );

create policy "member can update household item_status" on item_status
  for update using (
    exists (select 1 from items where items.id = item_status.item_id and items.household_id = auth_household_id())
  );

create policy "member can delete household item_status" on item_status
  for delete using (
    exists (select 1 from items where items.id = item_status.item_id and items.household_id = auth_household_id())
  );

-- ---------------------------------------------------------------------------
-- Household setup. No insert policy on `households` or `profiles` (a bare
-- INSERT would let any signed-in user create households, or attach a profile
-- to a household they don't belong to), so membership changes go through
-- these RPCs instead.
-- ---------------------------------------------------------------------------

create function create_household(household_name text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if exists (select 1 from profiles where user_id = auth.uid()) then
    raise exception 'profile already exists for this user';
  end if;

  insert into households (name) values (household_name) returning id into new_household_id;
  insert into profiles (household_id, user_id, display_name, email)
    values (new_household_id, auth.uid(), display_name, auth.jwt() ->> 'email');

  return new_household_id;
end;
$$;

-- The second parent joins with the household's UUID (shared out-of-band, e.g.
-- copy/paste) as an invite code.
create function join_household(target_household_id uuid, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from profiles where user_id = auth.uid()) then
    raise exception 'profile already exists for this user';
  end if;

  if not exists (select 1 from households where id = target_household_id) then
    raise exception 'household not found';
  end if;

  insert into profiles (household_id, user_id, display_name, email)
    values (target_household_id, auth.uid(), display_name, auth.jwt() ->> 'email');

  return target_household_id;
end;
$$;

-- Adds a household member with no login of their own (a kid) so they can be
-- assigned items via `who` just like a parent can.
create function add_household_member(display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_household_id uuid;
  new_profile_id uuid;
begin
  select household_id into caller_household_id from profiles where user_id = auth.uid();
  if caller_household_id is null then
    raise exception 'you must belong to a household first';
  end if;

  insert into profiles (household_id, display_name)
    values (caller_household_id, display_name)
    returning id into new_profile_id;

  return new_profile_id;
end;
$$;
