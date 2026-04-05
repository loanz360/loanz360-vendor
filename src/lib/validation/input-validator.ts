/**
 * Input Validation and Sanitization
 * Prevents injection attacks and ensures data integrity
 */

/**
 * Validate role key format
 * Must be uppercase letters and underscores only
 */
export function validateRoleKey(key: string): { valid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Role key is required' }
  }

  if (key.length < 2 || key.length > 100) {
    return { valid: false, error: 'Role key must be between 2 and 100 characters' }
  }

  if (!/^[A-Z_]+$/.test(key)) {
    return { valid: false, error: 'Role key must contain only uppercase letters and underscores' }
  }

  // Check for reserved keywords
  const reservedKeys = ['ADMIN', 'SUPER_ADMIN', 'USER', 'GUEST', 'SYSTEM']
  if (reservedKeys.includes(key)) {
    return { valid: false, error: 'Role key is reserved' }
  }

  return { valid: true }
}

/**
 * Validate role name
 * Allows letters, numbers, spaces, and common punctuation
 */
export function validateRoleName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Role name is required' }
  }

  const trimmed = name.trim()

  if (trimmed.length < 2 || trimmed.length > 255) {
    return { valid: false, error: 'Role name must be between 2 and 255 characters' }
  }

  // Allow letters, numbers, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z0-9\s\-']+$/.test(trimmed)) {
    return { valid: false, error: 'Role name contains invalid characters' }
  }

  return { valid: true }
}

/**
 * Validate role type
 */
export function validateRoleType(type: string): { valid: boolean; error?: string } {
  const validTypes = ['PARTNER', 'EMPLOYEE', 'CUSTOMER']

  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Role type is required' }
  }

  if (!validTypes.includes(type)) {
    return { valid: false, error: `Role type must be one of: ${validTypes.join(', ')}` }
  }

  return { valid: true }
}

/**
 * Validate description
 * Optional field with length limits
 */
export function validateDescription(description: string | null | undefined): { valid: boolean; error?: string } {
  if (!description) {
    return { valid: true } // Description is optional
  }

  if (typeof description !== 'string') {
    return { valid: false, error: 'Description must be a string' }
  }

  if (description.length > 1000) {
    return { valid: false, error: 'Description must not exceed 1000 characters' }
  }

  return { valid: true }
}

/**
 * Sanitize string input
 * Removes dangerous characters while preserving safe ones
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove other control characters except newlines and tabs
    .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Sanitize HTML to prevent XSS
 * Escapes HTML special characters
 */
export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' }
  }

  const trimmed = email.trim().toLowerCase()

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' }
  }

  if (trimmed.length > 320) {
    return { valid: false, error: 'Email exceeds maximum length' }
  }

  return { valid: true }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string; strength?: 'weak' | 'medium' | 'strong' } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' }
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' }
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password exceeds maximum length' }
  }

  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  let score = 0

  // Check for lowercase
  if (/[a-z]/.test(password)) score++

  // Check for uppercase
  if (/[A-Z]/.test(password)) score++

  // Check for numbers
  if (/[0-9]/.test(password)) score++

  // Check for special characters
  if (/[^a-zA-Z0-9]/.test(password)) score++

  // Check length bonus
  if (password.length >= 12) score++

  if (score < 3) {
    return {
      valid: false,
      error: 'Password must contain at least 3 of: lowercase, uppercase, numbers, special characters',
      strength: 'weak'
    }
  }

  if (score === 3) {
    strength = 'medium'
  } else if (score >= 4) {
    strength = 'strong'
  }

  return { valid: true, strength }
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): { valid: boolean; error?: string } {
  if (!uuid || typeof uuid !== 'string') {
    return { valid: false, error: 'UUID is required' }
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (!uuidRegex.test(uuid)) {
    return { valid: false, error: 'Invalid UUID format' }
  }

  return { valid: true }
}

/**
 * Validate phone number (basic international format)
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' }
  }

  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '')

  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return { valid: false, error: 'Phone number must be between 10 and 15 digits' }
  }

  return { valid: true }
}
