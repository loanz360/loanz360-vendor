import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '../types/database.types'

// Factory function - NEVER call at module level, only inside components/functions
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

// IMPORTANT: Do NOT create client at module level
// Export ONLY the factory function
export function getSupabaseClient() {
  return createSupabaseClient()
}

// Alias for convenience
export const createClient = createSupabaseClient

// Legacy support - but throws error to prevent misuse
export const supabaseClient = {
  get auth() {
    throw new Error('Use createSupabaseClient() instead of supabaseClient')
  },
  get from() {
    throw new Error('Use createSupabaseClient() instead of supabaseClient')
  }
}

export default supabaseClient
