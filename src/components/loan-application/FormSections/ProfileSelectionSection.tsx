'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  User, Building2, CheckCircle, AlertCircle, Loader2, ChevronRight,
  Shield, MapPin, FileText, BadgeCheck, AlertTriangle, Lock
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

interface ApplicantProfile {
  type: 'INDIVIDUAL' | 'ENTITY'
  id: string
  display_id: string
  linkId?: string
  name: string
  label: string
  subtitle: string
  entityType?: {
    id: string
    code: string
    name: string
    short_name: string | null
    category: string
    color: string | null
  }
  role?: {
    code: string
    name: string
  }
  ownership?: number
  isPrimaryContact?: boolean
  pan: string | null
  gstin?: string | null
  location: string | null
  completion: number
  verificationStatus: string
  verified?: {
    aadhaar: boolean
    pan: boolean
  }
  incomeCategory?: {
    id: string
    code: string
    name: string
    color: string | null
  }
  incomeProfile?: {
    id: string
    code: string
    name: string
  }
  canApply: boolean
  message: string | null
}

interface ProfileSelectionSectionProps {
  onSelect: (profile: ApplicantProfile) => void
  selectedProfileId?: string
  onContinue?: () => void
  showContinueButton?: boolean
}

export default function ProfileSelectionSection({
  onSelect,
  selectedProfileId,
  onContinue,
  showContinueButton = true
}: ProfileSelectionSectionProps) {
  const [profiles, setProfiles] = useState<ApplicantProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<ApplicantProfile | null>(null)

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/customers/loan-applicant-profiles', {
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setProfiles(data.profiles || [])

        // If there's a pre-selected profile, find and set it
        if (selectedProfileId) {
          const preSelected = data.profiles.find((p: ApplicantProfile) => p.id === selectedProfileId)
          if (preSelected) {
            setSelectedProfile(preSelected)
          }
        }
      } else {
        setError(data.error || 'Failed to load profiles')
      }
    } catch (err) {
      clientLogger.error('Error fetching applicant profiles', { error: err })
      setError('Failed to load profiles')
    } finally {
      setLoading(false)
    }
  }, [selectedProfileId])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleSelect = (profile: ApplicantProfile) => {
    if (!profile.canApply) return
    setSelectedProfile(profile)
    onSelect(profile)
  }

  const getCategoryColor = (category: string | undefined) => {
    const colorMap: Record<string, string> = {
      INDIVIDUAL: 'border-blue-500/50 bg-blue-500/10',
      PARTNERSHIP: 'border-green-500/50 bg-green-500/10',
      CORPORATE: 'border-purple-500/50 bg-purple-500/10',
      TRUST_NGO: 'border-orange-500/50 bg-orange-500/10',
      COOPERATIVE: 'border-cyan-500/50 bg-cyan-500/10',
      JOINT_VENTURE: 'border-pink-500/50 bg-pink-500/10',
    }
    return colorMap[category || ''] || 'border-gray-500/50 bg-gray-500/10'
  }

  const getVerificationIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <BadgeCheck className="w-4 h-4 text-green-400" />
      case 'PENDING':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-gray-400">Loading your profiles...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Unable to Load Profiles</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchProfiles}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Profile Required</h3>
        <p className="text-gray-400 mb-4">
          Please complete your profile before applying for a loan.
        </p>
        <a
          href="/customers/my-profile"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          Complete Profile
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    )
  }

  // Separate individual and entity profiles
  const individualProfile = profiles.find(p => p.type === 'INDIVIDUAL')
  const entityProfiles = profiles.filter(p => p.type === 'ENTITY')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Who is Applying?</h2>
        <p className="text-gray-400">
          Select the profile or entity for this loan application
        </p>
      </div>

      {/* Individual Profile */}
      {individualProfile && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Personal Application
          </h3>

          <button
            onClick={() => handleSelect(individualProfile)}
            disabled={!individualProfile.canApply}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
              selectedProfile?.id === individualProfile.id
                ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                : individualProfile.canApply
                  ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
                  : 'border-gray-800 bg-gray-900/50 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  selectedProfile?.id === individualProfile.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-semibold text-white">{individualProfile.name}</h4>
                    {getVerificationIcon(individualProfile.verificationStatus)}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{individualProfile.label}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {individualProfile.incomeCategory && (
                      <span className="px-2 py-0.5 bg-gray-700 rounded">
                        {individualProfile.incomeCategory.name}
                      </span>
                    )}
                    {individualProfile.incomeProfile && (
                      <span className="px-2 py-0.5 bg-gray-700 rounded">
                        {individualProfile.incomeProfile.name}
                      </span>
                    )}
                    {individualProfile.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {individualProfile.location}
                      </span>
                    )}
                  </div>
                  {individualProfile.verified && (
                    <div className="flex items-center gap-3 mt-2">
                      {individualProfile.verified.pan && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" /> PAN Verified
                        </span>
                      )}
                      {individualProfile.verified.aadhaar && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" /> Aadhaar Verified
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-white">{individualProfile.completion}%</div>
                <div className="text-xs text-gray-500">Complete</div>
                <div className="w-20 h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      individualProfile.completion >= 50 ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${individualProfile.completion}%` }}
                  />
                </div>
              </div>
            </div>

            {!individualProfile.canApply && individualProfile.message && (
              <div className="mt-3 flex items-center gap-2 text-sm text-yellow-400">
                <Lock className="w-4 h-4" />
                {individualProfile.message}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Entity Profiles */}
      {entityProfiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Business/Entity Applications ({entityProfiles.length})
          </h3>

          <div className="space-y-3">
            {entityProfiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => handleSelect(profile)}
                disabled={!profile.canApply}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedProfile?.id === profile.id
                    ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                    : profile.canApply
                      ? `border-gray-700 bg-gray-800/50 hover:border-gray-600 ${getCategoryColor(profile.entityType?.category)}`
                      : 'border-gray-800 bg-gray-900/50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      selectedProfile?.id === profile.id
                        ? 'bg-orange-500 text-white'
                        : getCategoryColor(profile.entityType?.category)
                    }`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{profile.name}</h4>
                        {getVerificationIcon(profile.verificationStatus)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-2">
                        <span className="px-2 py-0.5 bg-gray-700 rounded">
                          {profile.entityType?.short_name || profile.entityType?.name}
                        </span>
                        {profile.role && (
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {profile.role.name}
                          </span>
                        )}
                        {profile.ownership && (
                          <span>{profile.ownership}% ownership</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {profile.gstin && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            GST: {profile.gstin}
                          </span>
                        )}
                        {profile.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {profile.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{profile.completion}%</div>
                    <div className="text-xs text-gray-500">Complete</div>
                    <div className="w-16 h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          profile.completion >= 30 ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${profile.completion}%` }}
                      />
                    </div>
                  </div>
                </div>

                {!profile.canApply && profile.message && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-yellow-400">
                    <Lock className="w-4 h-4" />
                    {profile.message}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Entities Message */}
      {entityProfiles.length === 0 && (
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-400 mb-2">
                No business entities linked to your profile.
              </p>
              <a
                href="/customers/my-profile"
                className="text-sm text-orange-400 hover:text-orange-300"
              >
                Add an entity to apply for business loans →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button */}
      {showContinueButton && selectedProfile && (
        <div className="pt-4">
          <button
            onClick={onContinue}
            className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Continue as {selectedProfile.type === 'INDIVIDUAL' ? selectedProfile.name : selectedProfile.name}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
