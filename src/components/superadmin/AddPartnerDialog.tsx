'use client'

import React, { useState } from 'react'
import { X, User, Mail, Phone, MapPin, Upload, CheckCircle, AlertCircle } from 'lucide-react'

interface AddPartnerDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddPartnerDialog({ isOpen, onClose, onSuccess }: AddPartnerDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ partner_id: string; full_name: string } | null>(null)

  // Form state
  const [partnerType, setPartnerType] = useState('')
  const [fullName, setFullName] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [presentAddress, setPresentAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [addressProofUrl, setAddressProofUrl] = useState('')
  const [addressProofType, setAddressProofType] = useState('')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!isOpen) return null

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!partnerType) newErrors.partnerType = 'Partner type is required'
    if (!fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!workEmail.trim()) {
      newErrors.workEmail = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
      newErrors.workEmail = 'Invalid email format'
    }
    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required'
    } else if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      newErrors.mobileNumber = 'Invalid mobile number (must be 10 digits starting with 6-9)'
    }
    if (!presentAddress.trim()) newErrors.presentAddress = 'Address is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/superadmin/partner-management/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          partner_type: partnerType,
          full_name: fullName,
          work_email: workEmail,
          personal_email: personalEmail || null,
          mobile_number: mobileNumber,
          present_address: presentAddress,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          address_proof_url: addressProofUrl || null,
          address_proof_type: addressProofType || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create partner')
      }

      setSuccess({
        partner_id: result.data.partner_id,
        full_name: result.data.full_name,
      })

      // Reset form after 3 seconds and close
      setTimeout(() => {
        handleClose()
        onSuccess()
      }, 3000)
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to create partner')
      console.error('Add partner error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return

    // Reset form
    setPartnerType('')
    setFullName('')
    setWorkEmail('')
    setPersonalEmail('')
    setMobileNumber('')
    setPresentAddress('')
    setCity('')
    setState('')
    setPincode('')
    setAddressProofUrl('')
    setAddressProofType('')
    setErrors({})
    setError(null)
    setSuccess(null)

    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-2xl font-bold font-poppins">Add New Partner</h2>
            <p className="text-gray-400 text-sm mt-1">Create a new partner account manually</p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success State */}
        {success && (
          <div className="p-6">
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 font-poppins">Partner Created Successfully!</h3>
              <p className="text-gray-300 mb-4">
                <span className="font-semibold">{success.full_name}</span> has been added as a partner.
              </p>
              <div className="bg-black/30 rounded-lg p-4 inline-block">
                <p className="text-gray-400 text-sm mb-1">Partner ID</p>
                <p className="text-orange-400 text-3xl font-bold">{success.partner_id}</p>
              </div>
              <p className="text-gray-500 text-sm mt-4">Closing automatically...</p>
            </div>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-6">
            {/* Error Alert */}
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-semibold">Error</p>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Partner Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Partner Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={partnerType}
                  onChange={(e) => setPartnerType(e.target.value)}
                  className={`w-full bg-black/50 border ${errors.partnerType ? 'border-red-500' : 'border-white/20'} rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none`}
                  disabled={loading}
                >
                  <option value="">Select partner type</option>
                  <option value="BUSINESS_ASSOCIATE">Business Associate (BA)</option>
                  <option value="BUSINESS_PARTNER">Business Partner (BP)</option>
                  <option value="CHANNEL_PARTNER">Channel Partner (CP)</option>
                </select>
                {errors.partnerType && (
                  <p className="text-red-400 text-sm mt-1">{errors.partnerType}</p>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className={`w-full bg-black/50 border ${errors.fullName ? 'border-red-500' : 'border-white/20'} rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none`}
                    disabled={loading}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-red-400 text-sm mt-1">{errors.fullName}</p>
                )}
              </div>

              {/* Email Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Work Email <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="work@example.com"
                      className={`w-full bg-black/50 border ${errors.workEmail ? 'border-red-500' : 'border-white/20'} rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none`}
                      disabled={loading}
                    />
                  </div>
                  {errors.workEmail && (
                    <p className="text-red-400 text-sm mt-1">{errors.workEmail}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Personal Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      placeholder="personal@example.com"
                      className="w-full bg-black/50 border border-white/20 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mobile Number <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className={`w-full bg-black/50 border ${errors.mobileNumber ? 'border-red-500' : 'border-white/20'} rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none`}
                    disabled={loading}
                  />
                </div>
                {errors.mobileNumber && (
                  <p className="text-red-400 text-sm mt-1">{errors.mobileNumber}</p>
                )}
              </div>

              {/* Present Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Present Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                  <textarea
                    value={presentAddress}
                    onChange={(e) => setPresentAddress(e.target.value)}
                    placeholder="Enter complete address"
                    rows={3}
                    className={`w-full bg-black/50 border ${errors.presentAddress ? 'border-red-500' : 'border-white/20'} rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none resize-none`}
                    disabled={loading}
                  />
                </div>
                {errors.presentAddress && (
                  <p className="text-red-400 text-sm mt-1">{errors.presentAddress}</p>
                )}
              </div>

              {/* City, State, Pincode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Pincode</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="560001"
                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Address Proof */}
              <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Address Proof (Optional)
                </label>
                <div className="space-y-3">
                  <select
                    value={addressProofType}
                    onChange={(e) => setAddressProofType(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    disabled={loading}
                  >
                    <option value="">Select proof type</option>
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>

                  <div className="flex items-center gap-3">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={addressProofUrl}
                      onChange={(e) => setAddressProofUrl(e.target.value)}
                      placeholder="Enter document URL (or upload feature to be added)"
                      className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-gray-500 text-xs">Note: File upload functionality can be added later with Supabase Storage</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  'Create Partner'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
