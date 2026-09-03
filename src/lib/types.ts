export type Category =
  | 'activity'
  | 'meal'
  | 'chore'
  | 'project'
  | 'appointment'
  | 'milestone'
  | 'note'

export const CATEGORIES: Category[] = [
  'activity',
  'meal',
  'chore',
  'project',
  'appointment',
  'milestone',
  'note',
]

export const CATEGORY_LABEL: Record<Category, string> = {
  activity: 'Activity',
  meal: 'Meal',
  chore: 'Chore',
  project: 'Project',
  appointment: 'Appointment',
  milestone: 'Milestone',
  note: 'Note',
}

export type RepeatFreq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Subtask {
  text: string
  done: boolean
}

export interface Item {
  id: string
  household_id: string
  title: string
  category: Category
  starts_on: string // YYYY-MM-DD
  start_time: string | null // HH:MM:SS
  who: string | null
  notes: string | null
  location: string | null
  location_lat: number | null
  location_lng: number | null
  subtasks: Subtask[] | null
  repeat_freq: RepeatFreq
  repeat_interval: number
  repeat_weekdays: number[] | null
  repeat_until: string | null
  created_by: string | null
  created_at: string
}

export type NewItem = Omit<Item, 'id' | 'household_id' | 'created_by' | 'created_at'>

export type ItemStatusValue = 'done' | 'skipped'

export interface ItemStatus {
  id: string
  item_id: string
  occurrence_date: string
  status: ItemStatusValue
  by: string | null
  at: string
}

export interface Profile {
  id: string
  household_id: string
  display_name: string
}

export interface Household {
  id: string
  name: string
  home_address: string | null
  home_lat: number | null
  home_lng: number | null
  created_at: string
}

/** A single date on which an item (one-off or repeating) actually occurs. */
export interface Occurrence {
  item: Item
  date: string // YYYY-MM-DD
}

/** A checked-off grocery item for one week (see src/lib/groceryList.ts for how the list itself is built). */
export interface GroceryCheck {
  id: string
  household_id: string
  week_start: string // YYYY-MM-DD
  ingredient: string // normalized (trimmed, lowercased) — the join key back to a GroceryIngredient
  checked_at: string
}
