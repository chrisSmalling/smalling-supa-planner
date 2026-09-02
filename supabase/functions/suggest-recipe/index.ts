// Supabase Edge Function (Deno). Suggests a healthy recipe for a meal item —
// ingredients go into that item's checklist, instructions into its notes.
// Same Gemini key lookup as quick-add (see the comment there for why Vault
// needs a SECURITY DEFINER RPC rather than a direct schema query).

import { createClient } from 'npm:@supabase/supabase-js@2'

const VAULT_SECRET_NAME = 'Gemini-api'
const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: { type: 'array', items: { type: 'string' } },
    instructions: { type: 'string', description: 'Numbered steps as plain text, one per line' },
  },
  required: ['ingredients', 'instructions'],
}

function buildPrompt(title: string, notes: string | null): string {
  return `Suggest one healthy, family-friendly recipe for "${title}".
${notes ? `Context / constraints already noted for this meal: ${notes}` : ''}

Rules:
- Favor whole ingredients, lean proteins, vegetables, and modest added sugar/fat — this is a "healthy" request, not a health-food-store request; it should still taste like the dish it's named after.
- ingredients: a plain shopping list, one item with a rough quantity per entry (e.g. "2 cups sliced strawberries"), sized for a family of four unless the title suggests otherwise.
- instructions: numbered steps as plain text with line breaks between steps, concise enough to actually cook from on a weeknight.
- Output ONLY the JSON object matching the schema. No prose, no markdown fences.`
}

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

    const { title, notes } = (await req.json()) as { title?: string; notes?: string | null }
    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: 'title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(title, notes ?? null) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.4,
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
