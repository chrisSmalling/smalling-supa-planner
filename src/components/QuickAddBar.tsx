import * as React from 'react'
import { Sparkles, X } from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CategoryDot } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { geocodeLocation } from '@/lib/geocode'
import type { GeocodeMatch } from '@/lib/geocode'
import { useHousehold } from '@/contexts/HouseholdContext'
import { formatDisplayDate, formatTime } from '@/lib/dateUtils'
import { CATEGORY_LABEL } from '@/lib/types'
import type { NewItem, Profile } from '@/lib/types'
import type { QuickAddParsedItem } from '@/lib/quickAdd'

interface QuickAddBarProps {
  members: Profile[]
  onConfirm: (items: NewItem[]) => Promise<void>
}

export function QuickAddBar({ members, onConfirm }: QuickAddBarProps) {
  const { household } = useHousehold()
  const homeCoords =
    household?.home_lat != null && household?.home_lng != null
      ? { lat: household.home_lat, lng: household.home_lng }
      : undefined
  const [text, setText] = React.useState('')
  const [parsed, setParsed] = React.useState<QuickAddParsedItem[] | null>(null)
  const [included, setIncluded] = React.useState<boolean[]>([])
  // undefined = still resolving, null = resolved but nothing found.
  const [locationMatches, setLocationMatches] = React.useState<(GeocodeMatch | null | undefined)[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleParse(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.functions.invoke<{ items: QuickAddParsedItem[] }>('quick-add', {
        body: { text, roster: members.map((m) => m.display_name) },
      })
      if (error) throw error
      const items = data?.items ?? []
      if (items.length === 0) {
        setError("Couldn't find anything to add — try rephrasing.")
        return
      }
      setParsed(items)
      setIncluded(items.map(() => true))
      // Show the card immediately, then resolve each location in the
      // background and fill it in as it comes back — geocoding shouldn't
      // hold up seeing what Gemini found. A venue name like "LA Fitness,
      // New Tampa" is ambiguous on its own, so once resolved this shows
      // what it actually matched instead of trusting the raw text silently.
      setLocationMatches(items.map((p) => (p.location ? undefined : null)))
      items.forEach((p, i) => {
        if (!p.location) return
        geocodeLocation(p.location, homeCoords)
          .then((match) => setLocationMatches((prev) => prev.map((m, idx) => (idx === i ? match : m))))
          .catch(() => setLocationMatches((prev) => prev.map((m, idx) => (idx === i ? null : m))))
      })
    } catch (err) {
      // supabase-js's default error.message for a non-2xx response is just
      // "Edge Function returned a non-2xx status code" — pull the actual
      // message out of the response body so failures are self-diagnosing.
      if (err instanceof FunctionsHttpError) {
        try {
          const body = await err.context.json()
          setError(body?.error ?? err.message)
        } catch {
          setError(err.message)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Quick Add is unavailable right now')
      }
    } finally {
      setLoading(false)
    }
  }

  function resolveWho(name: string | null): string | null {
    if (!name) return null
    const match = members.find((m) => m.display_name.toLowerCase() === name.toLowerCase())
    return match?.id ?? null
  }

  async function handleConfirm() {
    if (!parsed) return
    const toInsert: NewItem[] = parsed
      .map((p, i) => ({ p, coords: locationMatches[i], include: included[i] }))
      .filter(({ include }) => include)
      .map(({ p, coords }) => {
        return {
          title: p.title,
          category: p.category,
          starts_on: p.starts_on,
          start_time: p.start_time,
          who: resolveWho(p.who),
          notes: p.notes,
          location: p.location,
          location_lat: coords?.lat ?? null,
          location_lng: coords?.lng ?? null,
          subtasks: p.subtasks ? p.subtasks.map((text) => ({ text, done: false })) : null,
          repeat_freq: p.repeat_freq,
          repeat_interval: p.repeat_interval,
          repeat_weekdays: p.repeat_weekdays,
          repeat_until: p.repeat_until,
        }
      })
    await onConfirm(toInsert)
    setParsed(null)
    setText('')
    setLocationMatches([])
  }

  if (parsed) {
    return (
      <div className="space-y-2 rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            I found {parsed.length} thing{parsed.length === 1 ? '' : 's'}
          </p>
          <button
            onClick={() => {
              setParsed(null)
              setLocationMatches([])
            }}
            aria-label="Cancel"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-1.5">
          {parsed.map((p, i) => {
            const inferredFlags = p.flags.filter((f) => /inferred/i.test(f))
            const otherFlags = p.flags.filter((f) => !/inferred/i.test(f))
            return (
              <label key={i} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={included[i]}
                  onChange={(e) => setIncluded((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CategoryDot category={p.category} />
                    {p.title}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABEL[p.category]} · {formatDisplayDate(p.starts_on)}
                    {p.start_time && ` · ${formatTime(p.start_time)}`}
                    {p.who && ` · ${p.who}`}
                    {p.location && ` · ${p.location}`}
                    {p.repeat_freq !== 'none' && ` · repeats ${p.repeat_freq}`}
                  </p>
                  {p.location && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {locationMatches[i] === undefined ? (
                        '📍 Locating…'
                      ) : locationMatches[i] ? (
                        <>
                          📍 {locationMatches[i]!.displayName ?? p.location}
                          {locationMatches[i]!.approximate && ' (approximate — city center)'}
                        </>
                      ) : (
                        "📍 couldn't verify this location — no leave-by time for it"
                      )}
                    </p>
                  )}
                  {p.subtasks && p.subtasks.length > 0 && (
                    <ul className="mt-0.5 list-inside list-disc text-xs text-muted-foreground">
                      {p.subtasks.map((s, si) => (
                        <li key={si}>{s}</li>
                      ))}
                    </ul>
                  )}
                  {inferredFlags.length > 0 && (
                    <p className="mt-0.5 text-xs font-medium text-category-chore">
                      ✨ Added automatically — you didn't type this part
                    </p>
                  )}
                  {otherFlags.length > 0 && (
                    <p className="mt-0.5 text-xs text-amber-600">⚠ {otherFlags.join(', ')}</p>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        <Button className="w-full" onClick={handleConfirm} disabled={!included.some(Boolean)}>
          Add {included.filter(Boolean).length}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleParse} className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Emma soccer Saturday at 10, tacos Tuesday…"
          disabled={loading}
        />
        <Button type="submit" size="icon" disabled={loading || !text.trim()} aria-label="Quick add">
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
