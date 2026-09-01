import * as React from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

/** Every person in the household who can be assigned an item — parents and kids alike. */
export function useHouseholdMembers() {
  const [members, setMembers] = React.useState<Profile[]>([])
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at')
    if (!error) setMembers((data as Profile[] | null) ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return { members, loading, refresh }
}
