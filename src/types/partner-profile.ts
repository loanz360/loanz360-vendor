/**
 * Partner Profile Types for BA, BP, CP
 * Comprehensive type definitions for My Profile section
 */

export type PartnerType = 'BA' | 'BP' | 'CP' | 'BUSINESS_ASSOCIATE' | 'BUSINESS_PARTNER' | 'CHANNEL_PARTNER'

/**
 * Complete Partner Profile Data Structure
 * Used across BA, BP, and CP portals
 */
export interface PartnerProfileData {
  // System Fields (Non-editable)
  id?: string
  user_id?: string
  partner_id: string // Auto-generated: BA1, BA2, BP1, BP2, CP1, CP2
  partner_type: PartnerType

  // ===================================
  // SECTION 1: PERSONAL DETAILS
  // ===================================

  // Profile Picture
  profile_picture_url: string | null

  // Basic Information
  full_name: string
  mobile_number: string
  work_email: string // Readonly if from registration

  // Present Address Details
  present_address: string
  present_address_proof_url: string | null
  present_address_proof_type: string | null
  state_name: string
  state_code: string
  pincode: string // 6-digit validation (matches database column)

  // Permanent Address Details
  permanent_address: string
  permanent_address_proof_url: string | null
  permanent_address_proof_type: string | null

  // Description / Bio
  bio_description: string

  // ===================================
  // SECTION 2: BANK DETAILS (PROFESSIONAL)
  // ===================================

  bank_name: string
  branch_name: string
  account_number: string // Encrypted in database
  ifsc_code: string // Validated format (11 characters)
  micr_code: string | null // Optional, validated
  account_holder_name: string
  cancelled_cheque_url: string | null

  // ===================================
  // METADATA
  // ===================================

  is_active?: boolean
  created_at?: string
  updated_at?: string
}

/**
 * Partner Profile Form Data (for UI forms)
 * Excludes system-generated fields
 */
export interface PartnerProfileFormData extends Omit<PartnerProfileData, 'id' | 'user_id' | 'partner_id' | 'partner_type' | 'is_active' | 'created_at' | 'updated_at'> {}

/**
 * Indian State data structure
 */
export interface IndianState {
  id: number
  state_name: string
  state_code: string
}

/**
 * File Upload Response
 */
export interface FileUploadResponse {
  success: boolean
  url: string
  filename: string
  size: number
  type: string
  uploaded_at: string
}

/**
 * Partner Profile API Response
 */
export interface PartnerProfileResponse {
  success: boolean
  profile: PartnerProfileData
  message?: string
}

/**
 * Allowed file types for uploads
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
export const ALLOWED_DOCUMENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']

/**
 * File size limits (in bytes)
 */
export const MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024 // 5MB
export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * IFSC Code Validation Pattern
 */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/

/**
 * MICR Code Validation Pattern
 */
export const MICR_PATTERN = /^[0-9]{9}$/

/**
 * PIN Code Validation Pattern
 */
export const PIN_CODE_PATTERN = /^[0-9]{6}$/

/**
 * Mobile Number Validation Pattern (10 digits)
 */
export const MOBILE_PATTERN = /^[0-9]{10}$/

/**
 * Helper function to validate IFSC code
 */
export function validateIFSC(ifsc: string): boolean {
  return IFSC_PATTERN.test(ifsc)
}

/**
 * Helper function to validate MICR code
 */
export function validateMICR(micr: string): boolean {
  return MICR_PATTERN.test(micr)
}

/**
 * Helper function to validate PIN code
 */
export function validatePinCode(pinCode: string): boolean {
  return PIN_CODE_PATTERN.test(pinCode)
}

/**
 * Helper function to validate mobile number
 */
export function validateMobile(mobile: string): boolean {
  return MOBILE_PATTERN.test(mobile)
}

/**
 * Format partner ID for display
 */
export function formatPartnerId(partnerId: string, partnerType: PartnerType): string {
  if (!partnerId) {
    const prefix = partnerType === 'BA' || partnerType === 'BUSINESS_ASSOCIATE' ? 'BA'
                 : partnerType === 'BP' || partnerType === 'BUSINESS_PARTNER' ? 'BP'
                 : partnerType === 'CP' || partnerType === 'CHANNEL_PARTNER' ? 'CP'
                 : 'PA'
    return `${prefix}#`
  }
  return partnerId
}

/**
 * Get partner type display name
 */
export function getPartnerTypeLabel(partnerType: PartnerType): string {
  switch (partnerType) {
    case 'BA':
    case 'BUSINESS_ASSOCIATE':
      return 'Business Associate'
    case 'BP':
    case 'BUSINESS_PARTNER':
      return 'Business Partner'
    case 'CP':
    case 'CHANNEL_PARTNER':
      return 'Channel Partner'
    default:
      return 'Partner'
  }
}
