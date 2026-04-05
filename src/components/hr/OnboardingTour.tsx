'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'

interface TourStep {
  target: string // CSS selector
  title: string
  description: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const HR_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: 'Welcome to HR Dashboard',
    description: 'Get a real-time overview of your workforce — headcount, attendance, leaves, and key metrics at a glance.',
    position: 'bottom',
  },
  {
    target: '[data-tour="employees"]',
    title: 'Employee Management',
    description: 'Add, edit, and manage all employees. View profiles, update roles, and handle onboarding/offboarding.',
    position: 'right',
  },
  {
    target: '[data-tour="attendance"]',
    title: 'Attendance & Leaves',
    description: 'Track daily attendance, manage leave requests, and approve/reject time-off applications.',
    position: 'right',
  },
  {
    target: '[data-tour="payroll"]',
    title: 'Payroll Processing',
    description: 'Generate payroll runs, process salaries, manage tax declarations, and generate payslips.',
    position: 'right',
  },
  {
    target: '[data-tour="reviews"]',
    title: 'Performance Reviews',
    description: 'Conduct performance appraisals, 360-degree feedback, and manage PIPs.',
    position: 'right',
  },
  {
    target: '[data-tour="analytics"]',
    title: 'HR Analytics',
    description: 'Dive deep into workforce data with interactive charts — attrition, hiring trends, department stats, and more.',
    position: 'right',
  },
  {
    target: '[data-tour="search"]',
    title: 'Quick Navigation',
    description: 'Press Ctrl+K anytime to quickly search and navigate to any HR module.',
    position: 'bottom',
  },
]

const TOUR_STORAGE_KEY = 'hr-onboarding-tour-completed'

export default function OnboardingTour() {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Check if tour was already completed
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY)
    if (!completed) {
      // Show tour after a short delay
      const timer = setTimeout(() => setIsActive(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  // Position tooltip relative to target element
  useEffect(() => {
    if (!isActive) return

    const step = HR_TOUR_STEPS[currentStep]
    const target = document.querySelector(step.target)
    if (!target) return

    const rect = target.getBoundingClientRect()
    const pos = step.position || 'bottom'
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    let top = 0
    let left = 0

    switch (pos) {
      case 'bottom':
        top = rect.bottom + scrollY + 12
        left = rect.left + scrollX + rect.width / 2 - 160
        break
      case 'top':
        top = rect.top + scrollY - 12 - 140
        left = rect.left + scrollX + rect.width / 2 - 160
        break
      case 'right':
        top = rect.top + scrollY + rect.height / 2 - 60
        left = rect.right + scrollX + 12
        break
      case 'left':
        top = rect.top + scrollY + rect.height / 2 - 60
        left = rect.left + scrollX - 332
        break
    }

    // Keep within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - 340))
    top = Math.max(8, top)

    setTooltipPosition({ top, left })

    // Highlight target
    target.classList.add('ring-2', 'ring-[#FF6700]', 'ring-offset-2', 'ring-offset-[#111]', 'rounded-lg', 'relative', 'z-[51]')

    // Scroll target into view
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })

    return () => {
      target.classList.remove('ring-2', 'ring-[#FF6700]', 'ring-offset-2', 'ring-offset-[#111]', 'rounded-lg', 'relative', 'z-[51]')
    }
  }, [isActive, currentStep])

  const handleNext = useCallback(() => {
    if (currentStep < HR_TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }, [currentStep])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1)
  }, [currentStep])

  const handleComplete = useCallback(() => {
    setIsActive(false)
    localStorage.setItem(TOUR_STORAGE_KEY, 'true')
  }, [])

  const handleSkip = useCallback(() => {
    setIsActive(false)
    localStorage.setItem(TOUR_STORAGE_KEY, 'true')
  }, [])

  if (!isActive) return null

  const step = HR_TOUR_STEPS[currentStep]
  const isLast = currentStep === HR_TOUR_STEPS.length - 1

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[50]" onClick={handleSkip} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[52] w-[320px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl animate-fade-in"
        style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6700]" />
            <span className="text-[10px] text-gray-500 font-medium">
              Step {currentStep + 1} of {HR_TOUR_STEPS.length}
            </span>
          </div>
          <button onClick={handleSkip} className="text-gray-500 hover:text-gray-300" aria-label="Skip tour">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <h4 className="text-sm font-medium text-white">{step.title}</h4>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{step.description}</p>
        </div>

        {/* Progress + Actions */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {HR_TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === currentStep ? 'bg-[#FF6700]' : idx < currentStep ? 'bg-[#FF6700]/40' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button onClick={handlePrev} className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-white">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-0.5 px-3 py-1 bg-[#FF6700] text-white text-xs rounded-lg hover:bg-[#FF6700]/90"
            >
              {isLast ? 'Finish' : 'Next'} {!isLast && <ChevronRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export { HR_TOUR_STEPS, TOUR_STORAGE_KEY }
