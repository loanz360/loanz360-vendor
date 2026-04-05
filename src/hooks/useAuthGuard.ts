'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'

interface UseAuthGuardOptions {
  redirectTo?: string
  requiredRole?: string
  requiredSubRole?: string
}

export function useAuthGuard(options: UseAuthGuardOptions = {}) {
  const { redirectTo = '/login', requiredRole, requiredSubRole } = options
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(redirectTo)
    }
  }, [authLoading, user, router, redirectTo])

  const isAuthorized = !authLoading && !!user &&
    (!requiredRole || user.role === requiredRole) &&
    (!requiredSubRole || user.sub_role === requiredSubRole)

  return {
    user,
    authLoading,
    isAuthorized,
    isAuthenticated: !authLoading && !!user
  }
}
