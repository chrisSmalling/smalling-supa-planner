import * as React from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { buildGroceryList } from '@/lib/groceryList'
import { useGroceryChecks } from '@/hooks/useGroceryChecks'
import { formatWeekRangeLabel } from '@/lib/dateUtils'
import type { Item, ItemStatus } from '@/lib/types'

interface GroceryListSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string | null
  items: Item[]
  statuses: ItemStatus[]
  weekStart: string
  weekEnd: string
}

/** This week's meals, ingredients aggregated and deduped into one checkable shopping list. */
export function GroceryListSheet({
  open,
  onOpenChange,
  householdId,
  items,
  statuses,
  weekStart,
  weekEnd,
}: GroceryListSheetProps) {
  const ingredients = React.useMemo(
    () => buildGroceryList(items, statuses, weekStart, weekEnd),
    [items, statuses, weekStart, weekEnd],
  )
  const { checked, toggle } = useGroceryChecks(householdId, weekStart)

  const remaining = ingredients.filter((i) => !checked.has(i.key))
  const done = ingredients.filter((i) => checked.has(i.key))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>Grocery list</SheetTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          From this week's meals ({formatWeekRangeLabel(weekStart)})
        </p>

        {ingredients.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No meals with ingredients this week yet.
          </p>
        )}

        <ul className="space-y-1">
          {remaining.map((ingredient) => (
            <GroceryRow key={ingredient.key} ingredient={ingredient} checked={false} onToggle={toggle} />
          ))}
        </ul>

        {done.length > 0 && (
          <>
            <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              In cart
            </p>
            <ul className="space-y-1">
              {done.map((ingredient) => (
                <GroceryRow key={ingredient.key} ingredient={ingredient} checked onToggle={toggle} />
              ))}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function GroceryRow({
  ingredient,
  checked,
  onToggle,
}: {
  ingredient: { key: string; text: string; meals: string[] }
  checked: boolean
  onToggle: (key: string, checked: boolean) => void
}) {
  return (
    <li className="flex items-start gap-2 rounded-md px-1 py-1.5">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onToggle(ingredient.key, value === true)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className={checked ? 'text-sm text-muted-foreground line-through' : 'text-sm'}>{ingredient.text}</p>
        <p className="truncate text-xs text-muted-foreground">{ingredient.meals.join(', ')}</p>
      </div>
    </li>
  )
}
