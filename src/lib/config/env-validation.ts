/**
 * Environment Variable Validation
 * 
 * SECURITY: Validates all required environment variables at application startup
 * Fails fast with clear error messages if critical configuration is missing
 * 
 * COMPLIANCE: Ensures secure configuration before handling sensitive data
 */

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = {
  // Supabase Configuration (CRITICAL)
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    description: 'Supabase project URL',
    validation: (val: string) => val.startsWith('https://') && val.includes('.supabase.co'),
    errorMessage: 'Must be a valid Supabase URL (https://*.supabase.co)'
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    required: true,
    description: 'Supabase anonymous key',
    validation: (val: string) => val.length > 100 && val.startsWith('eyJ'),
    errorMessage: 'Must be a valid JWT token starting with eyJ'
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    description: 'Supabase service role key (server-side only)',
    validation: (val: string) => val.length > 100 && val.startsWith('eyJ'),
    errorMessage: 'Must be a valid JWT token starting with eyJ'
  },
  
  // JWT Secrets (CRITICAL)
  JWT_SECRET: {
    required: true,
    description: 'JWT signing secret',
    validation: (val: string) => val.length >= 32,
    errorMessage: 'Must be at least 32 characters for security'
  },
  SESSION_SECRET: {
    required: true,
    description: 'Session encryption secret',
    validation: (val: string) => val.length >= 32,
    errorMessage: 'Must be at least 32 characters for security'
  },
  CSRF_SECRET: {
    required: true,
    description: 'CSRF token secret',
    validation: (val: string) => val.length >= 32,
    errorMessage: 'Must be at least 32 characters for security'
  },
  JWT_REFRESH_SECRET: {
    required: true,
    description: 'JWT refresh token secret',
    validation: (val: string) => val.length >= 32,
    errorMessage: 'Must be at least 32 characters for security'
  },
  
  // Application Configuration
  NODE_ENV: {
    required: true,
    description: 'Node environment',
    validation: (val: string) => ['development', 'production', 'test'].includes(val),
    errorMessage: 'Must be development, production, or test'
  },
  NEXTAUTH_URL: {
    required: true,
    description: 'Next Auth URL',
    validation: (val: string) => val.startsWith('http'),
    errorMessage: 'Must be a valid URL starting with http/https'
  },
  NEXTAUTH_SECRET: {
    required: true,
    description: 'Next Auth secret',
    validation: (val: string) => val.length >= 32,
    errorMessage: 'Must be at least 32 characters'
  },
  
  // Optional but recommended
  NEXT_PUBLIC_APP_URL: {
    required: false,
    description: 'Public application URL'
  },
  NEXT_PUBLIC_APP_NAME: {
    required: false,
    description: 'Application name'
  }
} as const

/**
 * Validation errors collection
 */
interface ValidationError {
  variable: string
  error: string
  description: string
}

/**
 * Validate a single environment variable
 */
function validateEnvVar(
  name: string,
  config: typeof REQUIRED_ENV_VARS[keyof typeof REQUIRED_ENV_VARS]
): ValidationError | null {
  const value = process.env[name]
  
  // Check if required variable is missing
  if (config.required && !value) {
    return {
      variable: name,
      error: 'Missing required environment variable',
      description: config.description
    }
  }
  
  // If value exists and validation function is provided, validate it
  if (value && 'validation' in config && config.validation && !config.validation(value)) {
    return {
      variable: name,
      error: 'errorMessage' in config && config.errorMessage ? config.errorMessage : 'Invalid value',
      description: config.description
    }
  }
  
  return null
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): {
  isValid: boolean
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []
  
  // Validate each environment variable
  for (const [name, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const error = validateEnvVar(name, config)
    if (error) {
      errors.push(error)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Format validation errors for display
 */
function formatValidationErrors(errors: ValidationError[]): string {
  const lines = [
    '',
    '═══════════════════════════════════════════════════════════',
    '  ❌ ENVIRONMENT VARIABLE VALIDATION FAILED',
    '═══════════════════════════════════════════════════════════',
    '',
    'The following environment variables are missing or invalid:',
    ''
  ]
  
  errors.forEach((error, index) => {
    lines.push(`${index + 1}. ${error.variable}`)
    lines.push(`   Error: ${error.error}`)
    lines.push(`   Description: ${error.description}`)
    lines.push('')
  })
  
  lines.push('Please update your .env.local file with the required variables.')
  lines.push('See .env.example for reference.')
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('')
  
  return lines.join('\n')
}

/**
 * Validate environment and throw error if invalid
 * Call this at application startup
 */
export function validateEnvironmentOrThrow(): void {
  const { isValid, errors } = validateEnvironment()

  if (!isValid) {
    const errorMessage = formatValidationErrors(errors)
    // eslint-disable-next-line no-console
    console.error(errorMessage)

    // Throw error to stop application startup
    throw new Error(
      `Environment validation failed. Found ${errors.length} error(s). ` +
      'Check console output for details.'
    )
  }

  // Log success in development
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
  }
}

/**
 * Get type-safe environment configuration
 */
export function getConfig() {
  // Ensure environment is validated
  const { isValid } = validateEnvironment()
  if (!isValid) {
    throw new Error('Environment not validated. Call validateEnvironmentOrThrow() first.')
  }
  
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    jwt: {
      secret: process.env.JWT_SECRET!,
      sessionSecret: process.env.SESSION_SECRET!,
      csrfSecret: process.env.CSRF_SECRET!,
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
    },
    app: {
      nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
      url: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL!,
      name: process.env.NEXT_PUBLIC_APP_NAME || 'LOANZ 360',
    },
    auth: {
      url: process.env.NEXTAUTH_URL!,
      secret: process.env.NEXTAUTH_SECRET!,
    }
  }
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}
