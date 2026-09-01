import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Shown once, right after sign-up: create a new household or join one with the other parent's invite code. */
export function Onboarding() {
  const { refreshProfile, signOut } = useAuth()
  const [tab, setTab] = React.useState<'create' | 'join'>('create')
  const [displayName, setDisplayName] = React.useState('')
  const [householdName, setHouseholdName] = React.useState('')
  const [inviteCode, setInviteCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (tab === 'create') {
        const { error } = await supabase.rpc('create_household', {
          household_name: householdName,
          display_name: displayName,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('join_household', {
          target_household_id: inviteCode.trim(),
          display_name: displayName,
        })
        if (error) throw error
      }
      await refreshProfile()
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
          <h1 className="text-xl font-semibold">Set up your household</h1>
          <p className="text-sm text-muted-foreground">
            One household, shared by both parents. Create it once, then have the other parent join.
          </p>
        </div>

        <div className="flex rounded-md border border-input p-1">
          <button
            type="button"
            className={`flex-1 rounded-sm py-1.5 text-sm ${tab === 'create' ? 'bg-primary text-primary-foreground' : ''}`}
            onClick={() => setTab('create')}
          >
            Create household
          </button>
          <button
            type="button"
            className={`flex-1 rounded-sm py-1.5 text-sm ${tab === 'join' ? 'bg-primary text-primary-foreground' : ''}`}
            onClick={() => setTab('join')}
          >
            Join with code
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {tab === 'create' ? (
            <div className="space-y-1.5">
              <Label htmlFor="householdName">Household name</Label>
              <Input
                id="householdName"
                required
                placeholder="The Smallings"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="inviteCode">Invite code</Label>
              <Input
                id="inviteCode"
                required
                placeholder="Paste the household ID from your partner"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {tab === 'create' ? 'Create household' : 'Join household'}
          </Button>
        </form>

        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => signOut()}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
