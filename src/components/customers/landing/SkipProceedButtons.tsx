'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Clock } from 'lucide-react'

interface SkipProceedButtonsProps {
  onSkip: () => void
  onProceed: () => void
  proceedText?: string
  skipText?: string
  isLoading?: boolean
  estimatedTime?: string
}

export default function SkipProceedButtons({
  onSkip,
  onProceed,
  proceedText = 'Complete My Profile',
  skipText = 'Skip for Now',
  isLoading = false,
  estimatedTime = '2 minutes'
}: SkipProceedButtonsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className="mt-8 pt-6 border-t border-gray-800"
    >
      {/* Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {/* Skip Button */}
        <button
          onClick={onSkip}
          disabled={isLoading}
          className="
            w-full sm:w-auto px-6 py-3 rounded-xl
            text-gray-400 hover:text-white
            border border-gray-700 hover:border-gray-600
            bg-transparent hover:bg-gray-800/50
            transition-all duration-200
            text-sm font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {skipText}
        </button>

        {/* Proceed Button */}
        <button
          onClick={onProceed}
          disabled={isLoading}
          className="
            w-full sm:w-auto px-8 py-3.5 rounded-xl
            text-white font-semibold
            bg-gradient-to-r from-orange-500 to-orange-600
            hover:from-orange-600 hover:to-orange-700
            shadow-lg shadow-orange-500/25
            hover:shadow-orange-500/40
            transition-all duration-200
            flex items-center justify-center gap-2
            disabled:opacity-50 disabled:cursor-not-allowed
            group
          "
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <span>{proceedText}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>

      {/* Time Estimate */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 1 }}
        className="flex items-center justify-center gap-2 mt-4 text-gray-500"
      >
        <Clock className="w-4 h-4" />
        <span className="text-xs">
          Takes only {estimatedTime} • Your progress is auto-saved
        </span>
      </motion.div>
    </motion.div>
  )
}
