import * as React from 'react'
import { MapPin } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RecipeButton } from '@/components/RecipeButton'
import { cn } from '@/lib/utils'
import { googleMapsSearchUrl } from '@/lib/maps'
import { geocodeLocation } from '@/lib/geocode'
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/types'
import type { Category, Item, NewItem, Profile, RepeatFreq, Subtask } from '@/lib/types'

const CHECKLIST_CATEGORIES: Category[] = ['project', 'chore', 'meal']

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function emptyForm(defaultDate: string): NewItem {
  return {
    title: '',
    category: 'activity',
    starts_on: defaultDate,
    start_time: null,
    who: null,
    notes: null,
    location: null,
    location_lat: null,
    location_lng: null,
    subtasks: null,
    repeat_freq: 'none',
    repeat_interval: 1,
    repeat_weekdays: null,
    repeat_until: null,
  }
}

interface AddEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Item | null
  /** Set when opened from a specific occurrence of a repeating item, enabling "skip this date only". */
  occurrenceDate?: string
  defaultDate: string
  members: Profile[]
  onSave: (input: NewItem) => Promise<void>
  onDelete?: () => Promise<void>
  onSkipOccurrence?: () => Promise<void>
}

export function AddEditSheet({
  open,
  onOpenChange,
  item,
  occurrenceDate,
  defaultDate,
  members,
  onSave,
  onDelete,
  onSkipOccurrence,
}: AddEditSheetProps) {
  const [form, setForm] = React.useState<NewItem>(() => item ?? emptyForm(defaultDate))
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) setForm(item ?? emptyForm(defaultDate))
  }, [open, item, defaultDate])

  const isEditingOccurrenceOfSeries = Boolean(item && occurrenceDate && item.repeat_freq !== 'none')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let toSave = form
      const locationChanged = form.location !== (item?.location ?? null)
      if (!form.location) {
        toSave = { ...form, location_lat: null, location_lng: null }
      } else if (locationChanged || form.location_lat == null) {
        // Best-effort: an item is still worth saving even if this address
        // doesn't resolve to coordinates — it just won't get a leave-by time.
        try {
          const coords = await geocodeLocation(form.location)
          toSave = { ...form, location_lat: coords?.lat ?? null, location_lng: coords?.lng ?? null }
        } catch (err) {
          console.error('Failed to geocode location:', err)
        }
      }
      await onSave(toSave)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  function toggleWeekday(day: number) {
    const current = form.repeat_weekdays ?? []
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    setForm({ ...form, repeat_weekdays: next.length > 0 ? next : null })
  }

  function updateSubtask(index: number, patch: Partial<Subtask>) {
    const subtasks = [...(form.subtasks ?? [])]
    subtasks[index] = { ...subtasks[index], ...patch }
    setForm({ ...form, subtasks })
  }

  function addSubtask() {
    setForm({ ...form, subtasks: [...(form.subtasks ?? []), { text: '', done: false }] })
  }

  function removeSubtask(index: number) {
    setForm({ ...form, subtasks: (form.subtasks ?? []).filter((_, i) => i !== index) })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>{item ? 'Edit item' : 'Add item'}</SheetTitle>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                required
                value={form.starts_on}
                onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={form.start_time ?? ''}
                onChange={(e) => setForm({ ...form, start_time: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Who</Label>
            <Select
              value={form.who ?? 'none'}
              onValueChange={(v) => setForm({ ...form, who: v === 'none' ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <div className="flex gap-2">
              <Input
                id="location"
                placeholder="Magic Kingdom, Orlando, FL"
                value={form.location ?? ''}
                onChange={(e) => setForm({ ...form, location: e.target.value || null })}
              />
              {form.location && (
                <Button type="button" variant="outline" size="icon" asChild>
                  <a href={googleMapsSearchUrl(form.location)} target="_blank" rel="noopener noreferrer" aria-label="Open in Maps">
                    <MapPin className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Repeat</Label>
            <Select
              value={form.repeat_freq}
              onValueChange={(v) =>
                setForm({ ...form, repeat_freq: v as RepeatFreq, repeat_weekdays: v === 'weekly' ? form.repeat_weekdays : null })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Doesn't repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.repeat_freq !== 'none' && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="interval" className="shrink-0">
                  Every
                </Label>
                <Input
                  id="interval"
                  type="number"
                  min={1}
                  className="w-20"
                  value={form.repeat_interval}
                  onChange={(e) => setForm({ ...form, repeat_interval: Math.max(1, Number(e.target.value)) })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.repeat_freq === 'daily' && 'day(s)'}
                  {form.repeat_freq === 'weekly' && 'week(s)'}
                  {form.repeat_freq === 'monthly' && 'month(s)'}
                  {form.repeat_freq === 'yearly' && 'year(s)'}
                </span>
              </div>

              {form.repeat_freq === 'weekly' && (
                <div className="space-y-1.5">
                  <Label>On</Label>
                  <div className="flex gap-1">
                    {WEEKDAYS.map((label, day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={cn(
                          'h-9 w-9 rounded-full border text-sm',
                          (form.repeat_weekdays ?? []).includes(day)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="until">Ends (optional)</Label>
                <Input
                  id="until"
                  type="date"
                  value={form.repeat_until ?? ''}
                  onChange={(e) => setForm({ ...form, repeat_until: e.target.value || null })}
                />
              </div>
            </div>
          )}

          {form.category === 'meal' && (
            <RecipeButton
              title={form.title}
              notes={form.notes}
              onSuggestion={(suggestion) =>
                setForm({
                  ...form,
                  subtasks: suggestion.ingredients.map((text) => ({ text, done: false })),
                  notes: [form.notes, suggestion.instructions].filter(Boolean).join('\n\n'),
                })
              }
            />
          )}

          {CHECKLIST_CATEGORIES.includes(form.category) && (
            <div className="space-y-2">
              <Label>{form.category === 'meal' ? 'Ingredients' : 'Checklist'}</Label>
              {(form.subtasks ?? []).map((subtask, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={subtask.done}
                    onCheckedChange={(checked) => updateSubtask(i, { done: checked === true })}
                  />
                  <Input
                    value={subtask.text}
                    onChange={(e) => updateSubtask(i, { text: e.target.value })}
                    placeholder={form.category === 'meal' ? 'Ingredient' : 'Subtask'}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeSubtask(i)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                {form.category === 'meal' ? 'Add ingredient' : 'Add subtask'}
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {item ? 'Save changes' : 'Add item'}
            </Button>

            {isEditingOccurrenceOfSeries && onSkipOccurrence && (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await onSkipOccurrence()
                  onOpenChange(false)
                }}
              >
                Skip just this date
              </Button>
            )}

            {item && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  await onDelete()
                  onOpenChange(false)
                }}
              >
                Delete {item.repeat_freq !== 'none' ? 'entire series' : 'item'}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
