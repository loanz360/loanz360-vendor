/**
 * Partner Unique ID Generator
 * Generates unique IDs for partner registrations
 * Format: BA1, BA2, BA3... for Business Associates
 *         BP1, BP2, BP3... for Business Partners
 *         CP1, CP2, CP3... for Channel Partners
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Get the prefix for partner type
 */
function getPartnerPrefix(partnerType: string): string {
  const prefixMap: Record<string, string> = {
    'BUSINESS_ASSOCIATE': 'BA',
    'BUSINESS_PARTNER': 'BP',
    'CHANNEL_PARTNER': 'CP',
  }

  return prefixMap[partnerType] || 'PA' // PA for generic partner if type not found
}

/**
 * Get the next sequence number for a partner type
 * @param partnerType - The type of partner (BUSINESS_ASSOCIATE, BUSINESS_PARTNER, CHANNEL_PARTNER)
 * @returns The next sequence number
 */
export async function getNextPartnerSequence(partnerType: string): Promise<number> {
  const supabase = await createClient()

  // Get the prefix for this partner type
  const prefix = getPartnerPrefix(partnerType)

  // Query the partner_profiles table to find the highest sequence number
  const { data: profiles, error } = await supabase
    .from('partner_profiles')
    .select('unique_id')
    .eq('partner_type', partnerType)
    .like('unique_id', `${prefix}%`)
    .order('unique_id', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching partner sequences:', error)
    // If error, start from 1
    return 1
  }

  // If no profiles exist, start from 1
  if (!profiles || profiles.length === 0) {
    return 1
  }

  // Extract the number from the last unique_id
  const lastId = profiles[0].unique_id
  const numberMatch = lastId.match(/\d+$/)

  if (!numberMatch) {
    // If we can't parse the number, start from 1
    return 1
  }

  const lastNumber = parseInt(numberMatch[0], 10)
  return lastNumber + 1
}

/**
 * Generate a unique ID for a partner
 * @param partnerType - The type of partner (BUSINESS_ASSOCIATE, BUSINESS_PARTNER, CHANNEL_PARTNER)
 * @returns A unique ID in format like BA1, BP2, CP3, etc.
 */
export async function generatePartnerUniqueId(partnerType: string): Promise<string> {
  const prefix = getPartnerPrefix(partnerType)
  const sequence = await getNextPartnerSequence(partnerType)

  return `${prefix}${sequence}`
}

/**
 * Validate a partner unique ID format
 * @param uniqueId - The unique ID to validate
 * @returns true if valid, false otherwise
 */
export function validatePartnerUniqueId(uniqueId: string): boolean {
  // Valid formats: BA1, BA2, BP1, BP2, CP1, CP2, etc.
  const validPattern = /^(BA|BP|CP)\d+$/
  return validPattern.test(uniqueId)
}

/**
 * Get partner type from unique ID
 * @param uniqueId - The unique ID (e.g., BA1, BP2, CP3)
 * @returns The partner type or null if invalid
 */
export function getPartnerTypeFromUniqueId(uniqueId: string): string | null {
  if (!validatePartnerUniqueId(uniqueId)) {
    return null
  }

  const prefix = uniqueId.match(/^[A-Z]+/)?.[0]

  const typeMap: Record<string, string> = {
    'BA': 'BUSINESS_ASSOCIATE',
    'BP': 'BUSINESS_PARTNER',
    'CP': 'CHANNEL_PARTNER',
  }

  return typeMap[prefix || ''] || null
}
