'use client'

import React, { useMemo, useState } from 'react'
import {
  Plus, User, Building2, Upload,
  Wheat, Briefcase, Home, GraduationCap, Globe, Heart,
  Scale, BookOpen, Clock, Zap, Users
} from 'lucide-react'
import Link from 'next/link'
import type { Profile, IndividualProfile, EntityProfile } from '@/lib/contexts/active-profile-context'

const SLOTS_PER_ROW = 4

interface ProfileAvatarStripProps {
  profiles: Profile[]
  activeProfileId?: string
  onProfileClick: (profileId: string, profileType: 'INDIVIDUAL' | 'ENTITY') => void
}

function getProfileName(profile: Profile): string {
  if (profile.type === 'INDIVIDUAL') {
    return (profile as IndividualProfile).full_name || 'Individual'
  }
  const entity = profile as EntityProfile
  return entity.trading_name || entity.legal_name || 'Business'
}

function getProfileSubLabel(profile: Profile): string {
  if (profile.type === 'INDIVIDUAL') {
    const cat = (profile as IndividualProfile).income_category
    if (!cat) return 'Individual'
    return cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, ' ')
  }
  const ent = profile as EntityProfile
  return ent.entity_type_name || 'Business'
}

function getProfileImage(profile: Profile): string | null {
  if (profile.type === 'INDIVIDUAL') {
    return (profile as IndividualProfile).profile_photo_url
  }
  return (profile as EntityProfile).logo_url
}

// Category-specific image and fallback icon for individual profiles
function getCategoryImage(category: string | null): string {
  const key = (category || '').toUpperCase()
  switch (key) {
    case 'AGRICULTURE': return '/images/categories/agriculture.jpg'
    case 'SALARIED': return '/images/categories/salaried.jpg'
    case 'BUSINESS': case 'MSME': return '/images/categories/business.jpg'
    case 'PROFESSIONAL': case 'DOCTOR': return '/images/categories/doctor.jpg'
    case 'LAWYER': return '/images/categories/lawyer.jpg'
    case 'NRI': return '/images/categories/nri.jpg'
    case 'STUDENT': return '/images/categories/student.jpg'
    case 'PENSIONER': return '/images/categories/pensioner.jpg'
    case 'PURE_RENTAL': case 'RENTAL': return '/images/categories/rental.jpg'
    case 'WOMEN': return '/images/categories/women.jpg'
    case 'GIG_ECONOMY': return '/images/categories/gig_economy.jpg'
    case 'CHARTERED_ACCOUNTANT': case 'COMPANY_SECRETARY': return '/images/categories/ca.jpg'
    default: return '/images/categories/default.jpg'
  }
}

function getCategoryIcon(category: string | null): { icon: React.ElementType; gradient: string; iconColor: string } {
  const key = (category || '').toUpperCase()
  switch (key) {
    case 'AGRICULTURE': return { icon: Wheat, gradient: 'from-green-600 to-emerald-800', iconColor: 'text-green-200' }
    case 'SALARIED': return { icon: Briefcase, gradient: 'from-blue-600 to-indigo-800', iconColor: 'text-blue-200' }
    case 'BUSINESS': case 'MSME': return { icon: Building2, gradient: 'from-violet-600 to-purple-800', iconColor: 'text-violet-200' }
    case 'PROFESSIONAL': case 'DOCTOR': return { icon: Heart, gradient: 'from-rose-600 to-pink-800', iconColor: 'text-rose-200' }
    case 'LAWYER': return { icon: Scale, gradient: 'from-amber-600 to-yellow-800', iconColor: 'text-amber-200' }
    case 'NRI': return { icon: Globe, gradient: 'from-cyan-600 to-teal-800', iconColor: 'text-cyan-200' }
    case 'STUDENT': return { icon: BookOpen, gradient: 'from-indigo-600 to-blue-800', iconColor: 'text-indigo-200' }
    case 'PENSIONER': return { icon: Clock, gradient: 'from-gray-500 to-slate-700', iconColor: 'text-gray-200' }
    case 'PURE_RENTAL': case 'RENTAL': return { icon: Home, gradient: 'from-orange-600 to-red-800', iconColor: 'text-orange-200' }
    case 'WOMEN': return { icon: Users, gradient: 'from-pink-500 to-rose-700', iconColor: 'text-pink-200' }
    case 'GIG_ECONOMY': return { icon: Zap, gradient: 'from-yellow-500 to-orange-700', iconColor: 'text-yellow-200' }
    case 'CHARTERED_ACCOUNTANT': case 'COMPANY_SECRETARY': return { icon: GraduationCap, gradient: 'from-teal-600 to-cyan-800', iconColor: 'text-teal-200' }
    default: return { icon: User, gradient: 'from-blue-500 to-orange-600', iconColor: 'text-white' }
  }
}

// Individual profile card — shows uploaded photo > category image > icon fallback
function IndividualCard({
  profile,
  isActive,
  onClick
}: {
  profile: IndividualProfile
  isActive: boolean
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const profilePhoto = profile.profile_photo_url
  const categoryImg = getCategoryImage(profile.income_category)
  const { icon: CategoryIcon, gradient, iconColor } = getCategoryIcon(profile.income_category)

  // Priority: uploaded photo → category image → gradient + icon
  const displayImage = profilePhoto || (!imgError ? categoryImg : null)

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-200 group ${
        isActive ? 'scale-105' : 'hover:scale-105'
      }`}
    >
      <div className={`relative w-[46px] h-[46px] rounded-lg overflow-hidden transition-all duration-200 ${
        isActive
          ? 'ring-2 ring-orange-500 shadow-[0_0_8px_rgba(255,103,0,0.4)]'
          : 'ring-1 ring-gray-700/50 group-hover:ring-orange-400/50'
      }`}>
        {displayImage ? (
          <img
            src={displayImage}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <CategoryIcon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>
      <span className={`text-[7px] leading-tight text-center truncate w-full font-medium ${
        isActive ? 'text-orange-400' : 'text-gray-400'
      }`}>
        {getProfileSubLabel(profile)}
      </span>
    </button>
  )
}

// Entity profile card
function EntityCard({
  profile,
  isActive,
  onClick
}: {
  profile: EntityProfile
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-200 group ${
        isActive ? 'scale-105' : 'hover:scale-105'
      }`}
    >
      <div className={`relative w-[46px] h-[46px] rounded-lg overflow-hidden transition-all duration-200 ${
        isActive
          ? 'ring-2 ring-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]'
          : 'ring-1 ring-gray-700/50 group-hover:ring-violet-400/50'
      }`}>
        <div className="w-full h-full bg-gradient-to-br from-violet-600 to-indigo-800 flex items-center justify-center">
          {profile.logo_url ? (
            <img src={profile.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-0.5 opacity-50">
              <Upload className="w-3.5 h-3.5 text-violet-200" />
              <span className="text-[5px] text-violet-200">Logo</span>
            </div>
          )}
        </div>
      </div>
      <span className={`text-[7px] leading-tight text-center truncate w-full font-medium ${
        isActive ? 'text-violet-400' : 'text-gray-400'
      }`}>
        {getProfileName(profile)}
      </span>
    </button>
  )
}

// Empty placeholder slot
function PlaceholderSlot({ type }: { type: 'individual' | 'entity' }) {
  const borderColor = type === 'individual' ? 'border-orange-800/30' : 'border-violet-800/30'
  const hoverBorder = type === 'individual' ? 'hover:border-orange-600/40' : 'hover:border-violet-600/40'
  const iconColor = type === 'individual' ? 'text-gray-700' : 'text-gray-700'

  return (
    <Link href="/customers/add-profile" prefetch={false} className="flex flex-col items-center gap-1 group">
      <div className={`w-[46px] h-[46px] rounded-lg border border-dashed ${borderColor} ${hoverBorder} bg-gray-800/20 flex items-center justify-center transition-all duration-200 group-hover:bg-gray-800/40`}>
        {type === 'individual' ? (
          <User className={`w-4 h-4 ${iconColor} opacity-30 group-hover:opacity-50 transition-opacity`} />
        ) : (
          <Building2 className={`w-4 h-4 ${iconColor} opacity-30 group-hover:opacity-50 transition-opacity`} />
        )}
      </div>
      <span className="text-[7px] leading-tight text-gray-600 group-hover:text-gray-500 transition-colors">Add</span>
    </Link>
  )
}

export default function ProfileAvatarStrip({
  profiles,
  activeProfileId,
  onProfileClick
}: ProfileAvatarStripProps) {
  const { individualProfiles, entityProfiles } = useMemo(() => {
    // Exclude the golden/default profile — it already has its own GoldenProfileCard above
    const individual = profiles.filter(p => p.type === 'INDIVIDUAL' && !p.is_default) as IndividualProfile[]
    const entity = profiles.filter(p => p.type === 'ENTITY') as EntityProfile[]
    return { individualProfiles: individual, entityProfiles: entity }
  }, [profiles])

  // Fill remaining slots with placeholders to always show 4 per row
  const indSlots = Math.max(SLOTS_PER_ROW, Math.ceil(individualProfiles.length / SLOTS_PER_ROW) * SLOTS_PER_ROW)
  const entSlots = Math.max(SLOTS_PER_ROW, Math.ceil(entityProfiles.length / SLOTS_PER_ROW) * SLOTS_PER_ROW)

  const indPlaceholders = indSlots - individualProfiles.length
  const entPlaceholders = entSlots - entityProfiles.length

  return (
    <div className="w-full px-2.5 py-2 space-y-2">
      {/* Individual Profiles Section */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
          <span className="text-[8px] font-semibold text-orange-400/70 uppercase tracking-wider">Individual</span>
          <div className="h-px flex-1 bg-gradient-to-r from-orange-500/30 to-transparent" />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {individualProfiles.map((profile) => (
            <IndividualCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeProfileId}
              onClick={() => onProfileClick(profile.id, profile.type)}
            />
          ))}
          {Array.from({ length: indPlaceholders }).map((_, i) => (
            <PlaceholderSlot key={`ind-ph-${i}`} type="individual" />
          ))}
        </div>
      </div>

      {/* Business Profiles Section */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
          <span className="text-[8px] font-semibold text-violet-400/70 uppercase tracking-wider">Business</span>
          <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {entityProfiles.map((profile) => (
            <EntityCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeProfileId}
              onClick={() => onProfileClick(profile.id, profile.type)}
            />
          ))}
          {Array.from({ length: entPlaceholders }).map((_, i) => (
            <PlaceholderSlot key={`ent-ph-${i}`} type="entity" />
          ))}
        </div>
      </div>
    </div>
  )
}
