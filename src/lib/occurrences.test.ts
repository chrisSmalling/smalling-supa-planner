import { describe, expect, it } from 'vitest'
import { buildOccurrences, groupByDate } from './occurrences'
import type { Item, ItemStatus } from './types'

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'item-1',
    household_id: 'h1',
    title: 'Test',
    category: 'chore',
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

function makeStatus(overrides: Partial<ItemStatus>): ItemStatus {
  return {
    id: 'status-1',
    item_id: 'item-1',
    occurrence_date: '2026-03-01',
    status: 'done',
    by: null,
    at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildOccurrences', () => {
  it('expands a repeating item and attaches its status per date', () => {
    const item = makeItem({ repeat_freq: 'weekly', repeat_weekdays: [0] }) // Sundays
    const statuses = [makeStatus({ occurrence_date: '2026-03-08', status: 'done' })]

    const result = buildOccurrences([item], statuses, '2026-03-01', '2026-03-15')

    expect(result.map((o) => o.date)).toEqual(['2026-03-01', '2026-03-08', '2026-03-15'])
    expect(result.find((o) => o.date === '2026-03-08')?.status).toBe('done')
    expect(result.find((o) => o.date === '2026-03-01')?.status).toBeNull()
  })

  it('returns nothing for items entirely outside the range', () => {
    const item = makeItem({ starts_on: '2026-01-01' })
    expect(buildOccurrences([item], [], '2026-03-01', '2026-03-31')).toEqual([])
  })
})

describe('groupByDate', () => {
  it('groups occurrences by date and sorts each day by start_time', () => {
    const itemLate = makeItem({ id: 'late', starts_on: '2026-03-01', start_time: '15:00' })
    const itemEarly = makeItem({ id: 'early', starts_on: '2026-03-01', start_time: '08:00' })
    const itemAllDay = makeItem({ id: 'allday', starts_on: '2026-03-01', start_time: null })

    const occurrences = buildOccurrences([itemLate, itemEarly, itemAllDay], [], '2026-03-01', '2026-03-01')
    const grouped = groupByDate(occurrences)

    expect(grouped.get('2026-03-01')?.map((o) => o.item.id)).toEqual(['early', 'late', 'allday'])
  })

  it('keeps separate days as separate map entries', () => {
    const item = makeItem({ repeat_freq: 'daily' })
    const occurrences = buildOccurrences([item], [], '2026-03-01', '2026-03-03')
    const grouped = groupByDate(occurrences)
    expect([...grouped.keys()]).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
  })
})
