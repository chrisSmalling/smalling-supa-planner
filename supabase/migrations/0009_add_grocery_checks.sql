-- Grocery list: aggregates ingredient checklist lines from the week's meal
-- items (client-side, see src/lib/groceryList.ts) and persists only which
-- ones are checked off, so both phones see the same shopping progress.
-- Scoped to week_start so a recurring ingredient starts unchecked each new
-- week instead of staying checked from groceries already bought last time.
-- Mirrors item_status: a row's existence means "checked," clearing it
-- deletes the row rather than storing a checked=false state.
create table grocery_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start date not null,
  ingredient text not null,
  checked_at timestamptz not null default now(),
  unique (household_id, week_start, ingredient)
);

alter table grocery_checks enable row level security;
create policy "open access" on grocery_checks for all using (true) with check (true);
