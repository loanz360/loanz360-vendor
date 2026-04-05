// LOANZ 360 Authentication Components
// Export all auth-related components for easy importing

// Auth Context and Hooks
export { AuthProvider, useAuth } from '@/lib/auth/auth-context'
export type { AuthUser } from '@/lib/auth/auth-context'

export {
  usePermissions,
  useAuthGuard,
  useConditionalRender,
  useSession,
  useFormAuth,
  useUserActivity,
  useAuthDebug
} from '@/lib/auth/auth-hooks'

// Auth Components
export { LoginForm, QuickLoginForm } from './login-form'
export { RegisterForm } from './register-form'

// Route Protection
export {
  ProtectedRoute,
  withAuth,
  withSuperAdminAuth,
  withAdminAuth,
  withPartnerAuth,
  withEmployeeAuth,
  withCustomerAuth,
  withVendorAuth
} from './protected-route'

// Auth Middleware utilities (commented out - using simple middleware)
// export { middleware, getRequiredRole, requiresAuthentication, requiresVerification } from '@/lib/auth/middleware'