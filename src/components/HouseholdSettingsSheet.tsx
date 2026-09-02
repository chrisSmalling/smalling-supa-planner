import * as React from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHousehold } from '@/contexts/HouseholdContext'
import { geocodeLocation } from '@/lib/geocode'
import type { GeocodeMatch } from '@/lib/geocode'

interface HouseholdSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Home address is the "leave by" feature's starting point — set once, used
 * to estimate drive time to every item that has a location. A bare street
 * address is ambiguous (a real bug here: "17735 Pleasantview Blvd" with no
 * city/state silently matched a same-named street in a different state), so
 * this shows back exactly what Nominatim resolved before saving it — never
 * trust the first geocode match blindly.
 */
export function HouseholdSettingsSheet({ open, onOpenChange }: HouseholdSettingsSheetProps) {
  const { household, updateHousehold } = useHousehold()
  const [address, setAddress] = React.useState('')
  const [match, setMatch] = React.useState<GeocodeMatch | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setAddress(household?.home_address ?? '')
      setMatch(null)
      setError(null)
    }
  }, [open, household?.home_address])

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = address.trim()
    if (!trimmed) {
      await updateHousehold({ home_address: null, home_lat: null, home_lng: null })
      onOpenChange(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const found = await geocodeLocation(trimmed)
      if (!found) {
        setError("Couldn't find that address — try adding city, state, and zip.")
        return
      }
      setMatch(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to look up that address')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!match) return
    setBusy(true)
    try {
      await updateHousehold({ home_address: address.trim(), home_lat: match.lat, home_lng: match.lng })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save home address')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>Settings</SheetTitle>

        {match ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Is this your home?</Label>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">{match.displayName ?? address}</div>
              <p className="text-xs text-muted-foreground">
                {match.approximate
                  ? "Couldn't find that exact street address — this is the city center instead, close enough for drive-time estimates but not pinpoint."
                  : 'A street address alone can match the wrong city or state — double-check this before saving.'}
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setMatch(null)} disabled={busy}>
                No, let me fix it
              </Button>
              <Button type="button" className="flex-1" onClick={handleConfirm} disabled={busy}>
                Yes, that's it
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLookup} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="home-address">Home address</Label>
              <Input
                id="home-address"
                placeholder="123 Main St, Anytown, FL 12345"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include city, state, and zip — a bare street address can match the wrong place. Used to estimate
                drive time and show a "leave by" time on items that have a location.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Looking up…' : 'Look up address'}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
