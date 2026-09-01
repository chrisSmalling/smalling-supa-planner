import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryDot } from '@/components/ui/badge'
import { DaySheet } from '@/components/DaySheet'
import { buildOccurrences, groupByDate } from '@/lib/occurrences'
import { addMonthsISO, formatMonthLabel, isSameMonth, monthGridISO, parseISO, todayISO } from '@/lib/dateUtils'
import { cn } from '@/lib/utils'
import type { Category, Item, ItemStatus, Profile } from '@/lib/types'

interface MonthViewProps {
  items: Item[]
  statuses: ItemStatus[]
  members: Profile[]
  onToggleDone: (item: Item, date: string, done: boolean) => void
  onItemClick: (item: Item, date: string) => void
  onAddForDate: (date: string) => void
}

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function MonthView({ items, statuses, members, onToggleDone, onItemClick, onAddForDate }: MonthViewProps) {
  const [monthAnchor, setMonthAnchor] = React.useState(() => todayISO())
  const [openDay, setOpenDay] = React.useState<string | null>(null)
  const today = todayISO()
  const grid = monthGridISO(monthAnchor)

  const occurrences = React.useMemo(
    () => buildOccurrences(items, statuses, grid[0], grid[grid.length - 1]),
    [items, statuses, grid],
  )
  const byDate = React.useMemo(() => groupByDate(occurrences), [occurrences])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonthAnchor(addMonthsISO(monthAnchor, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium">{formatMonthLabel(monthAnchor)}</span>
          <button
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMonthAnchor(todayISO())}
          >
            Today
          </button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMonthAnchor(addMonthsISO(monthAnchor, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_HEADERS.map((label, i) => (
          <div key={i} className="bg-card py-1.5">
            {label}
          </div>
        ))}
        {grid.map((date) => {
          const dayOccurrences = byDate.get(date) ?? []
          const categories = Array.from(new Set(dayOccurrences.map((o) => o.item.category))).slice(0, 4)
          const inMonth = isSameMonth(date, monthAnchor)
          const isToday = date === today

          return (
            <button
              key={date}
              onClick={() => setOpenDay(date)}
              className={cn(
                'flex min-h-[3.5rem] flex-col items-center gap-1 bg-card py-1.5',
                !inMonth && 'opacity-40',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-sm',
                  isToday && 'bg-primary text-primary-foreground',
                )}
              >
                {parseISO(date).getUTCDate()}
              </span>
              <div className="flex gap-0.5">
                {categories.map((c) => (
                  <CategoryDot key={c} category={c as Category} className="h-1.5 w-1.5" />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <DaySheet
        date={openDay}
        onOpenChange={(open) => !open && setOpenDay(null)}
        occurrences={openDay ? byDate.get(openDay) ?? [] : []}
        members={members}
        onToggleDone={onToggleDone}
        onItemClick={onItemClick}
        onAddForDate={onAddForDate}
      />
    </div>
  )
}
