import * as React from 'react'
import { estimateDriveMinutes } from '@/lib/travelTime'
import { computeLeaveBy } from '@/lib/leaveBy'
import { formatTime } from '@/lib/dateUtils'

const BUFFER_MINUTES = 10
// OSRM only knows how to drive somewhere — it has no concept of flying. Past
// this distance a "leave by" time computed from driving directions isn't
// useful advice (a 19-hour drive estimate for a trip you're actually flying
// to is technically correct and completely wrong to act on), so treat
// anything beyond a reasonable local/day-trip radius as "no estimate"
// rather than show a number nobody should follow.
const MAX_USEFUL_DRIVE_MINUTES = 180

interface LeaveByBadgeProps {
  homeLat: number | null
  homeLng: number | null
  destLat: number | null
  destLng: number | null
  date: string
  time: string // HH:MM or HH:MM:SS
}

// Module-level so the same origin/destination pair isn't re-requested from
// OSRM every time an item re-renders across views (Week/Month/Day all reuse
// ItemRow). Session-lived only — fine, since a stale drive-time estimate by
// a few minutes across a browser session doesn't matter for this feature.
const driveMinutesCache = new Map<string, number | null>()

/** Shows "Leave by 8:42 AM (18 min drive)" once home + item coordinates are both known. Renders nothing while loading or on any failure — this is a bonus, not something that should ever block or clutter the row. */
export function LeaveByBadge({ homeLat, homeLng, destLat, destLng, date, time }: LeaveByBadgeProps) {
  const [minutes, setMinutes] = React.useState<number | null>(null)

  const key =
    homeLat != null && homeLng != null && destLat != null && destLng != null
      ? `${homeLat},${homeLng}->${destLat},${destLng}`
      : null

  React.useEffect(() => {
    if (!key || homeLat == null || homeLng == null || destLat == null || destLng == null) {
      setMinutes(null)
      return
    }
    if (driveMinutesCache.has(key)) {
      setMinutes(driveMinutesCache.get(key) ?? null)
      return
    }
    let cancelled = false
    estimateDriveMinutes({ lat: homeLat, lng: homeLng }, { lat: destLat, lng: destLng }).then((mins) => {
      driveMinutesCache.set(key, mins)
      if (!cancelled) setMinutes(mins)
    })
    return () => {
      cancelled = true
    }
  }, [key, homeLat, homeLng, destLat, destLng])

  if (minutes == null || minutes > MAX_USEFUL_DRIVE_MINUTES) return null

  const { time: leaveTime } = computeLeaveBy(date, time.slice(0, 5), minutes + BUFFER_MINUTES)
  return (
    <span className="text-xs text-muted-foreground">
      Leave by {formatTime(leaveTime)} · {minutes} min drive
    </span>
  )
}
