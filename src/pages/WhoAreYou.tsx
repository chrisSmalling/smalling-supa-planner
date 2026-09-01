import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/contexts/HouseholdContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Profile } from '@/lib/types'

/**
 * Shown once per device (result is saved to localStorage): pick who's using
 * this phone, so items created here are attributed to the right person.
 * Not a security gate — every device already has full access to the data.
 */
export function WhoAreYou({ onPick }: { onPick: (person: Profile) => void }) {
  const { household, members, refresh } = useHousehold()
  const [newName, setNewName] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function handleAddSelf(e: React.FormEvent) {
    e.preventDefault()
    if (!household || !newName.trim()) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({ household_id: household.id, display_name: newName.trim() })
        .select()
        .single()
      if (!error && data) {
        await refresh()
        onPick(data as Profile)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Who's this?</h1>
          <p className="text-sm text-muted-foreground">Just for this device — so items get attributed to the right person.</p>
        </div>

        {members.length > 0 && (
          <div className="space-y-2">
            {members.map((person) => (
              <Button key={person.id} variant="outline" className="w-full" onClick={() => onPick(person)}>
                {person.display_name}
              </Button>
            ))}
          </div>
        )}

        <form onSubmit={handleAddSelf} className="flex gap-2">
          <Input placeholder="Add a new name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" disabled={busy || !newName.trim()}>
            Add
          </Button>
        </form>
      </div>
    </div>
  )
}
