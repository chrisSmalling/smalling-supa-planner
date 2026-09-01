import * as React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

/** Adds a household member (e.g. a kid) so they can be assigned items via `who`. */
export function AddMemberButton({ householdId, onAdded }: { householdId: string | null; onAdded: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!householdId) return
    setBusy(true)
    try {
      const { error } = await supabase.from('profiles').insert({ household_id: householdId, display_name: name })
      if (!error) {
        setName('')
        setOpen(false)
        onAdded()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        + Person
      </Button>
      <DialogContent>
        <DialogTitle>Add a household member</DialogTitle>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">Name</Label>
            <Input id="member-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
