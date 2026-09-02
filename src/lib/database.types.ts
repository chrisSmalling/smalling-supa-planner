// Hand-written to match supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once a live project exists,
// then keep this file in sync with any schema changes.

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          home_address: string | null
          home_lat: number | null
          home_lng: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: { id: string; household_id: string; display_name: string; created_at: string }
        Insert: { id?: string; household_id: string; display_name: string; created_at?: string }
        Update: { id?: string; household_id?: string; display_name?: string; created_at?: string }
        Relationships: []
      }
      items: {
        Row: {
          id: string
          household_id: string
          title: string
          category: string
          starts_on: string
          start_time: string | null
          who: string | null
          notes: string | null
          location: string | null
          location_lat: number | null
          location_lng: number | null
          subtasks: unknown | null
          repeat_freq: string
          repeat_interval: number
          repeat_weekdays: number[] | null
          repeat_until: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          title: string
          category: string
          starts_on: string
          start_time?: string | null
          who?: string | null
          notes?: string | null
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          subtasks?: unknown | null
          repeat_freq?: string
          repeat_interval?: number
          repeat_weekdays?: number[] | null
          repeat_until?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          title?: string
          category?: string
          starts_on?: string
          start_time?: string | null
          who?: string | null
          notes?: string | null
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          subtasks?: unknown | null
          repeat_freq?: string
          repeat_interval?: number
          repeat_weekdays?: number[] | null
          repeat_until?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      geocode_cache: {
        Row: { query: string; lat: number; lng: number; display_name: string | null; created_at: string }
        Insert: { query: string; lat: number; lng: number; display_name?: string | null; created_at?: string }
        Update: { query?: string; lat?: number; lng?: number; display_name?: string | null; created_at?: string }
        Relationships: []
      }
      item_status: {
        Row: {
          id: string
          item_id: string
          occurrence_date: string
          status: string
          by: string | null
          at: string
        }
        Insert: {
          id?: string
          item_id: string
          occurrence_date: string
          status: string
          by?: string | null
          at?: string
        }
        Update: {
          id?: string
          item_id?: string
          occurrence_date?: string
          status?: string
          by?: string | null
          at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
