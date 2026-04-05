'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { createSupabaseClient } from '@/lib/supabase/client'
import { AsyncLock } from './async-lock'
import { SessionTimeoutManager } from './session-timeout'
import { SessionTimeoutModal } from '@/components/auth/session-timeout-modal'
import { clientLogger } from '@/lib/utils/client-logger'

export interface AuthUser extends User {
  role?: string
  sub_role?: string
  status?: string
  full_name?: string
  avatar_url?: string
  email_verified?: boolean
  mobile_verified?: boolean
  employee_id?: string
  designation?: string
}

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  error: AuthError | null
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  refreshUser: () => Promise<void>
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  isActive: () => boolean
  isVerified: () => boolean
  hasAdminPermission: (permission?: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

// Cache for user profiles to avoid unnecessary database calls
const userProfileCache = new Map<string, { data: AuthUser; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Async lock to prevent race conditions during profile fetching
const profileFetchLock = new AsyncLock()

const AuthProviderComponent = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const [timeoutRemaining, setTimeoutRemaining] = useState(0)
  const sessionTimeoutRef = useRef<SessionTimeoutManager | null>(null)

  // Create Supabase client instance once and reuse
  const supabaseRef = useRef(createSupabaseClient())
  const supabase = supabaseRef.current

  // Optimized user profile fetching with caching and race condition protection
  // PERFORMANCE FIX: Use auth metadata FIRST, skip database queries if metadata has role
  const fetchUserProfile = useCallback(async (authUser: User): Promise<AuthUser> => {
    // Check cache first (before any async operations)
    const cached = userProfileCache.get(authUser.id)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      clientLogger.debug('Using cached user profile', { userId: authUser.id })
      return cached.data
    }

    // Get role and sub_role from user metadata (Supabase Auth metadata) - PRIMARY SOURCE
    const metadataRole = authUser.user_metadata?.role || authUser.app_metadata?.role
    const metadataSubRole = authUser.user_metadata?.sub_role || authUser.app_metadata?.sub_role

    // FAST PATH: If metadata has role AND it's not a generic 'employee' role, skip database queries
    // This is the key optimization - partners/superadmin don't query DB for profile
    // BUT for employees, we need to check employee_profile for their actual role (hr, telecaller, etc.)
    const isGenericEmployee = metadataRole?.toUpperCase() === 'EMPLOYEE'

    if (metadataRole && !isGenericEmployee) {
      clientLogger.debug('Using metadata role directly (fast path)', {
        role: metadataRole,
        subRole: metadataSubRole
      })

      const enhancedUser: AuthUser = {
        ...authUser,
        role: metadataRole,
        sub_role: metadataSubRole,
        status: 'ACTIVE',
        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
        avatar_url: authUser.user_metadata?.avatar_url,
        email_verified: !!authUser.email_confirmed_at,
        mobile_verified: authUser.user_metadata?.mobile_verified ?? false,
        employee_id: authUser.user_metadata?.employee_id || null,
        designation: metadataSubRole || null
      }

      // Cache immediately
      userProfileCache.set(authUser.id, {
        data: enhancedUser,
        timestamp: Date.now()
      })

      return enhancedUser
    }

    // SLOW PATH: Only query database if metadata doesn't have role (rare case)
    // Use async lock only for database queries to prevent concurrent fetches
    return await profileFetchLock.synchronized(async () => {
      // Re-check cache inside lock (might have been populated by another request)
      const cachedInLock = userProfileCache.get(authUser.id)
      if (cachedInLock && Date.now() - cachedInLock.timestamp < CACHE_DURATION) {
        return cachedInLock.data
      }

      try {
        clientLogger.debug('Metadata missing role, querying database (slow path)', { userId: authUser.id })

        // Helper to add timeout to Supabase queries
        const withTimeout = <T,>(promise: Promise<T>, timeoutMs = 3000): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
            )
          ])
        }

        // Only query users table - employee_profile and profiles have RLS issues
        let userData: { avatar_url?: string; full_name?: string; role?: string; sub_role?: string; status?: string } | null = null
        try {
          const { data, error } = await withTimeout(supabase
            .from('users')
            .select('avatar_url, full_name, role, sub_role, status')
            .eq('id', authUser.id)
            .maybeSingle(), 2000)

          if (!error && data) {
            userData = data
          }
        } catch (queryErr) {
          // Query failed or timed out - continue with defaults
          console.warn('[AuthContext] Users table query timed out or failed for user:', authUser.id, queryErr)
          clientLogger.debug('Users table query failed/timed out, using defaults')
        }

        // For employees, also check employee_profile table for the actual employee role
        // This is critical for HR, Telecaller, DSE etc who have role='employee' in auth but specific roles in employee_profile
        let employeeRole: string | null = null
        let employeeSubRole: string | null = null
        let employeeId: string | null = null
        let employeeDesignation: string | null = null

        const baseRole = userData?.role || metadataRole || 'EMPLOYEE'
        if (baseRole.toUpperCase() === 'EMPLOYEE') {
          try {
            // employee_profile query is critical for determining actual role (HR, CRO, DSE, etc.)
            // Use longer timeout since this determines sidebar menu visibility
            const { data: empData, error: empError } = await withTimeout(supabase
              .from('employee_profile')
              .select('role, subrole, employee_id, designation')
              .eq('user_id', authUser.id)
              .maybeSingle(), 3000)

            if (!empError && empData) {
              // employee_profile.role contains the actual role (hr, telecaller, dse, etc.)
              employeeRole = empData.role
              employeeSubRole = empData.subrole
              employeeId = empData.employee_id
              employeeDesignation = empData.designation
              clientLogger.debug('Found employee profile role', {
                userId: authUser.id,
                employeeRole,
                employeeSubRole
              })
            }
          } catch (empQueryErr) {
            console.warn('[AuthContext] Employee profile query timed out or failed for user:', authUser.id, empQueryErr)
            clientLogger.debug('Employee profile query failed/timed out')
          }
        }

        // Build user with whatever data we have
        // For employees, use employee_profile.role if available (hr, telecaller, etc.)
        const finalRole = employeeRole || userData?.role || metadataRole || 'EMPLOYEE'
        const finalSubRole = employeeSubRole || userData?.sub_role || metadataSubRole

        const enhancedUser: AuthUser = {
          ...authUser,
          role: finalRole,
          sub_role: finalSubRole,
          status: userData?.status?.toUpperCase() || 'ACTIVE',
          full_name: userData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          avatar_url: userData?.avatar_url || authUser.user_metadata?.avatar_url,
          email_verified: !!authUser.email_confirmed_at,
          mobile_verified: authUser.user_metadata?.mobile_verified ?? false,
          employee_id: employeeId || null,
          designation: employeeDesignation || finalSubRole || null
        }

        // Cache the result
        userProfileCache.set(authUser.id, {
          data: enhancedUser,
          timestamp: Date.now()
        })

        return enhancedUser
      } catch (err) {
        // RESILIENT FIX: Return auth user with safe defaults if everything fails
        console.warn('[AuthContext] Profile fetch timeout/failure — assigning generic EMPLOYEE role for user:', authUser.id, err)
        clientLogger.warn('Failed to fetch user profile, using defaults', { userId: authUser.id })
        const fallbackUser: AuthUser = {
          ...authUser,
          role: 'EMPLOYEE',
          sub_role: undefined,
          status: 'ACTIVE',
          full_name: authUser.email?.split('@')[0] || 'User',
          email_verified: true
        }

        // Cache fallback too to prevent repeated failures
        userProfileCache.set(authUser.id, {
          data: fallbackUser,
          timestamp: Date.now()
        })

        return fallbackUser
      }
    }) // Close synchronized block
  }, [])

  // Sign out method - defined early to be used by initializeSessionTimeout
  const signOut = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Destroy session timeout manager
      if (sessionTimeoutRef.current) {
        sessionTimeoutRef.current.destroy()
        sessionTimeoutRef.current = null
      }

      clientLogger.debug('Signing out user')
      const { error } = await supabase.auth.signOut()

      if (error) {
        setError(error)
        return { error }
      }

      setUser(null)
      setSession(null)
      setShowTimeoutWarning(false)
      userProfileCache.clear() // Clear cache on logout

      // Clear active profile from localStorage to prevent profile confusion between users
      localStorage.removeItem('loanz360_active_profile_id')

      return { error: null }
    } catch (err) {
      const authError = err as AuthError
      setError(authError)
      return { error: authError }
    } finally {
      setLoading(false)
    }
  }, [])

  // Initialize session timeout manager
  const initializeSessionTimeout = useCallback(() => {
    if (typeof window === 'undefined') return

    // Destroy existing timeout manager if any
    if (sessionTimeoutRef.current) {
      sessionTimeoutRef.current.destroy()
    }

    // Create new session timeout manager
    sessionTimeoutRef.current = new SessionTimeoutManager({
      timeout: 30 * 60 * 1000, // 30 minutes
      onWarning: (remainingSeconds) => {
        clientLogger.warn('Session timeout warning', { remainingSeconds })
        setTimeoutRemaining(remainingSeconds)
        setShowTimeoutWarning(true)
      },
      onTimeout: () => {
        clientLogger.warn('Session timeout - auto logout')
        setShowTimeoutWarning(false)
        signOut()
      }
    })

    clientLogger.debug('Session timeout manager initialized')
  }, [signOut])

  // Initialize auth state with optimizations
  useEffect(() => {
    let mounted = true

    // Safety timeout to ensure loading doesn't hang forever
    // Must be longer than the sum of query timeouts (users: 2s + employee_profile: 3s)
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        clientLogger.warn('Auth initialization safety timeout reached - forcing loading to false')
        setLoading(false)
      }
    }, 8000) // 8 second max wait for auth init (accounts for cold starts and DB query timeouts)

    const initializeAuth = async () => {
      try {

        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          if (mounted) {
            clientLogger.warn('Auth session error on init', { error: error.message })
            setError(error)
            setLoading(false)
          }
          return
        }

        if (session?.user && mounted) {
          try {
            const enhancedUser = await fetchUserProfile(session.user)
            if (mounted) {
              setUser(enhancedUser)
              setSession(session)
              // Initialize session timeout when user is authenticated
              initializeSessionTimeout()
            }
          } catch (profileError) {
            // RESILIENT FIX: Don't crash if profile fetch fails during init
            clientLogger.error('Failed to fetch profile during auth init', {
              error: profileError instanceof Error ? profileError.message : String(profileError)
            })
            if (mounted) {
              // Set user with basic auth data
              setUser(session.user as AuthUser)
              setSession(session)
            }
          }
        } else {
        }

        if (mounted) {
          setLoading(false)
        }
      } catch (err) {
        clientLogger.error('Fatal error during auth initialization', {
          error: err instanceof Error ? err.message : String(err)
        })
        if (mounted) {
          setLoading(false)
        }
      }
    }

    // Delay initialization slightly to avoid blocking initial render
    const initTimeout = setTimeout(initializeAuth, 0)

    // Listen for auth changes with debouncing
    let authChangeTimeout: NodeJS.Timeout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        // Debounce rapid auth state changes
        clearTimeout(authChangeTimeout)
        authChangeTimeout = setTimeout(async () => {

          // Only show loading for certain events
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            setLoading(true)
          }
          setError(null)

          if (session?.user) {
            const enhancedUser = await fetchUserProfile(session.user)
            if (mounted) {
              setUser(enhancedUser)
              setSession(session)
              // Initialize session timeout on sign in
              if (event === 'SIGNED_IN') {
                initializeSessionTimeout()
              }
            }
          } else {
            if (mounted) {
              setUser(null)
              setSession(null)
              // Clear user cache on logout
              userProfileCache.clear()
              // Destroy session timeout on sign out
              if (sessionTimeoutRef.current) {
                sessionTimeoutRef.current.destroy()
                sessionTimeoutRef.current = null
              }
            }
          }

          if (mounted) {
            setLoading(false)
          }
        }, 100) // 100ms debounce
      }
    )

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      clearTimeout(initTimeout)
      clearTimeout(authChangeTimeout)
      subscription.unsubscribe()
      // Clean up session timeout on unmount
      if (sessionTimeoutRef.current) {
        sessionTimeoutRef.current.destroy()
        sessionTimeoutRef.current = null
      }
    }
  }, [fetchUserProfile, initializeSessionTimeout, loading])

  // Memoized authentication methods
  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)

    try {

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setError(error)
        return { error }
      }


      // Check account status and email verification before allowing login
      if (data.user) {
        // Fetch user profile to check status
        const profile = await fetchUserProfile(data.user)

        // Check if email is verified (required for login)
        // Note: Supabase auth.user.email_confirmed_at is the source of truth
        if (!data.user.email_confirmed_at && !profile.email_verified) {

          // Sign out the user immediately
          await supabase.auth.signOut()

          const verificationError = {
            name: 'EmailNotVerifiedError',
            message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
            status: 403
          } as AuthError

          setError(verificationError)
          return { error: verificationError }
        }

        // Check if account is suspended, banned, or inactive
        const status = profile.status?.toLowerCase()
        if (status === 'suspended' || status === 'banned' || status === 'inactive' || status === 'deleted') {

          // Sign out the user immediately
          await supabase.auth.signOut()

          const statusError = {
            name: 'AccountStatusError',
            message: `Your account has been ${status}. Please contact support for assistance.`,
            status: 403
          } as AuthError

          setError(statusError)
          return { error: statusError }
        }

        // Update last login timestamp asynchronously (don't block)
        Promise.allSettled([
          supabase
            .from('users')
            .update({ last_login: new Date().toISOString() } as never)
            .eq('id', data.user.id),
          supabase
            .from('profiles')
            .update({ last_login: new Date().toISOString() } as never)
            .eq('id', data.user.id)
        ])
      }

      return { error: null }
    } catch (err) {
      const authError = err as AuthError
      setError(authError)
      return { error: authError }
    } finally {
      setLoading(false)
    }
  }, [fetchUserProfile])

  const refreshUser = useCallback(async () => {
    if (!session?.user) return

    try {
      // Clear cache to force fresh data
      userProfileCache.delete(session.user.id)
      const enhancedUser = await fetchUserProfile(session.user)
      setUser(enhancedUser)
    } catch (err) {
      console.error('Failed to refresh user profile:', err)
    }
  }, [session?.user, fetchUserProfile])

  const signUp = useCallback(async (email: string, password: string, metadata?: Record<string, unknown>) => {
    setLoading(true)
    setError(null)

    try {

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      if (error) {
        setError(error)
        return { error }
      }

      return { error: null }
    } catch (err) {
      const authError = err as AuthError
      setError(authError)
      return { error: authError }
    } finally {
      setLoading(false)
    }
  }, [])

  // Memoized helper methods for permission checking
  const hasRole = useCallback((role: string): boolean => {
    return user?.role === role
  }, [user?.role])

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    return user?.role ? roles.includes(user.role) : false
  }, [user?.role])

  const isActive = useCallback((): boolean => {
    return user?.status === 'ACTIVE'
  }, [user?.status])

  const isVerified = useCallback((): boolean => {
    return !!(user?.email_verified || user?.mobile_verified)
  }, [user?.email_verified, user?.mobile_verified])

  const hasAdminPermission = useCallback((): boolean => {
    return hasAnyRole(['ADMIN', 'SUPER_ADMIN'])
  }, [hasAnyRole])

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo((): AuthContextType => ({
    user,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshUser,
    hasRole,
    hasAnyRole,
    isActive,
    isVerified,
    hasAdminPermission
  }), [
    user,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshUser,
    hasRole,
    hasAnyRole,
    isActive,
    isVerified,
    hasAdminPermission
  ])

  // Handle session timeout warning actions
  const handleExtendSession = useCallback(() => {
    clientLogger.debug('User extended session')
    if (sessionTimeoutRef.current) {
      sessionTimeoutRef.current.extendSession()
    }
    setShowTimeoutWarning(false)
  }, [])

  const handleTimeoutLogout = useCallback(() => {
    clientLogger.debug('User chose to logout from timeout warning')
    setShowTimeoutWarning(false)
    signOut()
  }, [signOut])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {showTimeoutWarning && (
        <SessionTimeoutModal
          remainingSeconds={timeoutRemaining}
          onExtendSession={handleExtendSession}
          onLogout={handleTimeoutLogout}
        />
      )}
    </AuthContext.Provider>
  )
}

AuthProviderComponent.displayName = 'AuthProvider'

export const AuthProvider = React.memo(AuthProviderComponent)