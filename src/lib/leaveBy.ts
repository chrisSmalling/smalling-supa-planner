import { addDaysISO } from '@/lib/dateUtils'

/**
 * The time to leave by, given a target arrival date/time and how many
 * minutes of lead time (drive time + buffer) are needed before it. Pure
 * clock-and-calendar arithmetic — no timezone conversion, matching the rest
 * of this app's date handling — so it can roll back over a day boundary
 * (a 7am appointment with a 20-minute drive leaves "the day before" at
 * 23:40 only in the pathological case; the common case just subtracts
 * within the same day).
 */
export function computeLeaveBy(dateStr: string, timeStr: string, leadMinutes: number): { date: string; time: string } {
  const [h, m] = timeStr.split(':').map(Number)
  let totalMinutes = h * 60 + m - leadMinutes
  let dayOffset = 0
  while (totalMinutes < 0) {
    totalMinutes += 24 * 60
    dayOffset -= 1
  }
  const date = dayOffset === 0 ? dateStr : addDaysISO(dateStr, dayOffset)
  const leaveH = Math.floor(totalMinutes / 60) % 24
  const leaveM = totalMinutes % 60
  const time = `${String(leaveH).padStart(2, '0')}:${String(leaveM).padStart(2, '0')}`
  return { date, time }
}
