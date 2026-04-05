import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { createSupabaseAdmin } from '@/lib/supabase/server'

export interface VerifiedEmployee {
  id: string
  email: string
  name: string
  role: string
  sub_role?: string
  department?: string
  organization_id?: string
}

/**
 * Verify employee authentication from request
 * Returns employee data if authenticated, null otherwise
 */
export async function verifyEmployee(request: NextRequest): Promise<VerifiedEmployee | null> {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return null
    }

    const sessionData = verifySessionToken(authToken)
    if (!sessionData) {
      return null
    }

    const [tokenBlacklisted, sessionRevoked] = await Promise.all([
      isTokenBlacklisted(authToken),
      isSessionRevoked(sessionData.sessionId)
    ])

    if (tokenBlacklisted || sessionRevoked) {
      return null
    }

    // Allow both EMPLOYEE and HR roles to access employee self-service features
    const roleUpper = sessionData.role?.toUpperCase()
    if (roleUpper !== 'EMPLOYEE' && roleUpper !== 'HR') {
      return null
    }

    // Fetch employee details from database
    const supabase = createSupabaseAdmin()
    const { data: employee, error } = await supabase
      .from('users')
      .select('id, email, name, role, sub_role, department, organization_id')
      .eq('id', sessionData.userId)
      .maybeSingle()

    if (error || !employee) {
      return null
    }

    return employee as VerifiedEmployee
  } catch (error) {
    console.error('Error verifying employee:', error)
    return null
  }
}
