'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import {
  Edit3,
  Save,
  X,
  Loader2,
  Camera,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface TabItem {
  id: string
  label: string
  icon: LucideIcon
}

export interface TabGroup {
  label: string
  tabs: TabItem[]
}

export interface ProfileStatusBadge {
  label: string
  color: string
  bgColor: string
  icon: LucideIcon
}

export interface OnboardingStatusBadge {
  label: string
  color: string
}

export interface ProfileInfo {
  name: string
  partnerId: string
  partnerIdLabel: string
  partnerTypeLabel: string
  email: string
  mobile: string
  countryCode: string
  location: string
  registrationDate: string
  photoUrl: string | null
  accountStatus: ProfileStatusBadge
  onboardingStatus: OnboardingStatusBadge
  businessCategory?: string
  kycVerified: boolean
  bankVerified: boolean
  emailVerified: boolean
  mobileVerified: boolean
  completionPercentage: number
}

interface PartnerProfileLayoutProps {
  profileInfo: ProfileInfo
  tabGroups: TabGroup[]
  activeTab: string
  onTabChange: (tabId: string) => void
  isEditing: boolean
  isSaving: boolean
  onEditToggle: () => void
  onSave: () => void
  onCancel: () => void
  onPhotoUpload?: (file: File) => void
  isUploadingPhoto?: boolean
  headerExtra?: React.ReactNode
  isLoading: boolean
  children: React.ReactNode
}

// ============================================
// HELPER COMPONENTS
// ============================================

function VerificationBadge({
  label,
  verified,
}: {
  label: string
  verified: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        verified
          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
          : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
      }`}
    >
      {verified ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {label}
    </div>
  )
}

function CompletionBar({ percentage }: { percentage: number }) {
  const getColor = () => {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Profile Completion</span>
        <span className="text-xs font-bold text-white">{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}

// ============================================
// PROFILE HEADER
// ============================================

function ProfileHeader({
  profileInfo,
  isEditing,
  isSaving,
  onEditToggle,
  onSave,
  onCancel,
  onPhotoUpload,
  isUploadingPhoto,
  headerExtra,
}: {
  profileInfo: ProfileInfo
  isEditing: boolean
  isSaving: boolean
  onEditToggle: () => void
  onSave: () => void
  onCancel: () => void
  onPhotoUpload?: (file: File) => void
  isUploadingPhoto?: boolean
  headerExtra?: React.ReactNode
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const StatusIcon = profileInfo.accountStatus.icon

  const handlePhotoClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onPhotoUpload) {
      onPhotoUpload(file)
    }
    if (e.target) e.target.value = ''
  }

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row gap-5">
        {/* Photo */}
        <div className="flex-shrink-0">
          <div
            className={`relative w-20 h-20 rounded-xl overflow-hidden bg-gray-800 border-2 ${
              isEditing
                ? 'border-orange-500/50 cursor-pointer hover:border-orange-500'
                : 'border-gray-700'
            }`}
            onClick={handlePhotoClick}
          >
            {profileInfo.photoUrl ? (
              <Image
                src={profileInfo.photoUrl}
                alt={profileInfo.name}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-10 h-10 text-gray-600" />
              </div>
            )}
            {isEditing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                {isUploadingPhoto ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white font-poppins truncate">
                {profileInfo.name || 'Partner Profile'}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-gray-400">{profileInfo.partnerTypeLabel}</span>
                <span className="text-gray-600">|</span>
                <span className="text-xs text-gray-400">{profileInfo.partnerIdLabel}:</span>
                <span className="text-xs font-mono font-bold text-orange-400">
                  {profileInfo.partnerId || 'N/A'}
                </span>
                {profileInfo.businessCategory && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span className="text-xs text-gray-400">{profileInfo.businessCategory}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-gray-500">
                {profileInfo.email && <span>{profileInfo.email}</span>}
                {profileInfo.mobile && (
                  <>
                    <span className="text-gray-700">|</span>
                    <span>
                      {profileInfo.countryCode} {profileInfo.mobile}
                    </span>
                  </>
                )}
                {profileInfo.location && (
                  <>
                    <span className="text-gray-700">|</span>
                    <span>{profileInfo.location}</span>
                  </>
                )}
              </div>
              {headerExtra}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isEditing ? (
                <>
                  <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-500 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={onEditToggle}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-500 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Status Badges Row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {/* Account Status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${profileInfo.accountStatus.bgColor}`}
            >
              <StatusIcon className={`w-3 h-3 ${profileInfo.accountStatus.color}`} />
              <span className={profileInfo.accountStatus.color}>
                {profileInfo.accountStatus.label}
              </span>
            </div>

            {/* Onboarding Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 border border-gray-700">
              <span className={profileInfo.onboardingStatus.color}>
                {profileInfo.onboardingStatus.label}
              </span>
            </div>

            <div className="h-4 w-px bg-gray-700" />

            {/* Verification Badges */}
            <VerificationBadge label="KYC" verified={profileInfo.kycVerified} />
            <VerificationBadge label="Bank" verified={profileInfo.bankVerified} />
            <VerificationBadge label="Email" verified={profileInfo.emailVerified} />
            <VerificationBadge label="Mobile" verified={profileInfo.mobileVerified} />
          </div>

          {/* Completion Bar */}
          <div className="mt-3 max-w-xs">
            <CompletionBar percentage={profileInfo.completionPercentage} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// VERTICAL TABS SIDEBAR
// ============================================

function VerticalTabsSidebar({
  tabGroups,
  activeTab,
  onTabChange,
}: {
  tabGroups: TabGroup[]
  activeTab: string
  onTabChange: (tabId: string) => void
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  return (
    <nav className="w-56 flex-shrink-0">
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
        {tabGroups.map((group, groupIdx) => {
          const isCollapsed = collapsedGroups.has(group.label)

          return (
            <div key={group.label}>
              {groupIdx > 0 && <div className="h-px bg-gray-800" />}
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-400 transition-colors"
              >
                <span>{group.label}</span>
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {/* Tab Items */}
              {!isCollapsed && (
                <div className="pb-1">
                  {group.tabs.map((tab) => {
                    const isActive = tab.id === activeTab
                    const Icon = tab.icon

                    return (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all ${
                          isActive
                            ? 'text-orange-400 bg-orange-500/10 border-l-2 border-orange-500'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border-l-2 border-transparent'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-orange-400' : ''}`} />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

// ============================================
// LOADING SKELETON
// ============================================

function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
        <div className="flex gap-5">
          <div className="w-20 h-20 rounded-xl bg-gray-800" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48 bg-gray-800 rounded" />
            <div className="h-4 w-64 bg-gray-800 rounded" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 w-16 bg-gray-800 rounded-full" />
              ))}
            </div>
            <div className="h-2 w-48 bg-gray-800 rounded-full" />
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="flex gap-4">
        <div className="w-56 flex-shrink-0">
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-8 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================

export default function PartnerProfileLayout({
  profileInfo,
  tabGroups,
  activeTab,
  onTabChange,
  isEditing,
  isSaving,
  onEditToggle,
  onSave,
  onCancel,
  onPhotoUpload,
  isUploadingPhoto = false,
  headerExtra,
  isLoading,
  children,
}: PartnerProfileLayoutProps) {
  if (isLoading) {
    return <ProfileSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Profile Header Card */}
      <ProfileHeader
        profileInfo={profileInfo}
        isEditing={isEditing}
        isSaving={isSaving}
        onEditToggle={onEditToggle}
        onSave={onSave}
        onCancel={onCancel}
        onPhotoUpload={onPhotoUpload}
        isUploadingPhoto={isUploadingPhoto}
        headerExtra={headerExtra}
      />

      {/* Main Content: Vertical Tabs + Content */}
      <div className="flex gap-4">
        {/* Vertical Tabs Sidebar */}
        <VerticalTabsSidebar
          tabGroups={tabGroups}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
