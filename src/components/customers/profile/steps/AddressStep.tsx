'use client'

import React, { useCallback } from 'react'
import { MapPin, Home, Upload, CheckCircle, X, Loader2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useS3Upload } from '@/hooks/useS3Upload'
import type { CustomerProfileData } from '../CustomerProfileWizard'

interface AddressStepProps {
  data: CustomerProfileData
  errors: Record<string, string>
  onUpdate: (updates: Partial<CustomerProfileData>) => void
}

const ADDRESS_PROOF_TYPES = [
  { value: 'UTILITY_BILL', label: 'Utility Bill' },
  { value: 'RENT_AGREEMENT', label: 'Rent Agreement' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' }
]

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Lakshadweep'
]

export default function AddressStep({ data, errors, onUpdate }: AddressStepProps) {
  // S3 upload hooks for current and permanent address proofs
  const currentAddressUpload = useS3Upload()
  const permanentAddressUpload = useS3Upload()

  // Handle file upload using direct S3 upload
  const handleFileUpload = useCallback(async (
    file: File,
    type: 'current' | 'permanent'
  ) => {
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPG, PNG, WebP) or PDF file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB')
      return
    }

    const uploadHook = type === 'current' ? currentAddressUpload : permanentAddressUpload

    try {
      const result = await uploadHook.upload(file, `address_proof_${type}`)

      if (result.success && result.url) {
        if (type === 'current') {
          onUpdate({ current_address_proof_url: result.url })
        } else {
          onUpdate({ permanent_address_proof_url: result.url })
        }
        toast.success('Address proof uploaded successfully')
      } else {
        toast.error(result.error || 'Failed to upload file')
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload file')
    }
  }, [onUpdate, currentAddressUpload, permanentAddressUpload])

  // Copy current address to permanent
  const copyCurrentToPermanent = useCallback(() => {
    onUpdate({
      permanent_same_as_current: true,
      permanent_address_line1: data.current_address_line1,
      permanent_address_line2: data.current_address_line2,
      permanent_city: data.current_city,
      permanent_state: data.current_state,
      permanent_pincode: data.current_pincode,
      permanent_address_proof_type: data.current_address_proof_type,
      permanent_address_proof_url: data.current_address_proof_url
    })
  }, [data, onUpdate])

  // Clear permanent address when checkbox unchecked
  const handleSameAsCurrentChange = useCallback((checked: boolean) => {
    if (checked) {
      copyCurrentToPermanent()
    } else {
      onUpdate({
        permanent_same_as_current: false,
        permanent_address_line1: '',
        permanent_address_line2: '',
        permanent_city: '',
        permanent_state: '',
        permanent_pincode: '',
        permanent_address_proof_type: '',
        permanent_address_proof_url: ''
      })
    }
  }, [copyCurrentToPermanent, onUpdate])

  // Render address form section
  const renderAddressForm = (
    type: 'current' | 'permanent',
    title: string,
    icon: React.ReactNode
  ) => {
    const prefix = type
    const isPermanent = type === 'permanent'
    const isDisabled = isPermanent && data.permanent_same_as_current

    const addressData = {
      line1: data[`${prefix}_address_line1` as keyof CustomerProfileData] as string || '',
      line2: data[`${prefix}_address_line2` as keyof CustomerProfileData] as string || '',
      city: data[`${prefix}_city` as keyof CustomerProfileData] as string || '',
      state: data[`${prefix}_state` as keyof CustomerProfileData] as string || '',
      pincode: data[`${prefix}_pincode` as keyof CustomerProfileData] as string || '',
      proofType: data[`${prefix}_address_proof_type` as keyof CustomerProfileData] as string || '',
      proofUrl: data[`${prefix}_address_proof_url` as keyof CustomerProfileData] as string || ''
    }

    const uploading = type === 'current' ? currentAddressUpload.isUploading : permanentAddressUpload.isUploading

    return (
      <div className={`p-5 bg-gray-800/50 rounded-xl border border-gray-700 ${isDisabled ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            {icon}
            {title}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Address Line 1 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address Line 1 <span className="text-gray-500">(Optional)</span>
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
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
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
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              City <span className="text-gray-500">(Optional)</span>
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
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
              }`}
            />
            {errors[`${prefix}_city`] && (
              <p className="mt-1 text-sm text-red-400">{errors[`${prefix}_city`]}</p>
            )}
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              State <span className="text-gray-500">(Optional)</span>
            </label>
            <select
              value={addressData.state}
              onChange={(e) => onUpdate({ [`${prefix}_state`]: e.target.value })}
              disabled={isDisabled}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white appearance-none focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed ${
                errors[`${prefix}_state`]
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
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
              Pincode <span className="text-gray-500">(Optional)</span>
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
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
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
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white appearance-none focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed ${
                errors[`${prefix}_address_proof_type`]
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
              }`}
            >
              <option value="">Select proof type</option>
              {ADDRESS_PROOF_TYPES.map((proof) => (
                <option key={proof.value} value={proof.value}>{proof.label}</option>
              ))}
            </select>
            {errors[`${prefix}_address_proof_type`] && (
              <p className="mt-1 text-sm text-red-400">{errors[`${prefix}_address_proof_type`]}</p>
            )}
          </div>

          {/* Address Proof Upload */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Address Proof <span className="text-gray-500">(Optional)</span>
            </label>

            {addressData.proofUrl ? (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-sm flex-1">Address proof uploaded</span>
                <a
                  href={addressData.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm"
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
                    : errors[`${prefix}_address_proof_url`]
                    ? 'border-red-500 bg-red-500/5 hover:bg-red-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-purple-500'
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
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
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
            {errors[`${prefix}_address_proof_url`] && (
              <p className="mt-1 text-sm text-red-400">{errors[`${prefix}_address_proof_url`]}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-purple-400" />
          Address Details
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Please provide your current and permanent address details with proof documents.
        </p>
      </div>

      {/* Current Address */}
      {renderAddressForm(
        'current',
        'Current Address',
        <Home className="w-5 h-5 text-blue-400" />
      )}

      {/* Same as Current Checkbox */}
      <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <input
          type="checkbox"
          id="same_as_current"
          checked={data.permanent_same_as_current}
          onChange={(e) => handleSameAsCurrentChange(e.target.checked)}
          className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500/50"
        />
        <label htmlFor="same_as_current" className="text-gray-300 cursor-pointer">
          Permanent address is same as current address
        </label>
      </div>

      {/* Permanent Address */}
      {renderAddressForm(
        'permanent',
        'Permanent Address',
        <FileText className="w-5 h-5 text-green-400" />
      )}
    </div>
  )
}
