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

/** Drops the leading street-address segment, keeping city/state/zip — e.g. "17735 Pleasantview Blvd, Land O Lakes, FL 34638" -> "Land O Lakes, FL 34638". Returns null if there's nothing to drop. */
function withoutStreetPart(query: string): string | null {
  const parts = query
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  return parts.slice(1).join(', ')
}

type NominatimResult = { lat: string; lon: string; display_name: string }

async function lookupNominatim(q: string): Promise<NominatimResult | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Nominatim request failed (${res.status}): ${detail}`)
  }
  const results = (await res.json()) as NominatimResult[]
  return results[0] ?? null
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
      .select('lat, lng, display_name, approximate')
      .eq('query', key)
      .maybeSingle()

    if (cached) {
      return new Response(
        JSON.stringify({ lat: cached.lat, lng: cached.lng, displayName: cached.display_name, approximate: cached.approximate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let first: NominatimResult | null
    let approximate = false
    try {
      first = await lookupNominatim(query)
      // A specific house number often isn't in OSM's data even when the
      // surrounding area is well-mapped — falling back to city/state/zip
      // beats reporting "not found" for an address that's perfectly real.
      if (!first) {
        const fallback = withoutStreetPart(query)
        if (fallback) {
          first = await lookupNominatim(fallback)
          approximate = first !== null
        }
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      return new Response(JSON.stringify({ error: 'Geocoding failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!first) {
      return new Response(JSON.stringify({ lat: null, lng: null, displayName: null, approximate: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lat = Number(first.lat)
    const lng = Number(first.lon)
    const displayName = first.display_name

    const { error: insertError } = await supabase
      .from('geocode_cache')
      .insert({ query: key, lat, lng, display_name: displayName, approximate })
    if (insertError) console.error('Failed to cache geocode result:', insertError)

    return new Response(JSON.stringify({ lat, lng, displayName, approximate }), {
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
