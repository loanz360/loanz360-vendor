/**
 * Supabase Admin Client
 * Uses service role key for privileged operations that bypass RLS
 */

import { createClient } from '@supabase/supabase-js'

// Singleton instance
let adminClient: ReturnType<typeof createClient> | null = null

/**
 * Create a Supabase admin client with service role key
 * This client bypasses Row Level Security (RLS) policies
 */
export function createAdminClient() {
  if (adminClient) {
    return adminClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }

  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set - using anon key as fallback (RLS will apply)')
    // Fallback to anon key if service role key is not available
    adminClient = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    return adminClient
  }

  adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  return adminClient
}

// Re-export for convenience
export { createAdminClient as createSupabaseAdmin }
