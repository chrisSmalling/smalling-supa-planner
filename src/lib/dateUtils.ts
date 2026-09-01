/** 0 = Sunday .. 6 = Saturday. Change this one constant to move the week start. */
export const WEEK_START = 0

function toUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12))
}

export function todayISO(): string {
  return formatISO(toUTC(new Date()))
}

export function parseISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

export function formatISO(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysISO(dateStr: string, days: number): string {
  const date = parseISO(dateStr)
  return formatISO(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 12)))
}

export function startOfWeekISO(dateStr: string): string {
  const date = parseISO(dateStr)
  const diff = (date.getUTCDay() - WEEK_START + 7) % 7
  return addDaysISO(formatISO(date), -diff)
}

export function weekDatesISO(weekStartStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartStr, i))
}

export function startOfMonthISO(dateStr: string): string {
  const date = parseISO(dateStr)
  return formatISO(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12)))
}

export function addMonthsISO(dateStr: string, months: number): string {
  const date = parseISO(dateStr)
  return formatISO(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12)))
}

/** A full 6-week grid for the month containing `dateStr`, padded with adjacent-month days. */
export function monthGridISO(dateStr: string): string[] {
  const monthStart = startOfMonthISO(dateStr)
  const gridStart = startOfWeekISO(monthStart)
  return Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i))
}

export function isSameMonth(dateStr: string, monthAnchorStr: string): boolean {
  const a = parseISO(dateStr)
  const b = parseISO(monthAnchorStr)
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function weekdayLabel(dateStr: string): string {
  return WEEKDAY_LABELS[parseISO(dateStr).getUTCDay()]
}

export function formatDisplayDate(dateStr: string): string {
  const date = parseISO(dateStr)
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatMonthLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function formatWeekRangeLabel(weekStartStr: string): string {
  const end = addDaysISO(weekStartStr, 6)
  const start = parseISO(weekStartStr)
  const endDate = parseISO(end)
  const sameMonth = start.getUTCMonth() === endDate.getUTCMonth()
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `${startLabel} – ${endLabel}`
}

export function formatTime(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`
}
