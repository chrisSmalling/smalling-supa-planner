import { occurrencesInRange } from './recurrence'
import type { Item, ItemStatus, ItemStatusValue } from './types'

export interface EnrichedOccurrence {
  item: Item
  date: string
  status: ItemStatusValue | null
}

/** Expands every item into its occurrences within [from, to], each carrying its done/skipped state for that date. */
export function buildOccurrences(items: Item[], statuses: ItemStatus[], from: string, to: string): EnrichedOccurrence[] {
  const statusByKey = new Map<string, ItemStatusValue>()
  for (const s of statuses) statusByKey.set(`${s.item_id}:${s.occurrence_date}`, s.status)

  const result: EnrichedOccurrence[] = []
  for (const item of items) {
    for (const date of occurrencesInRange(item, from, to)) {
      result.push({ item, date, status: statusByKey.get(`${item.id}:${date}`) ?? null })
    }
  }
  return result
}

export function groupByDate(occurrences: EnrichedOccurrence[]): Map<string, EnrichedOccurrence[]> {
  const map = new Map<string, EnrichedOccurrence[]>()
  for (const occ of occurrences) {
    const list = map.get(occ.date)
    if (list) list.push(occ)
    else map.set(occ.date, [occ])
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.item.start_time ?? '99:99').localeCompare(b.item.start_time ?? '99:99'))
  }
  return map
}
