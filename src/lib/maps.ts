/**
 * A universal Google Maps search link — works with no API key, and opens
 * the Google Maps app on a phone that has it installed (falls back to the
 * web on desktop or without the app).
 */
export function googleMapsSearchUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}
