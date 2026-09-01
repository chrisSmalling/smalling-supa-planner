import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  addMonthsISO,
  formatISO,
  formatTime,
  isSameMonth,
  monthGridISO,
  parseISO,
  startOfMonthISO,
  startOfWeekISO,
  weekDatesISO,
} from './dateUtils'

describe('parseISO / formatISO', () => {
  it('round-trips a date string', () => {
    expect(formatISO(parseISO('2026-03-15'))).toBe('2026-03-15')
  })
})

describe('addDaysISO', () => {
  it('adds days within a month', () => {
    expect(addDaysISO('2026-03-15', 5)).toBe('2026-03-20')
  })

  it('crosses a month boundary', () => {
    expect(addDaysISO('2026-03-30', 5)).toBe('2026-04-04')
  })

  it('crosses a year boundary', () => {
    expect(addDaysISO('2025-12-30', 5)).toBe('2026-01-04')
  })

  it('supports negative deltas', () => {
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('startOfWeekISO (WEEK_START = Sunday)', () => {
  it('a Wednesday rolls back to the preceding Sunday', () => {
    expect(startOfWeekISO('2026-03-18')).toBe('2026-03-15') // Wed -> Sun
  })

  it('a Sunday is its own week start', () => {
    expect(startOfWeekISO('2026-03-15')).toBe('2026-03-15')
  })
})

describe('weekDatesISO', () => {
  it('returns 7 consecutive dates starting from the given date', () => {
    expect(weekDatesISO('2026-03-15')).toEqual([
      '2026-03-15',
      '2026-03-16',
      '2026-03-17',
      '2026-03-18',
      '2026-03-19',
      '2026-03-20',
      '2026-03-21',
    ])
  })
})

describe('startOfMonthISO / addMonthsISO', () => {
  it('finds the first of the month', () => {
    expect(startOfMonthISO('2026-03-18')).toBe('2026-03-01')
  })

  it('adds months and normalizes to the 1st', () => {
    expect(addMonthsISO('2026-03-18', 1)).toBe('2026-04-01')
    expect(addMonthsISO('2026-01-15', -1)).toBe('2025-12-01')
  })
})

describe('monthGridISO', () => {
  it('returns a 42-day grid starting on a Sunday', () => {
    const grid = monthGridISO('2026-03-18')
    expect(grid).toHaveLength(42)
    expect(parseISO(grid[0]).getUTCDay()).toBe(0)
    // The grid must fully contain the month (Mar 2026 has 31 days).
    expect(grid).toContain('2026-03-01')
    expect(grid).toContain('2026-03-31')
  })
})

describe('isSameMonth', () => {
  it('matches dates in the same month/year', () => {
    expect(isSameMonth('2026-03-01', '2026-03-31')).toBe(true)
    expect(isSameMonth('2026-02-28', '2026-03-01')).toBe(false)
    expect(isSameMonth('2025-03-15', '2026-03-15')).toBe(false)
  })
})

describe('formatTime', () => {
  it('formats midnight and noon correctly', () => {
    expect(formatTime('00:00')).toBe('12 AM')
    expect(formatTime('12:00')).toBe('12 PM')
  })

  it('formats a non-zero minute', () => {
    expect(formatTime('14:30')).toBe('2:30 PM')
  })

  it('returns null for no time', () => {
    expect(formatTime(null)).toBeNull()
  })
})
