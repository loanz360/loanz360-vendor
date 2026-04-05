import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface DSEProfile {
  id: string
  role: string
  sub_role: string
  full_name: string | null
  generated_id: string | null
  email: string | null
}

interface VerifyResult {
  isValid: true
  profile: DSEProfile
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
}

interface VerifyError {
  isValid: false
  response: NextResponse
}

/**
 * Shared DSE role verification middleware.
 * Authenticates the user and verifies EMPLOYEE + DIRECT_SALES_EXECUTIVE role.
 * Returns typed profile data on success, or a NextResponse error on failure.
 */
export async function verifyDSE(): Promise<VerifyResult | VerifyError> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      isValid: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      ),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, sub_role, full_name, generated_id, email')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      isValid: false,
      response: NextResponse.json(
        { success: false, error: 'User profile not found', code: 'PROFILE_NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
    return {
      isValid: false,
      response: NextResponse.json(
        { success: false, error: 'Access denied. Only Direct Sales Executives can access this resource.', code: 'ROLE_FORBIDDEN' },
        { status: 403 }
      ),
    }
  }

  return {
    isValid: true,
    profile: {
      id: user.id,
      role: profile.role,
      sub_role: profile.sub_role,
      full_name: profile.full_name,
      generated_id: profile.generated_id,
      email: profile.email,
    },
    supabase,
    userId: user.id,
  }
}
