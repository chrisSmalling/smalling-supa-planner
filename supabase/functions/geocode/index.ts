// Supabase Edge Function (Deno). Turns a free-text location ("Magic Kingdom,
// Orlando, FL") into a lat/lng using Nominatim (OpenStreetMap's free
// geocoder) — no API key, no billing. Results are cached in the
// `geocode_cache` table (keyed by normalized query) so the same address
// never hits Nominatim twice, per its usage policy (it's a shared public
// service, not meant for repeated lookups of the same thing).

import { createClient } from 'npm:@supabase/supabase-js@2'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
// Nominatim's usage policy requires a descriptive User-Agent identifying the
// application (and ideally a way to contact its maintainer) — anonymous or
// browser-default User-Agents get blocked.
const USER_AGENT = 'Superplan-Household-Planner/1.0 (+https://github.com/chrisSmalling/smalling-supa-planner)'

function normalize(query: string): string {
  return query.trim().toLowerCase()
}

function client() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(supabaseUrl, serviceRoleKey)
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { query } = (await req.json()) as { query?: string }
    if (!query || !query.trim()) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const key = normalize(query)
    const supabase = client()

    const { data: cached } = await supabase
      .from('geocode_cache')
      .select('lat, lng')
      .eq('query', key)
      .maybeSingle()

    if (cached) {
      return new Response(JSON.stringify({ lat: cached.lat, lng: cached.lng }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })

    if (!res.ok) {
      const detail = await res.text()
      console.error(`Nominatim request failed (${res.status}):`, detail)
      return new Response(JSON.stringify({ error: `Geocoding failed: ${detail}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = (await res.json()) as Array<{ lat: string; lon: string }>
    const first = results[0]
    if (!first) {
      return new Response(JSON.stringify({ lat: null, lng: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lat = Number(first.lat)
    const lng = Number(first.lon)

    const { error: insertError } = await supabase.from('geocode_cache').insert({ query: key, lat, lng })
    if (insertError) console.error('Failed to cache geocode result:', insertError)

    return new Response(JSON.stringify({ lat, lng }), {
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
