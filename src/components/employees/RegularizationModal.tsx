'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Calendar, Clock, FileText, Upload, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { clientLogger } from '@/lib/utils/client-logger'
import { isValidTimeFormat, showToast } from '@/lib/utils/workspace-helpers'
import { FILE_LIMITS } from '@/lib/constants/theme'
import DOMPurify from 'dompurify'

const ALLOWED_FILE_TYPES = FILE_LIMITS.allowedDocTypes
const MAX_FILE_SIZE = FILE_LIMITS.maxFileSize
const MAX_FILE_COUNT = 5

interface RegularizationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type RequestType = 'missed_checkin' | 'missed_checkout' | 'incorrect_time' | 'full_day_absent'

export default function RegularizationModal({ isOpen, onClose, onSuccess }: RegularizationModalProps) {
  const [requestType, setRequestType] = useState<RequestType>('missed_checkin')
  const [date, setDate] = useState('')
  const [proposedCheckIn, setProposedCheckIn] = useState('')
  const [proposedCheckOut, setProposedCheckOut] = useState('')
  const [reason, setReason] = useState('')
  const [documents, setDocuments] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestTypeOptions = [
    { value: 'missed_checkin', label: 'Missed Check-In', description: 'Forgot to check in' },
    { value: 'missed_checkout', label: 'Missed Check-Out', description: 'Forgot to check out' },
    { value: 'incorrect_time', label: 'Incorrect Time', description: 'Wrong check-in/out time recorded' },
    { value: 'full_day_absent', label: 'Full Day Absent', description: 'Mark full day as present' }
  ]

  // Close on Escape key
  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen && !isSubmitting) onClose()
  }, [isOpen, isSubmitting, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [handleEscapeKey])

  // Reset form when modal closes (including isSubmitting to prevent stuck state)
  useEffect(() => {
    if (!isOpen) {
      setRequestType('missed_checkin')
      setDate('')
      setProposedCheckIn('')
      setProposedCheckOut('')
      setReason('')
      setDocuments([])
      setError(null)
      setIsSubmitting(false)
    }
  }, [isOpen])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)

      // Max file count validation
      if (files.length > MAX_FILE_COUNT) {
        setError(`Maximum ${MAX_FILE_COUNT} files allowed. You selected ${files.length}.`)
        e.target.value = ''
        return
      }

      // File type validation
      const invalidTypeFiles = files.filter(f => !ALLOWED_FILE_TYPES.includes(f.type))
      if (invalidTypeFiles.length > 0) {
        setError(`Invalid file type: "${invalidTypeFiles[0].name}". Allowed: PDF, JPG, PNG.`)
        e.target.value = ''
        return
      }

      // File size validation
      const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE)
      if (oversizedFiles.length > 0) {
        setError(`File "${oversizedFiles[0].name}" exceeds ${FILE_LIMITS.maxFileSizeLabel} limit.`)
        e.target.value = ''
        return
      }

      setDocuments(files)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!date || !reason.trim()) {
      setError('Please fill in all required fields')
      return
    }

    // Type-specific validation
    if (requestType === 'missed_checkin' && !proposedCheckIn) {
      setError('Please provide proposed check-in time')
      return
    }

    if (requestType === 'missed_checkout' && !proposedCheckOut) {
      setError('Please provide proposed check-out time')
      return
    }

    if (requestType === 'incorrect_time' && (!proposedCheckIn || !proposedCheckOut)) {
      setError('Please provide both check-in and check-out times')
      return
    }

    if (requestType === 'full_day_absent' && (!proposedCheckIn || !proposedCheckOut)) {
      setError('Please provide both check-in and check-out times')
      return
    }

    // Time format validation
    if (proposedCheckIn && !isValidTimeFormat(proposedCheckIn)) {
      setError('Invalid check-in time format. Please use HH:MM format.')
      return
    }

    if (proposedCheckOut && !isValidTimeFormat(proposedCheckOut)) {
      setError('Invalid check-out time format. Please use HH:MM format.')
      return
    }

    // Validate check-out is after check-in when both provided
    if (proposedCheckIn && proposedCheckOut && proposedCheckOut <= proposedCheckIn) {
      setError('Check-out time must be after check-in time.')
      return
    }

    // Date validation - cannot regularize future dates
    const selectedDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (selectedDate >= today) {
      setError('Cannot regularize for today or future dates')
      return
    }

    // Cannot regularize dates older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    if (selectedDate < thirtyDaysAgo) {
      setError('Cannot regularize dates older than 30 days')
      return
    }

    setIsSubmitting(true)

    try {
      // Upload documents to Supabase Storage
      let documentUrls: string[] = []
      if (documents.length > 0) {
        clientLogger.info('Uploading documents', { count: documents.length })

        for (const file of documents) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('documentType', 'regularization')
          formData.append('relatedId', date) // Associate with the date being regularized

          const uploadResponse = await fetch('/api/employees/documents/upload', {
            method: 'POST',
            body: formData
          })

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload document')
          }

          const uploadData = await uploadResponse.json()
          if (uploadData.success && uploadData.file.path) {
            documentUrls.push(uploadData.file.path)
          }
        }

        clientLogger.info('Documents uploaded successfully', { count: documentUrls.length })
      }

      // Sanitize reason with DOMPurify (matching leave requests pattern)
      const sanitizedReason = DOMPurify.sanitize(reason.trim(), { ALLOWED_TAGS: [] })

      // Combine date with times for timestamp with format validation
      let checkInTimestamp: string | null = null
      let checkOutTimestamp: string | null = null

      if (proposedCheckIn) {
        checkInTimestamp = `${date}T${proposedCheckIn}:00`
        // Validate the resulting timestamp is a valid date
        if (isNaN(new Date(checkInTimestamp).getTime())) {
          setError('Invalid check-in date-time combination.')
          setIsSubmitting(false)
          return
        }
      }

      if (proposedCheckOut) {
        checkOutTimestamp = `${date}T${proposedCheckOut}:00`
        if (isNaN(new Date(checkOutTimestamp).getTime())) {
          setError('Invalid check-out date-time combination.')
          setIsSubmitting(false)
          return
        }
      }

      // Submit regularization request
      const response = await fetch('/api/employees/attendance/regularization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date,
          request_type: requestType,
          proposed_check_in: checkInTimestamp,
          proposed_check_out: checkOutTimestamp,
          proposed_status: 'present',
          reason: sanitizedReason,
          supporting_documents: documentUrls
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Please wait before trying again.')
        }
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit regularization request' }))
        throw new Error(errorData.error || `Request failed (${response.status})`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      clientLogger.info('Regularization request submitted successfully')

      onSuccess()
      onClose()

    } catch (error) {
      clientLogger.error('Failed to submit regularization request', { error })
      setError(error instanceof Error ? error.message : 'Failed to submit regularization request')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="regularization-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 id="regularization-modal-title" className="text-2xl font-bold flex items-center gap-2 font-poppins">
            <Clock className="w-6 h-6 text-orange-500" />
            Attendance Regularization
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isSubmitting}
            aria-label="Close regularization modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Request Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Request Type <span className="text-red-400">*</span>
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequestType)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              required
              disabled={isSubmitting}
              aria-label="Select request type"
            >
              {requestTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">
              {requestTypeOptions.find(opt => opt.value === requestType)?.description}
            </p>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date(Date.now() - 86400000).toISOString().split('T')[0]}
              min={new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              required
              disabled={isSubmitting}
              aria-label="Select date to regularize"
            />
            <p className="text-xs text-gray-400 mt-1">
              You can regularize attendance for the last 30 days
            </p>
          </div>

          {/* Time Fields - Conditional based on request type */}
          <div className="grid grid-cols-2 gap-4">
            {(requestType === 'missed_checkin' || requestType === 'incorrect_time' || requestType === 'full_day_absent') && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Proposed Check-In Time <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  value={proposedCheckIn}
                  onChange={(e) => setProposedCheckIn(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                  required
                  disabled={isSubmitting}
                  aria-label="Proposed check-in time"
                />
              </div>
            )}

            {(requestType === 'missed_checkout' || requestType === 'incorrect_time' || requestType === 'full_day_absent') && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Proposed Check-Out Time <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  value={proposedCheckOut}
                  onChange={(e) => setProposedCheckOut(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                  required
                  disabled={isSubmitting}
                  aria-label="Proposed check-out time"
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Please provide a detailed reason for this regularization request..."
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 resize-none"
              required
              disabled={isSubmitting}
              aria-label="Reason for regularization request"
              aria-describedby="reg-reason-char-count"
            />
            <p id="reg-reason-char-count" className={`text-xs mt-1 ${reason.length >= 450 ? 'text-amber-400' : 'text-gray-400'}`}>
              {reason.length}/500 characters{reason.length >= 450 ? ' (approaching limit)' : ''}
            </p>
          </div>

          {/* Documents Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Supporting Documents (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="regularization-document-upload"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                disabled={isSubmitting}
              />
              <label
                htmlFor="regularization-document-upload"
                className="cursor-pointer text-orange-500 hover:text-orange-400 font-semibold"
              >
                Click to upload files
              </label>
              <p className="text-xs text-gray-400 mt-2">
                PDF, JPG, PNG, DOC (Max 5MB each)
              </p>
              {documents.length > 0 && (
                <div className="mt-4 space-y-2">
                  {documents.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
                      <FileText className="w-4 h-4" />
                      {file.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Information Box */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold text-orange-400 mb-1">Important Notes:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Your request will be sent to your reporting manager for approval</li>
                  <li>Provide accurate timings and valid reason for faster approval</li>
                  <li>Supporting documents will help in quick processing</li>
                  <li>You'll receive email notification once processed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
              disabled={isSubmitting}
              aria-label="Cancel regularization request"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSubmitting}
              aria-label="Submit regularization request"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
