import * as React from 'react'
import { X } from 'lucide-react'
import { useHousehold } from '@/contexts/HouseholdContext'
import { useItems } from '@/hooks/useItems'
import { WeekView } from '@/components/WeekView'
import { MonthView } from '@/components/MonthView'
import { AddEditSheet } from '@/components/AddEditSheet'
import { QuickAddBar } from '@/components/QuickAddBar'
import { NeedsAttentionStrip } from '@/components/NeedsAttentionStrip'
import { AddMemberButton } from '@/components/AddMemberButton'
import { Button } from '@/components/ui/button'
import { todayISO } from '@/lib/dateUtils'
import type { Item, NewItem, Profile } from '@/lib/types'

type ViewMode = 'week' | 'month'
type SheetState = { item: Item | null; occurrenceDate?: string; defaultDate: string } | null

interface PlannerProps {
  currentPerson: Profile
  onSwitchPerson: () => void
}

export function Planner({ currentPerson, onSwitchPerson }: PlannerProps) {
  const { household, members, refresh: refreshMembers } = useHousehold()
  const itemsApi = useItems(household?.id ?? null)
  const [view, setView] = React.useState<ViewMode>('week')
  const [sheet, setSheet] = React.useState<SheetState>(null)

  function openCreate(defaultDate: string) {
    setSheet({ item: null, defaultDate })
  }

  function openEdit(item: Item, occurrenceDate: string) {
    setSheet({ item, occurrenceDate, defaultDate: occurrenceDate })
  }

  async function handleSave(input: NewItem) {
    if (sheet?.item) {
      await itemsApi.updateItem(sheet.item.id, input)
    } else {
      await itemsApi.createItem(input, currentPerson.id)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Superplan</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-input p-0.5 text-sm">
            <button
              className={`rounded-sm px-3 py-1 ${view === 'week' ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setView('week')}
            >
              Week
            </button>
            <button
              className={`rounded-sm px-3 py-1 ${view === 'month' ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setView('month')}
            >
              Month
            </button>
          </div>
          <AddMemberButton householdId={household?.id ?? null} onAdded={refreshMembers} />
          <Button variant="ghost" size="sm" onClick={onSwitchPerson}>
            {currentPerson.display_name}
          </Button>
        </div>
      </header>

      <div className="px-4 pt-3">
        <QuickAddBar
          members={members}
          onConfirm={async (parsedItems) => {
            for (const input of parsedItems) {
              await itemsApi.createItem(input, currentPerson.id)
            }
          }}
        />
      </div>

      {itemsApi.error && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{itemsApi.error}</span>
          <button onClick={itemsApi.clearError} aria-label="Dismiss">
            <X className="h-4 w-4 shrink-0" />
          </button>
        </div>
      )}

      <NeedsAttentionStrip
        items={itemsApi.items}
        statuses={itemsApi.statuses}
        members={members}
        onItemClick={(item, date) => openEdit(item, date)}
      />

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-2">
        {view === 'week' ? (
          <WeekView
            items={itemsApi.items}
            statuses={itemsApi.statuses}
            members={members}
            onToggleDone={(item, date, done) =>
              itemsApi.setOccurrenceStatus(item.id, date, done ? 'done' : null, currentPerson.id)
            }
            onItemClick={openEdit}
            onAddForDate={openCreate}
          />
        ) : (
          <MonthView
            items={itemsApi.items}
            statuses={itemsApi.statuses}
            members={members}
            onToggleDone={(item, date, done) =>
              itemsApi.setOccurrenceStatus(item.id, date, done ? 'done' : null, currentPerson.id)
            }
            onItemClick={openEdit}
            onAddForDate={openCreate}
          />
        )}
      </main>

      <button
        type="button"
        onClick={() => openCreate(todayISO())}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-lg"
        aria-label="Add item"
      >
        +
      </button>

      <AddEditSheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
        item={sheet?.item ?? null}
        occurrenceDate={sheet?.occurrenceDate}
        defaultDate={sheet?.defaultDate ?? todayISO()}
        members={members}
        onSave={handleSave}
        onDelete={sheet?.item ? async () => itemsApi.deleteItem(sheet.item!.id) : undefined}
        onSkipOccurrence={
          sheet?.item && sheet.occurrenceDate
            ? async () => itemsApi.setOccurrenceStatus(sheet.item!.id, sheet.occurrenceDate!, 'skipped', currentPerson.id)
            : undefined
        }
      />
    </div>
  )
}
