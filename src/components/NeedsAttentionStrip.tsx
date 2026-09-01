import * as React from 'react'
import { CategoryDot } from '@/components/ui/badge'
import { buildOccurrences } from '@/lib/occurrences'
import { addDaysISO, formatDisplayDate, todayISO } from '@/lib/dateUtils'
import { milestoneAge } from '@/lib/recurrence'
import type { Item, ItemStatus, Profile } from '@/lib/types'

const LOOKAHEAD_DAYS = 14
const CHECKABLE = new Set(['chore', 'project'])

interface NeedsAttentionStripProps {
  items: Item[]
  statuses: ItemStatus[]
  members: Profile[]
  onItemClick: (item: Item, date: string) => void
}

/** The one dependable reminder surface: upcoming milestones/appointments, and chores nobody did. */
export function NeedsAttentionStrip({ items, statuses, onItemClick }: NeedsAttentionStripProps) {
  const today = todayISO()

  const upcoming = React.useMemo(() => {
    const to = addDaysISO(today, LOOKAHEAD_DAYS)
    return buildOccurrences(items, statuses, today, to)
      .filter((o) => o.item.category === 'milestone' || o.item.category === 'appointment')
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [items, statuses, today])

  const overdue = React.useMemo(() => {
    // Look back a generous window; anything checkable, dated before today, still not done.
    const from = addDaysISO(today, -90)
    const yesterday = addDaysISO(today, -1)
    return buildOccurrences(items, statuses, from, yesterday)
      .filter((o) => CHECKABLE.has(o.item.category) && o.status !== 'done' && o.status !== 'skipped')
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [items, statuses, today])

  if (upcoming.length === 0 && overdue.length === 0) return null

  return (
    <div className="mx-4 mt-3 space-y-2 rounded-xl border bg-muted/40 p-3">
      {overdue.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
            Overdue ({overdue.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {overdue.slice(0, 8).map((o) => (
              <button
                key={`${o.item.id}:${o.date}`}
                onClick={() => onItemClick(o.item, o.date)}
                className="flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs"
              >
                <CategoryDot category={o.item.category} />
                {o.item.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Coming up
          </p>
          <div className="flex flex-wrap gap-1.5">
            {upcoming.slice(0, 8).map((o) => {
              const age = o.item.category === 'milestone' ? milestoneAge(o.item, o.date) : null
              return (
                <button
                  key={`${o.item.id}:${o.date}`}
                  onClick={() => onItemClick(o.item, o.date)}
                  className="flex items-center gap-1 rounded-full border bg-card px-2 py-1 text-xs"
                >
                  <CategoryDot category={o.item.category} />
                  {o.item.title}
                  {age !== null && ` (${age})`}
                  <span className="text-muted-foreground">· {formatDisplayDate(o.date)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
