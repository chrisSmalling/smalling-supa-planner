import * as React from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemRow } from '@/components/ItemRow'
import { buildOccurrences, groupByDate } from '@/lib/occurrences'
import {
  addDaysISO,
  formatDisplayDate,
  formatWeekRangeLabel,
  startOfWeekISO,
  todayISO,
  weekDatesISO,
} from '@/lib/dateUtils'
import { cn } from '@/lib/utils'
import type { Item, ItemStatus, Profile } from '@/lib/types'

interface WeekViewProps {
  items: Item[]
  statuses: ItemStatus[]
  members: Profile[]
  onToggleDone: (item: Item, date: string, done: boolean) => void
  onItemClick: (item: Item, date: string) => void
  onAddForDate: (date: string) => void
}

export function WeekView({ items, statuses, members, onToggleDone, onItemClick, onAddForDate }: WeekViewProps) {
  const [weekStart, setWeekStart] = React.useState(() => startOfWeekISO(todayISO()))
  const today = todayISO()
  const dates = weekDatesISO(weekStart)

  const occurrences = React.useMemo(
    () => buildOccurrences(items, statuses, dates[0], dates[6]),
    [items, statuses, dates],
  )
  const byDate = React.useMemo(() => groupByDate(occurrences), [occurrences])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium">{formatWeekRangeLabel(weekStart)}</span>
          <button
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setWeekStart(startOfWeekISO(todayISO()))}
          >
            Today
          </button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-2">
        {dates.map((date) => {
          const dayOccurrences = byDate.get(date) ?? []
          const milestones = dayOccurrences.filter((o) => o.item.category === 'milestone')
          const rest = dayOccurrences.filter((o) => o.item.category !== 'milestone')
          const isToday = date === today

          return (
            <div key={date} className={cn('rounded-xl border', isToday && 'border-primary')}>
              <div className="flex items-center justify-between px-3 py-2">
                <span className={cn('text-sm font-semibold', isToday && 'text-primary')}>
                  {formatDisplayDate(date)}
                </span>
                <button
                  className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => onAddForDate(date)}
                  aria-label={`Add item for ${date}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {milestones.length > 0 && (
                <div className="mx-3 mb-1 rounded-md bg-category-milestone/15 px-2 py-1 text-xs font-medium text-category-milestone">
                  {milestones.map((o) => o.item.title).join(' · ')}
                </div>
              )}

              {rest.length > 0 ? (
                <div className="px-1 pb-1">
                  {rest.map((occ) => (
                    <ItemRow
                      key={`${occ.item.id}:${occ.date}`}
                      occurrence={occ}
                      members={members}
                      onToggleDone={(done) => onToggleDone(occ.item, occ.date, done)}
                      onClick={() => onItemClick(occ.item, occ.date)}
                    />
                  ))}
                </div>
              ) : (
                milestones.length === 0 && (
                  <p className="px-3 pb-2 text-xs text-muted-foreground">Nothing planned</p>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
