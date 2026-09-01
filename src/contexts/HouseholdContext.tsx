import * as React from 'react'
import { supabase } from '@/lib/supabase'
import type { Household, Profile } from '@/lib/types'

interface HouseholdState {
  household: Household | null
  members: Profile[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const HouseholdContext = React.createContext<HouseholdState | null>(null)

/**
 * There's no login, so there's no "my household" — just the one household
 * this app talks to. Loads it (and its members) once, exposes a refresh.
 */
export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [household, setHousehold] = React.useState<Household | null>(null)
  const [members, setMembers] = React.useState<Profile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setError(null)
    try {
      const { data: households, error: householdsError } = await supabase
        .from('households')
        .select('*')
        .order('created_at')
        .limit(1)
      if (householdsError) throw householdsError

      const found = (households as Household[] | null)?.[0] ?? null
      setHousehold(found)

      if (found) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .eq('household_id', found.id)
          .order('created_at')
        if (profilesError) throw profilesError
        setMembers((profiles as Profile[] | null) ?? [])
      } else {
        setMembers([])
      }
    } catch (err) {
      // A thrown network error (offline, DNS, blocked host) must not leave
      // the app stuck on a loading spinner forever.
      setError(err instanceof Error ? err.message : 'Failed to load household')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <HouseholdContext.Provider value={{ household, members, loading, error, refresh }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = React.useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
