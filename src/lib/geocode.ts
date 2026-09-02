import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface Coords {
  lat: number
  lng: number
}

export interface GeocodeMatch extends Coords {
  /** What Nominatim actually matched, e.g. "17735 Pleasantview Blvd, Broadview Heights, OH 44147, USA". A bare street address with no city/state is ambiguous — show this back before trusting it, since Nominatim will still confidently return its single best (possibly wrong-state) guess. */
  displayName: string | null
  /** True if the exact street address wasn't found and this falls back to a city/state/zip-level match — close, not precise. */
  approximate: boolean
}

/**
 * Resolves a free-text location to coordinates via the geocode Edge
 * Function (Nominatim, cached in the geocode_cache table). Returns null if
 * nothing was found or the location text is empty; throws with a readable
 * message on an actual failure (network, upstream error) so callers can
 * surface it.
 *
 * `near` (the household's home coordinates) restricts the first search
 * attempt to a home-region box before falling back to an unrestricted
 * global search — a generic name ("Playground", "Chipotle") otherwise has
 * no geography of its own and can match a same-named place anywhere on
 * Earth. Omit it only when there's no home location yet (e.g. geocoding the
 * home address itself in Settings).
 */
export async function geocodeLocation(query: string, near?: Coords): Promise<GeocodeMatch | null> {
  if (!query.trim()) return null
  try {
    const { data, error } = await supabase.functions.invoke<{
      lat: number | null
      lng: number | null
      displayName: string | null
      approximate: boolean
    }>('geocode', { body: { query, near } })
    if (error) throw error
    if (data?.lat == null || data?.lng == null) return null
    return { lat: data.lat, lng: data.lng, displayName: data.displayName, approximate: data.approximate }
  } catch (err) {
    if (err instanceof FunctionsHttpError) {
      try {
        const body = await err.context.json()
        throw new Error(body?.error ?? err.message)
      } catch {
        throw new Error(err.message)
      }
    }
    throw err
  }
}
