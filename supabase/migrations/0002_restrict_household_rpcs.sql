-- The three household-membership RPCs are SECURITY DEFINER and must only be
-- callable by a signed-in user: anon had Supabase's default EXECUTE grant,
-- so an unauthenticated request could call e.g. create_household() with
-- auth.uid() = null and insert a household + an orphaned profile row.
-- Revoke anon's grant and add a belt-and-suspenders auth.uid() check.

revoke execute on function public.create_household(text, text) from public;
revoke execute on function public.join_household(uuid, text) from public;
revoke execute on function public.add_household_member(text) from public;
revoke execute on function public.create_household(text, text) from anon;
revoke execute on function public.join_household(uuid, text) from anon;
revoke execute on function public.add_household_member(text) from anon;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(uuid, text) to authenticated;
grant execute on function public.add_household_member(text) to authenticated;

create or replace function create_household(household_name text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  if exists (select 1 from profiles where user_id = auth.uid()) then
    raise exception 'profile already exists for this user';
  end if;

  insert into households (name) values (household_name) returning id into new_household_id;
  insert into profiles (household_id, user_id, display_name, email)
    values (new_household_id, auth.uid(), display_name, auth.jwt() ->> 'email');

  return new_household_id;
end;
$$;

create or replace function join_household(target_household_id uuid, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

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

create or replace function add_household_member(display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_household_id uuid;
  new_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

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
