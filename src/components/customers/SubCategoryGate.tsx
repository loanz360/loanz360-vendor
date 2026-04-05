'use client'

import { toast } from 'sonner'

import React, { useState, useMemo } from 'react'
import { ChevronRight, Lock, AlertTriangle, Check, HelpCircle, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import {
  CUSTOMER_SUBROLES,
  CUSTOMER_PROFILES,
  type CustomerSubrole,
  type CustomerProfile
} from '@/lib/constants/customer-subroles'
import OtherProfileModal from './OtherProfileModal'

interface SubCategoryGateProps {
  onComplete: (selection: {
    subrole: string
    subrole_name: string
    profile: string
    profile_name: string
    custom_profile_name?: string
  }) => void
  userName?: string
}

export default function SubCategoryGate({ onComplete, userName }: SubCategoryGateProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)

  // Selections
  const [selectedSubrole, setSelectedSubrole] = useState<CustomerSubrole | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<CustomerProfile | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Others profile modal
  const [showOtherModal, setShowOtherModal] = useState(false)
  const [customProfileName, setCustomProfileName] = useState<string | null>(null)
  const [pendingOtherProfile, setPendingOtherProfile] = useState<CustomerProfile | null>(null)

  // Get active subroles sorted by display order
  const activeSubroles = useMemo(() => {
    return CUSTOMER_SUBROLES
      .filter(s => s.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }, [])

  // Get profiles for selected subrole
  const availableProfiles = useMemo(() => {
    if (!selectedSubrole) return []
    const profiles = CUSTOMER_PROFILES[selectedSubrole.key] || []
    return profiles.filter(p => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
  }, [selectedSubrole])

  const handleSubroleSelect = (subrole: CustomerSubrole) => {
    setSelectedSubrole(subrole)
    setSelectedProfile(null)
    setStep(2)
  }

  const handleProfileSelect = (profile: CustomerProfile) => {
    // Check if this is an "Others" profile
    if (profile.isOther) {
      setPendingOtherProfile(profile)
      setShowOtherModal(true)
      return
    }

    setSelectedProfile(profile)
    setCustomProfileName(null)
    setShowConfirmation(true)
  }

  // Handle custom profile name submission
  const handleOtherProfileSubmit = (name: string) => {
    if (pendingOtherProfile) {
      setSelectedProfile(pendingOtherProfile)
      setCustomProfileName(name)
      setShowOtherModal(false)
      setPendingOtherProfile(null)
      setShowConfirmation(true)
    }
  }

  // Handle modal close
  const handleOtherModalClose = () => {
    setShowOtherModal(false)
    setPendingOtherProfile(null)
  }

  const handleConfirm = async () => {
    if (!selectedSubrole || !selectedProfile) return

    setSaving(true)
    try {
      const response = await fetch('/api/customers/profile/sub-category', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subrole: selectedSubrole.key,
          profile: selectedProfile.key,
          custom_profile_name: customProfileName || undefined
        })
      })

      const data = await response.json()
      if (data.success) {
        onComplete({
          subrole: selectedSubrole.key,
          subrole_name: selectedSubrole.name,
          profile: selectedProfile.key,
          profile_name: customProfileName || selectedProfile.name,
          custom_profile_name: customProfileName || undefined
        })
      } else {
        toast.error(data.error || 'Failed to save selection')
        setSaving(false)
      }
    } catch (err) {
      console.error('Failed to save selection:', err)
      toast.error('Failed to save selection. Please try again.')
      setSaving(false)
    }
  }

  const resetSelection = () => {
    setStep(1)
    setSelectedSubrole(null)
    setSelectedProfile(null)
    setShowConfirmation(false)
    setCustomProfileName(null)
    setShowOtherModal(false)
    setPendingOtherProfile(null)
  }

  // Get icon component for subrole
  const getSubroleIcon = (subrole: CustomerSubrole) => {
    const IconComponent = subrole.icon
    return <IconComponent className="w-8 h-8" style={{ color: subrole.color }} />
  }

  // Confirmation Screen
  if (showConfirmation) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 z-[9999] overflow-y-auto">
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <Logo size="md" />
              <span className="text-gray-400 text-sm">Profile Setup - Confirmation</span>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg bg-gray-900/80 border-gray-700/50 p-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Confirm Your Selection</h2>
                  <p className="text-gray-400 text-sm">Please review carefully before confirming</p>
                </div>
              </div>

              {/* Warning Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Lock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-amber-300 font-medium">Important Notice</p>
                    <p className="text-amber-200/70 text-sm mt-1">
                      Once confirmed, this selection <strong>cannot be changed</strong>. Your dashboard and available features will be customized based on this selection.
                    </p>
                  </div>
                </div>
              </div>

              {/* Selection Summary */}
              <div className="space-y-3 mb-6">
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Category</p>
                  <div className="flex items-center gap-3">
                    {selectedSubrole && getSubroleIcon(selectedSubrole)}
                    <p className="text-white font-medium text-lg">{selectedSubrole?.name}</p>
                  </div>
                  {selectedSubrole?.description && (
                    <p className="text-gray-500 text-sm mt-1">{selectedSubrole.description}</p>
                  )}
                </div>
                <div className="bg-[#FF6700]/10 rounded-xl p-4 border border-[#FF6700]/30">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Profile</p>
                  <p className="text-[#FF6700] font-semibold text-lg">
                    {customProfileName || selectedProfile?.name}
                  </p>
                  {customProfileName && (
                    <p className="text-gray-500 text-sm mt-1">(Custom profile under {selectedProfile?.name})</p>
                  )}
                  {!customProfileName && selectedProfile?.description && (
                    <p className="text-gray-400 text-sm mt-1">{selectedProfile.description}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowConfirmation(false)}
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 py-6"
                  disabled={saving}
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1 bg-[#FF6700] hover:bg-[#ff8533] py-6"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      Confirm & Lock
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </main>

          {/* Footer */}
          <footer className="border-t border-gray-800 py-4">
            <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
              <div className="flex items-center space-x-2 text-gray-500 text-sm">
                <HelpCircle className="w-4 h-4" />
                <span>Need help? Contact support at support@loanz360.com</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 z-[9999] overflow-y-auto">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <Logo size="md" />
            <span className="text-gray-400 text-sm">Profile Setup - Step {step} of 2</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-5xl">
            {/* Welcome Card (shown on step 1) */}
            {step === 1 && (
              <Card className="bg-gray-900/80 border-gray-700/50 p-8 mb-8 text-center">
                <div className="w-20 h-20 rounded-full bg-[#FF6700]/20 flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-10 h-10 text-[#FF6700]" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">
                  {userName ? `Welcome, ${userName}!` : 'Complete Your Profile Setup'}
                </h1>
                <p className="text-gray-400 text-lg mb-4 max-w-xl mx-auto">
                  Before you can access your personalized dashboard, please select your profile category. This helps us tailor your experience.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 max-w-md mx-auto">
                  <div className="flex items-center justify-center space-x-2">
                    <Lock className="w-5 h-5 text-amber-400" />
                    <p className="text-amber-300 text-sm font-medium">
                      This selection is permanent and cannot be changed later
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              {['Select Category', 'Select Profile'].map((label, idx) => (
                <div key={idx} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                      step > idx + 1
                        ? 'bg-green-500'
                        : step === idx + 1
                          ? 'bg-[#FF6700] ring-4 ring-[#FF6700]/20'
                          : 'bg-gray-700'
                    }`}>
                      {step > idx + 1 ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-white font-semibold">{idx + 1}</span>
                      )}
                    </div>
                    <span className={`text-xs mt-2 ${
                      step === idx + 1 ? 'text-[#FF6700]' : 'text-gray-500'
                    }`}>
                      {label}
                    </span>
                  </div>
                  {idx < 1 && (
                    <div className={`w-24 md:w-32 h-1 mx-4 rounded ${
                      step > idx + 1 ? 'bg-green-500' : 'bg-gray-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step Content Card */}
            <Card className="bg-gray-900/80 border-gray-700/50 p-8">
              {/* Step 1: Select Subrole (Category) */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Select Your Category</h2>
                    <p className="text-gray-400">Choose the category that best describes you</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activeSubroles.map(subrole => (
                      <button
                        key={subrole.key}
                        onClick={() => handleSubroleSelect(subrole)}
                        className="p-5 rounded-xl border-2 border-gray-700/50 hover:border-[#FF6700]/50 hover:bg-[#FF6700]/5 transition-all text-left group"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all"
                          style={{ backgroundColor: `${subrole.color}20` }}
                        >
                          {getSubroleIcon(subrole)}
                        </div>
                        <h4 className="font-semibold text-white text-base mb-1 group-hover:text-[#FF6700] transition-colors">
                          {subrole.name}
                        </h4>
                        <p className="text-gray-500 text-xs line-clamp-2">{subrole.description}</p>
                        <div className="mt-3 flex items-center text-gray-500 text-xs">
                          <span>{CUSTOMER_PROFILES[subrole.key]?.length || 0} profiles</span>
                          <ChevronRight className="w-4 h-4 ml-auto group-hover:text-[#FF6700] transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Select Profile */}
              {step === 2 && selectedSubrole && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">Select Your Profile</h2>
                      <div className="flex items-center gap-2">
                        {getSubroleIcon(selectedSubrole)}
                        <span className="text-[#FF6700] font-medium">{selectedSubrole.name}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetSelection}
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      Change Category
                    </Button>
                  </div>

                  {availableProfiles.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                      <p className="text-amber-300 mb-4">No profiles available for this category</p>
                      <Button onClick={resetSelection} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                        Select Different Category
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
                      {availableProfiles.map(profile => (
                        <button
                          key={profile.key}
                          onClick={() => handleProfileSelect(profile)}
                          className={`p-4 rounded-xl border-2 text-left transition-all group ${
                            profile.isOther
                              ? 'border-dashed border-gray-600 hover:border-[#FF6700]/50 hover:bg-[#FF6700]/5'
                              : selectedProfile?.key === profile.key
                                ? 'border-[#FF6700] bg-[#FF6700]/10'
                                : 'border-gray-700/50 hover:border-[#FF6700]/50 hover:bg-gray-800/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {profile.isOther && (
                              <PlusCircle className="w-5 h-5 text-[#FF6700]" />
                            )}
                            <h4 className={`font-medium group-hover:text-[#FF6700] transition-colors ${
                              profile.isOther ? 'text-[#FF6700]' : 'text-white'
                            }`}>
                              {profile.name}
                            </h4>
                          </div>
                          {profile.description && (
                            <p className="text-gray-500 text-sm mt-1 line-clamp-2">{profile.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 py-4">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-gray-500 text-sm">
              <HelpCircle className="w-4 h-4" />
              <span>Need help? Contact support at support@loanz360.com</span>
            </div>
            <p className="text-gray-600 text-xs">&copy; {new Date().getFullYear()} LOANZ360. All rights reserved.</p>
          </div>
        </footer>
      </div>

      {/* Other Profile Modal */}
      <OtherProfileModal
        isOpen={showOtherModal}
        onClose={handleOtherModalClose}
        onSubmit={handleOtherProfileSubmit}
        categoryName={selectedSubrole?.name || ''}
      />
    </div>
  )
}
