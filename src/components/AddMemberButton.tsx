import * as React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

/** Adds a household member with no login of their own — a kid, so they can be assigned items. */
export function AddMemberButton({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await supabase.rpc('add_household_member', { display_name: name })
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
