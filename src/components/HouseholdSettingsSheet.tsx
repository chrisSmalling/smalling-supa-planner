import * as React from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHousehold } from '@/contexts/HouseholdContext'
import { geocodeLocation } from '@/lib/geocode'

interface HouseholdSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Home address is the "leave by" feature's starting point — set once, used to estimate drive time to every item that has a location. */
export function HouseholdSettingsSheet({ open, onOpenChange }: HouseholdSettingsSheetProps) {
  const { household, updateHousehold } = useHousehold()
  const [address, setAddress] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) setAddress(household?.home_address ?? '')
  }, [open, household?.home_address])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const trimmed = address.trim()
      if (!trimmed) {
        await updateHousehold({ home_address: null, home_lat: null, home_lng: null })
        onOpenChange(false)
        return
      }
      const coords = await geocodeLocation(trimmed)
      if (!coords) {
        setError("Couldn't find that address — try adding city and state.")
        return
      }
      await updateHousehold({ home_address: trimmed, home_lat: coords.lat, home_lng: coords.lng })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save home address')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>Settings</SheetTitle>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="home-address">Home address</Label>
            <Input
              id="home-address"
              placeholder="123 Main St, Anytown, FL"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used to estimate drive time and show a "leave by" time on items that have a location.
              Nothing is sent anywhere except a free, open geocoding lookup for this address.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
