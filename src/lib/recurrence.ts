import type { Item } from './types'

/**
 * All dates are plain YYYY-MM-DD strings, handled as UTC-noon Date objects
 * internally so calendar-day arithmetic never shifts across a DST boundary.
 */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysInMonth(year: number, monthIndex0: number): number {
  // Day 0 of the *next* month is the last day of this one.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 12))
}

function clampToDayInMonth(year: number, monthIndex0: number, day: number): Date {
  const clamped = Math.min(day, daysInMonth(year, monthIndex0))
  return new Date(Date.UTC(year, monthIndex0, clamped, 12))
}

/**
 * Computes every date in [from, to] (inclusive) on which `item` occurs.
 * Pure function: no I/O, no materialized rows — this is the whole recurring engine.
 */
export function occurrencesInRange(item: Item, from: string, to: string): string[] {
  const rangeStart = parseDate(from)
  const rangeEnd = parseDate(to)
  if (rangeEnd < rangeStart) return []

  const anchor = parseDate(item.starts_on)
  const until = item.repeat_until ? parseDate(item.repeat_until) : null
  const effectiveEnd = until && until < rangeEnd ? until : rangeEnd
  if (effectiveEnd < rangeStart) return []
  if (anchor > effectiveEnd) return []

  const interval = Math.max(1, item.repeat_interval || 1)
  const dates: string[] = []

  switch (item.repeat_freq) {
    case 'none': {
      if (anchor >= rangeStart && anchor <= effectiveEnd) dates.push(formatDate(anchor))
      break
    }

    case 'daily': {
      const daysFromAnchor = Math.round((rangeStart.getTime() - anchor.getTime()) / 86_400_000)
      let cursor: Date
      if (daysFromAnchor <= 0) {
        cursor = anchor
      } else {
        const stepsNeeded = Math.ceil(daysFromAnchor / interval)
        cursor = addDays(anchor, stepsNeeded * interval)
      }
      while (cursor <= effectiveEnd) {
        if (cursor >= rangeStart) dates.push(formatDate(cursor))
        cursor = addDays(cursor, interval)
      }
      break
    }

    case 'weekly': {
      const weekdays =
        item.repeat_weekdays && item.repeat_weekdays.length > 0
          ? item.repeat_weekdays
          : [anchor.getUTCDay()]

      // Walk day-by-day from the anchor; cheap and immune to week-boundary edge cases.
      let cursor = anchor
      const anchorWeekStart = addDays(anchor, -anchor.getUTCDay())
      while (cursor <= effectiveEnd) {
        if (cursor >= rangeStart && weekdays.includes(cursor.getUTCDay())) {
          const weekStart = addDays(cursor, -cursor.getUTCDay())
          const weeksSinceAnchor = Math.round(
            (weekStart.getTime() - anchorWeekStart.getTime()) / (7 * 86_400_000),
          )
          if (weeksSinceAnchor % interval === 0) dates.push(formatDate(cursor))
        }
        cursor = addDays(cursor, 1)
      }
      break
    }

    case 'monthly': {
      const anchorDay = anchor.getUTCDate()
      let year = anchor.getUTCFullYear()
      let monthIndex0 = anchor.getUTCMonth()
      // Fast-forward to the first month on-or-after rangeStart's month.
      for (;;) {
        const occurrence = clampToDayInMonth(year, monthIndex0, anchorDay)
        if (occurrence >= rangeStart || occurrence > effectiveEnd) break
        monthIndex0 += interval
        year += Math.floor(monthIndex0 / 12)
        monthIndex0 = ((monthIndex0 % 12) + 12) % 12
      }
      for (;;) {
        const occurrence = clampToDayInMonth(year, monthIndex0, anchorDay)
        if (occurrence > effectiveEnd) break
        if (occurrence >= rangeStart && occurrence >= anchor) dates.push(formatDate(occurrence))
        monthIndex0 += interval
        year += Math.floor(monthIndex0 / 12)
        monthIndex0 = ((monthIndex0 % 12) + 12) % 12
      }
      break
    }

    case 'yearly': {
      const anchorMonth0 = anchor.getUTCMonth()
      const anchorDay = anchor.getUTCDate()
      const isFeb29 = anchorMonth0 === 1 && anchorDay === 29
      let year = anchor.getUTCFullYear()
      // Fast-forward to on-or-after rangeStart.getUTCFullYear(), respecting interval.
      const yearsToStart = Math.max(0, rangeStart.getUTCFullYear() - year)
      year += Math.floor(yearsToStart / interval) * interval
      for (;;) {
        const day = isFeb29 && !isLeapYear(year) ? 28 : anchorDay
        const occurrence = new Date(Date.UTC(year, anchorMonth0, day, 12))
        if (occurrence > effectiveEnd) break
        if (occurrence >= rangeStart && occurrence >= anchor) dates.push(formatDate(occurrence))
        year += interval
      }
      break
    }
  }

  return dates
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** For a milestone whose starts_on year is the real birth/anniversary year. */
export function milestoneAge(item: Item, occurrenceDate: string): number | null {
  const anchorYear = parseDate(item.starts_on).getUTCFullYear()
  const occurrenceYear = parseDate(occurrenceDate).getUTCFullYear()
  const age = occurrenceYear - anchorYear
  return age > 0 ? age : null
}
