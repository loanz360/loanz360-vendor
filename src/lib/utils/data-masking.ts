/**
 * Data Masking Utilities
 * Masks PII (phone, email, Aadhaar, PAN) for CRO-level access.
 * SuperAdmin sees full data.
 */

/**
 * Mask phone number: 9876543210 → 98XXXXX210
 */
export function maskPhone(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length < 6) return phone
  const start = cleaned.slice(0, 2)
  const end = cleaned.slice(-3)
  return `${start}${'X'.repeat(cleaned.length - 5)}${end}`
}

/**
 * Mask email: user@example.com → u***@example.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [localPart, domain] = email.split('@')
  if (localPart.length <= 1) return `${localPart}***@${domain}`
  return `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 1, 5))}@${domain}`
}

/**
 * Mask Aadhaar: 1234 5678 9012 → XXXX XXXX 9012
 */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar) return ''
  const cleaned = aadhaar.replace(/\D/g, '')
  if (cleaned.length < 4) return aadhaar
  const last4 = cleaned.slice(-4)
  return `XXXX XXXX ${last4}`
}

/**
 * Mask PAN: ABCDE1234F → ABCDEXXXXF
 */
export function maskPAN(pan: string): string {
  if (!pan || pan.length < 5) return pan
  return `${pan.slice(0, 5)}${'X'.repeat(Math.max(pan.length - 6, 0))}${pan.slice(-1)}`
}

/**
 * Mask name: Rajesh Kumar → Rajesh K.
 */
export function maskName(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  return `${parts[0]} ${parts.slice(1).map(p => `${p[0]}.`).join(' ')}`
}

/**
 * Apply masking to an object based on field names.
 * Automatically detects and masks common PII fields.
 */
export function maskRecord<T extends Record<string, unknown>>(
  record: T,
  shouldMask: boolean = true
): T {
  if (!shouldMask) return record

  const masked = { ...record }
  const phoneFields = ['phone', 'customer_phone', 'customer_mobile', 'mobile', 'contact_phone', 'alternate_phone']
  const emailFields = ['email', 'customer_email', 'contact_email']
  const aadhaarFields = ['aadhaar', 'aadhaar_number', 'aadhar']
  const panFields = ['pan', 'pan_number', 'pan_card']

  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase()
    const value = masked[key]
    if (typeof value !== 'string') continue

    if (phoneFields.includes(lowerKey)) {
      (masked as Record<string, unknown>)[key] = maskPhone(value)
    } else if (emailFields.includes(lowerKey)) {
      (masked as Record<string, unknown>)[key] = maskEmail(value)
    } else if (aadhaarFields.includes(lowerKey)) {
      (masked as Record<string, unknown>)[key] = maskAadhaar(value)
    } else if (panFields.includes(lowerKey)) {
      (masked as Record<string, unknown>)[key] = maskPAN(value)
    }
  }

  return masked
}

/**
 * Check if a user role should see masked data.
 * SuperAdmin and Admin see full data, CROs see masked.
 */
export function shouldMaskForRole(role: string): boolean {
  const unmaskedRoles = ['SUPER_ADMIN', 'ADMIN']
  return !unmaskedRoles.includes(role)
}

/**
 * Mask an array of records or a single record based on user role.
 * Convenience wrapper for API endpoints.
 */
export function maskDataForRole<T extends Record<string, unknown>>(
  data: T | T[],
  role: string,
  subRole?: string
): T | T[] {
  const shouldMask = shouldMaskForRole(subRole || role)
  if (!shouldMask) return data

  if (Array.isArray(data)) {
    return data.map(record => maskRecord(record, true))
  }
  return maskRecord(data, true)
}
