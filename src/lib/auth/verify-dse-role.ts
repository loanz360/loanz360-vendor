import { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Shared DSE/DSM Role Verification Utility
 * Eliminates duplicated verifyDSERole helpers across 15+ API route files.
 *
 * Usage:
 *   const roleCheck = await verifyDSERole(supabase, user.id)
 *   if (!roleCheck.isValid) return roleCheck.response
 */

interface RoleCheckResult {
  isValid: true
  profile: { role: string; sub_role: string; full_name?: string; branch_id?: string }
}

interface RoleCheckError {
  isValid: false
  error: string
  response: NextResponse
}

type RoleVerificationResult = RoleCheckResult | RoleCheckError

export async function verifyDSERole(
  supabase: SupabaseClient,
  userId: string
): Promise<RoleVerificationResult> {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role, full_name, branch_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return {
      isValid: false,
      error: 'Failed to verify user role',
      response: NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      ),
    }
  }

  if (!profile) {
    return {
      isValid: false,
      error: 'User profile not found',
      response: NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      ),
    }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
    return {
      isValid: false,
      error: 'Access denied',
      response: NextResponse.json(
        { success: false, error: 'Access denied. This feature is only available for Direct Sales Executives.' },
        { status: 403 }
      ),
    }
  }

  return { isValid: true, profile }
}

export async function verifyDSMRole(
  supabase: SupabaseClient,
  userId: string
): Promise<RoleVerificationResult> {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role, full_name, branch_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return {
      isValid: false,
      error: 'Failed to verify user role',
      response: NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      ),
    }
  }

  if (!profile) {
    return {
      isValid: false,
      error: 'User profile not found',
      response: NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      ),
    }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_MANAGER') {
    return {
      isValid: false,
      error: 'Access denied',
      response: NextResponse.json(
        { success: false, error: 'Access denied. This feature is only available for Direct Sales Managers.' },
        { status: 403 }
      ),
    }
  }

  return { isValid: true, profile }
}

/**
 * Verify either DSE or DSM role (for shared endpoints)
 */
export async function verifyDSEOrDSMRole(
  supabase: SupabaseClient,
  userId: string
): Promise<RoleVerificationResult> {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role, full_name, branch_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return {
      isValid: false,
      error: 'Failed to verify user role',
      response: NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      ),
    }
  }

  if (!profile) {
    return {
      isValid: false,
      error: 'User profile not found',
      response: NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      ),
    }
  }

  const validSubRoles = ['DIRECT_SALES_EXECUTIVE', 'DIRECT_SALES_MANAGER']
  if (profile.role !== 'EMPLOYEE' || !validSubRoles.includes(profile.sub_role)) {
    return {
      isValid: false,
      error: 'Access denied',
      response: NextResponse.json(
        { success: false, error: 'Access denied. This feature is only available for Direct Sales team members.' },
        { status: 403 }
      ),
    }
  }

  return { isValid: true, profile }
}
