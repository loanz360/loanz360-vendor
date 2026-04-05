'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  X, User, Star, Gift, Shield, TrendingUp, FileCheck, Bell,
  ChevronRight, Sparkles, Target, Award, CheckCircle2
} from 'lucide-react'

interface ProfileCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  profileCompletion?: number
  userName?: string
}

export default function ProfileCompletionModal({
  isOpen,
  onClose,
  profileCompletion = 0,
  userName = 'there'
}: ProfileCompletionModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  const handleCompleteProfile = () => {
    onClose()
    router.push('/customers/add-profile')
  }

  const handleRemindLater = () => {
    // Store in localStorage to not show for next 24 hours
    localStorage.setItem('loanz360_profile_reminder_dismissed', Date.now().toString())
    onClose()
  }

  // Benefits of completing profile
  const benefits = [
    {
      icon: TrendingUp,
      title: 'Personalized Loan Offers',
      description: 'Get loan offers tailored to your income and requirements',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20'
    },
    {
      icon: Shield,
      title: 'Faster Approvals',
      description: 'Pre-verified profiles get 3x faster loan approvals',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20'
    },
    {
      icon: Gift,
      title: 'Exclusive Benefits',
      description: 'Access special interest rates and cashback offers',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20'
    },
    {
      icon: FileCheck,
      title: 'Simplified Documentation',
      description: 'One-time document upload for all future applications',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20'
    }
  ]

  // Steps to complete profile
  const steps = [
    { label: 'Select Income Category', completed: profileCompletion >= 20 },
    { label: 'Add Personal Details', completed: profileCompletion >= 40 },
    { label: 'Upload Documents', completed: profileCompletion >= 60 },
    { label: 'Complete KYC', completed: profileCompletion >= 80 },
    { label: 'Verify Information', completed: profileCompletion >= 100 }
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-gray-700 w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500 p-6 text-center">
          {/* Decorative elements */}
          <div className="absolute top-2 left-4 opacity-30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="absolute top-4 right-6 opacity-30">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div className="absolute bottom-2 left-1/4 opacity-20">
            <Award className="w-4 h-4 text-white" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Avatar with glow effect */}
          <div className="relative inline-block mb-4">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-white shadow-md">
              <Target className="w-4 h-4 text-yellow-900" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1 font-poppins">
            Hey {userName}!
          </h2>
          <p className="text-white/90 text-sm">
            Complete your profile to unlock amazing benefits
          </p>
        </div>

        {/* Progress indicator */}
        <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Profile Completion</span>
            <span className="text-orange-400 font-semibold">{profileCompletion}%</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${profileCompletion}%` }}
            />
          </div>
          {profileCompletion < 100 && (
            <p className="text-gray-500 text-xs mt-2">
              {100 - profileCompletion}% more to unlock all features
            </p>
          )}
        </div>

        {/* Main content */}
        <div className="p-6 space-y-5">
          {/* Key message */}
          <div className="text-center">
            <p className="text-white text-lg font-medium mb-2">
              Unlock Your Full Potential
            </p>
            <p className="text-gray-400 text-sm">
              A complete profile helps us understand you better and provide personalized financial solutions tailored just for you.
            </p>
          </div>

          {/* Benefits grid */}
          <div className="grid grid-cols-2 gap-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <div
                  key={index}
                  className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-colors"
                >
                  <div className={`w-10 h-10 ${benefit.bgColor} rounded-lg flex items-center justify-center mb-2`}>
                    <Icon className={`w-5 h-5 ${benefit.color}`} />
                  </div>
                  <h4 className="text-white text-sm font-medium mb-1">{benefit.title}</h4>
                  <p className="text-gray-500 text-xs leading-relaxed">{benefit.description}</p>
                </div>
              )
            })}
          </div>

          {/* Quick steps preview */}
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Quick Steps</p>
            <div className="space-y-2">
              {steps.slice(0, 3).map((step, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    step.completed
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-500'
                  }`}>
                    {step.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-sm ${step.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
              {steps.length > 3 && (
                <p className="text-gray-500 text-xs pl-8">+{steps.length - 3} more steps</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={handleCompleteProfile}
            className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            Complete My Profile Now
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={handleRemindLater}
            className="w-full py-2.5 text-gray-400 hover:text-gray-300 text-sm transition-colors"
          >
            Remind me later
          </button>
        </div>

        {/* Bottom note */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 justify-center text-gray-500 text-xs">
            <Bell className="w-3.5 h-3.5" />
            <span>We'll send you helpful reminders to complete your profile</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper to check if reminder was recently dismissed
export function wasReminderDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false

  const dismissedAt = localStorage.getItem('loanz360_profile_reminder_dismissed')
  if (!dismissedAt) return false

  const dismissedTime = parseInt(dismissedAt, 10)
  const twentyFourHours = 24 * 60 * 60 * 1000

  return Date.now() - dismissedTime < twentyFourHours
}

// Helper to clear the dismissal (for testing or after a week)
export function clearReminderDismissal(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('loanz360_profile_reminder_dismissed')
  }
}
