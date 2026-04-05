'use client'

import React from 'react'
import {
  Building2,
  FileText,
  Hash,
  User,
  MapPin,
  Calendar,
  Shield,
  Upload,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import FormField, { SwitchField } from '@/components/partners/shared/FormField'
import { VerificationStatus } from '@/components/partners/shared/StatusIndicator'
import type {
  BPBusinessEntityDetails,
  BPBusinessEntityForm,
  VerificationStatus as VerificationStatusType,
} from '@/types/bp-profile'
import { ENTITY_TYPE_LABELS } from '@/types/bp-profile'

interface BusinessEntitySectionProps {
  data: BPBusinessEntityDetails | null
  formData: BPBusinessEntityForm
  onChange: (field: keyof BPBusinessEntityForm, value: string | boolean) => void
  onFileUpload: (field: string, file: File) => Promise<void>
  isEditing: boolean
  uploadingField: string | null
}

const entityTypeOptions = Object.entries(ENTITY_TYPE_LABELS)
  .filter(([key]) => key !== 'INDIVIDUAL')
  .map(([value, label]) => ({ value, label }))

export default function BusinessEntitySection({
  data,
  formData,
  onChange,
  onFileUpload,
  isEditing,
  uploadingField,
}: BusinessEntitySectionProps) {
  const getVerificationStatusType = (status: VerificationStatusType | undefined): 'not_submitted' | 'pending' | 'verified' | 'failed' | 'expired' | 'rejected' => {
    if (!status) return 'not_submitted'
    const mapping: Record<VerificationStatusType, 'not_submitted' | 'pending' | 'verified' | 'failed' | 'expired' | 'rejected'> = {
      NOT_SUBMITTED: 'not_submitted',
      PENDING: 'pending',
      VERIFIED: 'verified',
      FAILED: 'failed',
      EXPIRED: 'expired',
      REJECTED: 'rejected',
    }
    return mapping[status] || 'not_submitted'
  }

  const handleFileChange = async (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await onFileUpload(field, file)
    }
  }

  const FileUploadField = ({
    label,
    field,
    currentUrl,
    verificationStatus,
  }: {
    label: string
    field: string
    currentUrl: string | null | undefined
    verificationStatus?: VerificationStatusType
  }) => {
    const inputRef = React.useRef<HTMLInputElement>(null)

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
                <span className="text-gray-400 text-xs mt-1">PDF, JPG, PNG (max 10MB)</span>
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
      title="Business Entity Details"
      icon={Building2}
      badge={
        data?.cin_verification_status === 'VERIFIED'
          ? { text: 'Verified', variant: 'success' }
          : { text: 'Pending', variant: 'warning' }
      }
    >
      <div className="space-y-6 mt-4">
        {/* Legal Entity Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            label="Legal Entity Name"
            icon={Building2}
            value={formData.legal_entity_name}
            onChange={(v) => onChange('legal_entity_name', v)}
            isEditing={isEditing}
            placeholder="Enter legal entity name"
            required
          />

          <FormField
            label="Trade / Brand Name"
            icon={Building2}
            value={formData.trade_name}
            onChange={(v) => onChange('trade_name', v)}
            isEditing={isEditing}
            placeholder="Enter trade/brand name"
            hint="Optional - if different from legal name"
          />

          <FormField
            label="Entity Type"
            icon={Building2}
            value={formData.entity_type}
            onChange={(v) => onChange('entity_type', v)}
            isEditing={isEditing}
            type="select"
            options={entityTypeOptions}
            required
          />

          <FormField
            label="Date of Incorporation"
            icon={Calendar}
            value={formData.date_of_incorporation}
            onChange={(v) => onChange('date_of_incorporation', v)}
            isEditing={isEditing}
            type="date"
            required
          />

          <div className="space-y-2">
            <FormField
              label="CIN / LLPIN / Registration No."
              icon={Hash}
              value={formData.cin_llpin}
              onChange={(v) => onChange('cin_llpin', v.toUpperCase())}
              isEditing={isEditing}
              placeholder="Enter CIN/LLPIN"
              required
              verificationStatus={getVerificationStatusType(data?.cin_verification_status)}
            />
          </div>
        </div>

        {/* CIN Document Upload */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FileUploadField
            label="Incorporation Certificate"
            field="cin_document_url"
            currentUrl={data?.cin_document_url}
            verificationStatus={data?.cin_verification_status}
          />
        </div>

        {/* Business PAN & GST */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" />
            Business Tax Details
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <FormField
                label="Business PAN"
                icon={Hash}
                value={formData.business_pan}
                onChange={(v) => onChange('business_pan', v.toUpperCase())}
                isEditing={isEditing}
                placeholder="e.g., AABCT1234F"
                maxLength={10}
                verificationStatus={getVerificationStatusType(data?.business_pan_verification_status)}
              />
            </div>

            <SwitchField
              label="GST Applicable"
              description="Is this entity registered for GST?"
              value={formData.gst_applicable}
              onChange={(v) => onChange('gst_applicable', v)}
              isEditing={isEditing}
            />

            {formData.gst_applicable && (
              <div className="space-y-2">
                <FormField
                  label="GSTIN"
                  icon={Hash}
                  value={formData.gstin}
                  onChange={(v) => onChange('gstin', v.toUpperCase())}
                  isEditing={isEditing}
                  placeholder="e.g., 22AAAAA0000A1Z5"
                  maxLength={15}
                  verificationStatus={getVerificationStatusType(data?.gst_verification_status)}
                />
              </div>
            )}
          </div>

          {/* Document Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <FileUploadField
              label="Business PAN Document"
              field="business_pan_document_url"
              currentUrl={data?.business_pan_document_url}
              verificationStatus={data?.business_pan_verification_status}
            />

            {formData.gst_applicable && (
              <FileUploadField
                label="GST Certificate"
                field="gst_certificate_url"
                currentUrl={data?.gst_certificate_url}
                verificationStatus={data?.gst_verification_status}
              />
            )}
          </div>
        </div>

        {/* Entity Documents based on type */}
        {(formData.entity_type === 'PARTNERSHIP' || formData.entity_type === 'LLP') && (
          <div className="border-t border-gray-700/50 pt-6">
            <h4 className="text-white font-medium mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-400" />
              Entity Documents
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.entity_type === 'PARTNERSHIP' && (
                <FileUploadField
                  label="Partnership Deed"
                  field="partnership_deed_url"
                  currentUrl={data?.partnership_deed_url}
                />
              )}
              {formData.entity_type === 'LLP' && (
                <FileUploadField
                  label="LLP Agreement"
                  field="llp_agreement_url"
                  currentUrl={data?.llp_agreement_url}
                />
              )}
            </div>
          </div>
        )}

        {(formData.entity_type === 'PRIVATE_LIMITED' || formData.entity_type === 'PUBLIC_LIMITED') && (
          <div className="border-t border-gray-700/50 pt-6">
            <h4 className="text-white font-medium mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-400" />
              Entity Documents
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileUploadField
                label="MOA & AOA"
                field="moa_aoa_url"
                currentUrl={data?.moa_aoa_url}
              />
              <FileUploadField
                label="Board Resolution"
                field="board_resolution_url"
                currentUrl={data?.board_resolution_url}
              />
            </div>
          </div>
        )}

        {/* Authorized Signatory */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-orange-400" />
            Authorized Signatory
          </h4>

          <SwitchField
            label="Same as Personal Profile"
            description="Use your personal details as authorized signatory"
            value={formData.is_signatory_same_as_personal}
            onChange={(v) => onChange('is_signatory_same_as_personal', v)}
            isEditing={isEditing}
            className="mb-4"
          />

          {!formData.is_signatory_same_as_personal && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                label="Signatory Name"
                icon={User}
                value={formData.authorized_signatory_name}
                onChange={(v) => onChange('authorized_signatory_name', v)}
                isEditing={isEditing}
                placeholder="Enter full name"
                required
              />

              <FormField
                label="Designation"
                icon={Building2}
                value={formData.authorized_signatory_designation}
                onChange={(v) => onChange('authorized_signatory_designation', v)}
                isEditing={isEditing}
                placeholder="e.g., Director, Partner"
                required
              />

              <FormField
                label="PAN Number"
                icon={Hash}
                value={formData.authorized_signatory_pan}
                onChange={(v) => onChange('authorized_signatory_pan', v.toUpperCase())}
                isEditing={isEditing}
                placeholder="e.g., ABCDE1234F"
                maxLength={10}
              />
            </div>
          )}
        </div>

        {/* Registered Office Address */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-400" />
            Registered Office Address
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Address Line 1"
              icon={MapPin}
              value={formData.registered_address_line1}
              onChange={(v) => onChange('registered_address_line1', v)}
              isEditing={isEditing}
              placeholder="Building, Street"
              required
            />

            <FormField
              label="Address Line 2"
              icon={MapPin}
              value={formData.registered_address_line2}
              onChange={(v) => onChange('registered_address_line2', v)}
              isEditing={isEditing}
              placeholder="Area, Landmark"
            />

            <FormField
              label="City"
              icon={MapPin}
              value={formData.registered_city}
              onChange={(v) => onChange('registered_city', v)}
              isEditing={isEditing}
              placeholder="Enter city"
              required
            />

            <FormField
              label="State"
              icon={MapPin}
              value={formData.registered_state}
              onChange={(v) => onChange('registered_state', v)}
              isEditing={isEditing}
              placeholder="Enter state"
              required
            />

            <FormField
              label="PIN Code"
              icon={Hash}
              value={formData.registered_pincode}
              onChange={(v) => onChange('registered_pincode', v.replace(/\D/g, ''))}
              isEditing={isEditing}
              placeholder="6-digit PIN"
              maxLength={6}
              required
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}
