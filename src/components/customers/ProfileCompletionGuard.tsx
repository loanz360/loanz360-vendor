'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useActiveProfile } from '@/lib/contexts/active-profile-context'
import ProfileCompletionModal, { wasReminderDismissedRecently } from './ProfileCompletionModal'
import { useAuth } from '@/lib/auth/auth-context'

interface ProfileCompletionGuardProps {
  children: React.ReactNode
}

// Storage key to track if modal was shown in this session
const SESSION_SHOWN_KEY = 'loanz360_profile_modal_shown_session'

// Pages where the modal should NOT be shown
const EXCLUDED_PATHS = [
  '/customers/getting-started',
  '/customers/add-profile',
  '/customers/my-profile',
  '/customers/auth'
]

/**
 * ProfileCompletionGuard
 *
 * This component wraps the customer portal content and shows a profile completion
 * modal when:
 * 1. User is authenticated
 * 2. User has no profiles (profile not completed)
 * 3. Modal hasn't been dismissed recently (within 24 hours)
 * 4. Modal hasn't been shown in this browser session
 * 5. User is not on excluded pages (getting-started, add-profile, my-profile)
 *
 * This encourages customers to complete their profile for personalized services.
 */
export default function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  const { profiles, isLoading } = useActiveProfile()
  const [showModal, setShowModal] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  // Check if current path is excluded
  const isExcludedPath = EXCLUDED_PATHS.some(path => pathname?.startsWith(path))

  // Check if modal should be shown
  useEffect(() => {
    if (isLoading || hasChecked || isExcludedPath) return

    // Wait a bit for profiles to load
    const timer = setTimeout(() => {
      // Only show if:
      // 1. User is authenticated
      // 2. No profiles exist
      // 3. Modal wasn't dismissed recently
      // 4. Modal wasn't shown in this session yet
      // 5. Not on excluded pages

      const sessionShown = sessionStorage.getItem(SESSION_SHOWN_KEY)
      const hasProfiles = profiles && profiles.length > 0

      if (
        user &&
        !hasProfiles &&
        !wasReminderDismissedRecently() &&
        !sessionShown
      ) {
        setShowModal(true)
        // Mark as shown for this session
        sessionStorage.setItem(SESSION_SHOWN_KEY, 'true')
      }

      setHasChecked(true)
    }, 1500) // Wait 1.5 seconds after profiles load

    return () => clearTimeout(timer)
  }, [user, profiles, isLoading, hasChecked, isExcludedPath])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
  }, [])

  // Calculate profile completion percentage
  const profileCompletion = profiles.length > 0
    ? profiles.reduce((sum, p) => sum + (p.profile_completion || 0), 0) / profiles.length
    : 0

  return (
    <>
      {children}
      <ProfileCompletionModal
        isOpen={showModal}
        onClose={handleCloseModal}
        profileCompletion={Math.round(profileCompletion)}
        userName={user?.full_name?.split(' ')[0] || 'there'}
      />
    </>
  )
}

/**
 * Clear the session flag (useful for testing or when logging out)
 */
export function clearProfileModalSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_SHOWN_KEY)
  }
}
