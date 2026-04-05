'use client'

import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowRight, Plus, ArrowLeftRight, UserPlus, RefreshCw } from 'lucide-react'
import { useActiveProfile } from '@/lib/contexts/active-profile-context'
import ProfileAvatarStrip from './ProfileAvatarStrip'
import SwitchProfileModal from './SwitchProfileModal'

interface ProfileManagementCardProps {
  onSwitchProfile: (profileId: string) => Promise<void>
  switchingProfileId: string | null
}

type HoverState = 'none' | 'add' | 'switch'

export default function ProfileManagementCard({
  onSwitchProfile,
  switchingProfileId
}: ProfileManagementCardProps) {
  const router = useRouter()
  const { activeProfile, profiles } = useActiveProfile()
  const [showSwitchModal, setShowSwitchModal] = useState(false)
  const [hoverState, setHoverState] = useState<HoverState>('none')

  // Filter out placeholder profiles
  const realProfiles = profiles.filter(p => p.unique_id !== 'Pending')
  const hasProfiles = realProfiles.length > 0

  const handleProfileClick = useCallback((profileId: string, profileType: 'INDIVIDUAL' | 'ENTITY') => {
    router.push(`/customers/profile/${profileId}?type=${profileType}`)
  }, [router])

  const handleSwitchProfile = useCallback(async (profileId: string) => {
    await onSwitchProfile(profileId)
    setShowSwitchModal(false)
  }, [onSwitchProfile])

  return (
    <div className="px-3 py-3 border-b border-gray-800/50">
      <div className="relative rounded-xl overflow-hidden shadow-lg shadow-black/30"
        style={{
          backgroundColor: '#111827',
          border: '1px solid rgba(55, 65, 81, 0.5)',
        }}
      >

        {/* Content area — dynamic height, min 150px for hover descriptions */}
        <div className="relative">
          {/* Default content layer — relative so it drives parent height */}
          <div
            className={`transition-opacity duration-300 ease-in-out ${
              hoverState === 'none' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {hasProfiles ? (
              <div className="min-h-[150px]">
                <ProfileAvatarStrip
                  profiles={realProfiles}
                  activeProfileId={activeProfile?.id}
                  onProfileClick={handleProfileClick}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[150px] px-4">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-orange-400" />
                </div>
                <p className="text-sm font-semibold text-white mb-0.5">Get Started</p>
                <p className="text-[11px] text-gray-400 mb-2 leading-relaxed text-center">
                  Create your first profile to unlock all features
                </p>
                <Link
                  href="/customers/add-profile"
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Create Profile
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Add Profile hover layer — absolute overlay */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
              hoverState === 'add' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex flex-col items-center justify-center min-h-[150px] h-full px-4">
              <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-orange-500/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-orange-400" />
              </div>
              <p className="text-[12px] font-semibold text-white mb-1">Add a New Profile</p>
              <p className="text-[10px] text-gray-400 leading-relaxed text-center">
                Create Individual or Business profiles to manage separate loan applications, track credit scores, and maintain dedicated documents for each identity.
              </p>
            </div>
          </div>

          {/* Switch Profile hover layer — absolute overlay */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
              hoverState === 'switch' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex flex-col items-center justify-center min-h-[150px] h-full px-4">
              <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-orange-500/10 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-orange-400" />
              </div>
              <p className="text-[12px] font-semibold text-white mb-1">Switch Between Profiles</p>
              <p className="text-[10px] text-gray-400 leading-relaxed text-center">
                View and manage details of a different profile. Switch between your Individual and Business profiles to see their loan status, documents, and credit information.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex border-t border-gray-700/40">
          <Link
            href="/customers/add-profile"
            prefetch={false}
            onMouseEnter={() => setHoverState('add')}
            onMouseLeave={() => setHoverState('none')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] text-gray-400 hover:text-orange-400 hover:bg-orange-500/5 transition-all duration-200 group"
          >
            <Plus className="w-3.5 h-3.5 text-gray-500 group-hover:text-orange-400 transition-colors" />
            <span>Add Profile</span>
          </Link>

          <div className="w-px bg-gray-700/50" />

          <button
            onClick={() => setShowSwitchModal(!showSwitchModal)}
            onMouseEnter={() => setHoverState('switch')}
            onMouseLeave={() => setHoverState('none')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] text-gray-400 hover:text-orange-400 hover:bg-orange-500/5 transition-all duration-200 group"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-orange-400 transition-colors" />
            <span>Switch Profile</span>
          </button>
        </div>
      </div>

      {/* Switch Profile Modal — rendered via Portal to escape sidebar's backdrop-filter containing block */}
      {typeof document !== 'undefined' && createPortal(
        <SwitchProfileModal
          isOpen={showSwitchModal}
          onClose={() => setShowSwitchModal(false)}
          profiles={realProfiles}
          activeProfileId={activeProfile?.id}
          switchingProfileId={switchingProfileId}
          onSwitchProfile={handleSwitchProfile}
        />,
        document.body
      )}
    </div>
  )
}
