'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { clientLogger } from '@/lib/utils/client-logger'

// Profile types
export type ProfileType = 'INDIVIDUAL' | 'ENTITY'

export interface IndividualProfile {
  id: string
  type: 'INDIVIDUAL'
  unique_id: string
  full_name: string
  profile_photo_url: string | null
  income_category: string | null
  income_profile: string | null
  profile_completion: number
  kyc_status: string
  is_default: boolean
  // Phase 3: KYC-based profile completion
  profile_completed: boolean
  pan_verified: boolean
  aadhaar_verified: boolean
}

export interface EntityProfile {
  id: string
  type: 'ENTITY'
  unique_id: string
  legal_name: string
  trading_name: string | null
  entity_type: string
  entity_type_name: string | null
  logo_url: string | null
  role_in_entity: string
  profile_completion: number
  verification_status: string
  is_default: boolean
}

export type Profile = IndividualProfile | EntityProfile

export interface ActiveProfileContextType {
  // Current active profile
  activeProfile: Profile | null
  // All profiles (individual + entities)
  profiles: Profile[]
  // Loading state
  isLoading: boolean
  // Error state
  error: string | null
  // Switch to a different profile
  switchProfile: (profileId: string) => Promise<void>
  // Refresh profiles list
  refreshProfiles: () => Promise<void>
  // Check if current profile is individual
  isIndividualProfile: boolean
  // Check if current profile is entity
  isEntityProfile: boolean
  // Get the individual profile (always exists)
  individualProfile: IndividualProfile | null
}

const ActiveProfileContext = createContext<ActiveProfileContextType | undefined>(undefined)

// Cache for profiles
let profilesCache: { data: Profile[]; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Storage key for active profile
const ACTIVE_PROFILE_KEY = 'loanz360_active_profile_id'

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all profiles (individual + entities)
  const fetchProfiles = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && profilesCache && Date.now() - profilesCache.timestamp < CACHE_DURATION) {
        setProfiles(profilesCache.data)
        return profilesCache.data
      }

      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/customers/profiles/all', {
        credentials: 'include'
      })

      if (!response.ok) {
        // Not authenticated or server error — silently return empty
        return []
      }

      const data = await response.json()

      if (data.success) {
        const allProfiles: Profile[] = data.profiles || []

        // Update cache
        profilesCache = { data: allProfiles, timestamp: Date.now() }
        setProfiles(allProfiles)

        return allProfiles
      } else {
        throw new Error(data.error || 'Failed to fetch profiles')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profiles'
      clientLogger.error('Error fetching profiles', { message: errorMessage })
      setError(errorMessage)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize profiles and set active profile
  useEffect(() => {
    const initializeProfiles = async () => {
      const allProfiles = await fetchProfiles()

      if (allProfiles.length > 0) {
        // Try to restore previously selected profile
        const savedProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY)

        let profileToActivate: Profile | null = null

        if (savedProfileId) {
          profileToActivate = allProfiles.find(p => p.id === savedProfileId) || null
        }

        // If no saved profile or saved profile not found, use default or first individual
        if (!profileToActivate) {
          profileToActivate = allProfiles.find(p => p.is_default) ||
                             allProfiles.find(p => p.type === 'INDIVIDUAL') ||
                             allProfiles[0]
        }

        if (profileToActivate) {
          setActiveProfile(profileToActivate)
          localStorage.setItem(ACTIVE_PROFILE_KEY, profileToActivate.id)
        }
      }
    }

    initializeProfiles()
  }, [fetchProfiles])

  // Switch to a different profile
  const switchProfile = useCallback(async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId)

    if (!profile) {
      setError('Profile not found')
      return
    }

    try {
      // Optionally notify backend about profile switch
      await fetch('/api/customers/profiles/switch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, profile_type: profile.type })
      })

      setActiveProfile(profile)
      localStorage.setItem(ACTIVE_PROFILE_KEY, profileId)
      setError(null)

      // Dispatch event for other components to react
      window.dispatchEvent(new CustomEvent('profileSwitched', { detail: profile }))
    } catch (err) {
      clientLogger.error('Error switching profile', { error: err })
      // Still switch locally even if API fails
      setActiveProfile(profile)
      localStorage.setItem(ACTIVE_PROFILE_KEY, profileId)
    }
  }, [profiles])

  // Refresh profiles list
  const refreshProfiles = useCallback(async () => {
    profilesCache = null // Clear cache
    const allProfiles = await fetchProfiles(true)

    // If active profile was removed, switch to individual
    if (activeProfile && !allProfiles.find(p => p.id === activeProfile.id)) {
      const individual = allProfiles.find(p => p.type === 'INDIVIDUAL')
      if (individual) {
        setActiveProfile(individual)
        localStorage.setItem(ACTIVE_PROFILE_KEY, individual.id)
      }
    }
  }, [activeProfile, fetchProfiles])

  // Derived values
  const isIndividualProfile = activeProfile?.type === 'INDIVIDUAL'
  const isEntityProfile = activeProfile?.type === 'ENTITY'
  const individualProfile = profiles.find(p => p.type === 'INDIVIDUAL') as IndividualProfile | null

  const value: ActiveProfileContextType = {
    activeProfile,
    profiles,
    isLoading,
    error,
    switchProfile,
    refreshProfiles,
    isIndividualProfile,
    isEntityProfile,
    individualProfile
  }

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  )
}

export function useActiveProfile() {
  const context = useContext(ActiveProfileContext)
  if (context === undefined) {
    throw new Error('useActiveProfile must be used within an ActiveProfileProvider')
  }
  return context
}

// Helper to clear cache (useful when profiles are modified)
export function clearActiveProfileCache() {
  profilesCache = null
  // Also clear localStorage to prevent stale profile selection
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACTIVE_PROFILE_KEY)
  }
}
