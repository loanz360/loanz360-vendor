'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OtherProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (customProfileName: string) => void
  categoryName: string
}

export default function OtherProfileModal({
  isOpen,
  onClose,
  onSubmit,
  categoryName
}: OtherProfileModalProps) {
  const [profileName, setProfileName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
    // Reset state when modal opens
    if (isOpen) {
      setProfileName('')
      setError('')
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate input
    const trimmedName = profileName.trim()
    if (!trimmedName) {
      setError('Please enter a profile name')
      return
    }

    if (trimmedName.length < 3) {
      setError('Profile name must be at least 3 characters')
      return
    }

    if (trimmedName.length > 100) {
      setError('Profile name must be less than 100 characters')
      return
    }

    // Only allow alphanumeric, spaces, hyphens, and common punctuation
    const validNameRegex = /^[a-zA-Z0-9\s\-\.\,\'\/\(\)]+$/
    if (!validNameRegex.test(trimmedName)) {
      setError('Profile name contains invalid characters')
      return
    }

    onSubmit(trimmedName)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileName(e.target.value)
    if (error) setError('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Enter Profile Name</h2>
            <p className="text-sm text-gray-400 mt-1">
              Specify your profile under {categoryName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label htmlFor="profile-name" className="block text-sm font-medium text-gray-300 mb-2">
              Profile Name <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              id="profile-name"
              type="text"
              value={profileName}
              onChange={handleInputChange}
              placeholder="e.g., Astrologer, Dance Instructor, etc."
              className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                error
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-700 focus:border-orange-500'
              }`}
              maxLength={100}
              autoComplete="off"
            />
            {error && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Enter the specific profile name that best describes your occupation or business
            </p>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-5">
            <p className="text-sm text-orange-300">
              <strong>Note:</strong> This custom profile name will be stored and used throughout your application process.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 py-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-6"
              disabled={!profileName.trim()}
            >
              <Check className="w-5 h-5 mr-2" />
              Confirm
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
