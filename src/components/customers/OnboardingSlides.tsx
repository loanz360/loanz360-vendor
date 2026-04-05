'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Landmark,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Users,
  Building2,
  FileText,
  CreditCard,
  PieChart,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Crown
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface OnboardingSlidesProps {
  isOpen: boolean
  onClose: () => void
}

interface Slide {
  title: string
  description: string
  icon1: LucideIcon
  icon2: LucideIcon
  gradient: string
  iconColor1: string
  iconColor2: string
}

const slides: Slide[] = [
  {
    title: 'Welcome to LOANZ 360',
    description: 'Your complete loan management platform. Track loans, manage documents, and get the best rates — all in one place.',
    icon1: Landmark,
    icon2: Sparkles,
    gradient: 'from-orange-500/20 to-amber-500/20',
    iconColor1: 'text-orange-400',
    iconColor2: 'text-amber-400',
  },
  {
    title: 'Complete Your Profile',
    description: 'Set up your KYC with PAN & Aadhaar verification. A complete profile unlocks all platform features and loan applications.',
    icon1: ShieldCheck,
    icon2: UserCheck,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconColor1: 'text-blue-400',
    iconColor2: 'text-cyan-400',
  },
  {
    title: 'Add Your Profiles',
    description: 'Create individual or business profiles to apply for different loan types. Switch between profiles anytime from the sidebar.',
    icon1: Users,
    icon2: Building2,
    gradient: 'from-purple-500/20 to-pink-500/20',
    iconColor1: 'text-purple-400',
    iconColor2: 'text-pink-400',
  },
  {
    title: 'Apply for Loans',
    description: 'Browse loan products, submit applications, upload documents, and track approval status in real-time.',
    icon1: FileText,
    icon2: CreditCard,
    gradient: 'from-green-500/20 to-emerald-500/20',
    iconColor1: 'text-green-400',
    iconColor2: 'text-emerald-400',
  },
  {
    title: 'Track & Manage',
    description: 'Monitor EMIs, view credit scores, manage documents, and get AI-powered financial insights from your dashboard.',
    icon1: PieChart,
    icon2: TrendingUp,
    gradient: 'from-rose-500/20 to-orange-500/20',
    iconColor1: 'text-rose-400',
    iconColor2: 'text-orange-400',
  },
]

export default function OnboardingSlides({ isOpen, onClose }: OnboardingSlidesProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const handleSkip = useCallback(() => {
    onClose()
  }, [onClose])

  const handlePrevious = useCallback(() => {
    setCurrentSlide(prev => Math.max(0, prev - 1))
  }, [])

  const handleNext = useCallback(() => {
    if (currentSlide === slides.length - 1) {
      onClose()
    } else {
      setCurrentSlide(prev => prev + 1)
    }
  }, [currentSlide, onClose])

  if (!isOpen) return null

  const slide = slides[currentSlide]
  const Icon1 = slide.icon1
  const Icon2 = slide.icon2
  const isLastSlide = currentSlide === slides.length - 1
  const isFirstSlide = currentSlide === 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg mx-4 bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        {/* Skip Intro */}
        <div className="flex justify-end px-6 pt-4">
          <button
            onClick={handleSkip}
            className="text-sm text-orange-400 hover:text-orange-300 transition-colors font-medium"
          >
            Skip Intro
          </button>
        </div>

        {/* Slide Content */}
        <div className="px-8 pb-2">
          {/* Section Title */}
          <p className="text-center text-sm font-semibold text-gray-400 mb-6 tracking-wide">
            What&apos;s New In LOANZ 360
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center"
            >
              {/* Icon Illustration */}
              <div className={`relative w-40 h-40 rounded-full bg-gradient-to-br ${slide.gradient} flex items-center justify-center mb-8`}>
                {/* Decorative ring */}
                <div className="absolute inset-2 rounded-full border border-gray-700/50" />
                {/* Icons */}
                <div className="flex items-center gap-4">
                  <Icon1 className={`w-12 h-12 ${slide.iconColor1}`} strokeWidth={1.5} />
                  <Icon2 className={`w-10 h-10 ${slide.iconColor2}`} strokeWidth={1.5} />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-white text-center mb-3 font-poppins">
                {slide.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-gray-400 text-center leading-relaxed max-w-sm mb-6">
                {slide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot Indicators */}
        <div className="flex items-center justify-center gap-2 pb-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'w-6 h-2 bg-orange-500'
                  : 'w-2 h-2 bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 px-6 py-4 flex items-center justify-between">
          {/* Badge */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Crown className="w-3.5 h-3.5 text-orange-500" />
            <span>All features included</span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {!isFirstSlide && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-5 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1"
            >
              {isLastSlide ? 'Get Started' : 'Next'}
              {!isLastSlide && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
