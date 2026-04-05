'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X, Phone, Clock, FileText, Star,
  CalendarPlus, CheckCircle, AlertCircle, Loader2, Mic, Send
} from 'lucide-react'
import CallTranscriptionUploader from './CallTranscriptionUploader'
import InBrowserCallRecorder from './InBrowserCallRecorder'

interface PostCallModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CallLogSubmission) => Promise<void>
  customerName: string
  customerPhone: string
  contactType: 'contact' | 'positive_contact' | 'lead'
  entityId: string
  estimatedDuration: number // seconds
}

export interface CallLogSubmission {
  contact_type: 'contact' | 'positive_contact' | 'lead'
  entity_table_id: string
  customer_name: string
  customer_phone: string
  call_type: 'outbound' | 'inbound'
  call_duration_seconds: number
  call_outcome: string
  disposition_notes: string
  interest_level?: string
  next_followup_at?: string
  call_started_at?: string
}

const OUTCOMES = [
  { value: 'connected', label: 'Connected', color: 'bg-green-600', icon: '✓' },
  { value: 'interested', label: 'Interested', color: 'bg-emerald-600', icon: '★' },
  { value: 'callback_requested', label: 'Callback Requested', color: 'bg-blue-600', icon: '↩' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-orange-600', icon: '✕' },
  { value: 'busy', label: 'Busy', color: 'bg-yellow-600', icon: '◉' },
  { value: 'no_answer', label: 'No Answer', color: 'bg-gray-600', icon: '✗' },
  { value: 'switched_off', label: 'Switched Off', color: 'bg-red-700', icon: '⊘' },
  { value: 'wrong_number', label: 'Wrong Number', color: 'bg-red-600', icon: '!' },
]

const INTEREST_LEVELS = [
  { value: 'high', label: 'High', color: 'text-green-400 border-green-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400 border-yellow-500' },
  { value: 'low', label: 'Low', color: 'text-orange-400 border-orange-500' },
  { value: 'none', label: 'None', color: 'text-gray-400 border-gray-500' },
]

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function PostCallModal({
  isOpen,
  onClose,
  onSubmit,
  customerName,
  customerPhone,
  contactType,
  entityId,
  estimatedDuration,
}: PostCallModalProps) {
  const [outcome, setOutcome] = useState('')
  const [interestLevel, setInterestLevel] = useState('')
  const [duration, setDuration] = useState(estimatedDuration)
  const [nextFollowup, setNextFollowup] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedCallLogId, setSavedCallLogId] = useState<string | null>(null)
  const [showTranscriptUploader, setShowTranscriptUploader] = useState(false)
  const [autoSendSummary, setAutoSendSummary] = useState(true)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null)
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false)
  const [autoAnalysisStatus, setAutoAnalysisStatus] = useState<'idle' | 'transcribing' | 'analyzing' | 'done' | 'failed'>('idle')

  // Reset all state when modal opens
  useEffect(() => {
    if (isOpen) {
      setOutcome('')
      setInterestLevel('')
      setDuration(estimatedDuration)
      setNextFollowup('')
      setIsSubmitting(false)
      setError('')
      setSavedCallLogId(null)
      setShowTranscriptUploader(false)
      setAutoSendSummary(true)
      setSendStatus('idle')
      setRecordedAudio(null)
      setIsAutoAnalyzing(false)
      setAutoAnalysisStatus('idle')
    }
  }, [isOpen, estimatedDuration])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!outcome) {
      setError('Please select a call outcome')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      // Submit returns the call log data via the parent's onSubmit
      const response = await fetch('/api/cro/call-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_type: contactType,
          entity_table_id: entityId,
          customer_name: customerName,
          customer_phone: customerPhone,
          call_type: 'outbound',
          call_duration_seconds: duration,
          call_outcome: outcome,
          disposition_notes: '',
          interest_level: interestLevel || undefined,
          next_followup_at: nextFollowup ? new Date(nextFollowup).toISOString() : undefined,
        }),
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      const callLogId = result.data?.id || null
      setSavedCallLogId(callLogId)

      // Notify parent that call was logged (for refreshing data)
      await onSubmit({
        contact_type: contactType,
        entity_table_id: entityId,
        customer_name: customerName,
        customer_phone: customerPhone,
        call_type: 'outbound',
        call_duration_seconds: duration,
        call_outcome: outcome,
        disposition_notes: '',
        interest_level: interestLevel || undefined,
        next_followup_at: nextFollowup ? new Date(nextFollowup).toISOString() : undefined,
      }).catch(() => { /* Silently handled */ }) // Parent callback is non-critical

      // Auto-send summary to customer if enabled and outcome is interested/callback
      if (autoSendSummary && callLogId && ['interested', 'callback_requested'].includes(outcome)) {
        setSendStatus('sending')
        try {
          const autoResponse = await fetch('/api/cro/post-call-automation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callLogId,
              contactPhone: customerPhone,
              customerName,
              contactType,
              entityId,
              aiSummary: undefined,
              channels: 'both',
            }),
          })
          const autoResult = await autoResponse.json()
          setSendStatus(autoResult.success ? 'sent' : 'failed')
        } catch {
          setSendStatus('failed')
        }
      }

      // Show transcript uploader section
      setShowTranscriptUploader(true)

      // Auto-analyze recording if one was captured
      if (recordedAudio && callLogId) {
        setIsAutoAnalyzing(true)
        setAutoAnalysisStatus('transcribing')
        try {
          const formData = new FormData()
          formData.append('audio', recordedAudio, 'call-recording.webm')
          formData.append('callLogId', callLogId)
          if (entityId) formData.append('contactId', entityId)

          const transcribeRes = await fetch('/api/ai-crm/transcribe', {
            method: 'POST',
            body: formData,
          })
          const transcribeResult = await transcribeRes.json()

          if (transcribeResult.success) {
            setAutoAnalysisStatus('done')
          } else {
            setAutoAnalysisStatus('failed')
          }
        } catch {
          setAutoAnalysisStatus('failed')
        } finally {
          setIsAutoAnalyzing(false)
        }
      }
    } catch {
      setError('Failed to save call log. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const showInterestLevel = ['connected', 'interested', 'callback_requested'].includes(outcome)
  const showFollowup = ['interested', 'callback_requested', 'connected'].includes(outcome)
  const showAutoSend = ['interested', 'callback_requested'].includes(outcome)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Log Call</h2>
              <p className="text-gray-400 text-sm">{customerName} &middot; {customerPhone}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Duration */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Call Duration
            </label>
            <div className="flex items-center gap-3">
              <span className="text-white text-2xl font-mono">{formatDuration(duration)}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setDuration(Math.max(1, duration - 30))}
                  className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                  -30s
                </button>
                <button
                  onClick={() => setDuration(Math.min(3600, duration + 30))}
                  className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                  +30s
                </button>
                <button
                  onClick={() => setDuration(Math.min(3600, duration + 60))}
                  className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                  +1m
                </button>
              </div>
            </div>
          </div>

          {/* Call Outcome */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Call Outcome <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    outcome === o.value
                      ? `${o.color} text-white border-transparent ring-2 ring-white/20`
                      : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <span className="mr-1.5">{o.icon}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interest Level (conditional) */}
          {showInterestLevel && (
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Interest Level
              </label>
              <div className="flex gap-2 mt-2">
                {INTEREST_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setInterestLevel(level.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                      interestLevel === level.value
                        ? `${level.color} bg-white/5 border-current`
                        : 'text-gray-400 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Next Follow-up (conditional) */}
          {showFollowup && (
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4" />
                Schedule Next Follow-up
              </label>
              <input
                type="datetime-local"
                value={nextFollowup}
                onChange={(e) => setNextFollowup(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          {/* Call Recording */}
          <div>
            <label className="text-gray-300 text-sm font-medium mb-2 flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Call Recording
            </label>
            <div className="mt-1 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
              {recordedAudio ? (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Recording captured ({(recordedAudio.size / 1024).toFixed(0)} KB) - will auto-analyze after saving</span>
                </div>
              ) : (
                <InBrowserCallRecorder
                  onRecordingComplete={(blob) => setRecordedAudio(blob)}
                  showIndicator={true}
                />
              )}
              <p className="text-xs text-gray-500 mt-2">
                Use speakerphone or headset for best AI transcript quality. The recording auto-generates a conversation gist.
              </p>
            </div>
          </div>

          {/* Auto-send summary (conditional) */}
          {showAutoSend && !showTranscriptUploader && (
            <label className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer group">
              <input
                type="checkbox"
                checked={autoSendSummary}
                onChange={(e) => setAutoSendSummary(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
              />
              <div>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Auto-send summary to customer
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  SMS + WhatsApp with call summary and contact-back link
                </p>
              </div>
            </label>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions / Transcript Uploader */}
          {showTranscriptUploader && savedCallLogId ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 px-3 py-2 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                Call logged successfully!
              </div>

              {/* Post-call automation status */}
              {sendStatus === 'sending' && (
                <div className="flex items-center gap-2 text-orange-400 text-sm bg-orange-900/20 px-3 py-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending summary to customer...
                </div>
              )}
              {sendStatus === 'sent' && (
                <div className="flex items-center gap-2 text-blue-400 text-sm bg-blue-900/20 px-3 py-2 rounded-lg">
                  <Send className="w-4 h-4" />
                  Summary sent via SMS + WhatsApp
                </div>
              )}
              {sendStatus === 'failed' && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-900/20 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  Could not send summary (messaging service unavailable)
                </div>
              )}

              {/* Auto-analysis status */}
              {isAutoAnalyzing && (
                <div className="flex items-center gap-2 text-orange-400 text-sm bg-orange-900/20 px-3 py-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {autoAnalysisStatus === 'transcribing' ? 'Auto-transcribing & analyzing recording...' : 'Processing...'}
                </div>
              )}
              {autoAnalysisStatus === 'done' && (
                <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 px-3 py-2 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  AI conversation gist generated automatically
                </div>
              )}
              {autoAnalysisStatus === 'failed' && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center gap-2 mb-2 text-yellow-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Auto-analysis failed. You can manually upload or paste transcript below.
                  </div>
                  <CallTranscriptionUploader
                    callLogId={savedCallLogId}
                    contactId={entityId}
                    onAnalysisComplete={onClose}
                  />
                </div>
              )}
              {!recordedAudio && autoAnalysisStatus === 'idle' && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Mic className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-gray-300">Add AI Analysis (Optional)</span>
                  </div>
                  <CallTranscriptionUploader
                    callLogId={savedCallLogId}
                    contactId={entityId}
                    onAnalysisComplete={onClose}
                  />
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Call Log'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
