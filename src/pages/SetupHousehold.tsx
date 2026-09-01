import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/contexts/HouseholdContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Shown once, the very first time the app is opened: there's no login, so this just names the one household. */
export function SetupHousehold() {
  const { refresh } = useHousehold()
  const [householdName, setHouseholdName] = React.useState('')
  const [displayName, setDisplayName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({ name: householdName })
        .select()
        .single()
      if (householdError) throw householdError

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ household_id: household.id, display_name: displayName })
      if (profileError) throw profileError

      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Superplan</h1>
          <p className="text-sm text-muted-foreground">
            Let's set up your household. Open this same link on your partner's phone afterward —
            no account needed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="householdName">Household name</Label>
            <Input
              id="householdName"
              required
              autoFocus
              placeholder="The Smallings"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Your name</Label>
            <Input
              id="displayName"
              required
              placeholder="Dad, Mom, ..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            Create household
          </Button>
        </form>
      </div>
    </div>
  )
}
