'use client'

import React, { useEffect, useRef, useMemo, useState } from 'react'
import {
  X, User, Building2, Loader2, Plus, UserCircle, Crown,
  Wheat, Briefcase, Home, GraduationCap, Globe, Heart,
  Scale, BookOpen, Clock, Zap, Upload, ImagePlus, Users
} from 'lucide-react'
import Link from 'next/link'
import type { Profile, IndividualProfile, EntityProfile } from '@/lib/contexts/active-profile-context'

interface SwitchProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profiles: Profile[]
  activeProfileId?: string
  switchingProfileId: string | null
  onSwitchProfile: (profileId: string) => void
}

function getProfileDisplayName(profile: Profile): string {
  if (profile.type === 'INDIVIDUAL') {
    const ind = profile as IndividualProfile
    return ind.full_name || ind.income_category || 'Individual'
  }
  const ent = profile as EntityProfile
  return ent.trading_name || ent.legal_name || 'Business'
}

function getProfileSubLabel(profile: Profile): string {
  if (profile.type === 'INDIVIDUAL') {
    const ind = profile as IndividualProfile
    return ind.income_category || 'Individual'
  }
  const ent = profile as EntityProfile
  return ent.entity_type_name || ent.entity_type || 'Entity'
}

// Category-specific image for individual profiles (fallback when no photo uploaded)
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

// Category-specific icon and gradient for individual profiles (final fallback)
function getCategoryVisual(category: string | null): {
  icon: React.ElementType
  gradient: string
  iconColor: string
} {
  const key = (category || '').toUpperCase()
  switch (key) {
    case 'AGRICULTURE':
      return { icon: Wheat, gradient: 'from-green-600 to-emerald-800', iconColor: 'text-green-200' }
    case 'SALARIED':
      return { icon: Briefcase, gradient: 'from-blue-600 to-indigo-800', iconColor: 'text-blue-200' }
    case 'BUSINESS':
    case 'MSME':
      return { icon: Building2, gradient: 'from-violet-600 to-purple-800', iconColor: 'text-violet-200' }
    case 'PROFESSIONAL':
    case 'DOCTOR':
      return { icon: Heart, gradient: 'from-rose-600 to-pink-800', iconColor: 'text-rose-200' }
    case 'LAWYER':
      return { icon: Scale, gradient: 'from-amber-600 to-yellow-800', iconColor: 'text-amber-200' }
    case 'NRI':
      return { icon: Globe, gradient: 'from-cyan-600 to-teal-800', iconColor: 'text-cyan-200' }
    case 'STUDENT':
      return { icon: BookOpen, gradient: 'from-indigo-600 to-blue-800', iconColor: 'text-indigo-200' }
    case 'PENSIONER':
      return { icon: Clock, gradient: 'from-gray-500 to-slate-700', iconColor: 'text-gray-200' }
    case 'PURE_RENTAL':
    case 'RENTAL':
      return { icon: Home, gradient: 'from-orange-600 to-red-800', iconColor: 'text-orange-200' }
    case 'WOMEN':
      return { icon: Users, gradient: 'from-pink-500 to-rose-700', iconColor: 'text-pink-200' }
    case 'GIG_ECONOMY':
      return { icon: Zap, gradient: 'from-yellow-500 to-orange-700', iconColor: 'text-yellow-200' }
    case 'CHARTERED_ACCOUNTANT':
    case 'COMPANY_SECRETARY':
      return { icon: GraduationCap, gradient: 'from-teal-600 to-cyan-800', iconColor: 'text-teal-200' }
    default:
      return { icon: User, gradient: 'from-blue-500 to-orange-600', iconColor: 'text-white' }
  }
}

export default function SwitchProfileModal({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  switchingProfileId,
  onSwitchProfile
}: SwitchProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const { goldenProfile, individualProfiles, entityProfiles } = useMemo(() => {
    const individual = profiles.filter(
      (p) => p.type === 'INDIVIDUAL' && p.unique_id !== 'Pending'
    ) as IndividualProfile[]
    const entity = profiles.filter(
      (p) => p.type === 'ENTITY'
    ) as EntityProfile[]

    const golden = individual.find(p => p.is_default) || null
    const remainingIndividual = individual.filter(p => !p.is_default)

    return { goldenProfile: golden, individualProfiles: remainingIndividual, entityProfiles: entity }
  }, [profiles])

  if (!isOpen) return null

  const hasProfiles = !!goldenProfile || individualProfiles.length > 0 || entityProfiles.length > 0

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />

      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div
          ref={modalRef}
          className="w-full max-w-lg bg-[#0A0A0A] border border-gray-800 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80">
            <div>
              <h3 className="text-sm font-semibold text-white" style={{ color: 'white' }}>Switch Profile</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Select a profile to view its details</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {hasProfiles ? (
            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto scrollbar-thin">

              {/* ── Golden Profile (Primary) ── */}
              {goldenProfile && (() => {
                const { icon: CategoryIcon, gradient, iconColor } = getCategoryVisual(goldenProfile.income_category)
                const goldenCategoryImg = getCategoryImage(goldenProfile.income_category)
                const goldenDisplayImg = goldenProfile.profile_photo_url || goldenCategoryImg
                return (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px w-2 bg-gradient-to-r from-transparent to-amber-500/50" />
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">
                        Golden Profile
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-amber-500/50 to-transparent" />
                    </div>

                    <button
                      onClick={() => onSwitchProfile(goldenProfile.id)}
                      disabled={switchingProfileId === goldenProfile.id || goldenProfile.id === activeProfileId}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 group ${
                        goldenProfile.id === activeProfileId
                          ? 'bg-amber-500/10 ring-1 ring-amber-500/50 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                          : 'hover:bg-amber-500/5 hover:ring-1 hover:ring-amber-500/30'
                      }`}
                    >
                      {/* Square avatar with gold ring */}
                      <div className={`relative w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-200 ${
                        goldenProfile.id === activeProfileId
                          ? 'ring-2 ring-amber-400 shadow-[0_0_16px_rgba(212,175,55,0.4)]'
                          : 'ring-1 ring-amber-500/40 group-hover:ring-amber-400/60'
                      }`}>
                        <img src={goldenDisplayImg} alt="" className="w-full h-full object-cover" />
                        {switchingProfileId === goldenProfile.id && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 text-left min-w-0">
                        <p className={`text-sm font-semibold truncate ${
                          goldenProfile.id === activeProfileId ? 'text-amber-300' : 'text-amber-400/90'
                        }`}>
                          {getProfileDisplayName(goldenProfile)}
                        </p>
                        <p className="text-[10px] text-amber-500/60 truncate">
                          {getProfileSubLabel(goldenProfile)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider px-1.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                          Primary
                        </span>
                        {goldenProfile.id === activeProfileId && (
                          <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider">Active</span>
                        )}
                      </div>
                    </button>
                  </div>
                )
              })()}

              {/* ── Individual Profiles ── */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px w-2 bg-gradient-to-r from-transparent to-orange-500/50" />
                  <span className="text-[10px] font-semibold text-orange-400/80 uppercase tracking-wider">
                    Individual Profiles
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-orange-500/50 to-transparent" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {individualProfiles.length > 0 ? (
                    individualProfiles.map((profile) => {
                      const isActive = profile.id === activeProfileId
                      const isSwitching = switchingProfileId === profile.id
                      const categoryImg = getCategoryImage(profile.income_category)
                      const displayImg = profile.profile_photo_url || categoryImg

                      return (
                        <button
                          key={profile.id}
                          onClick={() => onSwitchProfile(profile.id)}
                          disabled={isSwitching || isActive}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 group ${
                            isActive
                              ? 'bg-orange-500/10 ring-1 ring-orange-500/50'
                              : 'hover:bg-white/5 hover:ring-1 hover:ring-gray-700'
                          }`}
                        >
                          <div className={`relative w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-200 ${
                            isActive
                              ? 'ring-2 ring-orange-500 shadow-[0_0_12px_rgba(255,103,0,0.3)]'
                              : 'ring-1 ring-gray-700/60 group-hover:ring-gray-500/60'
                          }`}>
                            <img src={displayImg} alt="" className="w-full h-full object-cover" />
                            {isSwitching && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="text-center min-w-0 w-full">
                            <p className={`text-[11px] font-medium truncate ${
                              isActive ? 'text-orange-400' : 'text-gray-300'
                            }`}>
                              {getProfileDisplayName(profile)}
                            </p>
                            <p className="text-[9px] text-gray-500 truncate">
                              {getProfileSubLabel(profile)}
                            </p>
                          </div>

                          {isActive && (
                            <span className="text-[8px] font-bold text-orange-400 uppercase tracking-wider">Active</span>
                          )}
                        </button>
                      )
                    })
                  ) : (
                    /* Placeholder cards when no individual profiles */
                    <>
                      {[1, 2, 3].map((i) => (
                        <Link
                          key={`placeholder-ind-${i}`}
                          href="/customers/add-profile"
                          prefetch={false}
                          onClick={onClose}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl border border-dashed border-gray-700/50 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-200 group"
                        >
                          <div className="w-16 h-16 rounded-xl bg-gray-800/40 flex items-center justify-center border border-dashed border-gray-700/40 group-hover:border-orange-500/20 transition-colors">
                            <User className="w-6 h-6 text-gray-600/50 group-hover:text-orange-500/30 transition-colors" />
                          </div>
                          <div className="text-center min-w-0 w-full">
                            <p className="text-[10px] text-gray-600 group-hover:text-orange-400/60 transition-colors">Add Profile</p>
                          </div>
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* ── Business Profiles ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px w-2 bg-gradient-to-r from-transparent to-violet-500/50" />
                  <span className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-wider">
                    Business Profiles
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-violet-500/50 to-transparent" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {entityProfiles.length > 0 ? (
                    entityProfiles.map((profile) => {
                      const isActive = profile.id === activeProfileId
                      const isSwitching = switchingProfileId === profile.id

                      return (
                        <button
                          key={profile.id}
                          onClick={() => onSwitchProfile(profile.id)}
                          disabled={isSwitching || isActive}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 group ${
                            isActive
                              ? 'bg-violet-500/10 ring-1 ring-violet-500/50'
                              : 'hover:bg-white/5 hover:ring-1 hover:ring-gray-700'
                          }`}
                        >
                          <div className={`relative w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-200 ${
                            isActive
                              ? 'ring-2 ring-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                              : 'ring-1 ring-gray-700/60 group-hover:ring-gray-500/60'
                          }`}>
                            <div className="w-full h-full bg-gradient-to-br from-violet-600 to-indigo-800 flex items-center justify-center">
                              {profile.logo_url ? (
                                <img src={profile.logo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                /* Upload logo watermark */
                                <div className="flex flex-col items-center gap-0.5 opacity-60">
                                  <Upload className="w-5 h-5 text-violet-200" />
                                  <span className="text-[7px] text-violet-200 font-medium">Logo</span>
                                </div>
                              )}
                            </div>
                            {isSwitching && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                                <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="text-center min-w-0 w-full">
                            <p className={`text-[11px] font-medium truncate ${
                              isActive ? 'text-violet-400' : 'text-gray-300'
                            }`}>
                              {getProfileDisplayName(profile)}
                            </p>
                            <p className="text-[9px] text-gray-500 truncate">
                              {getProfileSubLabel(profile)}
                            </p>
                          </div>

                          {isActive && (
                            <span className="text-[8px] font-bold text-violet-400 uppercase tracking-wider">Active</span>
                          )}
                        </button>
                      )
                    })
                  ) : (
                    /* Placeholder cards when no business profiles */
                    <>
                      {[1, 2, 3].map((i) => (
                        <Link
                          key={`placeholder-biz-${i}`}
                          href="/customers/add-profile"
                          prefetch={false}
                          onClick={onClose}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl border border-dashed border-gray-700/50 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-200 group"
                        >
                          <div className="w-16 h-16 rounded-xl bg-gray-800/40 flex items-center justify-center border border-dashed border-gray-700/40 group-hover:border-violet-500/20 transition-colors">
                            <ImagePlus className="w-5 h-5 text-gray-600/50 group-hover:text-violet-500/30 transition-colors" />
                          </div>
                          <div className="text-center min-w-0 w-full">
                            <p className="text-[10px] text-gray-600 group-hover:text-violet-400/60 transition-colors">Add Business</p>
                          </div>
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <UserCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-300 mb-1">No profiles yet</p>
              <p className="text-[11px] text-gray-500 mb-4">Create your first profile to get started</p>
              <Link
                href="/customers/add-profile"
                prefetch={false}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Profile
              </Link>
            </div>
          )}

          {/* Footer */}
          {hasProfiles && (
            <div className="border-t border-gray-800/80 px-5 py-3 bg-gray-900/30">
              <Link
                href="/customers/add-profile"
                prefetch={false}
                onClick={onClose}
                className="flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-orange-400 transition-colors py-1 group"
              >
                <div className="w-6 h-6 rounded-lg border border-dashed border-orange-700/50 group-hover:border-orange-500/80 flex items-center justify-center transition-colors">
                  <Plus className="w-3 h-3 text-orange-400/70" />
                </div>
                <span>Add New Profile</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
