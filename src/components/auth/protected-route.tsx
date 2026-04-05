'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import type { UserRole } from '@/lib/types/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  requiresVerification?: boolean
  fallback?: React.ReactNode
  redirectTo?: string
}

export function ProtectedRoute({
  children,
  allowedRoles = [],
  requiresVerification = false,
  fallback,
  redirectTo = '/auth/login'
}: ProtectedRouteProps) {
  const { user, loading, hasAnyRole, isActive, isVerified } = useAuth()
  const router = useRouter()

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center flex flex-col gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-muted border-t-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Check authentication
  if (!user) {
    if (fallback) return <>{fallback}</>

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md" variant="default">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Logo size="lg" />
            </div>
            <div className="flex flex-col gap-2">
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>
                You need to sign in to access this page
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              variant="orange"
              size="lg"
              className="w-full"
              onClick={() => router.push(redirectTo)}
            >
              Sign In
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push('/auth/register')}
            >
              Create Account
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check role authorization
  if (allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    if (fallback) return <>{fallback}</>

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md" variant="default">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-error/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don&apos;t have permission to access this page
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="text-center text-sm text-muted-foreground">
              Contact your administrator for access to this resource.
            </div>
            <Button
              variant="orange"
              size="lg"
              className="w-full"
              onClick={() => router.back()}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check account status
  if (!isActive()) {
    if (fallback) return <>{fallback}</>

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md" variant="default">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-warning/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <CardTitle>Account Inactive</CardTitle>
              <CardDescription>
                Your account is not active. Please contact support for assistance.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="text-center text-sm text-muted-foreground">
              Account status: <span className="text-warning font-medium">{user.status}</span>
            </div>
            <Button
              variant="orange"
              size="lg"
              className="w-full"
              onClick={() => window.location.href = 'mailto:support@loanz360.com'}
            >
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check verification requirements
  if (requiresVerification && !isVerified()) {
    if (fallback) return <>{fallback}</>

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md" variant="default">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-info/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <CardTitle>Verification Required</CardTitle>
              <CardDescription>
                Please verify your email and mobile number to continue
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Email verification:</span>
                <span className={user.email_verified ? "text-success" : "text-warning"}>
                  {user.email_verified ? "✓ Verified" : "⚠ Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Mobile verification:</span>
                <span className={user.mobile_verified ? "text-success" : "text-warning"}>
                  {user.mobile_verified ? "✓ Verified" : "⚠ Pending"}
                </span>
              </div>
            </div>
            <Button
              variant="orange"
              size="lg"
              className="w-full"
              onClick={() => router.push('/auth/verify')}
            >
              Complete Verification
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // All checks passed, render children
  return <>{children}</>
}

// Higher-order component for page-level protection
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ProtectedRouteProps, 'children'> = {}
) {
  const AuthenticatedComponent = (props: P) => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  )

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`

  return AuthenticatedComponent
}

// Role-specific HOCs for convenience
export const withSuperAdminAuth = <P extends object>(Component: React.ComponentType<P>) =>
  withAuth(Component, { allowedRoles: ['SUPER_ADMIN'], requiresVerification: true })

export const withAdminAuth = <P extends object>(Component: React.ComponentType<P>) =>
  withAuth(Component, { allowedRoles: ['SUPER_ADMIN', 'ADMIN'], requiresVerification: true })

export const withPartnerAuth = <P extends object>(Component: React.ComponentType<P>) =>
  withAuth(Component, { allowedRoles: ['PARTNER'], requiresVerification: true })

export const withEmployeeAuth = <P extends object>(Component: React.ComponentType<P>) =>
  withAuth(Component, { allowedRoles: ['EMPLOYEE'], requiresVerification: true })

export const withCustomerAuth = <P extends object>(Component: React.ComponentType<P>) =>
  withAuth(Component, { allowedRoles: ['CUSTOMER'], requiresVerification: true })

export const withVendorAuth = <P extends object>(Component: React.ComponentType<P>) =>
  withAuth(Component, { allowedRoles: ['VENDOR'], requiresVerification: true })