# Superplan

A mobile-first PWA for one family's shared weekly planner: activities, meals,
chores/projects, appointments, and recurring milestones, in a week view and a
month calendar.

## The one idea everything rests on

There is **one kind of thing: an item.** An item has a date, an optional
time, a category tag, and an optional repeat rule. A birthday, a monthly
chore, Saturday soccer, and Tuesday's tacos are all just items with different
categories and repeat rules — one model, one week view, one recurring engine.

## Stack

- Vite + React + TypeScript + Tailwind + hand-rolled shadcn/ui-style components
- Supabase (Postgres, RLS) — no Realtime, fetch-on-open instead
- vite-plugin-pwa for the offline app shell + iOS home-screen install
- Gemini (`gemini-3.6-flash`) via a Supabase Edge Function for Quick Add

## No sign-in, by design

There's no login of any kind — no accounts, no passwords. On first open the
app asks you to name your household and add each person (you, your partner,
the kids); after that, opening the app on any device just asks "who's this?"
once (saved to that device) so items get attributed to the right person.

This is a deliberate trade-off: the database is protected only by RLS
policies that allow full read/write to anyone holding the app's URL and
Supabase anon key — there is no per-user access boundary. That's the right
call for a private, two-person household app and the wrong call for anything
with more than a handful of trusted users. See
`supabase/migrations/0003_remove_auth_open_access.sql` for exactly what that
opens up.

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the migrations**: `supabase link --project-ref <ref>` then
   `supabase db push` (or paste `supabase/migrations/*.sql`, in order, into
   the SQL editor).
3. **Copy `.env.example` to `.env`** and fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from your project's API settings.
4. **Deploy the Quick Add function**:
   ```
   supabase functions deploy quick-add
   supabase secrets set GEMINI_API_KEY=your-gemini-key
   ```
   The function reads either `GEMINI_API_KEY` or `Gemini-api` as the secret
   name, so either works.
   Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com/apikey).
5. **Install and run**:
   ```
   npm install
   npm run dev
   ```
6. **Open the app**, name your household and add yourself. Open the same URL
   on your partner's phone and add them too from the "who's this?" screen.
7. **Add the kids** as household members from the "+ Person" button in the
   header so they show up in the "Who" picker and in Quick Add.

## Install to a phone's home screen (iOS)

Open the deployed URL in Safari → Share → Add to Home Screen. The app runs
standalone with an offline shell and a read-through cache, so the week/month
views still render the last-known data with no connection. Treat any push
notification as best-effort — the **Needs attention** strip (14-day
lookahead + overdue chores) is the real reminder surface.

## Smarter Quick Add

Quick Add doesn't just extract literal calendar entries — it's told to
notice what's implied and split it out as its own item:

- **Inferred prep/logistics steps**: "French toast Friday for breakfast,
  needs prepping the night before" produces two items — the meal, and a
  separate "Prep French toast" chore the evening before — flagged in the
  confirm card as auto-added, not something you typed.
- **Packing lists**: "Emma's recital Saturday, needs her costume, shoes,
  and hairbrush" produces the recital plus a checklist item ("Pack for
  Emma's recital") with each thing as its own checkable line.
- **Locations**: a mentioned venue or address is captured on the item and
  gets a one-tap Google Maps link (no API key needed — it's a plain search
  URL) wherever that item shows up.
- **Healthy recipes**: on a meal item's edit sheet, "Suggest a healthy
  recipe" calls Gemini once more and fills the ingredient checklist +
  instructions for you to review before saving.

None of this is flagged as ambiguous just because a field was empty —
flags mean "I guessed, double-check this," not "this field happens to be
null." See the prompt in `supabase/functions/quick-add/index.ts` for the
worked examples that keep this calibrated.

**Not built**: turn-by-turn "leave by" times. The Maps link is free (just a
URL); a real leave-by time needs an actual travel-time API (Google Maps
Distance Matrix or similar) plus a home address to calculate from — a
deliberate scope line since that means a second paid API key.

## Project structure

```
src/
  lib/
    recurrence.ts       — occurrencesInRange(item, from, to): the recurring engine
    occurrences.ts       — expands items + item_status into per-date occurrences
    dateUtils.ts          — week/month date arithmetic (WEEK_START lives here)
    types.ts, database.types.ts
  hooks/
    useItems.ts           — fetch-on-open + focus/visibilitychange refetch, optimistic writes
    useCurrentPerson.ts    — "who's using this device" (localStorage, attribution only)
  contexts/
    HouseholdContext.tsx   — loads the one household + its members
  components/
    WeekView.tsx, MonthView.tsx, DaySheet.tsx
    AddEditSheet.tsx       — manual add/edit, repeat rule builder, subtasks, location, recipe button
    QuickAddBar.tsx        — calls the quick-add Edge Function, confirm-before-write
    RecipeButton.tsx        — calls suggest-recipe, fills the meal's checklist + notes
    NeedsAttentionStrip.tsx
  pages/
    SetupHousehold.tsx, WhoAreYou.tsx, Planner.tsx
supabase/
  migrations/              — households, profiles, items, item_status, RLS (see 0003 re: open access), location
  functions/
    quick-add/              — Gemini parse (server-side key only)
    suggest-recipe/          — Gemini recipe suggestion for a meal item
```

## Build order this followed

1. Household + profiles + RLS (later reworked to remove auth entirely — see above)
2. `items` table + Add/Edit sheet + Week view (one-offs only)
3. Recurring engine + Month calendar view
4. `item_status`: chore completion and skip, per date
5. Quick Add (Gemini parse with recurrence) + confirm card
6. Needs-attention strip (lookahead + overdue)
7. PWA install + offline read cache

**Parked** until the planner earns daily use: Instacart integration for meal
ingredients (`category = 'meal'` items already exist; a `meal_ingredients`
child table + a "build this week's list" flow that POSTs to the Instacart
Developer Platform is the next step, not part of this build).

## Notes on modeling choices

- `profiles` represents every household member who can be assigned an item —
  parents and kids alike, all just rows in the same table, so "Emma" is
  assignable via `who` exactly like "Dad" is.
- Editing a single occurrence of a repeating item is v1-scoped to: skip that
  date (`item_status = 'skipped'`) and, if needed, add a one-off in its
  place. True per-instance editing is a deliberate later enhancement.
