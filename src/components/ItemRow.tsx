import { Checkbox } from '@/components/ui/checkbox'
import { CategoryDot } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/dateUtils'
import { milestoneAge } from '@/lib/recurrence'
import type { EnrichedOccurrence } from '@/lib/occurrences'
import type { Profile } from '@/lib/types'

interface ItemRowProps {
  occurrence: EnrichedOccurrence
  members: Profile[]
  onToggleDone: (checked: boolean) => void
  onClick: () => void
}

const CHECKABLE = new Set(['chore', 'project'])

export function ItemRow({ occurrence, members, onToggleDone, onClick }: ItemRowProps) {
  const { item, date, status } = occurrence
  const who = members.find((m) => m.id === item.who)
  const checkable = CHECKABLE.has(item.category)
  const done = status === 'done'
  const skipped = status === 'skipped'
  const age = item.category === 'milestone' ? milestoneAge(item, date) : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left hover:bg-accent',
        skipped && 'opacity-50',
      )}
    >
      {checkable ? (
        <Checkbox
          checked={done}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(checked) => onToggleDone(checked === true)}
        />
      ) : (
        <CategoryDot category={item.category} className="ml-1.5 mr-1.5" />
      )}

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', done && 'text-muted-foreground line-through')}>
          {item.title}
          {age !== null && <span className="text-muted-foreground"> · turns {age}</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[item.start_time ? formatTime(item.start_time) : null, who?.display_name]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </button>
  )
}
