'use client'

import React, { useRef, useState } from 'react'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Upload,
  CheckCircle,
  FileText,
  Camera,
  Globe,
  Hash,
  CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import FormField from '@/components/partners/shared/FormField'
import { VerificationStatus } from '@/components/partners/shared/StatusIndicator'
import CameraCapture from '@/components/ui/CameraCapture'
import Image from 'next/image'
import type {
  BPPersonalDetails,
  BPPersonalDetailsForm,
  VerificationStatus as VerificationStatusType,
} from '@/types/bp-profile'

interface BPPersonalDetailsSectionProps {
  data: BPPersonalDetails | null
  formData: BPPersonalDetailsForm
  onChange: (field: keyof BPPersonalDetailsForm, value: string) => void
  onFileUpload: (field: string, file: File) => Promise<void>
  isEditing: boolean
  uploadingField: string | null
  indianStates: Array<{ state_name: string; state_code: string }>
}

const genderOptions = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
]

const residentialStatusOptions = [
  { value: 'RESIDENT', label: 'Indian Resident' },
  { value: 'NRI', label: 'NRI' },
  { value: 'FOREIGN_NATIONAL', label: 'Foreign National' },
]

const addressProofOptions = [
  { value: 'UTILITY_BILL', label: 'Utility Bill' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'RENT_AGREEMENT', label: 'Rent Agreement' },
  { value: 'PROPERTY_DOCUMENT', label: 'Property Document' },
  { value: 'AADHAAR_CARD', label: 'Aadhaar Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'VOTER_ID', label: 'Voter ID' },
]

export default function BPPersonalDetailsSection({
  data,
  formData,
  onChange,
  onFileUpload,
  isEditing,
  uploadingField,
  indianStates,
}: BPPersonalDetailsSectionProps) {
  const profilePictureRef = useRef<HTMLInputElement>(null)
  const panDocRef = useRef<HTMLInputElement>(null)
  const aadhaarDocRef = useRef<HTMLInputElement>(null)
  const addressProofRef = useRef<HTMLInputElement>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)

  const getVerificationStatusType = (
    status: VerificationStatusType | undefined
  ): 'not_submitted' | 'pending' | 'verified' | 'failed' | 'expired' | 'rejected' => {
    if (!status) return 'not_submitted'
    const mapping: Record<
      VerificationStatusType,
      'not_submitted' | 'pending' | 'verified' | 'failed' | 'expired' | 'rejected'
    > = {
      NOT_SUBMITTED: 'not_submitted',
      PENDING: 'pending',
      VERIFIED: 'verified',
      FAILED: 'failed',
      EXPIRED: 'expired',
      REJECTED: 'rejected',
    }
    return mapping[status] || 'not_submitted'
  }

  const handleFileChange = async (
    field: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      await onFileUpload(field, file)
    }
  }

  const handleCameraCapture = async (file: File) => {
    await onFileUpload('profile_photograph_url', file)
  }

  const stateOptions = indianStates.map((state) => ({
    value: state.state_name,
    label: state.state_name,
  }))

  const handleStateChange = (stateName: string) => {
    onChange('residential_state', stateName)
  }

  const renderFileUpload = (
    label: string,
    field: string,
    currentUrl: string | null | undefined,
    inputRef: React.RefObject<HTMLInputElement>,
    verificationStatus?: VerificationStatusType
  ) => {
    return (
      <div className="space-y-2">
        <label className="text-gray-400 text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {label}
        </label>
        {!isEditing ? (
          <div className="flex items-center gap-3">
            {currentUrl ? (
              <>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 text-sm underline"
                >
                  View Document
                </a>
                {verificationStatus && (
                  <VerificationStatus
                    status={getVerificationStatusType(verificationStatus)}
                    size="sm"
                  />
                )}
              </>
            ) : (
              <span className="text-gray-500 text-sm italic">Not uploaded</span>
            )}
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-700/50 rounded-lg p-4">
            {currentUrl ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 text-sm">Document uploaded</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:text-orange-300 text-sm underline"
                  >
                    View
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploadingField === field}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-white text-sm">
                  {uploadingField === field ? 'Uploading...' : 'Click to upload'}
                </span>
                <span className="text-gray-400 text-xs mt-1">PDF, JPG, PNG (max 5MB)</span>
              </label>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFileChange(field, e)}
              className="hidden"
              disabled={uploadingField === field}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <CollapsibleSection
      title="Personal Details"
      icon={User}
      badge={
        data?.pan_verification_status === 'VERIFIED' &&
        data?.address_verification_status === 'VERIFIED'
          ? { text: 'Verified', variant: 'success' }
          : { text: 'Incomplete', variant: 'warning' }
      }
    >
      <div className="space-y-6 mt-4">
        {/* Profile Picture */}
        <div className="flex items-start gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Profile Picture <span className="text-gray-500 text-xs">(JPG, PNG, max 5MB)</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-2 border-orange-500/30">
                {data?.profile_photograph_url ? (
                  <Image
                    src={data.profile_photograph_url}
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

              {isEditing && (
                <div className="flex flex-col gap-2">
                  <input
                    ref={profilePictureRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={(e) => handleFileChange('profile_photograph_url', e)}
                    className="hidden"
                    disabled={uploadingField === 'profile_photograph_url'}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => profilePictureRef.current?.click()}
                      disabled={uploadingField === 'profile_photograph_url'}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      size="sm"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingField === 'profile_photograph_url'
                        ? 'Uploading...'
                        : data?.profile_photograph_url
                        ? 'Change'
                        : 'Upload'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      disabled={uploadingField === 'profile_photograph_url'}
                      variant="outline"
                      className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                      size="sm"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Take Selfie
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            label="Full Name (as per PAN)"
            icon={User}
            value={formData.full_name}
            onChange={(v) => onChange('full_name', v)}
            isEditing={isEditing}
            placeholder="Enter your full name"
            required
          />

          <FormField
            label="Date of Birth"
            icon={Calendar}
            value={formData.date_of_birth}
            onChange={(v) => onChange('date_of_birth', v)}
            isEditing={isEditing}
            type="date"
            required
          />

          <FormField
            label="Gender"
            icon={User}
            value={formData.gender}
            onChange={(v) => onChange('gender', v)}
            isEditing={isEditing}
            type="select"
            options={genderOptions}
          />
        </div>

        {/* Contact Information */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4 text-orange-400" />
            Contact Information
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField
              label="Mobile Number"
              icon={Phone}
              value={formData.mobile_number}
              onChange={(v) => onChange('mobile_number', v.replace(/\D/g, ''))}
              isEditing={isEditing}
              placeholder="10-digit mobile number"
              maxLength={10}
              required
              verified={data?.mobile_verified}
            />

            <FormField
              label="Alternate Mobile"
              icon={Phone}
              value={formData.alternate_mobile}
              onChange={(v) => onChange('alternate_mobile', v.replace(/\D/g, ''))}
              isEditing={isEditing}
              placeholder="Optional"
              maxLength={10}
            />

            <FormField
              label="Email ID"
              icon={Mail}
              value={formData.email_id}
              onChange={(v) => onChange('email_id', v)}
              isEditing={isEditing}
              type="email"
              placeholder="your@email.com"
              required
              readOnly
              verified={data?.email_verified}
              hint="Email cannot be changed"
            />
          </div>
        </div>

        {/* Identity Information */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" />
            Identity Information
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PAN Number */}
            <div className="space-y-4">
              <div className="space-y-2">
                <FormField
                  label="PAN Number"
                  icon={CreditCard}
                  value={formData.pan_number}
                  onChange={(v) => onChange('pan_number', v.toUpperCase())}
                  isEditing={isEditing}
                  placeholder="e.g., ABCDE1234F"
                  maxLength={10}
                  required
                  verificationStatus={getVerificationStatusType(data?.pan_verification_status)}
                />
              </div>

              {renderFileUpload(
                'PAN Card Document',
                'pan_document_url',
                data?.pan_document_url,
                panDocRef,
                data?.pan_verification_status
              )}
            </div>

            {/* Aadhaar Number */}
            <div className="space-y-4">
              <FormField
                label="Aadhaar Number"
                icon={CreditCard}
                value={formData.aadhaar_number}
                onChange={(v) => onChange('aadhaar_number', v.replace(/\D/g, ''))}
                isEditing={isEditing}
                placeholder="12-digit Aadhaar number"
                maxLength={12}
                hint="Optional - will be masked for security"
                verificationStatus={getVerificationStatusType(data?.aadhaar_verification_status)}
              />

              {renderFileUpload(
                'Aadhaar Document',
                'aadhaar_document_url',
                data?.aadhaar_document_url,
                aadhaarDocRef,
                data?.aadhaar_verification_status
              )}
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="border-t border-gray-700/50 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Nationality"
              icon={Globe}
              value={formData.nationality}
              onChange={(v) => onChange('nationality', v)}
              isEditing={isEditing}
              placeholder="e.g., Indian"
            />

            <FormField
              label="Residential Status"
              icon={User}
              value={formData.residential_status}
              onChange={(v) => onChange('residential_status', v)}
              isEditing={isEditing}
              type="select"
              options={residentialStatusOptions}
            />
          </div>
        </div>

        {/* Residential Address */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-400" />
            Residential Address
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Address Line 1"
              icon={MapPin}
              value={formData.residential_address_line1}
              onChange={(v) => onChange('residential_address_line1', v)}
              isEditing={isEditing}
              placeholder="House No., Building, Street"
              required
            />

            <FormField
              label="Address Line 2"
              icon={MapPin}
              value={formData.residential_address_line2}
              onChange={(v) => onChange('residential_address_line2', v)}
              isEditing={isEditing}
              placeholder="Area, Landmark"
            />

            <FormField
              label="City"
              icon={MapPin}
              value={formData.residential_city}
              onChange={(v) => onChange('residential_city', v)}
              isEditing={isEditing}
              placeholder="Enter city"
              required
            />

            <FormField
              label="District"
              icon={MapPin}
              value={formData.residential_district}
              onChange={(v) => onChange('residential_district', v)}
              isEditing={isEditing}
              placeholder="Enter district"
              required
            />

            <FormField
              label="State"
              icon={MapPin}
              value={formData.residential_state}
              onChange={handleStateChange}
              isEditing={isEditing}
              type="select"
              options={stateOptions}
              required
            />

            <FormField
              label="PIN Code"
              icon={Hash}
              value={formData.residential_pincode}
              onChange={(v) => onChange('residential_pincode', v.replace(/\D/g, ''))}
              isEditing={isEditing}
              placeholder="6-digit PIN code"
              maxLength={6}
              required
            />
          </div>

          {/* Address Proof */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <FormField
              label="Address Proof Type"
              icon={FileText}
              value={formData.address_proof_type}
              onChange={(v) => onChange('address_proof_type', v)}
              isEditing={isEditing}
              type="select"
              options={addressProofOptions}
            />

            {renderFileUpload(
              'Address Proof Document',
              'address_proof_url',
              data?.address_proof_url,
              addressProofRef,
              data?.address_verification_status
            )}
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
    </CollapsibleSection>
  )
}
