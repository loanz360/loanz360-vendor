/**
 * BDE Utilities
 * Helper functions for Business Development Executive operations
 */

import { createClient } from '@/lib/supabase/server'

export interface BDEInfo {
  id: string
  name: string
  email: string
  employeeCode: string
  managerId: string
  status: string
  subRole: string
}

/**
 * Validate BDE ID format
 */
export function isValidBDEId(bdeId: string): boolean {
  return typeof bdeId === 'string' && bdeId.length > 0
}

/**
 * Format BDE name for display
 */
export function formatBDEName(name: string): string {
  if (!name) return 'Unknown'
  return name.trim()
}

/**
 * Get BDE initials
 */
export function getBDEInitials(name: string): string {
  if (!name) return '??'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Format employee code
 */
export function formatEmployeeCode(code: string): string {
  if (!code) return 'N/A'
  return code.toUpperCase()
}

/**
 * Check if BDE is active
 */
export function isBDEActive(status: string): boolean {
  return status === 'ACTIVE'
}

/**
 * Get BDE status color
 */
export function getBDEStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'green'
    case 'INACTIVE':
      return 'gray'
    case 'ON_LEAVE':
      return 'yellow'
    case 'SUSPENDED':
      return 'red'
    default:
      return 'gray'
  }
}

/**
 * Sort BDEs by name
 */
export function sortBDEsByName(bdes: BDEInfo[]): BDEInfo[] {
  return [...bdes].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Sort BDEs by employee code
 */
export function sortBDEsByCode(bdes: BDEInfo[]): BDEInfo[] {
  return [...bdes].sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))
}

/**
 * Filter active BDEs
 */
export function filterActiveBDEs(bdes: BDEInfo[]): BDEInfo[] {
  return bdes.filter((bde) => isBDEActive(bde.status))
}

/**
 * Find BDE by ID
 */
export function findBDEById(bdes: BDEInfo[], bdeId: string): BDEInfo | undefined {
  return bdes.find((bde) => bde.id === bdeId)
}

/**
 * Find BDE by employee code
 */
export function findBDEByCode(bdes: BDEInfo[], code: string): BDEInfo | undefined {
  return bdes.find((bde) => bde.employeeCode === code)
}

/**
 * Get BDEs by manager (sync helper)
 */
export function getBDEsByManager(bdes: BDEInfo[], managerId: string): BDEInfo[] {
  return bdes.filter((bde) => bde.managerId === managerId)
}

/**
 * Count active BDEs
 */
export function countActiveBDEs(bdes: BDEInfo[]): number {
  return filterActiveBDEs(bdes).length
}

/**
 * Get current BDM ID from auth (sync helper)
 */
export function getCurrentBDMIdFromAuth(auth: unknown): string | null {
  return auth?.user?.id || null
}

/**
 * Get BDE IDs from BDE array (sync helper)
 */
export function getBDEIdsFromArray(bdes: BDEInfo[]): string[] {
  return bdes.map((bde) => bde.id)
}

/**
 * Get BDEs by IDs from array (sync helper)
 */
export function filterBDEsByIds(bdes: BDEInfo[], ids: string[]): BDEInfo[] {
  return bdes.filter((bde) => ids.includes(bde.id))
}

// =============================================================================
// ASYNC DATABASE FUNCTIONS - Used by API routes
// =============================================================================

/**
 * Get current BDM ID from authenticated user
 * Queries the database to verify the user is a BDM
 */
export async function getCurrentBDMId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return null
    }

    // Verify user is a BDM by checking their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, sub_role, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return null
    }

    // Check if user is a BDM
    if (profile.sub_role === 'BUSINESS_DEVELOPMENT_MANAGER' || profile.role === 'BUSINESS_DEVELOPMENT_MANAGER') {
      return user.id
    }

    return null
  } catch (error) {
    console.error('Error getting current BDM ID:', error)
    return null
  }
}

/**
 * Get BDE IDs under a specific BDM
 * Queries the database to get all BDEs reporting to this BDM
 */
export async function getBDEIds(bdmId: string): Promise<string[]> {
  try {
    const supabase = await createClient()

    // Get all employees who report to this BDM and are BDEs
    const { data: bdes, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('manager_id', bdmId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (error) {
      console.error('Error fetching BDE IDs:', error)
      return []
    }

    return bdes?.map(bde => bde.id) || []
  } catch (error) {
    console.error('Error in getBDEIds:', error)
    return []
  }
}

/**
 * Get BDE details by their IDs
 * Queries the database to get full BDE information
 */
export async function getBDEsByIds(bdeIds: string[]): Promise<BDEInfo[]> {
  try {
    if (!bdeIds || bdeIds.length === 0) {
      return []
    }

    const supabase = await createClient()

    const { data: bdes, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        employee_id,
        manager_id,
        status,
        sub_role
      `)
      .in('id', bdeIds)

    if (error) {
      console.error('Error fetching BDEs by IDs:', error)
      return []
    }

    return (bdes || []).map(bde => ({
      id: bde.id,
      name: bde.full_name || 'Unknown',
      email: bde.email || '',
      employeeCode: bde.employee_id || '',
      managerId: bde.manager_id || '',
      status: bde.status || 'ACTIVE',
      subRole: bde.sub_role || ''
    }))
  } catch (error) {
    console.error('Error in getBDEsByIds:', error)
    return []
  }
}

/**
 * Get all BDEs under a BDM with full details
 */
export async function getAllBDEsForBDM(bdmId: string): Promise<BDEInfo[]> {
  const bdeIds = await getBDEIds(bdmId)
  if (bdeIds.length === 0) return []
  return getBDEsByIds(bdeIds)
}
