'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { X, Calendar, FileText, Upload, AlertCircle } from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'
import { validateFiles } from '@/lib/utils/workspace-helpers'
import { FILE_LIMITS } from '@/lib/constants/theme'

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
const MAX_FILE_COUNT = 5

interface LeaveType {
  id: string
  name: string
  description: string
  max_days_per_year: number
  requires_documentation: boolean
  color: string
}

interface HolidayInfo {
  id: string
  name: string
  date: string
  type: string
  is_mandatory: boolean
}

interface LeaveRequestModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  holidays?: HolidayInfo[]
}

export default function LeaveRequestModal({ isOpen, onClose, onSuccess, holidays = [] }: LeaveRequestModalProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [documents, setDocuments] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalDays, setTotalDays] = useState(0)

  // Close on Escape key
  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen && !isSubmitting) onClose()
  }, [isOpen, isSubmitting, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [handleEscapeKey])

  useEffect(() => {
    if (isOpen) {
      loadLeaveTypes()
    }
  }, [isOpen])

  // Calculate working days (excluding weekends AND mandatory holidays) to match server-side calculation
  useEffect(() => {
    if (fromDate && toDate) {
      const from = new Date(fromDate)
      const to = new Date(toDate)

      if (to < from) {
        setTotalDays(0)
        return
      }

      // Build set of mandatory holiday dates for quick lookup
      const mandatoryHolidayDates = new Set(
        holidays
          .filter(h => h.is_mandatory)
          .map(h => h.date)
      )

      // Count working days (Mon-Fri only, excluding mandatory holidays) - matches server
      let count = 0
      const current = new Date(from)
      while (current <= to) {
        const dayOfWeek = current.getDay()
        const dateStr = current.toISOString().split('T')[0]
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !mandatoryHolidayDates.has(dateStr)) {
          count++
        }
        current.setDate(current.getDate() + 1)
      }
      setTotalDays(count)
    } else {
      setTotalDays(0)
    }
  }, [fromDate, toDate, holidays])

  const loadLeaveTypes = async () => {
    try {
      const response = await fetch('/api/employees/leaves/types')

      if (!response.ok) {
        clientLogger.error('Failed to load leave types', { status: response.status })
        toast.error('Failed to load leave types')
        return
      }

      const result = await response.json()

      if (result.success) {
        setLeaveTypes(result.data)
      } else {
        toast.error(result.error || 'Failed to load leave types')
      }
    } catch (error) {
      clientLogger.error('Failed to load leave types', { error })
      toast.error('Failed to load leave types. Please try again.')
    }
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)

      // Max file count validation
      if (files.length > MAX_FILE_COUNT) {
        setError(`Maximum ${MAX_FILE_COUNT} files allowed. You selected ${files.length}.`)
        e.target.value = ''
        return
      }

      // File type validation (JavaScript-level, not just HTML accept)
      const invalidTypeFiles = files.filter(f => !ALLOWED_FILE_TYPES.includes(f.type))
      if (invalidTypeFiles.length > 0) {
        setError(`Invalid file type: "${invalidTypeFiles[0].name}". Allowed: PDF, JPG, PNG, DOC, DOCX.`)
        e.target.value = ''
        return
      }

      // File size validation
      const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE)
      if (oversizedFiles.length > 0) {
        setError(`File "${oversizedFiles[0].name}" exceeds 5MB limit. Please choose a smaller file.`)
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
    if (!selectedType || !fromDate || !toDate || !reason.trim()) {
      setError('Please fill in all required fields')
      return
    }

    if (new Date(toDate) < new Date(fromDate)) {
      setError('End date must be after start date')
      return
    }

    const selectedLeaveType = leaveTypes.find(lt => lt.id === selectedType)
    if (selectedLeaveType?.requires_documentation && documents.length === 0) {
      setError(`${selectedLeaveType.name} requires supporting documents`)
      return
    }

    setIsSubmitting(true)

    try {
      // Step 1: Create leave request FIRST (without documents)
      const response = await fetch('/api/employees/leaves/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leave_type_id: selectedType,
          from_date: fromDate,
          to_date: toDate,
          reason: reason.trim(),
          documents: null
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Please wait before trying again.')
        }
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit leave request' }))
        throw new Error(errorData.error || `Request failed (${response.status})`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      const leaveRequestId = result.data?.id

      // Step 2: Upload documents AFTER leave request is created (prevents orphans)
      if (documents.length > 0 && leaveRequestId) {
        clientLogger.info('Uploading documents', { count: documents.length })
        const documentUrls: string[] = []
        const failedFiles: string[] = []

        for (const file of documents) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('documentType', 'leave_request')
          formData.append('relatedId', leaveRequestId)

          try {
            const uploadResponse = await fetch('/api/employees/documents/upload', {
              method: 'POST',
              body: formData
            })

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json()
              if (uploadData.success && uploadData.file.path) {
                documentUrls.push(uploadData.file.path)
              }
            } else {
              failedFiles.push(file.name)
              clientLogger.error('Failed to upload document', { fileName: file.name })
            }
          } catch (uploadErr) {
            failedFiles.push(file.name)
            clientLogger.error('Document upload error', { fileName: file.name, error: uploadErr })
          }
        }

        // Update leave request with document URLs (best-effort)
        if (documentUrls.length > 0) {
          await fetch('/api/employees/leaves/requests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              request_id: leaveRequestId,
              documents: documentUrls
            })
          }).catch(err => clientLogger.error('Failed to attach documents to leave request', { err }))

          clientLogger.info('Documents uploaded successfully', { count: documentUrls.length })
        }

        if (failedFiles.length > 0) {
          toast.error(
            `Failed to upload ${failedFiles.length} file(s): ${failedFiles.join(', ')}. You can retry from the leave details.`,
            { duration: 8000 }
          )
        }
      }

      // Show balance confirmation
      if (result.data?.total_days) {
        toast.success(
          `Leave request submitted. ${result.data.total_days} day(s) reserved pending approval.`,
          { duration: 5000 }
        )
      }

      clientLogger.info('Leave request submitted successfully')

      // Reset form
      setSelectedType('')
      setFromDate('')
      setToDate('')
      setReason('')
      setDocuments([])

      onSuccess()
      onClose()

    } catch (error) {
      clientLogger.error('Failed to submit leave request', { error })
      setError(error instanceof Error ? error.message : 'Failed to submit leave request')
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
      aria-labelledby="leave-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 id="leave-modal-title" className="text-2xl font-bold flex items-center gap-2 font-poppins">
            <Calendar className="w-6 h-6 text-orange-500" />
            Request Leave
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isSubmitting}
            aria-label="Close leave request modal"
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

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Leave Type <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              required
              disabled={isSubmitting}
              aria-label="Select leave type"
            >
              <option value="">Select leave type</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.max_days_per_year} days/year)
                </option>
              ))}
            </select>
            {selectedType && (
              <p className="text-xs text-gray-400 mt-2">
                {leaveTypes.find(lt => lt.id === selectedType)?.description}
              </p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                From Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                required
                disabled={isSubmitting}
                aria-label="Leave start date"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                To Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate || new Date().toISOString().split('T')[0]}
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                required
                disabled={isSubmitting}
                aria-label="Leave end date"
              />
            </div>
          </div>

          {/* Total Working Days Display */}
          {totalDays > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-400 font-semibold">
                Working Days: {totalDays} {totalDays === 1 ? 'day' : 'days'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Excludes weekends and public holidays
              </p>
            </div>
          )}

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
              placeholder="Please provide a reason for your leave request..."
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 resize-none"
              required
              disabled={isSubmitting}
              aria-label="Reason for leave request"
              aria-describedby="reason-char-count"
            />
            <p id="reason-char-count" className={`text-xs mt-1 ${reason.length >= 450 ? 'text-amber-400' : 'text-gray-400'}`}>
              {reason.length}/500 characters{reason.length >= 450 ? ' (approaching limit)' : ''}
            </p>
          </div>

          {/* Documents Upload */}
          {selectedType && leaveTypes.find(lt => lt.id === selectedType)?.requires_documentation && (
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Supporting Documents <span className="text-red-400">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="document-upload"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="document-upload"
                  className="cursor-pointer text-orange-500 hover:text-orange-400 font-semibold"
                >
                  Click to upload files
                </label>
                <p className="text-xs text-gray-400 mt-2">
                  PDF, JPG, PNG, DOC, DOCX (Max 5MB each, max {MAX_FILE_COUNT} files)
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
          )}

          {/* Information Box */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold text-orange-400 mb-1">Important Notes:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Your request will be sent to your reporting manager for approval</li>
                  <li>Leave balance will be reserved until approved or rejected</li>
                  <li>You'll receive email notification once processed</li>
                  <li>You can cancel pending requests from the Leave Management tab</li>
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
              aria-label="Cancel leave request"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSubmitting}
              aria-label="Submit leave request"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
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
