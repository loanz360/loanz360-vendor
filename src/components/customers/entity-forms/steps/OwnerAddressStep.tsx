'use client'

import React, { useCallback } from 'react'
import {
  User,
  Calendar,
  Users,
  CreditCard,
  Fingerprint,
  Phone,
  Mail,
  MapPin,
  Home,
  Building2,
  Upload,
  CheckCircle,
  X,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { useS3Upload } from '@/hooks/useS3Upload'
import type { SoleProprietorshipStepProps, SoleProprietorshipData } from '../types'
import {
  GENDER_OPTIONS,
  ADDRESS_PROOF_TYPES,
  INDIAN_STATES
} from '../types'

export default function OwnerAddressStep({
  data,
  errors,
  onUpdate
}: SoleProprietorshipStepProps) {
  // S3 upload hooks
  const residentialUpload = useS3Upload()
  const permanentUpload = useS3Upload()
  const businessUpload = useS3Upload()

  // Handle file upload
  const handleFileUpload = useCallback(async (
    file: File,
    type: 'residential' | 'permanent' | 'business'
  ) => {
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPG, PNG, WebP) or PDF file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB')
      return
    }

    const uploadHook = type === 'residential'
      ? residentialUpload
      : type === 'permanent'
        ? permanentUpload
        : businessUpload

    try {
      const result = await uploadHook.upload(file, `${type}_address_proof`)

      if (result.success && result.url) {
        onUpdate({ [`${type}_address_proof_url`]: result.url })
        toast.success('Address proof uploaded successfully')
      } else {
        toast.error(result.error || 'Failed to upload file')
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload file')
    }
  }, [onUpdate, residentialUpload, permanentUpload, businessUpload])

  // Copy residential to permanent
  const copyResidentialToPermanent = useCallback(() => {
    onUpdate({
      permanent_same_as_residential: true,
      permanent_address_line1: data.residential_address_line1,
      permanent_address_line2: data.residential_address_line2,
      permanent_city: data.residential_city,
      permanent_state: data.residential_state,
      permanent_pincode: data.residential_pincode,
      permanent_address_proof_type: data.residential_address_proof_type,
      permanent_address_proof_url: data.residential_address_proof_url
    })
  }, [data, onUpdate])

  const handleSameAsResidentialChange = useCallback((checked: boolean) => {
    if (checked) {
      copyResidentialToPermanent()
    } else {
      onUpdate({
        permanent_same_as_residential: false,
        permanent_address_line1: '',
        permanent_address_line2: '',
        permanent_city: '',
        permanent_state: '',
        permanent_pincode: '',
        permanent_address_proof_type: '',
        permanent_address_proof_url: ''
      })
    }
  }, [copyResidentialToPermanent, onUpdate])

  // Render address form
  const renderAddressForm = (
    type: 'residential' | 'permanent' | 'business',
    title: string,
    iconColor: string,
    Icon: React.ElementType
  ) => {
    const prefix = type
    const isPermanent = type === 'permanent'
    const isDisabled = isPermanent && data.permanent_same_as_residential

    const addressData = {
      line1: data[`${prefix}_address_line1` as keyof SoleProprietorshipData] as string || '',
      line2: data[`${prefix}_address_line2` as keyof SoleProprietorshipData] as string || '',
      city: data[`${prefix}_city` as keyof SoleProprietorshipData] as string || '',
      state: data[`${prefix}_state` as keyof SoleProprietorshipData] as string || '',
      pincode: data[`${prefix}_pincode` as keyof SoleProprietorshipData] as string || '',
      proofType: data[`${prefix}_address_proof_type` as keyof SoleProprietorshipData] as string || '',
      proofUrl: data[`${prefix}_address_proof_url` as keyof SoleProprietorshipData] as string || ''
    }

    const uploading = type === 'residential'
      ? residentialUpload.isUploading
      : type === 'permanent'
        ? permanentUpload.isUploading
        : businessUpload.isUploading

    return (
      <div className={`p-5 bg-gray-800/50 rounded-xl border border-gray-700 ${isDisabled ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <h3 className="text-lg font-medium text-white">{title}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Address Line 1 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address Line 1 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={addressData.line1}
              onChange={(e) => onUpdate({ [`${prefix}_address_line1`]: e.target.value })}
              disabled={isDisabled}
              placeholder="House/Flat No., Building Name"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed ${
                errors[`${prefix}_address_line1`]
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
              }`}
            />
            {errors[`${prefix}_address_line1`] && (
              <p className="mt-1 text-sm text-red-400">{errors[`${prefix}_address_line1`]}</p>
            )}
          </div>

          {/* Address Line 2 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address Line 2 <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={addressData.line2}
              onChange={(e) => onUpdate({ [`${prefix}_address_line2`]: e.target.value })}
              disabled={isDisabled}
              placeholder="Street, Landmark"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              City <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={addressData.city}
              onChange={(e) => onUpdate({ [`${prefix}_city`]: e.target.value })}
              disabled={isDisabled}
              placeholder="Enter city"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed ${
                errors[`${prefix}_city`]
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
              }`}
            />
            {errors[`${prefix}_city`] && (
              <p className="mt-1 text-sm text-red-400">{errors[`${prefix}_city`]}</p>
            )}
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              State <span className="text-red-400">*</span>
            </label>
            <select
              value={addressData.state}
              onChange={(e) => onUpdate({ [`${prefix}_state`]: e.target.value })}
              disabled={isDisabled}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white appearance-none focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed ${
                errors[`${prefix}_state`]
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
              }`}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {errors[`${prefix}_state`] && (
              <p className="mt-1 text-sm text-red-400">{errors[`${prefix}_state`]}</p>
            )}
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pincode <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={addressData.pincode}
              onChange={(e) => onUpdate({ [`${prefix}_pincode`]: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              disabled={isDisabled}
              placeholder="Enter 6-digit pincode"
              maxLength={6}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed ${
                errors[`${prefix}_pincode`]
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
              }`}
            />
            {errors[`${prefix}_pincode`] && (
              <p className="mt-1 text-sm text-red-400">{errors[`${prefix}_pincode`]}</p>
            )}
          </div>

          {/* Address Proof Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address Proof Type <span className="text-gray-500">(Optional)</span>
            </label>
            <select
              value={addressData.proofType}
              onChange={(e) => onUpdate({ [`${prefix}_address_proof_type`]: e.target.value })}
              disabled={isDisabled}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed"
            >
              <option value="">Select proof type</option>
              {ADDRESS_PROOF_TYPES.map((proof) => (
                <option key={proof.value} value={proof.value}>{proof.label}</option>
              ))}
            </select>
          </div>

          {/* Address Proof Upload */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Address Proof <span className="text-gray-500">(Optional)</span>
            </label>

            {addressData.proofUrl ? (
              <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-orange-400" />
                <span className="text-orange-400 text-sm flex-1">Address proof uploaded</span>
                <a
                  href={addressData.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 text-sm"
                >
                  View
                </a>
                {!isDisabled && (
                  <button
                    type="button"
                    onClick={() => onUpdate({ [`${prefix}_address_proof_url`]: '' })}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isDisabled
                    ? 'border-gray-700 bg-gray-900 cursor-not-allowed'
                    : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-orange-500'
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, type)
                  }}
                  disabled={isDisabled || uploading}
                  className="hidden"
                />
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin mb-2" />
                    <span className="text-gray-400 text-sm">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-500 mb-2" />
                    <span className="text-gray-400 text-sm">Click to upload</span>
                    <span className="text-gray-500 text-xs mt-1">JPG, PNG, WebP or PDF (max 5MB)</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Proprietor Details Section */}
      <div className="p-5 bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-medium text-white">Proprietor Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Proprietor Full Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={data.proprietor_name || ''}
                onChange={(e) => onUpdate({ proprietor_name: e.target.value })}
                placeholder="Enter full name as per PAN"
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  errors.proprietor_name
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                }`}
              />
            </div>
            {errors.proprietor_name && (
              <p className="mt-1 text-sm text-red-400">{errors.proprietor_name}</p>
            )}
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Date of Birth <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={data.proprietor_dob || ''}
                onChange={(e) => onUpdate({ proprietor_dob: e.target.value })}
                max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 transition-colors ${
                  errors.proprietor_dob
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                }`}
              />
            </div>
            {errors.proprietor_dob && (
              <p className="mt-1 text-sm text-red-400">{errors.proprietor_dob}</p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gender <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-3">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUpdate({ proprietor_gender: option.value })}
                  className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                    data.proprietor_gender === option.value
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {errors.proprietor_gender && (
              <p className="mt-1 text-sm text-red-400">{errors.proprietor_gender}</p>
            )}
          </div>

          {/* Father's Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Father's Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={data.proprietor_father_name || ''}
                onChange={(e) => onUpdate({ proprietor_father_name: e.target.value })}
                placeholder="Enter father's name"
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  errors.proprietor_father_name
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                }`}
              />
            </div>
            {errors.proprietor_father_name && (
              <p className="mt-1 text-sm text-red-400">{errors.proprietor_father_name}</p>
            )}
          </div>

          {/* PAN Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PAN Number <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={data.proprietor_pan || ''}
                onChange={(e) => onUpdate({ proprietor_pan: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors font-mono ${
                  errors.proprietor_pan
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                }`}
              />
            </div>
            {errors.proprietor_pan && (
              <p className="mt-1 text-sm text-red-400">{errors.proprietor_pan}</p>
            )}
          </div>

          {/* Aadhaar Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Aadhaar Number <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={data.proprietor_aadhaar || ''}
                onChange={(e) => onUpdate({ proprietor_aadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                placeholder="Enter 12-digit Aadhaar"
                maxLength={12}
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors font-mono ${
                  errors.proprietor_aadhaar
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                }`}
              />
            </div>
            {errors.proprietor_aadhaar && (
              <p className="mt-1 text-sm text-red-400">{errors.proprietor_aadhaar}</p>
            )}
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Mobile Number <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                value={data.proprietor_mobile || ''}
                onChange={(e) => onUpdate({ proprietor_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="Enter 10-digit mobile"
                maxLength={10}
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  errors.proprietor_mobile
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                }`}
              />
            </div>
            {errors.proprietor_mobile && (
              <p className="mt-1 text-sm text-red-400">{errors.proprietor_mobile}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={data.proprietor_email || ''}
                onChange={(e) => onUpdate({ proprietor_email: e.target.value })}
                placeholder="Enter email address"
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  errors.proprietor_email
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                }`}
              />
            </div>
            {errors.proprietor_email && (
              <p className="mt-1 text-sm text-red-400">{errors.proprietor_email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Section Header for Addresses */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Address Details</h2>
          <p className="text-sm text-gray-400">Provide residential, permanent and business addresses</p>
        </div>
      </div>

      {/* Residential Address */}
      {renderAddressForm('residential', 'Residential Address', 'text-orange-400', Home)}

      {/* Same as Residential Checkbox */}
      <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <input
          type="checkbox"
          id="same_as_residential"
          checked={data.permanent_same_as_residential}
          onChange={(e) => handleSameAsResidentialChange(e.target.checked)}
          className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
        />
        <label htmlFor="same_as_residential" className="text-gray-300 cursor-pointer">
          Permanent address is same as residential address
        </label>
      </div>

      {/* Permanent Address */}
      {renderAddressForm('permanent', 'Permanent Address', 'text-orange-400', Home)}

      {/* Business Address */}
      {renderAddressForm('business', 'Business Address', 'text-orange-400', Building2)}
    </div>
  )
}
