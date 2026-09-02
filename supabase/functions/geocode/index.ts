// Supabase Edge Function (Deno). Turns a free-text location ("Magic Kingdom,
// Orlando, FL") into a lat/lng — no API key, no billing. Tries, in order:
//   1. Nominatim (OpenStreetMap), restricted to a box around the household's
//      home (if known) — a generic term like "Playground" or "Chipotle" has
//      no geography of its own, so without this it can match any
//      same-named place on Earth (confirmed: "Playground" -> Wisconsin,
//      "Chipotle" -> Colorado, for a Florida household — all three states
//      away). Most quick-add locations are local, so try local first.
//   2. Nominatim again with no geographic restriction, for a query that
//      genuinely refers to somewhere far away (a trip, a relative's house)
//      and so isn't found in the home-region box.
//   3. The US Census Bureau's geocoder, which interpolates an exact house
//      number along a street from TIGER/Line address ranges even when OSM
//      has no point for it — US addresses only, but free and unlimited.
//   4. Nominatim again with the street part dropped (city/state/zip only),
//      flagged "approximate" — better than reporting "not found" for an
//      address that's perfectly real but under-mapped.
// Results are cached in geocode_cache (keyed by normalized query) so the
// same address never re-triggers this chain, per Nominatim's usage policy
// (it's a shared public service, not meant for repeated identical lookups).
// The cache key doesn't include the home-bias point — fine for a
// single-household app where that point never changes, but would need
// revisiting if this ever served more than one household.

import { createClient } from 'npm:@supabase/supabase-js@2'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress'
// Nominatim's usage policy requires a descriptive User-Agent identifying the
// application (and ideally a way to contact its maintainer) — anonymous or
// browser-default User-Agents get blocked.
const USER_AGENT = 'Superplan-Household-Planner/1.0 (+https://github.com/chrisSmalling/smalling-supa-planner)'
// ~1 degree of lat/lng is roughly 70 miles — a generous day-trip radius for
// "local" without being so wide it starts pulling in other metro areas.
const HOME_BIAS_DEGREES = 1

interface Coords {
  lat: number
  lng: number
}

interface Match extends Coords {
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

/**
 * `near` + `bounded` restrict results to a box around a point rather than
 * just nudging the ranking — Nominatim's plain (unbounded) `viewbox` bias is
 * too weak to beat a more "important" same-named place across the country,
 * which is exactly the failure mode this exists to fix.
 */
async function lookupNominatim(q: string, near?: Coords, bounded?: boolean): Promise<Match | null> {
  let url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`
  if (near) {
    const left = near.lng - HOME_BIAS_DEGREES
    const right = near.lng + HOME_BIAS_DEGREES
    const top = near.lat + HOME_BIAS_DEGREES
    const bottom = near.lat - HOME_BIAS_DEGREES
    url += `&viewbox=${left},${top},${right},${bottom}`
    if (bounded) url += '&bounded=1'
  }
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
    const { query, near } = (await req.json()) as { query?: string; near?: Coords }
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
      // Prefer a match near home first — most quick-add locations are local,
      // and a generic name (a park, a gym, a chain restaurant) has no
      // geography of its own to disambiguate it otherwise.
      match = near ? await lookupNominatim(query, near, true) : null

      // Nothing local — this might genuinely be somewhere far away (a trip,
      // a relative's address), so search without restriction.
      if (!match) {
        match = await lookupNominatim(query)
      }

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
