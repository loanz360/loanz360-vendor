'use client'

import React, { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Upload,
  CheckCircle,
  FileText,
  Camera
} from 'lucide-react'
import type { PartnerProfileData, IndianState } from '@/types/partner-profile'
import Image from 'next/image'
import CameraCapture from '@/components/ui/CameraCapture'

interface PersonalDetailsSectionProps {
  profileData: PartnerProfileData
  indianStates: IndianState[]
  onChange: (field: keyof PartnerProfileData, value: string | null) => void
  onFileUpload: (field: keyof PartnerProfileData, file: File) => Promise<void>
  uploadingField: string | null
  readonly?: boolean
}

export default function PersonalDetailsSection({
  profileData,
  indianStates,
  onChange,
  onFileUpload,
  uploadingField,
  readonly = false,
}: PersonalDetailsSectionProps) {
  const profilePictureRef = useRef<HTMLInputElement>(null)
  const presentAddressProofRef = useRef<HTMLInputElement>(null)
  const permanentAddressProofRef = useRef<HTMLInputElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)

  const handleFileChange = async (
    field: keyof PartnerProfileData,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      await onFileUpload(field, file)
    }
  }

  const handleCameraCapture = async (file: File) => {
    await onFileUpload('profile_picture_url', file)
  }

  const handleStateChange = (stateName: string) => {
    const selectedState = indianStates.find((s) => s.state_name === stateName)
    if (selectedState) {
      onChange('state_name', selectedState.state_name)
      onChange('state_code', selectedState.state_code)
    }
  }

  const copyPresentToPermanent = () => {
    onChange('permanent_address', profileData.present_address)
  }

  return (
    <Card className="bg-brand-card border-brand-card-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <User className="w-5 h-5 text-brand-primary" />
          Personal Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Picture Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Profile Picture <span className="text-gray-500 text-xs">(JPG, PNG, max 5MB)</span>
          </label>
          <div className="flex items-center gap-4">
            {/* Profile Picture Preview */}
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-2 border-brand-primary">
              {profileData.profile_picture_url ? (
                <Image
                  src={profileData.profile_picture_url}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-500" />
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="flex flex-col gap-2">
              <input
                ref={profilePictureRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => handleFileChange('profile_picture_url', e)}
                className="hidden"
                disabled={readonly || uploadingField === 'profile_picture_url'}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => profilePictureRef.current?.click()}
                  disabled={readonly || uploadingField === 'profile_picture_url'}
                  className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                  size="sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingField === 'profile_picture_url'
                    ? 'Uploading...'
                    : profileData.profile_picture_url
                    ? 'Change Photo'
                    : 'Upload Photo'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  disabled={readonly || uploadingField === 'profile_picture_url'}
                  variant="outline"
                  className="border-brand-primary text-brand-primary hover:bg-brand-primary/10"
                  size="sm"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Selfie
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Full Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={profileData.full_name}
              onChange={(e) => onChange('full_name', e.target.value)}
              placeholder="Enter your full name"
              disabled={readonly}
              className="w-full bg-brand-black text-white border border-white/20 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Mobile Number */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Mobile Number <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={profileData.mobile_number}
              onChange={(e) => onChange('mobile_number', e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile number"
              maxLength={10}
              disabled={readonly}
              className="w-full bg-brand-black text-white border border-white/20 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>
        </div>

        {/* Email ID (Readonly from registration) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email ID <span className="text-gray-500 text-xs">(From registration)</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={profileData.work_email}
              disabled
              className="w-full bg-gray-800/50 text-gray-400 border border-gray-700 rounded-lg pl-12 pr-4 py-3 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-6" />

        {/* Present Address Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-brand-primary font-poppins">Present Address</h3>

          {/* Present Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Present Address <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                value={profileData.present_address}
                onChange={(e) => onChange('present_address', e.target.value)}
                placeholder="Enter your current residential address"
                rows={3}
                disabled={readonly}
                className="w-full bg-brand-black text-white border border-white/20 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
              />
            </div>
          </div>

          {/* State Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              State Name <span className="text-red-400">*</span>
            </label>
            <select
              value={profileData.state_name}
              onChange={(e) => handleStateChange(e.target.value)}
              disabled={readonly}
              className="w-full bg-brand-black text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
            >
              <option value="">Select State</option>
              {indianStates.map((state) => (
                <option key={state.id} value={state.state_name}>
                  {state.state_name}
                </option>
              ))}
            </select>
          </div>

          {/* State Code (Auto-populated) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              State Code <span className="text-gray-500 text-xs">(Auto-populated)</span>
            </label>
            <input
              type="text"
              value={profileData.state_code}
              disabled
              className="w-full bg-gray-800/50 text-gray-400 border border-gray-700 rounded-lg px-4 py-3 cursor-not-allowed"
            />
          </div>

          {/* PIN Code */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PIN Code <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={profileData.pincode}
              onChange={(e) => onChange('pincode', e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit PIN code"
              maxLength={6}
              disabled={readonly}
              className="w-full bg-brand-black text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>

          {/* Present Address Proof Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Present Address Proof <span className="text-gray-500 text-xs">(JPG, PDF, max 5MB)</span>
            </label>
            <div className="border-2 border-dashed border-white/20 rounded-lg p-4">
              {profileData.present_address_proof_url ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 text-sm">Document uploaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={profileData.present_address_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-primary hover:text-brand-primary/80 text-sm underline"
                    >
                      View
                    </a>
                    {!readonly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => presentAddressProofRef.current?.click()}
                        disabled={uploadingField === 'present_address_proof_url'}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center">
                  <input
                    ref={presentAddressProofRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange('present_address_proof_url', e)}
                    className="hidden"
                    disabled={readonly || uploadingField === 'present_address_proof_url'}
                  />
                  <FileText className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-white text-sm">
                    {uploadingField === 'present_address_proof_url'
                      ? 'Uploading...'
                      : 'Click to upload address proof'}
                  </span>
                  <span className="text-gray-400 text-xs mt-1">JPG, PNG, or PDF (max 5MB)</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-6" />

        {/* Permanent Address Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-brand-primary font-poppins">Permanent Address</h3>
            {!readonly && (
              <Button
                type="button"
                onClick={copyPresentToPermanent}
                variant="outline"
                size="sm"
                className="text-xs border-brand-primary text-brand-primary hover:bg-brand-primary/10"
              >
                Same as Present Address
              </Button>
            )}
          </div>

          {/* Permanent Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Permanent Address <span className="text-red-400">*</span>
            </label>
            <textarea
              value={profileData.permanent_address}
              onChange={(e) => onChange('permanent_address', e.target.value)}
              placeholder="Enter your permanent address"
              rows={3}
              disabled={readonly}
              className="w-full bg-brand-black text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>

          {/* Permanent Address Proof Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Permanent Address Proof <span className="text-gray-500 text-xs">(JPG, PDF, max 5MB)</span>
            </label>
            <div className="border-2 border-dashed border-white/20 rounded-lg p-4">
              {profileData.permanent_address_proof_url ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 text-sm">Document uploaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={profileData.permanent_address_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-primary hover:text-brand-primary/80 text-sm underline"
                    >
                      View
                    </a>
                    {!readonly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => permanentAddressProofRef.current?.click()}
                        disabled={uploadingField === 'permanent_address_proof_url'}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center">
                  <input
                    ref={permanentAddressProofRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange('permanent_address_proof_url', e)}
                    className="hidden"
                    disabled={readonly || uploadingField === 'permanent_address_proof_url'}
                  />
                  <FileText className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-white text-sm">
                    {uploadingField === 'permanent_address_proof_url'
                      ? 'Uploading...'
                      : 'Click to upload address proof'}
                  </span>
                  <span className="text-gray-400 text-xs mt-1">JPG, PNG, or PDF (max 5MB)</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-6" />

        {/* Description / Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description / Bio <span className="text-gray-500 text-xs">(About yourself or your business)</span>
          </label>
          <textarea
            value={profileData.bio_description || ''}
            onChange={(e) => onChange('bio_description', e.target.value)}
            placeholder="Tell us about yourself or your business (max 1000 characters)"
            rows={4}
            maxLength={1000}
            disabled={readonly}
            className="w-full bg-brand-black text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {(profileData.bio_description || '').length} / 1000 characters
          </div>
        </div>

        {/* Camera Capture Modal */}
        <CameraCapture
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
          aspectRatio="square"
        />
      </CardContent>
    </Card>
  )
}
