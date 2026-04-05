'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Rocket,
  Users,
  Send,
  BarChart3,
  ArrowRight,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

interface BPOnboardingTourProps {
  onComplete: () => void
}

interface TourStep {
  title: string
  description: string
  icon: React.ReactNode
  hint?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Loanz360!',
    description:
      'You\'re now a Business Partner with the power to build and manage your own team of Business Associates.',
    icon: <Rocket className="w-10 h-10 text-[#FF6700]" />,
    hint: 'Let\'s walk through the key features',
  },
  {
    title: 'Build Your Team',
    description:
      'Recruit Business Associates from the Team section. Track their performance and earn commission on their leads too!',
    icon: <Users className="w-10 h-10 text-[#FF6700]" />,
    hint: 'Find this in the Team section',
  },
  {
    title: 'Submit & Track Leads',
    description:
      'Submit leads directly or let your BAs submit. Track all leads from your Leads Management section.',
    icon: <Send className="w-10 h-10 text-[#FF6700]" />,
    hint: 'Find this in the sidebar menu',
  },
  {
    title: 'Monitor Performance',
    description:
      'View team performance, commission analytics, and payout forecasts from your dashboard.',
    icon: <BarChart3 className="w-10 h-10 text-[#FF6700]" />,
    hint: 'Visible on your main dashboard',
  },
  {
    title: 'Get Started!',
    description:
      'Start by inviting your first Business Associate or submitting your first lead!',
    icon: <Sparkles className="w-10 h-10 text-[#FF6700]" />,
    hint: 'Build your team now',
  },
]

const STORAGE_KEY = 'bp_onboarding_complete'

export default function BPOnboardingTour({ onComplete }: BPOnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isFading, setIsFading] = useState(false)
  const [stepFading, setStepFading] = useState(false)

  useEffect(() => {
    try {
      const completed = localStorage.getItem(STORAGE_KEY)
      if (completed === 'true') {
        return
      }
    } catch {
      // localStorage not available, show tour anyway
    }
    // Small delay to let the dashboard render first
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const completeTour = useCallback(() => {
    setIsFading(true)
    setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, 'true')
      } catch {
        // Silently fail if localStorage is not available
      }
      setIsVisible(false)
      setIsFading(false)
      onComplete()
    }, 300)
  }, [onComplete])

  const handleNext = useCallback(() => {
    if (currentStep === TOUR_STEPS.length - 1) {
      completeTour()
      return
    }
    setStepFading(true)
    setTimeout(() => {
      setCurrentStep((prev) => prev + 1)
      setStepFading(false)
    }, 200)
  }, [currentStep, completeTour])

  const handleSkip = useCallback(() => {
    completeTour()
  }, [completeTour])

  if (!isVisible) return null

  const step = TOUR_STEPS[currentStep]
  const isLastStep = currentStep === TOUR_STEPS.length - 1
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding Tour"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-lg mx-auto transition-all duration-200 ${
          stepFading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-gray-800">
            <div
              className="h-full bg-[#FF6700] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Skip button */}
          {!isLastStep && (
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-800"
              aria-label="Skip tour"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Content */}
          <div className="px-6 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-[#FF6700]/10 border border-[#FF6700]/20 flex items-center justify-center">
                {step.icon}
              </div>
            </div>

            {/* Step counter */}
            <div className="text-center mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-3 font-poppins">
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-gray-400 text-center text-sm sm:text-base leading-relaxed mb-2">
              {step.description}
            </p>

            {/* Hint */}
            {step.hint && (
              <p className="text-[#FF6700]/80 text-center text-xs font-medium mb-6">
                {step.hint}
              </p>
            )}

            {/* Progress dots */}
            <div className="flex justify-center gap-2 mb-8">
              {TOUR_STEPS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (index <= currentStep) {
                      setStepFading(true)
                      setTimeout(() => {
                        setCurrentStep(index)
                        setStepFading(false)
                      }, 200)
                    }
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-8 bg-[#FF6700]'
                      : index < currentStep
                        ? 'w-2 bg-[#FF6700]/50 cursor-pointer hover:bg-[#FF6700]/70'
                        : 'w-2 bg-gray-700'
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                  disabled={index > currentStep}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {!isLastStep && (
                <button
                  onClick={handleSkip}
                  className="order-2 sm:order-1 text-sm text-gray-500 hover:text-gray-300 transition-colors py-2 px-4"
                >
                  Skip Tour
                </button>
              )}
              <button
                onClick={handleNext}
                className={`order-1 sm:order-2 w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  isLastStep
                    ? 'bg-[#FF6700] hover:bg-[#FF6700]/90 text-white shadow-lg shadow-[#FF6700]/20'
                    : 'bg-[#FF6700] hover:bg-[#FF6700]/90 text-white'
                }`}
              >
                {isLastStep ? (
                  <>
                    Invite Your First BA
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
