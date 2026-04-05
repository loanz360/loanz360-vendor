/**
 * Supabase Service Role Client
 * Uses service role key for privileged operations that bypass RLS
 * For server-side API routes only
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instance
let serviceRoleClient: SupabaseClient | null = null

/**
 * Create a Supabase client with service role key
 * This client bypasses Row Level Security (RLS) policies
 * WARNING: Only use in server-side code (API routes, server actions)
 */
export function createServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) {
    return serviceRoleClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }

  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set - using anon key as fallback (RLS will apply)')
    // Fallback to anon key if service role key is not available
    serviceRoleClient = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    return serviceRoleClient
  }

  serviceRoleClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  return serviceRoleClient
}

// Alias for convenience
export { createServiceRoleClient as getServiceRoleClient }
