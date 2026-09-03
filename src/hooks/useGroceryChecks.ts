import * as React from 'react'
import { supabase } from '@/lib/supabase'

/** Which ingredients (by normalized key) are checked off for one household's week. Mirrors item_status: a row's existence means "checked." */
export function useGroceryChecks(householdId: string | null, weekStart: string) {
  const [checked, setChecked] = React.useState<Set<string>>(new Set())
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    if (!householdId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('grocery_checks')
      .select('ingredient')
      .eq('household_id', householdId)
      .eq('week_start', weekStart)
    if (!error && data) setChecked(new Set(data.map((row) => row.ingredient as string)))
    setLoading(false)
  }, [householdId, weekStart])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const toggle = React.useCallback(
    async (key: string, isChecked: boolean) => {
      if (!householdId) return
      setChecked((prev) => {
        const next = new Set(prev)
        if (isChecked) next.add(key)
        else next.delete(key)
        return next
      })

      if (isChecked) {
        await supabase
          .from('grocery_checks')
          .upsert(
            { household_id: householdId, week_start: weekStart, ingredient: key },
            { onConflict: 'household_id,week_start,ingredient' },
          )
      } else {
        await supabase
          .from('grocery_checks')
          .delete()
          .eq('household_id', householdId)
          .eq('week_start', weekStart)
          .eq('ingredient', key)
      }
    },
    [householdId, weekStart],
  )

  return { checked, loading, toggle }
}
