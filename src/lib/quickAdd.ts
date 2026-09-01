import type { Category, RepeatFreq } from './types'

/** The JSON contract returned by the `quick-add` Edge Function (Gemini parse). */
export interface QuickAddParsedItem {
  category: Category
  title: string
  starts_on: string
  start_time: string | null
  who: string | null
  repeat_freq: RepeatFreq
  repeat_interval: number
  repeat_weekdays: number[] | null
  repeat_until: string | null
  notes: string | null
  flags: string[]
  confidence: 'high' | 'medium' | 'low'
}
