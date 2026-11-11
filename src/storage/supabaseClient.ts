import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined

/**
 * The Supabase client, or null when the app runs in local-only mode
 * (no VITE_SUPABASE_URL / key set at build time).
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const cloudEnabled = supabase !== null
