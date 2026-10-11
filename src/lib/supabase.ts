import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Client-side key is safe to expose only alongside correctly configured RLS policies. */
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null
export const isSupabaseConfigured = supabase !== null

