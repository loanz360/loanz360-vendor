/**
 * Enterprise Password Policy Validation
 * Fortune 500 Standard Password Requirements
 *
 * Compliance: NIST SP 800-63B, PCI-DSS, SOX, GDPR
 *
 * SECURITY: Centralized password policy ensures consistent security
 * across all authentication flows (registration, reset, change password)
 */

import { z } from 'zod'

/**
 * Password Policy Constants
 * Fortune 500 Enterprise Standard
 */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 12,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL_CHAR: true,
  HISTORY_COUNT: 5, // Prevent reuse of last 5 passwords
  MAX_AGE_DAYS: 90, // Force password change every 90 days
  MIN_AGE_HOURS: 24, // Prevent rapid password changes
  LOCKOUT_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
} as const

/**
 * Special characters allowed in passwords
 */
const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?'

/**
 * Password validation error messages
 */
export const PASSWORD_ERRORS = {
  TOO_SHORT: `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`,
  TOO_LONG: `Password must not exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`,
  NO_UPPERCASE: 'Password must contain at least one uppercase letter (A-Z)',
  NO_LOWERCASE: 'Password must contain at least one lowercase letter (a-z)',
  NO_NUMBER: 'Password must contain at least one number (0-9)',
  NO_SPECIAL: `Password must contain at least one special character (${SPECIAL_CHARS})`,
  COMMON_PASSWORD: 'This password is too common. Please choose a more unique password',
  CONTAINS_EMAIL: 'Password must not contain your email address',
  CONTAINS_USERNAME: 'Password must not contain your username',
  SEQUENTIAL: 'Password must not contain sequential characters (e.g., 123, abc)',
  REPEATED: 'Password must not contain repeated characters (e.g., aaa, 111)',
} as const

/**
 * Common weak passwords to reject (partial list)
 * In production, use a comprehensive dictionary check
 */
const COMMON_PASSWORDS = [
  'password', 'password123', 'Password123!', '123456789', 'qwerty123',
  'admin123', 'letmein', 'welcome123', 'monkey123', 'dragon123',
  'master123', 'sunshine123', 'princess123', 'football123', 'shadow123'
]

/**
 * Check if password contains sequential characters
 */
function hasSequentialChars(password: string): boolean {
  const sequences = [
    '0123456789', 'abcdefghijklmnopqrstuvwxyz',
    '9876543210', 'zyxwvutsrqponmlkjihgfedcba'
  ]

  const lower = password.toLowerCase()
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 3; i++) {
      if (lower.includes(seq.substring(i, i + 3))) {
        return true
      }
    }
  }
  return false
}

/**
 * Check if password contains repeated characters
 */
function hasRepeatedChars(password: string): boolean {
  for (let i = 0; i < password.length - 2; i++) {
    if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
      return true
    }
  }
  return false
}

/**
 * Validate password against enterprise policy
 *
 * @param password - Password to validate
 * @param email - Optional email to prevent password containing email
 * @param username - Optional username to prevent password containing username
 * @returns Validation result with detailed error messages
 */
export function validatePassword(
  password: string,
  email?: string,
  username?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Length checks
  if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
    errors.push(PASSWORD_ERRORS.TOO_SHORT)
  }
  if (password.length > PASSWORD_POLICY.MAX_LENGTH) {
    errors.push(PASSWORD_ERRORS.TOO_LONG)
  }

  // Complexity checks
  if (PASSWORD_POLICY.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push(PASSWORD_ERRORS.NO_UPPERCASE)
  }
  if (PASSWORD_POLICY.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push(PASSWORD_ERRORS.NO_LOWERCASE)
  }
  if (PASSWORD_POLICY.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push(PASSWORD_ERRORS.NO_NUMBER)
  }
  if (PASSWORD_POLICY.REQUIRE_SPECIAL_CHAR) {
    const specialRegex = new RegExp(`[${SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`)
    if (!specialRegex.test(password)) {
      errors.push(PASSWORD_ERRORS.NO_SPECIAL)
    }
  }

  // Common password check
  const lowerPassword = password.toLowerCase()
  if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common.toLowerCase()))) {
    errors.push(PASSWORD_ERRORS.COMMON_PASSWORD)
  }

  // Email/username check
  if (email && password.toLowerCase().includes(email.toLowerCase().split('@')[0])) {
    errors.push(PASSWORD_ERRORS.CONTAINS_EMAIL)
  }
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    errors.push(PASSWORD_ERRORS.CONTAINS_USERNAME)
  }

  // Sequential characters check
  if (hasSequentialChars(password)) {
    errors.push(PASSWORD_ERRORS.SEQUENTIAL)
  }

  // Repeated characters check
  if (hasRepeatedChars(password)) {
    errors.push(PASSWORD_ERRORS.REPEATED)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Zod schema for password validation
 * Use this in all API route validators
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_POLICY.MIN_LENGTH, PASSWORD_ERRORS.TOO_SHORT)
  .max(PASSWORD_POLICY.MAX_LENGTH, PASSWORD_ERRORS.TOO_LONG)
  .regex(/[A-Z]/, PASSWORD_ERRORS.NO_UPPERCASE)
  .regex(/[a-z]/, PASSWORD_ERRORS.NO_LOWERCASE)
  .regex(/[0-9]/, PASSWORD_ERRORS.NO_NUMBER)
  .regex(
    new RegExp(`[${SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`),
    PASSWORD_ERRORS.NO_SPECIAL
  )
  .refine(
    (pwd) => !COMMON_PASSWORDS.some(common => pwd.toLowerCase().includes(common.toLowerCase())),
    { message: PASSWORD_ERRORS.COMMON_PASSWORD }
  )
  .refine(
    (pwd) => !hasSequentialChars(pwd),
    { message: PASSWORD_ERRORS.SEQUENTIAL }
  )
  .refine(
    (pwd) => !hasRepeatedChars(pwd),
    { message: PASSWORD_ERRORS.REPEATED }
  )

/**
 * Password strength calculator
 * Returns score 0-100
 */
export function calculatePasswordStrength(password: string): {
  score: number
  level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent'
} {
  let score = 0

  // Length score (max 25 points)
  score += Math.min(25, (password.length - PASSWORD_POLICY.MIN_LENGTH) * 2)

  // Complexity score (max 40 points)
  if (/[A-Z]/.test(password)) score += 10
  if (/[a-z]/.test(password)) score += 10
  if (/[0-9]/.test(password)) score += 10
  if (new RegExp(`[${SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password)) {
    score += 10
  }

  // Uniqueness score (max 20 points)
  const uniqueChars = new Set(password.split('')).size
  score += Math.min(20, uniqueChars * 2)

  // Entropy score (max 15 points)
  if (!hasSequentialChars(password)) score += 8
  if (!hasRepeatedChars(password)) score += 7

  // Normalize to 100
  score = Math.min(100, score)

  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent'
  if (score < 40) level = 'weak'
  else if (score < 60) level = 'fair'
  else if (score < 75) level = 'good'
  else if (score < 90) level = 'strong'
  else level = 'excellent'

  return { score, level }
}

/**
 * Generate password policy description for UI
 */
export function getPasswordPolicyDescription(): string {
  return `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters and include:
  • At least one uppercase letter (A-Z)
  • At least one lowercase letter (a-z)
  • At least one number (0-9)
  • At least one special character (${SPECIAL_CHARS})
  • No sequential characters (e.g., 123, abc)
  • No repeated characters (e.g., aaa, 111)`
}

/**
 * Example usage in API routes:
 *
 * ```typescript
 * import { passwordSchema, validatePassword } from '@/lib/validation/password-policy'
 *
 * const schema = z.object({
 *   email: z.string().email(),
 *   password: passwordSchema,
 * })
 *
 * // Or for custom validation:
 * const result = validatePassword(password, email)
 * if (!result.valid) {
 *   return NextResponse.json({ errors: result.errors }, { status: 400 })
 * }
 * ```
 */
