import { describe, expect, it } from 'vitest'
import { milestoneAge, occurrencesInRange } from './recurrence'
import type { Item } from './types'

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'test',
    household_id: 'h1',
    title: 'Test',
    category: 'chore',
    starts_on: '2026-01-01',
    start_time: null,
    who: null,
    notes: null,
    location: null,
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

describe('occurrencesInRange — none', () => {
  it('returns the single date only when it falls in range', () => {
    const item = makeItem({ starts_on: '2026-03-10' })
    expect(occurrencesInRange(item, '2026-03-01', '2026-03-31')).toEqual(['2026-03-10'])
    expect(occurrencesInRange(item, '2026-04-01', '2026-04-30')).toEqual([])
  })
})

describe('occurrencesInRange — daily', () => {
  it('steps every N days from the anchor', () => {
    const item = makeItem({ starts_on: '2026-01-01', repeat_freq: 'daily', repeat_interval: 3 })
    expect(occurrencesInRange(item, '2026-01-01', '2026-01-10')).toEqual([
      '2026-01-01',
      '2026-01-04',
      '2026-01-07',
      '2026-01-10',
    ])
  })

  it('aligns correctly when the range starts after the anchor', () => {
    const item = makeItem({ starts_on: '2026-01-01', repeat_freq: 'daily', repeat_interval: 3 })
    expect(occurrencesInRange(item, '2026-01-05', '2026-01-11')).toEqual(['2026-01-07', '2026-01-10'])
  })
})

describe('occurrencesInRange — weekly', () => {
  it('clean the bathrooms every Saturday', () => {
    const item = makeItem({
      starts_on: '2026-01-03', // a Saturday
      repeat_freq: 'weekly',
      repeat_weekdays: [6],
    })
    expect(occurrencesInRange(item, '2026-01-01', '2026-01-31')).toEqual([
      '2026-01-03',
      '2026-01-10',
      '2026-01-17',
      '2026-01-24',
      '2026-01-31',
    ])
  })

  it('supports multiple weekdays and an interval (every 2 weeks)', () => {
    const item = makeItem({
      starts_on: '2026-01-04', // Sunday
      repeat_freq: 'weekly',
      repeat_interval: 2,
      repeat_weekdays: [0, 3], // Sun + Wed
    })
    const result = occurrencesInRange(item, '2026-01-01', '2026-01-31')
    // Week of Jan 4 (week 0): Sun Jan4, Wed Jan7. Week of Jan 11 (week 1): skipped.
    // Week of Jan 18 (week 2): Sun Jan18, Wed Jan21.
    expect(result).toEqual(['2026-01-04', '2026-01-07', '2026-01-18', '2026-01-21'])
  })

  it('defaults to the anchor weekday when repeat_weekdays is unset', () => {
    const item = makeItem({ starts_on: '2026-01-06', repeat_freq: 'weekly' }) // Tuesday
    expect(occurrencesInRange(item, '2026-01-01', '2026-01-31')).toEqual([
      '2026-01-06',
      '2026-01-13',
      '2026-01-20',
      '2026-01-27',
    ])
  })
})

describe('occurrencesInRange — monthly', () => {
  it('change the AC filter on the 5th of every month', () => {
    const item = makeItem({ starts_on: '2026-01-05', repeat_freq: 'monthly' })
    expect(occurrencesInRange(item, '2026-01-01', '2026-06-30')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
      '2026-05-05',
      '2026-06-05',
    ])
  })

  it('clamps the 31st to the last day of short months', () => {
    const item = makeItem({ starts_on: '2026-01-31', repeat_freq: 'monthly' })
    expect(occurrencesInRange(item, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('respects an interval of every 2 months', () => {
    const item = makeItem({ starts_on: '2026-01-15', repeat_freq: 'monthly', repeat_interval: 2 })
    expect(occurrencesInRange(item, '2026-01-01', '2026-06-30')).toEqual([
      '2026-01-15',
      '2026-03-15',
      '2026-05-15',
    ])
  })

  it('respects repeat_until', () => {
    const item = makeItem({
      starts_on: '2026-01-05',
      repeat_freq: 'monthly',
      repeat_until: '2026-03-05',
    })
    expect(occurrencesInRange(item, '2026-01-01', '2026-06-30')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
    ])
  })
})

describe('occurrencesInRange — yearly', () => {
  it('my birthday is January 14', () => {
    const item = makeItem({ starts_on: '2020-01-14', category: 'milestone', repeat_freq: 'yearly' })
    expect(occurrencesInRange(item, '2026-01-01', '2028-12-31')).toEqual([
      '2026-01-14',
      '2027-01-14',
      '2028-01-14',
    ])
  })

  it('falls back to Feb 28 in non-leap years for a Feb 29 anchor', () => {
    const item = makeItem({ starts_on: '2020-02-29', category: 'milestone', repeat_freq: 'yearly' })
    expect(occurrencesInRange(item, '2026-01-01', '2026-12-31')).toEqual(['2026-02-28'])
    expect(occurrencesInRange(item, '2028-01-01', '2028-12-31')).toEqual(['2028-02-29'])
  })
})

describe('milestoneAge', () => {
  it('computes age from the anchor year', () => {
    const item = makeItem({ starts_on: '2022-06-01', category: 'milestone', repeat_freq: 'yearly' })
    expect(milestoneAge(item, '2026-06-01')).toBe(4)
  })
})
