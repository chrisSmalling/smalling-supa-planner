import * as React from 'react'
import { supabase } from '@/lib/supabase'
import type { Item, ItemStatus, ItemStatusValue, NewItem } from '@/lib/types'

/**
 * Loads every item + item_status row for the household once, then refetches
 * on window focus / visibilitychange (per spec: no Realtime — two people in
 * one house re-opening the app is enough). Writes are applied to local state
 * immediately, then sent to Supabase; a failed write rolls the local change back.
 */
export function useItems(householdId: string | null) {
  const [items, setItems] = React.useState<Item[]>([])
  const [statuses, setStatuses] = React.useState<ItemStatus[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const itemsRef = React.useRef(items)
  itemsRef.current = items
  const statusesRef = React.useRef(statuses)
  statusesRef.current = statuses

  const refresh = React.useCallback(async () => {
    if (!householdId) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const [itemsRes, statusRes] = await Promise.all([
        supabase.from('items').select('*').eq('household_id', householdId),
        supabase
          .from('item_status')
          .select('*, items!inner(household_id)')
          .eq('items.household_id', householdId),
      ])
      if (itemsRes.error) throw itemsRes.error
      setItems(itemsRes.data as unknown as Item[])

      if (statusRes.error) throw statusRes.error
      setStatuses(statusRes.data as unknown as ItemStatus[])
    } catch (err) {
      // A thrown network error (offline, DNS, blocked host) must not leave
      // the app stuck on a loading spinner forever.
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [householdId])

  React.useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  React.useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const createItem = React.useCallback(
    async (input: NewItem, createdBy: string | null) => {
      if (!householdId) return
      const optimistic: Item = {
        ...input,
        id: crypto.randomUUID(),
        household_id: householdId,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      }
      setItems((prev) => [...prev, optimistic])

      const { data, error } = await supabase
        .from('items')
        .insert({ ...input, id: optimistic.id, household_id: householdId, created_by: createdBy })
        .select()
        .single()

      if (error) {
        setError(error.message)
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
        return null
      }
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? (data as unknown as Item) : i)))
      return data as unknown as Item
    },
    [householdId],
  )

  const updateItem = React.useCallback(async (id: string, patch: Partial<NewItem>) => {
    const previous = itemsRef.current.find((i) => i.id === id)
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    const { error } = await supabase.from('items').update(patch).eq('id', id)
    if (error) {
      setError(error.message)
      if (previous) setItems((prev) => prev.map((i) => (i.id === id ? previous : i)))
    }
  }, [])

  const deleteItem = React.useCallback(async (id: string) => {
    const previous = itemsRef.current
    setItems((prev) => prev.filter((i) => i.id !== id))
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setItems(previous)
    }
  }, [])

  /** status = null clears any done/skipped state for that occurrence. */
  const setOccurrenceStatus = React.useCallback(
    async (itemId: string, occurrenceDate: string, status: ItemStatusValue | null, by: string | null) => {
      const previous = statusesRef.current
      if (status === null) {
        setStatuses((prev) => prev.filter((s) => !(s.item_id === itemId && s.occurrence_date === occurrenceDate)))
        const { error } = await supabase
          .from('item_status')
          .delete()
          .eq('item_id', itemId)
          .eq('occurrence_date', occurrenceDate)
        if (error) {
          setError(error.message)
          setStatuses(previous)
        }
        return
      }

      const optimistic: ItemStatus = {
        id: crypto.randomUUID(),
        item_id: itemId,
        occurrence_date: occurrenceDate,
        status,
        by,
        at: new Date().toISOString(),
      }
      setStatuses((prev) => [
        ...prev.filter((s) => !(s.item_id === itemId && s.occurrence_date === occurrenceDate)),
        optimistic,
      ])

      const { data, error } = await supabase
        .from('item_status')
        .upsert(
          { item_id: itemId, occurrence_date: occurrenceDate, status, by },
          { onConflict: 'item_id,occurrence_date' },
        )
        .select()
        .single()

      if (error) {
        setError(error.message)
        setStatuses(previous)
      } else if (data) {
        setStatuses((prev) =>
          prev.map((s) => (s.id === optimistic.id ? (data as unknown as ItemStatus) : s)),
        )
      }
    },
    [],
  )

  return { items, statuses, loading, error, refresh, createItem, updateItem, deleteItem, setOccurrenceStatus }
}
