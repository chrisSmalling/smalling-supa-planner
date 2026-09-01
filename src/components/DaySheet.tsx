import { Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ItemRow } from '@/components/ItemRow'
import { formatDisplayDate } from '@/lib/dateUtils'
import type { EnrichedOccurrence } from '@/lib/occurrences'
import type { Item, Profile } from '@/lib/types'

interface DaySheetProps {
  date: string | null
  onOpenChange: (open: boolean) => void
  occurrences: EnrichedOccurrence[]
  members: Profile[]
  onToggleDone: (item: Item, date: string, done: boolean) => void
  onItemClick: (item: Item, date: string) => void
  onAddForDate: (date: string) => void
}

export function DaySheet({ date, onOpenChange, occurrences, members, onToggleDone, onItemClick, onAddForDate }: DaySheetProps) {
  return (
    <Sheet open={date !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        {date && (
          <>
            <div className="flex items-center justify-between">
              <SheetTitle>{formatDisplayDate(date)}</SheetTitle>
              <button
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onAddForDate(date)}
                aria-label="Add item"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3">
              {occurrences.length > 0 ? (
                occurrences.map((occ) => (
                  <ItemRow
                    key={`${occ.item.id}:${occ.date}`}
                    occurrence={occ}
                    members={members}
                    onToggleDone={(done) => onToggleDone(occ.item, occ.date, done)}
                    onClick={() => onItemClick(occ.item, occ.date)}
                  />
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">Nothing planned</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
