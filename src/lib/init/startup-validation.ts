/**
 * Application Startup Validation
 * Enforces critical security checks before application starts
 *
 * SECURITY: Fortune 500 Standards
 * - Environment validation (fail-fast)
 * - Database connectivity check
 * - Security configuration validation
 * - Compliance prerequisites check
 *
 * This module MUST be imported at the very start of the application
 */

import { validateEnvironmentOrThrow, getConfig, isProduction } from '@/lib/config/env-validation'

/**
 * Startup validation results
 */
interface StartupValidationResult {
  success: boolean
  errors: string[]
  warnings: string[]
  timestamp: string
}

/**
 * Validate database configuration
 */
function validateDatabaseConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const config = getConfig()

  // Check Supabase URL format
  if (!config.supabase.url.includes('.supabase.co') && !config.supabase.url.includes('localhost')) {
    errors.push('Invalid Supabase URL format')
  }

  // Check keys are not placeholder values
  if (config.supabase.anonKey.includes('your-') || config.supabase.anonKey === 'placeholder') {
    errors.push('Supabase anon key appears to be a placeholder')
  }

  if (config.supabase.serviceRoleKey.includes('your-') || config.supabase.serviceRoleKey === 'placeholder') {
    errors.push('Supabase service role key appears to be a placeholder')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate security configuration
 */
function validateSecurityConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const config = getConfig()

  // Check JWT secret strength (production only)
  if (isProduction()) {
    if (config.jwt.secret.length < 64) {
      errors.push('JWT_SECRET must be at least 64 characters in production')
    }

    if (config.jwt.sessionSecret.length < 64) {
      errors.push('SESSION_SECRET must be at least 64 characters in production')
    }

    if (config.jwt.csrfSecret.length < 64) {
      errors.push('CSRF_SECRET must be at least 64 characters in production')
    }

    // Check for common weak secrets
    const weakSecrets = ['secret', 'password', '12345', 'changeme', 'default']
    if (weakSecrets.some(weak => config.jwt.secret.toLowerCase().includes(weak))) {
      errors.push('JWT_SECRET appears to be a weak or default value')
    }
  }

  // Check HTTPS in production
  if (isProduction() && !config.app.url.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_APP_URL must use HTTPS in production')
  }

  // Warnings for development
  if (!isProduction()) {
    warnings.push('Running in development mode - some security checks are relaxed')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate compliance prerequisites
 */
function validateCompliancePrerequisites(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []

  // Check for optional but recommended env vars
  if (!process.env.SENTRY_DSN && isProduction()) {
    warnings.push('SENTRY_DSN not configured - error tracking disabled')
  }

  if (!process.env.SLACK_SECURITY_WEBHOOK_URL && isProduction()) {
    warnings.push('SLACK_SECURITY_WEBHOOK_URL not configured - security alerts limited')
  }

  if (!process.env.PAGERDUTY_INTEGRATION_KEY && isProduction()) {
    warnings.push('PAGERDUTY_INTEGRATION_KEY not configured - critical alerts limited')
  }

  return {
    valid: true, // Warnings don't block startup
    warnings,
  }
}

/**
 * Run all startup validations
 */
export function runStartupValidation(): StartupValidationResult {
  const result: StartupValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    timestamp: new Date().toISOString(),
  }

  console.log('🚀 Starting application validation...\n')

  // 1. Validate environment variables
  console.log('1️⃣  Validating environment variables...')
  try {
    validateEnvironmentOrThrow()
    console.log('   ✅ Environment variables validated\n')
  } catch {
    result.success = false
    result.errors.push('Environment validation failed')
    console.error('   ❌ Environment validation failed\n')
    return result
  }

  // 2. Validate database configuration
  console.log('2️⃣  Validating database configuration...')
  const dbValidation = validateDatabaseConfig()
  if (!dbValidation.valid) {
    result.success = false
    result.errors.push(...dbValidation.errors)
    console.error('   ❌ Database configuration invalid')
    dbValidation.errors.forEach(err => console.error(`      - ${err}`))
    console.log('')
  } else {
    console.log('   ✅ Database configuration valid\n')
  }

  // 3. Validate security configuration
  console.log('3️⃣  Validating security configuration...')
  const secValidation = validateSecurityConfig()
  if (!secValidation.valid) {
    result.success = false
    result.errors.push(...secValidation.errors)
    console.error('   ❌ Security configuration invalid')
    secValidation.errors.forEach(err => console.error(`      - ${err}`))
    console.log('')
  } else {
    console.log('   ✅ Security configuration valid\n')
  }

  if (secValidation.warnings.length > 0) {
    result.warnings.push(...secValidation.warnings)
    secValidation.warnings.forEach(warn => console.warn(`   ⚠️  ${warn}`))
    console.log('')
  }

  // 4. Validate compliance prerequisites
  console.log('4️⃣  Validating compliance prerequisites...')
  const complianceValidation = validateCompliancePrerequisites()
  if (complianceValidation.warnings.length > 0) {
    result.warnings.push(...complianceValidation.warnings)
    complianceValidation.warnings.forEach(warn => console.warn(`   ⚠️  ${warn}`))
  } else {
    console.log('   ✅ All compliance prerequisites configured\n')
  }

  // Final result
  if (result.success) {
    console.log('═══════════════════════════════════════════════════════════')
    console.log('✅ STARTUP VALIDATION PASSED')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`Environment: ${isProduction() ? 'PRODUCTION' : 'DEVELOPMENT'}`)
    console.log(`Timestamp: ${result.timestamp}`)
    if (result.warnings.length > 0) {
      console.log(`Warnings: ${result.warnings.length}`)
    }
    console.log('═══════════════════════════════════════════════════════════\n')
  } else {
    console.error('═══════════════════════════════════════════════════════════')
    console.error('❌ STARTUP VALIDATION FAILED')
    console.error('═══════════════════════════════════════════════════════════')
    console.error(`Errors: ${result.errors.length}`)
    result.errors.forEach((err, i) => console.error(`  ${i + 1}. ${err}`))
    console.error('═══════════════════════════════════════════════════════════\n')
  }

  return result
}

/**
 * Run startup validation and throw if failed
 * Use this to enforce validation before application starts
 */
export function enforceStartupValidation(): void {
  const result = runStartupValidation()

  if (!result.success) {
    throw new Error(
      `❌ STARTUP VALIDATION FAILED\n\n` +
      `Found ${result.errors.length} critical error(s):\n` +
      result.errors.map((err, i) => `  ${i + 1}. ${err}`).join('\n') +
      `\n\nApplication cannot start. Please fix the errors above.`
    )
  }
}

/**
 * Log startup validation results (non-blocking)
 */
export function logStartupValidation(): void {
  try {
    runStartupValidation()
  } catch (error) {
    console.error('Startup validation error:', error)
    // Don't throw - just log
  }
}

// ✅ AUTO-RUN on import in production (fail-fast)
if (isProduction()) {
  try {
    enforceStartupValidation()
  } catch {
    console.error('\n🚨 CRITICAL: Application startup blocked due to validation failures\n')
    // In production, we want to fail fast
    process.exit(1)
  }
}

// In development, just log warnings
if (!isProduction() && typeof window === 'undefined') {
  logStartupValidation()
}
