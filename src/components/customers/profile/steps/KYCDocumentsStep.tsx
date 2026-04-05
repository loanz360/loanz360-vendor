'use client'

import React, { useState, useCallback } from 'react'
import { FileCheck, CreditCard, Fingerprint, Camera, Upload, CheckCircle, X, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useS3Upload } from '@/hooks/useS3Upload'
import type { CustomerProfileData } from '../CustomerProfileWizard'

interface KYCDocumentsStepProps {
  data: CustomerProfileData
  errors: Record<string, string>
  onUpdate: (updates: Partial<CustomerProfileData>) => void
}

export default function KYCDocumentsStep({ data, errors, onUpdate }: KYCDocumentsStepProps) {
  const [verifyingPan, setVerifyingPan] = useState(false)
  const [verifyingAadhaar, setVerifyingAadhaar] = useState(false)

  // S3 upload hooks
  const panUpload = useS3Upload()
  const aadhaarUpload = useS3Upload()
  const photoUpload = useS3Upload()

  // Verify PAN
  const verifyPan = useCallback(async () => {
    if (!data.pan_number || data.pan_number.length !== 10) {
      toast.error('Please enter a valid 10-character PAN number')
      return
    }

    try {
      setVerifyingPan(true)
      const response = await fetch('/api/customers/verify-pan', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pan_number: data.pan_number.toUpperCase() })
      })

      const result = await response.json()

      if (result.success && result.verified) {
        onUpdate({
          pan_verified: true,
          pan_holder_name: result.holder_name
        })
        toast.success('PAN verified successfully!')
      } else {
        toast.error(result.error || 'PAN verification failed')
      }
    } catch (err) {
      console.error('PAN verification error:', err)
      toast.error('PAN verification failed. Please try again.')
    } finally {
      setVerifyingPan(false)
    }
  }, [data.pan_number, onUpdate])

  // Verify Aadhaar
  const verifyAadhaar = useCallback(async () => {
    const aadhaarClean = data.aadhaar_number?.replace(/\s/g, '')
    if (!aadhaarClean || aadhaarClean.length !== 12) {
      toast.error('Please enter a valid 12-digit Aadhaar number')
      return
    }

    try {
      setVerifyingAadhaar(true)
      const response = await fetch('/api/customers/verify-aadhaar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar_number: aadhaarClean })
      })

      const result = await response.json()

      if (result.success && result.verified) {
        onUpdate({
          aadhaar_verified: true,
          aadhaar_holder_name: result.holder_name
        })
        toast.success('Aadhaar verified successfully!')
      } else {
        toast.error(result.error || 'Aadhaar verification failed')
      }
    } catch (err) {
      console.error('Aadhaar verification error:', err)
      toast.error('Aadhaar verification failed. Please try again.')
    } finally {
      setVerifyingAadhaar(false)
    }
  }, [data.aadhaar_number, onUpdate])

  // Handle file upload using S3
  const handleFileUpload = useCallback(async (
    file: File,
    type: 'pan' | 'aadhaar' | 'photo'
  ) => {
    if (!file) return

    // Validate file type
    const validTypes = type === 'photo'
      ? ['image/jpeg', 'image/png', 'image/webp']
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

    if (!validTypes.includes(file.type)) {
      toast.error(`Please upload a valid ${type === 'photo' ? 'image' : 'image or PDF'} file`)
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB')
      return
    }

    const uploadHook = type === 'pan' ? panUpload : type === 'aadhaar' ? aadhaarUpload : photoUpload
    const uploadType = type === 'photo' ? 'profile_photo' : `${type}_document`

    try {
      const result = await uploadHook.upload(file, uploadType)

      if (result.success && result.url) {
        if (type === 'pan') {
          onUpdate({ pan_document_url: result.url })
        } else if (type === 'aadhaar') {
          onUpdate({ aadhaar_document_url: result.url })
        } else {
          onUpdate({ profile_photo_url: result.url })
        }
        toast.success(`${type === 'photo' ? 'Profile photo' : type.toUpperCase() + ' document'} uploaded successfully`)
      } else {
        toast.error(result.error || 'Failed to upload file')
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload file')
    }
  }, [onUpdate, panUpload, aadhaarUpload, photoUpload])

  // Format Aadhaar for display (XXXX XXXX XXXX)
  const formatAadhaar = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 12)
    const parts = []
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4))
    }
    return parts.join(' ')
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-purple-400" />
          KYC Documents
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Upload and verify your PAN and Aadhaar for identity verification.
        </p>
      </div>

      {/* PAN Card Section */}
      <div className="p-5 bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-medium text-white">PAN Card</h3>
          {data.pan_verified && (
            <span className="ml-auto flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded">
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PAN Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PAN Number <span className="text-gray-500">(Optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.pan_number || ''}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
                  onUpdate({ pan_number: value, pan_verified: false })
                }}
                placeholder="ABCDE1234F"
                maxLength={10}
                disabled={data.pan_verified}
                className={`flex-1 px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors uppercase disabled:bg-gray-900 disabled:cursor-not-allowed ${
                  errors.pan_number
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
                }`}
              />
              {!data.pan_verified && (
                <button
                  type="button"
                  onClick={verifyPan}
                  disabled={verifyingPan || !data.pan_number || data.pan_number.length !== 10}
                  className="px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {verifyingPan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Verify
                    </>
                  )}
                </button>
              )}
            </div>
            {errors.pan_number && <p className="mt-1 text-sm text-red-400">{errors.pan_number}</p>}
            {data.pan_verified && data.pan_holder_name && (
              <p className="mt-2 text-sm text-green-400">
                Name: {data.pan_holder_name}
              </p>
            )}
          </div>

          {/* PAN Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload PAN Card <span className="text-gray-500">(Optional)</span>
            </label>
            {data.pan_document_url ? (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-sm flex-1">PAN document uploaded</span>
                <a
                  href={data.pan_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  View
                </a>
                <button
                  type="button"
                  onClick={() => onUpdate({ pan_document_url: '' })}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 hover:border-purple-500 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'pan')
                  }}
                  disabled={panUpload.isUploading}
                  className="hidden"
                />
                {panUpload.isUploading ? (
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-500 mb-1" />
                    <span className="text-gray-400 text-sm">Click to upload</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Aadhaar Section */}
      <div className="p-5 bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Fingerprint className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-medium text-white">Aadhaar Card</h3>
          {data.aadhaar_verified && (
            <span className="ml-auto flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded">
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Aadhaar Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Aadhaar Number <span className="text-gray-500">(Optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formatAadhaar(data.aadhaar_number || '')}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 12)
                  onUpdate({ aadhaar_number: value, aadhaar_verified: false })
                }}
                placeholder="XXXX XXXX XXXX"
                disabled={data.aadhaar_verified}
                className={`flex-1 px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-900 disabled:cursor-not-allowed ${
                  errors.aadhaar_number
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
                }`}
              />
              {!data.aadhaar_verified && (
                <button
                  type="button"
                  onClick={verifyAadhaar}
                  disabled={verifyingAadhaar || !data.aadhaar_number || data.aadhaar_number.replace(/\s/g, '').length !== 12}
                  className="px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {verifyingAadhaar ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Verify
                    </>
                  )}
                </button>
              )}
            </div>
            {errors.aadhaar_number && <p className="mt-1 text-sm text-red-400">{errors.aadhaar_number}</p>}
            {data.aadhaar_verified && data.aadhaar_holder_name && (
              <p className="mt-2 text-sm text-green-400">
                Name: {data.aadhaar_holder_name}
              </p>
            )}
          </div>

          {/* Aadhaar Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Aadhaar Card <span className="text-gray-500">(Optional)</span>
            </label>
            {data.aadhaar_document_url ? (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-sm flex-1">Aadhaar document uploaded</span>
                <a
                  href={data.aadhaar_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  View
                </a>
                <button
                  type="button"
                  onClick={() => onUpdate({ aadhaar_document_url: '' })}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 hover:border-purple-500 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'aadhaar')
                  }}
                  disabled={aadhaarUpload.isUploading}
                  className="hidden"
                />
                {aadhaarUpload.isUploading ? (
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-500 mb-1" />
                    <span className="text-gray-400 text-sm">Click to upload</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>

        {/* Aadhaar OTP Info */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-blue-300 text-sm">
              Aadhaar verification may require OTP verification sent to your registered mobile number.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Photo Section */}
      <div className="p-5 bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-medium text-white">Profile Photo</h3>
          <span className="text-gray-500 text-sm">(Optional but recommended)</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Photo Preview */}
          <div className="w-32 h-32 rounded-full bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {data.profile_photo_url ? (
              <img
                src={data.profile_photo_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <Camera className="w-10 h-10 text-gray-600" />
            )}
          </div>

          {/* Upload/Actions */}
          <div className="flex-1">
            <p className="text-gray-400 text-sm mb-3">
              Upload a clear photo of yourself for smoother loan processing. You can also upload this during your loan application.
            </p>

            <div className="flex gap-3">
              <label className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg cursor-pointer transition-colors flex items-center gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'photo')
                  }}
                  disabled={photoUpload.isUploading}
                  className="hidden"
                />
                {photoUpload.isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {data.profile_photo_url ? 'Change Photo' : 'Upload Photo'}
                  </>
                )}
              </label>

              {data.profile_photo_url && (
                <button
                  type="button"
                  onClick={() => onUpdate({ profile_photo_url: '' })}
                  className="px-4 py-2 text-red-400 hover:text-red-300 border border-red-500/50 hover:border-red-400 rounded-lg transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            <p className="text-gray-500 text-xs mt-2">
              JPG, PNG or WebP. Max 5MB. Face should be clearly visible.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
