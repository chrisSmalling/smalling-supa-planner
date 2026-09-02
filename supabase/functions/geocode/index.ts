// Supabase Edge Function (Deno). Turns a free-text location ("Magic Kingdom,
// Orlando, FL") into a lat/lng — no API key, no billing. Tries, in order:
//   1. Nominatim (OpenStreetMap) on the exact text.
//   2. The US Census Bureau's geocoder, which interpolates an exact house
//      number along a street from TIGER/Line address ranges even when OSM
//      has no point for it — US addresses only, but free and unlimited.
//   3. Nominatim again with the street part dropped (city/state/zip only),
//      flagged "approximate" — better than reporting "not found" for an
//      address that's perfectly real but under-mapped.
// Results are cached in geocode_cache (keyed by normalized query) so the
// same address never re-triggers this chain, per Nominatim's usage policy
// (it's a shared public service, not meant for repeated identical lookups).

import { createClient } from 'npm:@supabase/supabase-js@2'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress'
// Nominatim's usage policy requires a descriptive User-Agent identifying the
// application (and ideally a way to contact its maintainer) — anonymous or
// browser-default User-Agents get blocked.
const USER_AGENT = 'Superplan-Household-Planner/1.0 (+https://github.com/chrisSmalling/smalling-supa-planner)'

interface Match {
  lat: number
  lng: number
  displayName: string
}

const FETCH_TIMEOUT_MS = 4000

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

/** Census only geocodes structured mailing addresses — a venue name like "LA Fitness, New Tampa" will never match, so skip straight past it unless the query actually starts with a house number. */
function looksLikeStreetAddress(query: string): boolean {
  return /^\d+\s/.test(query.trim())
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function lookupNominatim(q: string): Promise<Match | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Nominatim request failed (${res.status}): ${detail}`)
  }
  const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
  const first = results[0]
  if (!first) return null
  return { lat: Number(first.lat), lng: Number(first.lon), displayName: first.display_name }
}

async function lookupCensus(q: string): Promise<Match | null> {
  const url = `${CENSUS_URL}?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`
  const res = await fetchWithTimeout(url)
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Census geocoder failed (${res.status}): ${detail}`)
  }
  const data = (await res.json()) as {
    result?: { addressMatches?: Array<{ coordinates: { x: number; y: number }; matchedAddress: string }> }
  }
  const first = data.result?.addressMatches?.[0]
  if (!first) return null
  return { lat: first.coordinates.y, lng: first.coordinates.x, displayName: first.matchedAddress }
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

    let match: Match | null
    let approximate = false
    try {
      match = await lookupNominatim(query)

      // A specific house number is often missing from OSM's point data even
      // when the surrounding streets are well-mapped. The Census geocoder
      // interpolates along known address ranges instead, so it can resolve
      // exactly this case for US addresses — but only for queries that are
      // actually a street address; it will never match a venue name, so
      // skip it there instead of burning a slow, guaranteed-empty request.
      if (!match && looksLikeStreetAddress(query)) {
        match = await lookupCensus(query).catch((err) => {
          console.error('Census geocoder lookup failed:', err instanceof Error ? err.message : err)
          return null
        })
      }

      // Still nothing precise — fall back to city/state/zip only, which
      // beats reporting "not found" for an address that's perfectly real.
      if (!match) {
        const fallback = withoutStreetPart(query)
        if (fallback) {
          match = await lookupNominatim(fallback)
          approximate = match !== null
        }
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      return new Response(JSON.stringify({ error: 'Geocoding failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!match) {
      return new Response(JSON.stringify({ lat: null, lng: null, displayName: null, approximate: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { lat, lng, displayName } = match

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
