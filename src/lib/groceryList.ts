import { buildOccurrences } from './occurrences'
import type { Item, ItemStatus } from './types'

export interface GroceryIngredient {
  key: string // normalized (trimmed, lowercased) — also the persistence key in grocery_checks
  text: string // display text, first-seen casing
  meals: string[] // distinct meal titles that call for it, for context under the line
}

/**
 * Aggregates ingredient checklist lines off every meal item occurring in
 * [from, to] into one deduped shopping list. A meal skipped on a given date
 * doesn't contribute its ingredients for that occurrence, but a recurring
 * meal is only ever counted once even if it lands on multiple days in range.
 */
export function buildGroceryList(items: Item[], statuses: ItemStatus[], from: string, to: string): GroceryIngredient[] {
  const meals = items.filter((item) => item.category === 'meal' && item.subtasks && item.subtasks.length > 0)
  const occurrences = buildOccurrences(meals, statuses, from, to).filter((occ) => occ.status !== 'skipped')

  const byKey = new Map<string, GroceryIngredient>()
  const countedItemsByKey = new Map<string, Set<string>>()

  for (const occ of occurrences) {
    for (const subtask of occ.item.subtasks ?? []) {
      const text = subtask.text.trim()
      if (!text) continue
      const key = text.toLowerCase()

      const countedItems = countedItemsByKey.get(key) ?? new Set<string>()
      countedItemsByKey.set(key, countedItems)
      if (countedItems.has(occ.item.id)) continue
      countedItems.add(occ.item.id)

      const existing = byKey.get(key)
      if (existing) {
        if (!existing.meals.includes(occ.item.title)) existing.meals.push(occ.item.title)
      } else {
        byKey.set(key, { key, text, meals: [occ.item.title] })
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.text.localeCompare(b.text))
}
