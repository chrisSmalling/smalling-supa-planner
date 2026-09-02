// Supabase Edge Function (Deno). Parses one Quick Add text entry into structured
// items via Gemini. The API key lives only server-side — the client never
// sees it. Gemini *proposes*; nothing is written to the database here or
// anywhere else until the user confirms in the app.

import { createClient } from 'npm:@supabase/supabase-js@2'

const VAULT_SECRET_NAME = 'Gemini-api'

const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

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
          repeat_freq: { type: 'string', enum: REPEAT_FREQS },
          repeat_interval: { type: 'integer' },
          repeat_weekdays: { type: 'array', items: { type: 'integer' }, nullable: true },
          repeat_until: { type: 'string', nullable: true, description: 'YYYY-MM-DD or null' },
          notes: { type: 'string', nullable: true },
          flags: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: [
          'category',
          'title',
          'starts_on',
          'start_time',
          'who',
          'repeat_freq',
          'repeat_interval',
          'repeat_weekdays',
          'repeat_until',
          'notes',
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
- start_time is 24h "HH:MM", or null for anything that isn't a specific time (all-day).
- Detect recurrence phrases and set repeat_freq/repeat_interval/repeat_weekdays/repeat_until accordingly:
  - "every Saturday" -> weekly, repeat_weekdays [6] (0=Sun..6=Sat).
  - "every other week" -> weekly, repeat_interval 2.
  - "on the 5th of every month" -> monthly, starts_on the next occurrence of the 5th.
  - "my birthday is January 14" / a recurring anniversary -> yearly, category milestone, starts_on the next Jan 14; if a birth year is stated, use that year as starts_on's year instead so age can be computed.
  - Nothing recurrence-related mentioned -> repeat_freq "none", repeat_interval 1, repeat_weekdays null, repeat_until null.
- who: match a name to the roster case-insensitively; null if no one is named or the name isn't on the roster.
- notes: never let real detail from the input evaporate. Anything specific
  that doesn't have its own field — where, what to bring, a constraint, a
  reason — goes in notes on the item it's attached to, verbatim or close to it.
- **Prep/logistics splitting — the main thing that makes this useful, do not
  skip it**: if the text implies a *separate* earlier action someone has to
  actually do — prep, thaw, buy, pack, charge, book, RSVP, print, mail — emit
  it as its OWN additional item, not just a note buried on the main one. Put
  it on the date it needs doing (the night before, that morning, "by
  Wednesday", etc.), give it category "chore" (or "note" if it's not really a
  discrete task), a title that stands alone as a to-do ("Prep French toast
  for breakfast", not "prep"), and flag it as inferred so it's clear this
  wasn't literally typed:
  - "French toast Friday for breakfast, will need to be prepped the night
    before" -> TWO items: (1) meal "French toast", Friday, no time; (2) chore
    "Prep French toast for breakfast", Thursday (the night before), no time,
    flags: ["inferred prep step"].
  - "Thanksgiving dinner Thursday, need to thaw the turkey" -> the dinner
    (appointment/activity, Thursday) PLUS a chore "Thaw the turkey" dated
    2-3 days earlier (thawing a turkey takes days — use your judgment on the
    lead time a task like this actually needs), flags: ["inferred prep step",
    "assumed thaw lead time"].
  - "Emma's recital Saturday, needs to bring her costume" -> the recital PLUS
    a chore "Pack Emma's costume" the night before or morning of.
  - If nothing implies a separate prep action, don't invent one — a plain
    "dentist Tuesday at 2" is just one item.
- flags: short phrases naming anything ambiguous you had to guess at (e.g.
  "assumed this year", "no time given"), and always flag any item you split
  out yourself rather than one the user stated outright (e.g. "inferred prep
  step"). Empty array only if nothing was ambiguous and nothing was inferred.
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

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
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
    })

    if (!geminiRes.ok) {
      const detail = await geminiRes.text()
      console.error(`Gemini request failed (${geminiRes.status}):`, detail)
      return new Response(JSON.stringify({ error: `Gemini request failed: ${detail}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
