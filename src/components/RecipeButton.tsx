import * as React from 'react'
import { Sparkles } from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export interface RecipeSuggestion {
  ingredients: string[]
  instructions: string
}

interface RecipeButtonProps {
  title: string
  notes: string | null
  onSuggestion: (suggestion: RecipeSuggestion) => void
}

/** Calls the suggest-recipe Edge Function and hands the result to the caller to fill into the form. */
export function RecipeButton({ title, notes, onSuggestion }: RecipeButtonProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleClick() {
    if (!title.trim()) {
      setError('Give it a title first')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.functions.invoke<RecipeSuggestion>('suggest-recipe', {
        body: { title, notes },
      })
      if (error) throw error
      if (data) onSuggestion(data)
    } catch (err) {
      if (err instanceof FunctionsHttpError) {
        try {
          const body = await err.context.json()
          setError(body?.error ?? err.message)
        } catch {
          setError(err.message)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Recipe suggestion is unavailable right now')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        <Sparkles className="h-4 w-4" />
        {loading ? 'Thinking…' : 'Suggest a healthy recipe'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
