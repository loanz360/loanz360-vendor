/**
 * Access Control Library
 * IP and Geographic access control utilities
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import logger from '@/lib/monitoring/logger'

export interface AccessCheckResult {
  access_allowed: boolean
  ip_blacklisted: boolean
  ip_whitelisted: boolean
  country_allowed: boolean
  block_reason?: string
}

/**
 * Check if access is allowed for admin from IP and country
 */
export async function checkAccessAllowed(
  adminId: string,
  ipAddress: string,
  countryCode?: string
): Promise<AccessCheckResult> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase.rpc('check_access_allowed', {
      p_admin_id: adminId,
      p_ip_address: ipAddress,
      p_country_code: countryCode || null
    })

    if (error) throw error

    return data as AccessCheckResult
  } catch (error) {
    logger.error('Failed to check access', error instanceof Error ? error : undefined, {
      admin_id: adminId,
      ip_address: ipAddress
    })

    // SECURITY: Fail closed — deny access when verification fails
    return {
      access_allowed: false,
      ip_blacklisted: false,
      ip_whitelisted: false,
      country_allowed: false,
      block_reason: 'Access verification unavailable — denied for safety'
    }
  }
}

/**
 * Log an access violation
 */
export async function logAccessViolation(params: {
  admin_id?: string
  admin_unique_id?: string
  ip_address: string
  country_code?: string
  city?: string
  violation_type: string
  violation_details?: Record<string, any>
  user_agent?: string
  attempted_action?: string
}): Promise<string | null> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase.rpc('log_ip_violation', {
      p_admin_id: params.admin_id || null,
      p_admin_unique_id: params.admin_unique_id || null,
      p_ip_address: params.ip_address,
      p_country_code: params.country_code || null,
      p_city: params.city || null,
      p_violation_type: params.violation_type,
      p_violation_details: params.violation_details || null,
      p_user_agent: params.user_agent || null,
      p_attempted_action: params.attempted_action || null
    })

    if (error) throw error

    logger.warn('Access violation logged', {
      violation_type: params.violation_type,
      ip_address: params.ip_address,
      admin_id: params.admin_id
    })

    return data
  } catch (error) {
    logger.error('Failed to log violation', error instanceof Error ? error : undefined)
    return null
  }
}

/**
 * Add IP to whitelist for admin
 */
export async function addIPToWhitelist(params: {
  admin_id: string
  ip_address: string
  description?: string
  notes?: string
  expires_at?: Date
  added_by: string
}): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('admin_ip_whitelist')
      .insert({
        admin_id: params.admin_id,
        ip_address: params.ip_address,
        description: params.description,
        notes: params.notes,
        expires_at: params.expires_at?.toISOString(),
        added_by: params.added_by
      })

    if (error) throw error

    logger.info('IP added to whitelist', {
      admin_id: params.admin_id,
      ip_address: params.ip_address
    })

    return true
  } catch (error) {
    logger.error('Failed to add IP to whitelist', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Remove IP from whitelist
 */
export async function removeIPFromWhitelist(
  whitelistId: string
): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('admin_ip_whitelist')
      .update({ is_active: false })
      .eq('id', whitelistId)

    if (error) throw error

    logger.info('IP removed from whitelist', { whitelist_id: whitelistId })

    return true
  } catch (error) {
    logger.error('Failed to remove IP from whitelist', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Add IP to global blacklist
 */
export async function addIPToBlacklist(params: {
  ip_address: string
  reason: string
  severity?: string
  is_permanent?: boolean
  expires_at?: Date
  added_by: string
}): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('ip_blacklist')
      .insert({
        ip_address: params.ip_address,
        reason: params.reason,
        severity: params.severity || 'medium',
        is_permanent: params.is_permanent || false,
        expires_at: params.expires_at?.toISOString(),
        added_by: params.added_by
      })

    if (error) throw error

    logger.warn('IP added to blacklist', {
      ip_address: params.ip_address,
      reason: params.reason
    })

    return true
  } catch (error) {
    logger.error('Failed to add IP to blacklist', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Remove IP from blacklist
 */
export async function removeIPFromBlacklist(
  blacklistId: string
): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('ip_blacklist')
      .update({ is_active: false })
      .eq('id', blacklistId)

    if (error) throw error

    logger.info('IP removed from blacklist', { blacklist_id: blacklistId })

    return true
  } catch (error) {
    logger.error('Failed to remove IP from blacklist', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Add country restriction for admin
 */
export async function addCountryRestriction(params: {
  admin_id: string
  country_code: string
  country_name?: string
  restriction_type: 'allow' | 'deny'
  added_by: string
}): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('admin_country_restrictions')
      .insert({
        admin_id: params.admin_id,
        country_code: params.country_code.toUpperCase(),
        country_name: params.country_name,
        restriction_type: params.restriction_type,
        added_by: params.added_by
      })

    if (error) throw error

    logger.info('Country restriction added', {
      admin_id: params.admin_id,
      country_code: params.country_code,
      restriction_type: params.restriction_type
    })

    return true
  } catch (error) {
    logger.error('Failed to add country restriction', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Remove country restriction
 */
export async function removeCountryRestriction(
  restrictionId: string
): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('admin_country_restrictions')
      .update({ is_active: false })
      .eq('id', restrictionId)

    if (error) throw error

    logger.info('Country restriction removed', { restriction_id: restrictionId })

    return true
  } catch (error) {
    logger.error('Failed to remove country restriction', error instanceof Error ? error : undefined)
    return false
  }
}

/**
 * Get IP whitelist for admin
 */
export async function getIPWhitelist(adminId: string): Promise<any[]> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase
      .from('admin_ip_whitelist')
      .select('*')
      .eq('admin_id', adminId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Failed to get IP whitelist', error instanceof Error ? error : undefined)
    return []
  }
}

/**
 * Get country restrictions for admin
 */
export async function getCountryRestrictions(adminId: string): Promise<any[]> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase
      .from('admin_country_restrictions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Failed to get country restrictions', error instanceof Error ? error : undefined)
    return []
  }
}

/**
 * Get recent violations for admin
 */
export async function getRecentViolations(
  adminId: string,
  limit: number = 50
): Promise<any[]> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase
      .from('ip_restriction_violations')
      .select('*')
      .eq('admin_id', adminId)
      .order('occurred_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Failed to get recent violations', error instanceof Error ? error : undefined)
    return []
  }
}
