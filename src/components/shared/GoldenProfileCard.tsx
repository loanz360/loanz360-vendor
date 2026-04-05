'use client'

import React from 'react'
import Link from 'next/link'
import { User, Building2, Crown, Lock, BadgeCheck } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// GOLDEN PROFILE CARD — Global Reusable Component
// Used across ALL portals: Customer, Partner (BA/BP/CP), Employee, SuperAdmin
// Styling controlled via CSS custom properties (--gpc-*) in globals.css
// ═══════════════════════════════════════════════════════════════════════════

export interface GoldenVerificationItem {
  label: string
  verified: boolean
}

export interface GoldenProfileCardProps {
  /** Display name of the user or entity */
  userName: string
  /** Short display ID (e.g., "C5", "BA-12", "EMP-45") */
  userId: string
  /** Role/designation label shown when no verification items exist */
  roleLabel?: string
  /** Avatar/profile photo URL */
  avatarUrl?: string | null
  /** Fallback icon when no avatar: 'user' for individuals, 'building' for entities */
  avatarFallbackIcon?: 'user' | 'building'
  /** Verification status items displayed as a checklist */
  verificationItems?: GoldenVerificationItem[]
  /** Profile completion percentage (0-100) */
  completionPercentage: number
  /** Link for the "My Profile" footer */
  profileLink: string
  /** Custom label for the footer link (defaults to "My Profile" or "Complete Profile") */
  profileLinkLabel?: string
  /** Whether the profile is considered complete */
  isProfileComplete?: boolean
  /** When true, footer shows locked state if profile is incomplete */
  enableGatekeeping?: boolean
  /** Callback when user clicks a disabled/locked element */
  onDisabledClick?: () => void
  /** Current pathname to determine active state of the footer link */
  currentPath?: string
}

export default function GoldenProfileCard({
  userName,
  userId,
  roleLabel,
  avatarUrl,
  avatarFallbackIcon = 'user',
  verificationItems = [],
  completionPercentage,
  profileLink,
  profileLinkLabel,
  isProfileComplete = true,
  enableGatekeeping = false,
  onDisabledClick,
  currentPath = '',
}: GoldenProfileCardProps) {
  const percent = Math.min(Math.max(completionPercentage, 0), 100)
  const profileLinkPath = profileLink.split('?')[0]
  const isFooterActive = currentPath === profileLinkPath || currentPath.startsWith(profileLinkPath + '/')
  const isFooterDisabled = enableGatekeeping && !isProfileComplete
  const footerLabel = profileLinkLabel || (isProfileComplete ? 'My Profile' : 'Complete Profile')

  const FallbackIcon = avatarFallbackIcon === 'building' ? Building2 : User

  return (
    <div className="p-3 border-b border-gray-800/50 flex-shrink-0">
      <div className="golden-card rounded-xl overflow-hidden">
        {/* Gold Sparkle Cascade Overlay */}
        <div className="golden-sparkle-cascade" />

        {/* Card Content — Horizontal layout with padded image */}
        <div className="relative z-10 p-4 flex gap-4">
          {/* Left: Square Avatar with gold border, inner padding, rounded corners */}
          <div className="flex-shrink-0">
            <div
              className="relative rounded-lg overflow-hidden"
              style={{
                width: '88px',
                height: '112px',
                border: '2px solid rgba(212, 175, 55, 0.4)',
                boxShadow: '0 0 12px rgba(212, 175, 55, 0.15), inset 0 0 8px rgba(0,0,0,0.3)',
              }}
            >
              {/* Avatar image or fallback */}
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--gpc-avatar-bg)' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <FallbackIcon className="w-11 h-11" style={{ color: 'var(--gpc-gold-primary)', opacity: 0.6 }} />
                )}
              </div>

              {/* Progress bar + percentage overlaid at bottom of image */}
              <div className="absolute bottom-0 left-0 right-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                <div className="px-1.5 pt-1">
                  <div className="h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--gpc-progress-bg)' }}>
                    <div
                      className="h-full golden-progress-bar transition-all duration-500 rounded-full"
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-center py-0.5">
                  <span className="text-[8px] font-bold" style={{ color: 'var(--gpc-gold-primary)' }}>{percent}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Profile Info + Verification Checklist */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="font-semibold text-[13px] truncate font-poppins golden-text leading-tight">
              {userName}
            </h3>
            <p className="text-[10px] mt-1" style={{ color: 'var(--gpc-gold-dark)' }}>
              ID: {userId}
            </p>

            {/* Verification Checklist */}
            {verificationItems.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {verificationItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    {item.verified ? (
                      <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--gpc-verified)' }} />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0" style={{ borderColor: 'rgba(212, 175, 55, 0.5)' }}>
                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--gpc-gold-primary)' }} />
                      </span>
                    )}
                    <span className={`text-[10px] leading-none ${item.verified ? 'text-green-400' : ''}`} style={!item.verified ? { color: 'var(--gpc-gold-primary)' } : undefined}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Role Label (shown when no verification items) */}
            {verificationItems.length === 0 && roleLabel && (
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--gpc-gold-primary)' }}>{roleLabel}</p>
            )}
          </div>
        </div>

        {/* Golden Divider */}
        <div className="golden-divider" />

        {/* Golden Footer — My Profile Link */}
        {isFooterDisabled ? (
          <button
            onClick={onDisabledClick}
            className="w-full px-4 py-2.5 flex items-center justify-between cursor-not-allowed group relative"
            style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.06) 0%, rgba(0,0,0,0) 100%)' }}
          >
            <div className="flex items-center space-x-2">
              <Crown className="w-4 h-4" style={{ color: 'var(--gpc-gold-muted)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--gpc-gold-muted)' }}>{footerLabel}</span>
            </div>
            <Lock className="w-3.5 h-3.5" style={{ color: 'var(--gpc-gold-muted)' }} />
          </button>
        ) : (
          <Link
            href={profileLink}
            prefetch={false}
            className={`golden-footer-link w-full px-4 py-2.5 flex items-center justify-between transition-all duration-300 ${
              isFooterActive ? 'shadow-lg shadow-amber-500/20' : ''
            }`}
            style={{
              background: isFooterActive
                ? 'linear-gradient(90deg, #B8860B 0%, #D4AF37 50%, #B8860B 100%)'
                : 'linear-gradient(90deg, rgba(212,175,55,0.08) 0%, rgba(184,134,11,0.04) 100%)'
            }}
          >
            <div className="flex items-center space-x-2">
              <Crown className={`w-4 h-4 ${isFooterActive ? 'text-black' : ''}`} style={!isFooterActive ? { color: 'var(--gpc-gold-primary)' } : undefined} />
              <span className={`text-sm font-semibold ${isFooterActive ? 'text-black' : ''}`} style={!isFooterActive ? { color: 'var(--gpc-gold-primary)' } : undefined}>
                {footerLabel}
              </span>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
