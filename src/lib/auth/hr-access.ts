/**
 * Shared HR Access Check Utility
 *
 * Checks whether the authenticated user has HR access.
 * Tries multiple tables in priority order so test accounts
 * and production accounts both work regardless of setup.
 *
 * Uses an admin client internally to bypass RLS when checking
 * the user's role — this is an authorization check, not a data query.
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'

const HR_SUB_ROLES = ['HR_EXECUTIVE', 'HR_MANAGER', 'HR EXECUTIVE', 'HR MANAGER', 'HR', 'HRBP', 'HR_OPERATIONS']
const HR_ROLES = ['HR', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMIN']

function isHRSubRole(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = value.toUpperCase().trim()
  // Use exact matching against whitelist — never use startsWith to avoid
  // granting HR access to unrelated roles (e.g., HOURLY_WAGE)
  return HR_SUB_ROLES.includes(normalized) ||
    HR_ROLES.includes(normalized)
}

function isHRRole(value: string | null | undefined): boolean {
  if (!value) return false
  return HR_ROLES.includes(value.toUpperCase().trim())
}

/**
 * Check if the current Supabase session user has HR access.
 * Tries employees table → profiles table as fallback.
 * Uses admin client to bypass RLS for the role lookup.
 * Never throws — returns false on any error.
 */
export async function checkHRAccess(supabase: any): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    return checkHRAccessByUserId(createSupabaseAdmin(), user.id)
  } catch {
    return false
  }
}

/**
 * Check HR access by explicit userId.
 * Accepts any Supabase client (admin recommended to bypass RLS).
 */
export async function checkHRAccessByUserId(supabase: any, userId: string): Promise<boolean> {
  try {
    // 1. Check employees table (sub_role or role column)
    const { data: employee } = await supabase
      .from('employees')
      .select('id, sub_role, role, employee_status')
      .eq('user_id', userId)
      .maybeSingle()

    if (employee) {
      if (isHRSubRole(employee.sub_role) || isHRRole(employee.role)) {
        return true
      }
      // Employee row exists but is not HR — still check profiles
      // (employee.role might be 'EMPLOYEE' while profiles.role = 'HR')
    }

    // 2. Check profiles table (most reliable for test accounts)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (profile && isHRRole(profile.role)) {
      return true
    }

    // 3. Fallback: check employee_profile table (legacy)
    const { data: empProfile } = await supabase
      .from('employee_profile')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (empProfile && isHRRole(empProfile.role)) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Express-style middleware helper — returns 403 JSON or null.
 * Usage: const deny = await requireHRAccess(supabase)
 *        if (deny) return deny
 */
export async function requireHRAccess(supabase: any) {
  const ok = await checkHRAccess(supabase)
  if (!ok) {
    const { NextResponse } = await import('next/server')
    return NextResponse.json(
      { success: false, error: 'Access denied. HR role required.' },
      { status: 403 }
    )
  }
  return null
}
