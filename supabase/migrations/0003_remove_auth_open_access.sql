-- Private, two-person household app: no sign-in of any kind. Replace the
-- auth-gated RLS model with fully open access via the anon key, and drop the
-- auth-linked plumbing (user_id/email on profiles, the household RPCs, the
-- auth_household_id() helper) that only existed to support login.
--
-- This is a deliberate trade-off, not an oversight: anyone with this
-- project's URL and anon key can read/write all data. Acceptable for a
-- private family calendar; would not be for anything with more than a
-- handful of trusted users.

drop policy if exists "member can view own household" on households;
drop policy if exists "member can view household profiles" on profiles;
drop policy if exists "member can update own profile" on profiles;
drop policy if exists "member can view household items" on items;
drop policy if exists "member can insert household items" on items;
drop policy if exists "member can update household items" on items;
drop policy if exists "member can delete household items" on items;
drop policy if exists "member can view household item_status" on item_status;
drop policy if exists "member can insert household item_status" on item_status;
drop policy if exists "member can update household item_status" on item_status;
drop policy if exists "member can delete household item_status" on item_status;

drop function if exists create_household(text, text);
drop function if exists join_household(uuid, text);
drop function if exists add_household_member(text);
drop function if exists auth_household_id();

alter table profiles drop column if exists user_id;
alter table profiles drop column if exists email;

-- Explicit "open" policies (kept, not disabled outright) so RLS stays on
-- record as an intentional, documented choice rather than an oversight.
create policy "open access" on households for all using (true) with check (true);
create policy "open access" on profiles for all using (true) with check (true);
create policy "open access" on items for all using (true) with check (true);
create policy "open access" on item_status for all using (true) with check (true);
