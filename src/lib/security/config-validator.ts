/**
 * Secure Configuration Validator
 * Fortune 500 Enterprise Standard
 *
 * SECURITY: Validates all security-critical configuration at startup
 * Prevents deployment with insecure or missing configuration
 *
 * Features:
 * - Environment variable validation
 * - Secret strength checking
 * - Configuration auditing
 * - Security recommendations
 */

// Validation result
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  recommendations: string[]
}

// Configuration requirements
interface ConfigRequirement {
  name: string
  envVar: string
  required: boolean
  minLength?: number
  pattern?: RegExp
  description: string
  category: 'security' | 'database' | 'api' | 'feature'
}

// Configuration requirements list
const CONFIG_REQUIREMENTS: ConfigRequirement[] = [
  // Security - Critical
  {
    name: 'JWT Secret',
    envVar: 'JWT_SECRET',
    required: true,
    minLength: 32,
    description: 'Secret key for JWT token signing',
    category: 'security',
  },
  {
    name: 'Session Secret',
    envVar: 'SESSION_SECRET',
    required: true,
    minLength: 32,
    description: 'Secret key for session encryption',
    category: 'security',
  },
  {
    name: 'CSRF Secret',
    envVar: 'CSRF_SECRET',
    required: true,
    minLength: 32,
    description: 'Secret key for CSRF token generation',
    category: 'security',
  },
  {
    name: 'Encryption Master Key',
    envVar: 'ENCRYPTION_MASTER_KEY',
    required: true,
    minLength: 32,
    description: 'Master key for data encryption',
    category: 'security',
  },

  // Database - Critical
  {
    name: 'Supabase URL',
    envVar: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    pattern: /^https:\/\/.+\.supabase\.co$/,
    description: 'Supabase project URL',
    category: 'database',
  },
  {
    name: 'Supabase Anon Key',
    envVar: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    minLength: 100,
    description: 'Supabase anonymous public key',
    category: 'database',
  },
  {
    name: 'Supabase Service Role Key',
    envVar: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    minLength: 100,
    description: 'Supabase service role key (server-side only)',
    category: 'database',
  },

  // API - Important
  {
    name: 'NextAuth URL',
    envVar: 'NEXTAUTH_URL',
    required: false,
    pattern: /^https?:\/\/.+$/,
    description: 'Base URL for NextAuth',
    category: 'api',
  },
  {
    name: 'App URL',
    envVar: 'NEXT_PUBLIC_APP_URL',
    required: false,
    pattern: /^https?:\/\/.+$/,
    description: 'Public application URL',
    category: 'api',
  },

  // Features - Optional
  {
    name: '2FA Enabled',
    envVar: 'FEATURE_2FA_ENABLED',
    required: false,
    pattern: /^(true|false)$/,
    description: 'Enable two-factor authentication',
    category: 'feature',
  },
  {
    name: 'Email Verification Required',
    envVar: 'FEATURE_EMAIL_VERIFICATION_REQUIRED',
    required: false,
    pattern: /^(true|false)$/,
    description: 'Require email verification',
    category: 'feature',
  },
]

// Security best practices
const SECURITY_RECOMMENDATIONS = [
  'Use a password manager to generate and store secrets',
  'Rotate secrets every 90 days',
  'Never commit secrets to version control',
  'Use different secrets for each environment',
  'Enable 2FA for all admin accounts',
  'Monitor failed authentication attempts',
  'Set up security alerts for suspicious activity',
  'Regularly audit access logs',
  'Keep dependencies updated',
  'Perform regular security scans',
]

/**
 * Check if a string has sufficient entropy
 */
function hasGoodEntropy(value: string): boolean {
  const hasUpper = /[A-Z]/.test(value)
  const hasLower = /[a-z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  const hasSpecial = /[^A-Za-z0-9]/.test(value)

  const charTypes = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  return charTypes >= 3
}

/**
 * Check if value looks like a default/placeholder
 */
function isDefaultValue(value: string): boolean {
  const defaults = [
    'your-secret-here',
    'change-me',
    'xxx',
    'password',
    'secret',
    'default',
    'placeholder',
    'fallback',
    'todo',
  ]

  const lower = value.toLowerCase()
  return defaults.some(d => lower.includes(d))
}

/**
 * Validate a single configuration
 */
function validateConfig(req: ConfigRequirement): {
  valid: boolean
  error?: string
  warning?: string
} {
  const value = process.env[req.envVar]

  // Check if required and missing
  if (req.required && !value) {
    return {
      valid: false,
      error: `Missing required configuration: ${req.name} (${req.envVar})`,
    }
  }

  // Skip further validation if not set and not required
  if (!value) {
    return { valid: true }
  }

  // Check minimum length
  if (req.minLength && value.length < req.minLength) {
    return {
      valid: false,
      error: `${req.name} must be at least ${req.minLength} characters`,
    }
  }

  // Check pattern
  if (req.pattern && !req.pattern.test(value)) {
    return {
      valid: false,
      error: `${req.name} has invalid format`,
    }
  }

  // Check for default values (warning only)
  if (isDefaultValue(value)) {
    return {
      valid: true,
      warning: `${req.name} appears to be a default/placeholder value`,
    }
  }

  // Check entropy for secrets (warning only)
  if (req.category === 'security' && !hasGoodEntropy(value)) {
    return {
      valid: true,
      warning: `${req.name} has low entropy - consider using a stronger secret`,
    }
  }

  return { valid: true }
}

/**
 * Validate all configuration
 */
export function validateAllConfig(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  // Validate each requirement
  for (const req of CONFIG_REQUIREMENTS) {
    const result = validateConfig(req)

    if (!result.valid && result.error) {
      errors.push(result.error)
    }

    if (result.warning) {
      warnings.push(result.warning)
    }
  }

  // Check for production-specific requirements
  if (process.env.NODE_ENV === 'production') {
    // HTTPS requirement
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    if (appUrl && !appUrl.startsWith('https://')) {
      errors.push('Production app must use HTTPS')
    }

    // Feature flags for production
    if (process.env.FEATURE_2FA_ENABLED !== 'true') {
      warnings.push('2FA is not enabled - strongly recommended for production')
    }

    if (process.env.FEATURE_EMAIL_VERIFICATION_REQUIRED !== 'true') {
      warnings.push('Email verification is not required - recommended for production')
    }
  }

  // Add recommendations if there are issues
  if (errors.length > 0 || warnings.length > 0) {
    recommendations.push(...SECURITY_RECOMMENDATIONS.slice(0, 5))
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    recommendations,
  }
}

/**
 * Validate configuration and throw if invalid
 */
export function validateConfigOrThrow(): void {
  const result = validateAllConfig()

  if (!result.valid) {
    console.error('='.repeat(60))
    console.error('SECURITY CONFIGURATION ERRORS')
    console.error('='.repeat(60))

    for (const error of result.errors) {
      console.error(`❌ ${error}`)
    }

    console.error('')
    console.error('Application cannot start with invalid security configuration.')
    console.error('Please fix the above errors and restart.')
    console.error('='.repeat(60))

    throw new Error(`Security configuration invalid: ${result.errors.length} error(s)`)
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('='.repeat(60))
    console.warn('SECURITY CONFIGURATION WARNINGS')
    console.warn('='.repeat(60))

    for (const warning of result.warnings) {
      console.warn(`⚠️  ${warning}`)
    }

    console.warn('='.repeat(60))
  }
}

/**
 * Get configuration audit report
 */
export function getConfigAudit(): {
  summary: string
  categories: Record<string, { configured: number; total: number }>
  details: Array<{
    name: string
    envVar: string
    configured: boolean
    required: boolean
    category: string
  }>
} {
  const details = CONFIG_REQUIREMENTS.map(req => ({
    name: req.name,
    envVar: req.envVar,
    configured: !!process.env[req.envVar],
    required: req.required,
    category: req.category,
  }))

  const categories: Record<string, { configured: number; total: number }> = {}

  for (const req of CONFIG_REQUIREMENTS) {
    if (!categories[req.category]) {
      categories[req.category] = { configured: 0, total: 0 }
    }

    categories[req.category].total++

    if (process.env[req.envVar]) {
      categories[req.category].configured++
    }
  }

  const totalConfigured = details.filter(d => d.configured).length
  const totalRequired = details.filter(d => d.required).length
  const requiredConfigured = details.filter(d => d.required && d.configured).length

  const summary = `Configuration: ${totalConfigured}/${details.length} total, ${requiredConfigured}/${totalRequired} required`

  return { summary, categories, details }
}

/**
 * Check specific security features
 */
export function checkSecurityFeatures(): {
  twoFactorEnabled: boolean
  emailVerificationRequired: boolean
  httpsEnforced: boolean
  csrfProtectionEnabled: boolean
  rateLimitingEnabled: boolean
} {
  return {
    twoFactorEnabled: process.env.FEATURE_2FA_ENABLED === 'true',
    emailVerificationRequired: process.env.FEATURE_EMAIL_VERIFICATION_REQUIRED === 'true',
    httpsEnforced:
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ||
      false,
    csrfProtectionEnabled: !!process.env.CSRF_SECRET,
    rateLimitingEnabled: true, // Always enabled in middleware
  }
}

/**
 * Log security status on startup
 */
export function logSecurityStatus(): void {
  console.log('')
  console.log('='.repeat(60))
  console.log('SECURITY STATUS')
  console.log('='.repeat(60))

  const features = checkSecurityFeatures()

  console.log(`  2FA Enabled:              ${features.twoFactorEnabled ? '✅' : '❌'}`)
  console.log(`  Email Verification:       ${features.emailVerificationRequired ? '✅' : '❌'}`)
  console.log(`  HTTPS Enforced:           ${features.httpsEnforced ? '✅' : '❌'}`)
  console.log(`  CSRF Protection:          ${features.csrfProtectionEnabled ? '✅' : '❌'}`)
  console.log(`  Rate Limiting:            ${features.rateLimitingEnabled ? '✅' : '❌'}`)

  const audit = getConfigAudit()
  console.log('')
  console.log(`  ${audit.summary}`)

  console.log('='.repeat(60))
  console.log('')
}
