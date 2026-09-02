// Supabase Edge Function (Deno). Parses one Quick Add text entry into structured
// items via Gemini. The API key lives only server-side — the client never
// sees it. Gemini *proposes*; nothing is written to the database here or
// anywhere else until the user confirms in the app.

import { createClient } from 'npm:@supabase/supabase-js@2'

const VAULT_SECRET_NAME = 'Gemini-api'

// Free-tier Gemini gets deprioritized under load — confirmed via logs on
// 2026-09-02: gemini-3.6-flash alone was down (503 "high demand", then full
// timeouts) for close to an hour straight. Trying a second model only
// *after* the first fails just adds up wait time without improving the
// odds much, since a sustained outage doesn't clear in the time a sequential
// retry takes. Instead, two different models (verified real via
// ModelService.ListModels — the first fallback guess, 3.6-flash-lite,
// doesn't exist) are raced in parallel; whichever answers successfully
// first wins and the other is cancelled. Same request budget as a
// sequential retry, roughly half the worst-case wait, and it actually
// benefits from the outage being model-specific rather than API-wide.
const GEMINI_MODELS = ['gemini-3.7-flash', 'gemini-flash-lite-latest']
const geminiUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
// Each attempt is capped so a slow/overloaded backend fails in seconds, not
// the 60-90s it can otherwise hang for with no timeout at all.
const GEMINI_TIMEOUT_MS = 15000

const CATEGORIES = ['activity', 'meal', 'chore', 'project', 'appointment', 'milestone', 'note']
const REPEAT_FREQS = ['none', 'daily', 'weekly', 'monthly', 'yearly']

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          title: { type: 'string' },
          starts_on: { type: 'string', description: 'YYYY-MM-DD' },
          start_time: { type: 'string', nullable: true, description: 'HH:MM 24h, or null for all-day' },
          who: { type: 'string', nullable: true },
          location: { type: 'string', nullable: true, description: 'A venue name or address, if one was mentioned' },
          repeat_freq: { type: 'string', enum: REPEAT_FREQS },
          repeat_interval: { type: 'integer' },
          repeat_weekdays: { type: 'array', items: { type: 'integer' }, nullable: true },
          repeat_until: { type: 'string', nullable: true, description: 'YYYY-MM-DD or null' },
          notes: { type: 'string', nullable: true },
          subtasks: {
            type: 'array',
            items: { type: 'string' },
            nullable: true,
            description: 'A checklist of things to bring/do, only when the item is genuinely a multi-item list',
          },
          flags: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: [
          'category',
          'title',
          'starts_on',
          'start_time',
          'who',
          'location',
          'repeat_freq',
          'repeat_interval',
          'repeat_weekdays',
          'repeat_until',
          'notes',
          'subtasks',
          'flags',
          'confidence',
        ],
      },
    },
  },
  required: ['items'],
}

function buildPrompt(text: string, today: string, roster: string[]): string {
  return `You turn a family planner's freeform quick-add text into structured calendar items.
You are not a transcription tool — you are the one who notices what a parent
would otherwise have to remember on their own. The whole point of this
feature is catching the prep work hiding inside a plan, not just filing the
plan itself.

Today's date is ${today} (YYYY-MM-DD). The household roster (valid values for "who") is: ${roster.join(', ') || '(none yet)'}.

Rules:
- Split the input into one item per distinct thing being planned.
- category is one of: activity, meal, chore, project, appointment, milestone, note.
- starts_on is always a concrete YYYY-MM-DD date, resolved relative to today. A bare weekday ("Saturday", "Tuesday") means the next occurrence of that weekday on or after today.
- start_time is 24h "HH:MM", or null for anything that isn't a specific time (all-day). A day-part word is itself a time and should resolve to one, not get discarded as vague: "breakfast" -> 08:00, "brunch" -> 10:30, "lunch" -> 12:00, "dinner" -> 18:00, "snack" -> null (too variable to guess). "Chicken tacos for dinner" has a time — 18:00 — use it, don't leave start_time null and don't flag it; you weren't guessing, the user told you the part of the day.
- Detect recurrence phrases and set repeat_freq/repeat_interval/repeat_weekdays/repeat_until accordingly:
  - "every Saturday" -> weekly, repeat_weekdays [6] (0=Sun..6=Sat).
  - "every other week" -> weekly, repeat_interval 2.
  - "on the 5th of every month" -> monthly, starts_on the next occurrence of the 5th.
  - "my birthday is January 14" / a recurring anniversary -> yearly, category milestone, starts_on the next Jan 14; if a birth year is stated, use that year as starts_on's year instead so age can be computed.
  - Nothing recurrence-related mentioned -> repeat_freq "none", repeat_interval 1, repeat_weekdays null, repeat_until null.
- who: match a name to the roster case-insensitively; null if no one is named or the name isn't on the roster.
- location: a venue name or address, if one was mentioned ("Magic Kingdom", "Dr. Patel's office", "grandma's house"). Null if nothing place-like was said — don't invent one.
- notes: never let real detail from the input evaporate. Anything specific
  that doesn't have its own field — a constraint, a reason, context that
  isn't a place or a checklist item — goes in notes on the item it's
  attached to, verbatim or close to it.
- subtasks: a checklist, only when the item is genuinely a multi-item list —
  several things to pack, buy, or bring. Split each thing into its own
  string; don't cram a list into the title or notes when subtasks exists for
  exactly this. A single thing to bring doesn't need a checklist — a plain
  title is enough ("Bring the folder" needs no subtasks). Null otherwise.
- **Prep/logistics splitting — the main thing that makes this useful, do not
  skip it**: if the text implies a *separate* earlier action someone has to
  actually do — prep, thaw, buy, pack, charge, book, RSVP, print, mail — emit
  it as its OWN additional item, not just a note buried on the main one. Put
  it on the date it needs doing (the night before, that morning, "by
  Wednesday", etc.), give it category "chore" (or "note" if it's not really a
  discrete task), a title that stands alone as a to-do ("Prep French toast
  for breakfast", not "prep"), use subtasks if it's a multi-item list, and
  flag it as inferred so it's clear this wasn't literally typed:
  - "French toast Friday for breakfast, will need to be prepped the night
    before" -> TWO items: (1) meal "French toast", Friday, 08:00 (breakfast);
    (2) chore "Prep French toast for breakfast", Thursday (the night before),
    no time, flags: ["inferred prep step"].
  - "Thanksgiving dinner Thursday, need to thaw the turkey" -> the dinner
    (appointment/activity, Thursday) PLUS a chore "Thaw the turkey" dated
    2-3 days earlier (thawing a turkey takes days — use your judgment on the
    lead time a task like this actually needs), flags: ["inferred prep step",
    "assumed thaw lead time"].
  - "Emma's recital Saturday, needs her costume, shoes, and hairbrush" -> the
    recital PLUS a chore "Pack for Emma's recital" the night before or
    morning of, with subtasks ["Costume", "Shoes", "Hairbrush"], flags:
    ["inferred prep step"].
  - "beach day Saturday" -> the activity PLUS (if it's plausible a family
    would need to pack for it) a chore "Pack for the beach" that morning
    with a sensible subtasks list (sunscreen, towels, swimsuits, water) —
    use judgment for what's genuinely implied by the activity, and flag it
    clearly as inferred since none of it was stated.
  - If nothing implies a separate prep action, don't invent one — a plain
    "dentist Tuesday at 2" is just one item.
- flags are for genuine uncertainty, not routine nulls. A field being empty
  because the user simply didn't mention it (no time, no one named, no end
  date) is the normal, correct state of an all-day/unassigned/open-ended
  item — that is NOT something to flag. Only flag when you actually had to
  guess, resolve something unclear, or interpret rather than just read: a
  guessed year, a vague time you couldn't pin down ("later", "sometime"), a
  name that's close to but doesn't exactly match the roster, an assumed prep
  lead time. And always flag an item you split out yourself rather than one
  the user stated outright (e.g. "inferred prep step"). Empty array is the
  common case, not the exception — most well-specified items need no flag at
  all.
- confidence: "high" | "medium" | "low" for how sure you are you parsed this item correctly.
- Output ONLY the JSON object matching the schema. No prose, no markdown fences.

Quick add text: "${text}"`
}

/**
 * Prefers a plain Edge Function secret (GEMINI_API_KEY / Gemini-api) if one
 * is ever set that way, otherwise falls back to reading the key out of
 * Supabase Vault via the public.get_vault_secret() RPC (see migration
 * add_vault_secret_reader). Vault itself lives in a `vault` schema that
 * Supabase's REST API does not expose directly — a SECURITY DEFINER
 * function in the exposed `public` schema, locked to service_role, is the
 * documented way in from application code. The service-role key used here
 * is injected into every Edge Function automatically; it never leaves this
 * server-side function.
 */
async function getGeminiApiKey(): Promise<string | null> {
  const direct = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('Gemini-api')
  if (direct) return direct

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return null

  const client = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await client.rpc('get_vault_secret', { secret_name: VAULT_SECRET_NAME })

  if (error || !data) return null
  return data as string
}

interface ModelAttempt {
  model: string
  res?: Response
  timedOut?: boolean
}

async function callGemini(prompt: string, apiKey: string, model: string, signal: AbortSignal): Promise<ModelAttempt> {
  try {
    const res = await fetch(`${geminiUrl(model)}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
      signal,
    })
    return { model, res }
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError'
    console.error(`Gemini (${model}) ${timedOut ? 'timed out or was cancelled' : 'errored'}:`, err)
    return { model, timedOut }
  }
}

/** Races every candidate model at once; the first one to answer successfully wins and the rest are cancelled. Resolves with every attempt's outcome once either a winner is found or all have failed, so a failure can still report the most informative error. */
function raceGeminiModels(prompt: string, apiKey: string, models: string[]): Promise<ModelAttempt[]> {
  const controllers = models.map(() => new AbortController())
  const timers = controllers.map((c) => setTimeout(() => c.abort(), GEMINI_TIMEOUT_MS))
  const clearTimers = () => timers.forEach(clearTimeout)
  const attempts = models.map((model, i) => callGemini(prompt, apiKey, model, controllers[i].signal))

  return new Promise((resolve) => {
    const results: ModelAttempt[] = new Array(models.length)
    let doneCount = 0
    let settled = false
    attempts.forEach((attempt, i) => {
      attempt.then((result) => {
        results[i] = result
        doneCount++
        if (!settled && result.res?.ok) {
          settled = true
          controllers.forEach((c, j) => j !== i && c.abort())
          clearTimers()
          resolve(results.filter(Boolean))
        } else if (doneCount === models.length && !settled) {
          settled = true
          clearTimers()
          resolve(results)
        }
      })
    })
  })
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { text, roster } = (await req.json()) as { text?: string; roster?: string[] }
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const today = new Date().toISOString().slice(0, 10)
    const prompt = buildPrompt(text, today, roster ?? [])

    const results = await raceGeminiModels(prompt, apiKey, GEMINI_MODELS)
    const winner = results.find((r) => r.res?.ok)

    if (!winner) {
      // Nothing succeeded — report the most useful thing we have: an actual
      // HTTP error from Google beats a bare timeout, since it names the
      // real reason (503 overloaded, 404 bad model, etc.).
      const withResponse = results.find((r) => r.res)
      if (withResponse?.res) {
        const detail = await withResponse.res.text()
        console.error(`Gemini (${withResponse.model}) request failed (${withResponse.res.status}):`, detail)
        const message =
          withResponse.res.status === 503
            ? 'Gemini is overloaded right now — try again in a moment.'
            : `Gemini request failed: ${detail}`
        return new Response(JSON.stringify({ error: message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(
        JSON.stringify({
          error: `Gemini isn't responding right now (tried ${results.length} models) — try again in a moment.`,
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const geminiRes = winner.res!

    const geminiData = await geminiRes.json()
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Gemini returned no content' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = JSON.parse(raw)
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unhandled error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
