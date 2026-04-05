'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Upload,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Building2,
  Briefcase
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'
import CameraCapture from '@/components/ui/CameraCapture'
import { toast } from 'sonner'
import { PageLoading } from '@/components/ui/loading-spinner'

interface VendorProfileData {
  vendor_id: string
  full_name: string
  email: string
  mobile_number: string
  profile_photo_url: string | null
  company_name: string
  service_type: string
  gst_number: string
  pan_number: string
  address: string
  city: string
  state: string
  pincode: string
}

const SERVICE_TYPES = [
  'Document Verification',
  'Property Valuation',
  'Legal Consultation',
  'Collection Agency',
  'Auction Services',
  'Field Investigation',
  'Technical Valuation',
  'Other Services'
]

export default function VendorProfileClient() {
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profileData, setProfileData] = useState<VendorProfileData>({
    vendor_id: '',
    full_name: '',
    email: '',
    mobile_number: '',
    profile_photo_url: null,
    company_name: '',
    service_type: '',
    gst_number: '',
    pan_number: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  })

  useEffect(() => {
    loadProfileData()
  }, [user])

  const loadProfileData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/profile')

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.profile) {
          setProfileData(data.profile)
        }
      } else {
        // If profile doesn't exist, use user data
        if (user) {
          setProfileData((prev) => ({
            ...prev,
            vendor_id: user.id || '',
            full_name: user.full_name || '',
            email: user.email || '',
          }))
        }
      }
    } catch (error) {
      clientLogger.error('Error loading vendor profile', { error })
      toast.error('Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof VendorProfileData, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePhotoUpload = async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setPhotoError('Invalid file type. Only JPG, PNG, and WebP are allowed')
      toast.error('Invalid file type')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('File size must be less than 5MB')
      toast.error('File size must be less than 5MB')
      return
    }

    setPhotoError(null)
    setIsUploadingPhoto(true)

    try {
      const formData = new FormData()
      formData.append('photo', file)

      const response = await fetch('/api/profile/upload-photo', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success && result.data?.url) {
        setProfileData(prev => ({
          ...prev,
          profile_photo_url: result.data.url
        }))
        await refreshUser()
        toast.success('Profile photo uploaded successfully')
        clientLogger.info('Vendor photo uploaded successfully')
      } else {
        setPhotoError(result.error || 'Failed to upload photo')
        toast.error(result.error || 'Failed to upload photo')
      }
    } catch (error) {
      clientLogger.error('Error uploading photo', error)
      setPhotoError('Failed to upload photo. Please try again.')
      toast.error('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await handlePhotoUpload(file)
  }

  const handleCameraCapture = async (file: File) => {
    await handlePhotoUpload(file)
  }

  const handleSaveProfile = async () => {
    // Client-side validation
    if (profileData.mobile_number && !/^[6-9]\d{9}$/.test(profileData.mobile_number)) {
      toast.error('Mobile number must be 10 digits starting with 6-9')
      return
    }
    if (profileData.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(profileData.pan_number)) {
      toast.error('Invalid PAN format (e.g., ABCDE1234F)')
      return
    }
    if (profileData.gst_number && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(profileData.gst_number)) {
      toast.error('Invalid GST format')
      return
    }
    if (profileData.pincode && !/^[1-9]\d{5}$/.test(profileData.pincode)) {
      toast.error('Pincode must be 6 digits')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || `Failed to save profile (${response.status})`)
        return
      }

      const result = await response.json()

      if (result.success) {
        toast.success('Profile updated successfully')
        await refreshUser()
      } else {
        toast.error(result.error || 'Failed to update profile')
      }
    } catch (error) {
      clientLogger.error('Error saving profile', error)
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageLoading
        text="Loading your profile..."
        subText="Please wait"
      />
    )
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">My Profile</h1>
          <p className="text-gray-400">Manage your vendor profile and business information</p>
        </div>

        {/* Profile Photo Card */}
        <Card className="content-card mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-orange-500" />
              Profile Photo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              {/* Photo Preview */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-800 border-4 border-gray-700/50 flex items-center justify-center">
                  {profileData.profile_photo_url ? (
                    <img
                      src={profileData.profile_photo_url}
                      alt={profileData.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <User className="w-12 h-12 text-gray-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">No photo</p>
                    </div>
                  )}
                </div>

                {/* Loading Overlay */}
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1">
                <div className="flex flex-wrap gap-3 mb-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isUploadingPhoto}
                  />

                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                    size="sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploadingPhoto ? 'Uploading...' : profileData.profile_photo_url ? 'Change Photo' : 'Upload Photo'}
                  </Button>

                  <Button
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isUploadingPhoto}
                    variant="outline"
                    className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
                    size="sm"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Selfie
                  </Button>
                </div>

                <p className="text-xs text-gray-400 mb-1">
                  Max size: 5MB • Formats: JPG, PNG, WebP
                </p>

                {photoError && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {photoError}
                  </p>
                )}

                {profileData.profile_photo_url && !photoError && !isUploadingPhoto && (
                  <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Photo uploaded successfully
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Details Card */}
        <Card className="content-card mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-orange-500" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={profileData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Enter your full name"
                className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address <span className="text-gray-500 text-xs">(Registered)</span>
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled
                className="w-full bg-gray-800/50 text-gray-400 border border-gray-700 rounded-lg px-4 py-3 cursor-not-allowed"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mobile Number <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={profileData.mobile_number}
                onChange={(e) => handleInputChange('mobile_number', e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Business Details Card */}
        <Card className="content-card mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-500" />
              Business Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={profileData.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                placeholder="Enter company name"
                className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Service Type <span className="text-red-400">*</span>
              </label>
              <select
                value={profileData.service_type}
                onChange={(e) => handleInputChange('service_type', e.target.value)}
                className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select Service Type</option>
                {SERVICE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* GST Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  GST Number
                </label>
                <input
                  type="text"
                  value={profileData.gst_number}
                  onChange={(e) => handleInputChange('gst_number', e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* PAN Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  PAN Number
                </label>
                <input
                  type="text"
                  value={profileData.pan_number}
                  onChange={(e) => handleInputChange('pan_number', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Card */}
        <Card className="content-card mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Address Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Address
              </label>
              <textarea
                value={profileData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Enter business address"
                rows={3}
                className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={profileData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="City"
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={profileData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="State"
                  className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pincode
              </label>
              <input
                type="text"
                value={profileData.pincode}
                onChange={(e) => handleInputChange('pincode', e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit pincode"
                maxLength={6}
                className="w-full bg-black text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        aspectRatio="square"
      />
    </div>
  )
}
