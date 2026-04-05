'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-context'
import type { UserRole } from '@/lib/types/database.types'
import { clientLogger } from '@/lib/utils/client-logger'

// Hook for checking user permissions
export function usePermissions() {
  const { user, hasRole, hasAnyRole, isActive, isVerified, hasAdminPermission } = useAuth()

  return {
    // Role checks
    hasRole,
    hasAnyRole,
    isSuperAdmin: () => hasRole('SUPER_ADMIN'),
    isAdmin: () => hasAnyRole(['SUPER_ADMIN', 'ADMIN']),
    isPartner: () => hasRole('PARTNER'),
    isEmployee: () => hasRole('EMPLOYEE'),
    isCustomer: () => hasRole('CUSTOMER'),
    isVendor: () => hasRole('VENDOR'),

    // Status checks
    isActive,
    isVerified,
    isLoggedIn: () => !!user,

    // Admin permission checks
    hasAdminPermission,
    canManageUsers: () => hasAdminPermission('user_management'),
    canManagePartners: () => hasAdminPermission('partner_management'),
    canManageCustomers: () => hasAdminPermission('customer_management'),
    canManagePayouts: () => hasAdminPermission('payout_management'),
    canManageBanners: () => hasAdminPermission('banner_management'),
    canManageIncentives: () => hasAdminPermission('incentive_management'),
    canManageContests: () => hasAdminPermission('contest_management'),
    canManageProperties: () => hasAdminPermission('property_management'),
    canManageVendors: () => hasAdminPermission('vendor_management'),

    // User info
    user,
    userRole: user?.role,
    userStatus: user?.status,
    userId: user?.id
  }
}

// Hook for route protection with automatic redirection
export function useAuthGuard(
  requiredRoles: UserRole[] = [],
  options: {
    requiresVerification?: boolean
    redirectTo?: string
    onUnauthorized?: () => void
    onUnverified?: () => void
  } = {}
) {
  const router = useRouter()
  const { user, loading, hasAnyRole, isActive, isVerified } = useAuth()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  const {
    requiresVerification = false,
    redirectTo = '/auth/login',
    onUnauthorized,
    onUnverified
  } = options

  useEffect(() => {
    if (loading) {
      setIsAuthorized(null)
      return
    }

    // Check authentication
    if (!user) {
      setIsAuthorized(false)
      onUnauthorized?.()
      if (redirectTo) {
        router.push(`${redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`)
      }
      return
    }

    // Check role authorization
    if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
      setIsAuthorized(false)
      onUnauthorized?.()
      // Redirect to appropriate dashboard based on user's role
      const roleRedirect = getRoleRedirect(user.role as UserRole)
      router.push(roleRedirect)
      return
    }

    // Check account status
    if (!isActive()) {
      setIsAuthorized(false)
      router.push('/auth/account-inactive')
      return
    }

    // Check verification requirements
    if (requiresVerification && !isVerified()) {
      setIsAuthorized(false)
      onUnverified?.()
      router.push('/auth/verify')
      return
    }

    setIsAuthorized(true)
  }, [user, loading, hasAnyRole, isActive, isVerified, requiredRoles, requiresVerification, router, redirectTo, onUnauthorized, onUnverified])

  return {
    isAuthorized,
    isLoading: loading || isAuthorized === null,
    user
  }
}

// Hook for conditional rendering based on permissions
export function useConditionalRender() {
  const permissions = usePermissions()

  return {
    // Render helpers
    renderForRole: (role: UserRole, children: React.ReactNode) =>
      permissions.hasRole(role) ? children : null,

    renderForRoles: (roles: UserRole[], children: React.ReactNode) =>
      permissions.hasAnyRole(roles) ? children : null,

    renderForAdmin: (children: React.ReactNode) =>
      permissions.isAdmin() ? children : null,

    renderForSuperAdmin: (children: React.ReactNode) =>
      permissions.isSuperAdmin() ? children : null,

    renderIfVerified: (children: React.ReactNode) =>
      permissions.isVerified() ? children : null,

    renderIfActive: (children: React.ReactNode) =>
      permissions.isActive() ? children : null,

    renderWithPermission: (permission: string, children: React.ReactNode) =>
      permissions.hasAdminPermission(permission) ? children : null,

    // Utility functions
    ...permissions
  }
}

// Hook for session management
export function useSession() {
  const { user, session, loading, signOut, refreshUser } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshUser()
    } finally {
      setIsRefreshing(false)
    }
  }

  const logout = async () => {
    // Get the redirect URL before signing out (user info will be cleared)
    const redirectUrl = getLogoutRedirect(user?.role as UserRole, user?.sub_role)
    try {
      await signOut()
      window.location.href = redirectUrl
    } catch (error) {
      clientLogger.error('Logout error', { error: error instanceof Error ? error.message : String(error) })
      // Even on error, redirect to the appropriate login page
      window.location.href = redirectUrl
    }
  }

  return {
    user,
    session,
    loading,
    isRefreshing,
    refresh,
    logout,
    isSessionValid: !!session && !!user,
    sessionExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000) : null,
    timeUntilExpiry: session?.expires_at
      ? Math.max(0, (session.expires_at * 1000) - Date.now())
      : 0
  }
}

// Hook for form authentication state
export function useFormAuth() {
  const { loading } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setIsSubmitting(true)
    try {
      return await fn()
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    isLoading: loading || isSubmitting,
    isSubmitting,
    withLoading
  }
}

// Hook for tracking user activity
export function useUserActivity() {
  const { user } = useAuth()
  const [lastActivity, setLastActivity] = useState<Date>(new Date())

  useEffect(() => {
    if (!user) return

    const updateActivity = () => {
      setLastActivity(new Date())
    }

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
    }
  }, [user])

  const getTimeSinceLastActivity = () => {
    return Date.now() - lastActivity.getTime()
  }

  const isIdle = (thresholdMs: number = 300000) => { // 5 minutes default
    return getTimeSinceLastActivity() > thresholdMs
  }

  return {
    lastActivity,
    getTimeSinceLastActivity,
    isIdle
  }
}

// Utility function to get role-specific redirect
function getRoleRedirect(role: UserRole | undefined): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin'
    case 'PARTNER':
      return '/partners'
    case 'EMPLOYEE':
      return '/employees'
    case 'CUSTOMER':
      return '/customers'
    case 'VENDOR':
      return '/vendors'
    default:
      return '/auth/login'
  }
}

// Utility function to get role-specific LOGIN redirect (for logout)
export function getLogoutRedirect(role: UserRole | undefined, subRole?: string | null): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin/auth/login'
    case 'PARTNER':
      return '/partners/auth/login'
    case 'EMPLOYEE':
      return '/employees/auth/login'
    case 'CUSTOMER':
      return '/customers/auth/login'
    case 'VENDOR':
      return '/auth/login'
    default:
      return '/auth/login'
  }
}

// Hook for debugging auth state (development only)
export function useAuthDebug() {
  const { user, session, loading, error } = useAuth()

  if (process.env.NODE_ENV === 'development') {
    clientLogger.debug('Auth Debug', {
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        verified: {
          email: user.email_verified,
          mobile: user.mobile_verified
        }
      } : null,
      session: session ? {
        expires_at: session.expires_at,
        expires_in: session.expires_in
      } : null,
      loading,
      error: error?.message
    })
  }

  return {
    user,
    session,
    loading,
    error
  }
}