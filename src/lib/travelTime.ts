import type { Coords } from '@/lib/geocode'

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Estimated driving minutes between two points via OSRM's public demo
 * server — free, no API key, but a static road-network estimate with no
 * live traffic data (unlike Google's Distance Matrix). Returns null on any
 * failure rather than throwing: a missing travel-time estimate should never
 * block showing the item itself.
 */
export async function estimateDriveMinutes(origin: Coords, destination: Coords): Promise<number | null> {
  try {
    const url = `${OSRM_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const seconds = data?.routes?.[0]?.duration
    if (typeof seconds !== 'number') return null
    return Math.ceil(seconds / 60)
  } catch {
    return null
  }
}
