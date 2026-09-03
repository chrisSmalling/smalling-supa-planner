import { describe, expect, it } from 'vitest'
import { buildGroceryList } from './groceryList'
import type { Item, ItemStatus } from './types'

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'item-1',
    household_id: 'h1',
    title: 'Test',
    category: 'meal',
    starts_on: '2026-03-01',
    start_time: null,
    who: null,
    notes: null,
    location: null,
    location_lat: null,
    location_lng: null,
    subtasks: null,
    repeat_freq: 'none',
    repeat_interval: 1,
    repeat_weekdays: null,
    repeat_until: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildGroceryList', () => {
  it('dedupes an ingredient shared by two meals and lists both meal names', () => {
    const tacos = makeItem({
      id: 'tacos',
      title: 'Tacos',
      starts_on: '2026-03-02',
      subtasks: [{ text: 'Cheese', done: false }, { text: 'Tortillas', done: false }],
    })
    const nachos = makeItem({
      id: 'nachos',
      title: 'Nachos',
      starts_on: '2026-03-04',
      subtasks: [{ text: 'cheese', done: false }, { text: 'Chips', done: false }],
    })

    const result = buildGroceryList([tacos, nachos], [], '2026-03-01', '2026-03-07')

    const cheese = result.find((r) => r.key === 'cheese')
    expect(cheese?.meals).toEqual(['Tacos', 'Nachos'])
    expect(result.map((r) => r.text).sort()).toEqual(['Cheese', 'Chips', 'Tortillas'])
  })

  it('counts a recurring meal only once even with multiple occurrences in range', () => {
    const item = makeItem({
      repeat_freq: 'weekly',
      repeat_weekdays: [0],
      subtasks: [{ text: 'Eggs', done: false }],
    })
    const result = buildGroceryList([item], [], '2026-03-01', '2026-03-31')
    expect(result).toEqual([{ key: 'eggs', text: 'Eggs', meals: ['Test'] }])
  })

  it('excludes a meal occurrence that was skipped for every date it lands on', () => {
    const item = makeItem({ starts_on: '2026-03-03', subtasks: [{ text: 'Milk', done: false }] })
    const statuses: ItemStatus[] = [
      { id: 's1', item_id: item.id, occurrence_date: '2026-03-03', status: 'skipped', by: null, at: '' },
    ]
    expect(buildGroceryList([item], statuses, '2026-03-01', '2026-03-07')).toEqual([])
  })

  it('ignores non-meal categories and meals with no ingredients', () => {
    const chore = makeItem({ category: 'chore', subtasks: [{ text: 'Trash bags', done: false }] })
    const emptyMeal = makeItem({ id: 'm2', category: 'meal', subtasks: [] })
    expect(buildGroceryList([chore, emptyMeal], [], '2026-03-01', '2026-03-07')).toEqual([])
  })
})
