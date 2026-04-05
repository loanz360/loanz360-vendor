'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { clientLogger } from '@/lib/utils/client-logger'

/**
 * Super Admin Authentication Context
 *
 * This is a SEPARATE auth system from the regular Supabase AuthProvider.
 * Super Admin uses its own session management via super_admin_session cookies
 * and the super_admins/super_admin_sessions tables.
 *
 * DO NOT use the regular useAuth() hook in the Super Admin portal.
 * Use useSuperAdminAuth() instead.
 */

interface SuperAdminUser {
  id: string
  email: string
  fullName: string
  role: 'SUPER_ADMIN'
}

interface SuperAdminAuthContextType {
  user: SuperAdminUser | null
  loading: boolean
  isAuthenticated: boolean
  error: string | null
  refreshAuth: () => Promise<void>
  logout: () => Promise<void>
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | undefined>(undefined)

export function SuperAdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SuperAdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verifySession = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      clientLogger.debug('[SuperAdminAuth] Verifying session...')

      const response = await fetch('/api/auth/verify-session', {
        credentials: 'include'
      })

      if (!response.ok) {
        clientLogger.warn('[SuperAdminAuth] verify-session request failed')
        setUser(null)
        setIsAuthenticated(false)
        return
      }

      const data = await response.json()
      clientLogger.debug('[SuperAdminAuth] verify-session response:', data)

      if (data.authenticated && data.role === 'SUPER_ADMIN' && data.user) {
        clientLogger.info('[SuperAdminAuth] Session valid, setting user')
        setUser({
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.fullName || 'Super Admin',
          role: 'SUPER_ADMIN'
        })
        setIsAuthenticated(true)
      } else {
        clientLogger.warn('[SuperAdminAuth] Invalid session:', {
          authenticated: data.authenticated,
          role: data.role
        })
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (err) {
      clientLogger.error('[SuperAdminAuth] Error verifying session:', err)
      setError(err instanceof Error ? err.message : 'Failed to verify session')
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      clientLogger.info('[SuperAdminAuth] Logging out...')
      await fetch('/api/superadmin/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
      setIsAuthenticated(false)
    } catch (err) {
      clientLogger.error('[SuperAdminAuth] Logout error:', err)
    }
  }, [])

  useEffect(() => {
    verifySession()
  }, [verifySession])

  return (
    <SuperAdminAuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        error,
        refreshAuth: verifySession,
        logout
      }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  )
}

export function useSuperAdminAuth() {
  const context = useContext(SuperAdminAuthContext)
  if (context === undefined) {
    throw new Error('useSuperAdminAuth must be used within a SuperAdminAuthProvider')
  }
  return context
}

export default SuperAdminAuthContext
