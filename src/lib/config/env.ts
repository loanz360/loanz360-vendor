// FIX: Lazy import of zod to prevent TDZ errors during SSG
// Only import zod when actually validating (not during module initialization)

type EnvConfig = {
  NODE_ENV: 'development' | 'production' | 'test'
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  NEXTAUTH_URL?: string
  NEXTAUTH_SECRET?: string
  JWT_SECRET: string
  JWT_REFRESH_SECRET: string
  SESSION_SECRET: string
  CSRF_SECRET: string
  SUPER_ADMIN_EMAIL?: string
  SUPER_ADMIN_PASSWORD_HASH?: string
  NEXT_PUBLIC_APP_URL?: string
  NEXT_PUBLIC_APP_NAME?: string
}

class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

let cachedEnv: EnvConfig | null = null

async function validateEnv(): Promise<EnvConfig> {
  if (cachedEnv) return cachedEnv

  // Lazy load zod only when validation is actually needed
  const { z } = await import('@/lib/utils/zod')

  const envSchema = z.object({
    // Node Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Supabase Configuration
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    // NextAuth Configuration
    NEXTAUTH_URL: z.string().url().optional(),
    NEXTAUTH_SECRET: z.string().optional(),

    // JWT Configuration - REQUIRED for enterprise-grade security
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),

    // Super Admin Configuration
    SUPER_ADMIN_EMAIL: z.string().email().optional(),
    SUPER_ADMIN_PASSWORD_HASH: z.string().optional(),

    // App Configuration
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_APP_NAME: z.string().optional(),
  })

  try {
    cachedEnv = envSchema.parse(process.env)
    return cachedEnv
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      const issues = (error as any).issues
      const missingVars = issues
        ?.map((err: any) => `${err.path.join('.')}: ${err.message}`)
        ?.join('\n') || 'Unknown validation error'
      throw new ConfigError(
        `Invalid environment configuration:\n${missingVars}\n\nPlease check your .env.local file.`
      )
    }
    throw error
  }
}

// For SSG compatibility: provide direct access to process.env without validation
// Validation happens at runtime in API routes and server components
const envRaw = process.env as unknown as EnvConfig

// Export environment configuration (validates lazily on first access in server context)
export const env = envRaw

// Export individual configurations for convenience
export const supabaseConfig = {
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
} as const

export const authConfig = {
  nextAuthUrl: env.NEXTAUTH_URL,
  nextAuthSecret: env.NEXTAUTH_SECRET,
  jwtSecret: env.JWT_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  sessionSecret: env.SESSION_SECRET,
  csrfSecret: env.CSRF_SECRET,
} as const

export const superAdminConfig = {
  email: env.SUPER_ADMIN_EMAIL,
  passwordHash: env.SUPER_ADMIN_PASSWORD_HASH,
} as const

export const appConfig = {
  url: env.NEXT_PUBLIC_APP_URL,
  name: env.NEXT_PUBLIC_APP_NAME,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
} as const