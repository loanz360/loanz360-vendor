'use client'

import React, { useState } from 'react'
import {
  Users, Plus, Trash2, Phone, Mail, User, CheckCircle, Clock,
  AlertCircle, Loader2, Shield, Send, RefreshCw, X
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'
import { toast } from 'sonner'

interface CoApplicant {
  id?: string
  full_name: string
  mobile_number: string
  email?: string
  relationship?: string
  pan_number?: string
  applicant_type: 'CO_APPLICANT' | 'GUARANTOR'
  consent_status: 'NOT_SENT' | 'PENDING' | 'GRANTED' | 'REJECTED' | 'EXPIRED'
  consent_request_id?: string
}

interface CoApplicantConsentSectionProps {
  coApplicants: CoApplicant[]
  onCoApplicantsChange: (coApplicants: CoApplicant[]) => void
  entityId?: string
  loanApplicationId?: string
  requiresCoApplicant?: boolean
}

const RELATIONSHIP_OPTIONS = [
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Business Partner',
  'Friend',
  'Colleague',
  'Other'
]

export default function CoApplicantConsentSection({
  coApplicants,
  onCoApplicantsChange,
  entityId,
  loanApplicationId,
  requiresCoApplicant = false
}: CoApplicantConsentSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [otpValues, setOtpValues] = useState<Record<string, string>>({})

  // Form state for new co-applicant
  const [newCoApplicant, setNewCoApplicant] = useState<CoApplicant>({
    full_name: '',
    mobile_number: '',
    email: '',
    relationship: '',
    pan_number: '',
    applicant_type: 'CO_APPLICANT',
    consent_status: 'NOT_SENT'
  })

  const handleAddCoApplicant = () => {
    if (!newCoApplicant.full_name || !newCoApplicant.mobile_number) {
      toast.error('Name and mobile number are required')
      return
    }

    // Validate mobile number
    if (!/^[6-9]\d{9}$/.test(newCoApplicant.mobile_number)) {
      toast.error('Please enter a valid 10-digit Indian mobile number')
      return
    }

    // Check for duplicate
    if (coApplicants.some(c => c.mobile_number === newCoApplicant.mobile_number)) {
      toast.error('A co-applicant with this mobile number already exists')
      return
    }

    onCoApplicantsChange([...coApplicants, { ...newCoApplicant, id: `temp_${Date.now()}` }])
    setNewCoApplicant({
      full_name: '',
      mobile_number: '',
      email: '',
      relationship: '',
      pan_number: '',
      applicant_type: 'CO_APPLICANT',
      consent_status: 'NOT_SENT'
    })
    setShowAddForm(false)
    toast.success('Co-applicant added')
  }

  const handleRemoveCoApplicant = (index: number) => {
    const updated = coApplicants.filter((_, i) => i !== index)
    onCoApplicantsChange(updated)
  }

  const handleSendConsent = async (index: number) => {
    const coApplicant = coApplicants[index]
    setSending(coApplicant.id || index.toString())

    try {
      const response = await fetch('/api/customers/loan-consent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_application_id: loanApplicationId,
          entity_id: entityId,
          applicant_type: coApplicant.applicant_type,
          mobile_number: coApplicant.mobile_number,
          email: coApplicant.email,
          full_name: coApplicant.full_name,
          relationship: coApplicant.relationship,
          pan_number: coApplicant.pan_number
        })
      })

      const data = await response.json()

      if (data.success) {
        const updated = [...coApplicants]
        updated[index] = {
          ...updated[index],
          consent_status: 'PENDING',
          consent_request_id: data.consentRequestId
        }
        onCoApplicantsChange(updated)
        toast.success(`OTP sent to ${coApplicant.mobile_number}`)

        // For development, show the OTP
        if (data._devOTP) {
          console.log(`[DEV] OTP for ${coApplicant.mobile_number}: ${data._devOTP}`)
        }
      } else {
        toast.error(data.error || 'Failed to send consent request')
      }
    } catch (error) {
      clientLogger.error('Error sending consent', { error })
      toast.error('Failed to send consent request')
    } finally {
      setSending(null)
    }
  }

  const handleResendOTP = async (index: number) => {
    const coApplicant = coApplicants[index]
    if (!coApplicant.consent_request_id) return

    setSending(coApplicant.id || index.toString())

    try {
      const response = await fetch('/api/customers/loan-consent/resend', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent_request_id: coApplicant.consent_request_id
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('OTP resent successfully')

        // For development, show the OTP
        if (data._devOTP) {
          console.log(`[DEV] New OTP for ${coApplicant.mobile_number}: ${data._devOTP}`)
        }
      } else {
        toast.error(data.error || 'Failed to resend OTP')
      }
    } catch (error) {
      clientLogger.error('Error resending OTP', { error })
      toast.error('Failed to resend OTP')
    } finally {
      setSending(null)
    }
  }

  const handleVerifyOTP = async (index: number) => {
    const coApplicant = coApplicants[index]
    const otp = otpValues[coApplicant.id || index.toString()]

    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    if (!coApplicant.consent_request_id) {
      toast.error('No consent request found')
      return
    }

    setVerifying(coApplicant.id || index.toString())

    try {
      const response = await fetch('/api/customers/loan-consent/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent_request_id: coApplicant.consent_request_id,
          otp,
          action: 'GRANT'
        })
      })

      const data = await response.json()

      if (data.success) {
        const updated = [...coApplicants]
        updated[index] = {
          ...updated[index],
          consent_status: 'GRANTED'
        }
        onCoApplicantsChange(updated)
        setOtpValues(prev => ({ ...prev, [coApplicant.id || index.toString()]: '' }))
        toast.success('Consent verified successfully')
      } else {
        toast.error(data.error || 'Failed to verify OTP')
      }
    } catch (error) {
      clientLogger.error('Error verifying OTP', { error })
      toast.error('Failed to verify OTP')
    } finally {
      setVerifying(null)
    }
  }

  const getStatusBadge = (status: CoApplicant['consent_status']) => {
    switch (status) {
      case 'GRANTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            Consent Granted
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
            <Clock className="w-3 h-3" />
            Awaiting Response
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
            <X className="w-3 h-3" />
            Rejected
          </span>
        )
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">
            <AlertCircle className="w-3 h-3" />
            Expired
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">
            <AlertCircle className="w-3 h-3" />
            Not Sent
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Co-applicants & Guarantors
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Add co-applicants or guarantors for this loan application
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {requiresCoApplicant && coApplicants.filter(c => c.consent_status === 'GRANTED').length === 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Co-applicant Required</p>
            <p className="text-yellow-300/70 text-sm mt-1">
              This loan type requires at least one co-applicant with verified consent.
            </p>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <h4 className="text-white font-medium mb-4">Add Co-applicant / Guarantor</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Type <span className="text-red-400">*</span>
              </label>
              <select
                value={newCoApplicant.applicant_type}
                onChange={(e) => setNewCoApplicant({ ...newCoApplicant, applicant_type: e.target.value as 'CO_APPLICANT' | 'GUARANTOR' })}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="CO_APPLICANT">Co-applicant</option>
                <option value="GUARANTOR">Guarantor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Relationship
              </label>
              <select
                value={newCoApplicant.relationship}
                onChange={(e) => setNewCoApplicant({ ...newCoApplicant, relationship: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="">Select</option>
                {RELATIONSHIP_OPTIONS.map(rel => (
                  <option key={rel} value={rel}>{rel}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newCoApplicant.full_name}
                onChange={(e) => setNewCoApplicant({ ...newCoApplicant, full_name: e.target.value })}
                placeholder="Enter full name"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mobile Number <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={newCoApplicant.mobile_number}
                onChange={(e) => setNewCoApplicant({ ...newCoApplicant, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="10-digit mobile"
                maxLength={10}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email (Optional)
              </label>
              <input
                type="email"
                value={newCoApplicant.email}
                onChange={(e) => setNewCoApplicant({ ...newCoApplicant, email: e.target.value })}
                placeholder="email@example.com"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                PAN Number (Optional)
              </label>
              <input
                type="text"
                value={newCoApplicant.pan_number}
                onChange={(e) => setNewCoApplicant({ ...newCoApplicant, pan_number: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none uppercase"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewCoApplicant({
                  full_name: '',
                  mobile_number: '',
                  email: '',
                  relationship: '',
                  pan_number: '',
                  applicant_type: 'CO_APPLICANT',
                  consent_status: 'NOT_SENT'
                })
              }}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCoApplicant}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      )}

      {/* Co-applicants List */}
      {coApplicants.length > 0 && (
        <div className="space-y-3">
          {coApplicants.map((coApplicant, index) => (
            <div
              key={coApplicant.id || index}
              className={`p-4 rounded-xl border transition-all ${
                coApplicant.consent_status === 'GRANTED'
                  ? 'bg-green-500/5 border-green-500/30'
                  : coApplicant.consent_status === 'PENDING'
                    ? 'bg-yellow-500/5 border-yellow-500/30'
                    : 'bg-gray-800/50 border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    coApplicant.applicant_type === 'GUARANTOR'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {coApplicant.applicant_type === 'GUARANTOR' ? (
                      <Shield className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{coApplicant.full_name}</h4>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        coApplicant.applicant_type === 'GUARANTOR'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {coApplicant.applicant_type === 'GUARANTOR' ? 'Guarantor' : 'Co-applicant'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {coApplicant.mobile_number}
                      </span>
                      {coApplicant.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {coApplicant.email}
                        </span>
                      )}
                      {coApplicant.relationship && (
                        <span>({coApplicant.relationship})</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(coApplicant.consent_status)}
                  {coApplicant.consent_status === 'NOT_SENT' && (
                    <button
                      onClick={() => handleRemoveCoApplicant(index)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Actions based on status */}
              {coApplicant.consent_status === 'NOT_SENT' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handleSendConsent(index)}
                    disabled={sending === (coApplicant.id || index.toString())}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sending === (coApplicant.id || index.toString()) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send Consent Request
                  </button>
                </div>
              )}

              {coApplicant.consent_status === 'PENDING' && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-700">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={otpValues[coApplicant.id || index.toString()] || ''}
                      onChange={(e) => setOtpValues(prev => ({
                        ...prev,
                        [coApplicant.id || index.toString()]: e.target.value.replace(/\D/g, '').slice(0, 6)
                      }))}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none text-center tracking-widest font-mono"
                    />
                  </div>
                  <button
                    onClick={() => handleVerifyOTP(index)}
                    disabled={verifying === (coApplicant.id || index.toString())}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {verifying === (coApplicant.id || index.toString()) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Verify
                  </button>
                  <button
                    onClick={() => handleResendOTP(index)}
                    disabled={sending === (coApplicant.id || index.toString())}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sending === (coApplicant.id || index.toString()) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Resend
                  </button>
                </div>
              )}

              {coApplicant.consent_status === 'EXPIRED' && (
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-700">
                  <button
                    onClick={() => handleSendConsent(index)}
                    disabled={sending === (coApplicant.id || index.toString())}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sending === (coApplicant.id || index.toString()) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Send New Request
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {coApplicants.length === 0 && !showAddForm && (
        <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-xl">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <h4 className="text-white font-medium mb-1">No Co-applicants Added</h4>
          <p className="text-sm text-gray-400 mb-4">
            Add co-applicants or guarantors to strengthen your loan application
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Co-applicant
          </button>
        </div>
      )}
    </div>
  )
}
