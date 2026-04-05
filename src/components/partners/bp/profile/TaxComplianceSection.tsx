'use client'

import React from 'react'
import {
  Receipt,
  Percent,
  FileText,
  Shield,
  CheckCircle,
  AlertTriangle,
  Info,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import FormField, { SwitchField } from '@/components/partners/shared/FormField'
import { VerificationStatus } from '@/components/partners/shared/StatusIndicator'
import type {
  BPTaxCompliance,
  BPTaxComplianceForm,
  VerificationStatus as VerificationStatusType,
} from '@/types/bp-profile'
import { INCOME_TAX_CATEGORY_LABELS } from '@/types/bp-profile'
import { cn } from '@/lib/utils/cn'

interface TaxComplianceSectionProps {
  data: BPTaxCompliance | null
  formData: BPTaxComplianceForm
  onChange: (field: keyof BPTaxComplianceForm, value: string | boolean) => void
  onFileUpload?: (field: string, file: File) => Promise<void>
  isEditing: boolean
  uploadingField?: string | null
}

const incomeTaxCategoryOptions = Object.entries(INCOME_TAX_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
)

const tdsPercentageOptions = [
  { value: '1', label: '1%' },
  { value: '2', label: '2%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '20', label: '20%' },
]

export default function TaxComplianceSection({
  data,
  formData,
  onChange,
  onFileUpload,
  isEditing,
  uploadingField,
}: TaxComplianceSectionProps) {
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

  const getEligibilityStatus = () => {
    if (!data) return null

    const statusConfig = {
      ELIGIBLE: {
        icon: CheckCircle,
        text: 'Eligible for Commission',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        textColor: 'text-green-400',
      },
      INELIGIBLE: {
        icon: AlertTriangle,
        text: 'Not Eligible for Commission',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
      },
      SUSPENDED: {
        icon: AlertTriangle,
        text: 'Commission Suspended',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        textColor: 'text-yellow-400',
      },
      PENDING_REVIEW: {
        icon: Info,
        text: 'Under Review',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        textColor: 'text-blue-400',
      },
    }

    const config = statusConfig[data.commission_eligibility_status]
    if (!config) return null

    return (
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border',
          config.bgColor,
          config.borderColor
        )}
      >
        <config.icon className={cn('w-5 h-5 mt-0.5', config.textColor)} />
        <div>
          <p className={cn('font-medium', config.textColor)}>{config.text}</p>
          {data.commission_ineligibility_reason && (
            <p className="text-gray-400 text-sm mt-1">
              {data.commission_ineligibility_reason}
            </p>
          )}
        </div>
      </div>
    )
  }

  const handleFileChange = async (
    field: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (file && onFileUpload) {
      await onFileUpload(field, file)
    }
  }

  const gstCertificateRef = React.useRef<HTMLInputElement>(null)

  return (
    <CollapsibleSection
      title="Tax & Commission Compliance"
      icon={Receipt}
      badge={
        data?.commission_eligibility_status === 'ELIGIBLE'
          ? { text: 'Eligible', variant: 'success' }
          : data?.commission_eligibility_status === 'PENDING_REVIEW'
          ? { text: 'Under Review', variant: 'warning' }
          : { text: 'Check Status', variant: 'default' }
      }
    >
      <div className="space-y-6 mt-4">
        {/* Commission Eligibility Status */}
        {getEligibilityStatus()}

        {/* GST on Commission */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-orange-400" />
            GST Configuration
          </h4>

          <SwitchField
            label="GST Applicable on Commission"
            description="Are you registered for GST and will invoice with GST?"
            icon={Receipt}
            value={formData.gst_on_commission}
            onChange={(v) => onChange('gst_on_commission', v)}
            isEditing={isEditing}
            className="mb-4"
          />

          {formData.gst_on_commission && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <FormField
                  label="GSTIN"
                  icon={FileText}
                  value={formData.gstin}
                  onChange={(v) => onChange('gstin', v.toUpperCase())}
                  isEditing={isEditing}
                  placeholder="e.g., 22AAAAA0000A1Z5"
                  maxLength={15}
                  required
                  verificationStatus={getVerificationStatusType(data?.gst_verification_status)}
                />
              </div>

              {/* GST Certificate Upload */}
              <div className="space-y-2">
                <label className="text-gray-400 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  GST Certificate
                </label>
                {!isEditing ? (
                  <div className="flex items-center gap-3">
                    {data?.gst_certificate_url ? (
                      <>
                        <a
                          href={data.gst_certificate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 text-sm underline"
                        >
                          View Certificate
                        </a>
                        <VerificationStatus
                          status={getVerificationStatusType(data?.gst_verification_status)}
                          size="sm"
                        />
                      </>
                    ) : (
                      <span className="text-gray-500 text-sm italic">Not uploaded</span>
                    )}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-700/50 rounded-lg p-4">
                    {data?.gst_certificate_url ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <span className="text-green-400 text-sm">Uploaded</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => gstCertificateRef.current?.click()}
                          disabled={uploadingField === 'gst_certificate_url'}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-white text-sm">
                          {uploadingField === 'gst_certificate_url'
                            ? 'Uploading...'
                            : 'Upload GST Certificate'}
                        </span>
                      </label>
                    )}
                    <input
                      ref={gstCertificateRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('gst_certificate_url', e)}
                      className="hidden"
                      disabled={uploadingField === 'gst_certificate_url'}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* TDS Configuration */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Percent className="w-4 h-4 text-orange-400" />
            TDS Configuration
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SwitchField
              label="TDS Applicable"
              description="Will TDS be deducted from your commission?"
              icon={Percent}
              value={formData.tds_applicable}
              onChange={(v) => onChange('tds_applicable', v)}
              isEditing={isEditing}
            />

            {formData.tds_applicable && (
              <FormField
                label="TDS Percentage"
                icon={Percent}
                value={formData.tds_percentage}
                onChange={(v) => onChange('tds_percentage', v)}
                isEditing={isEditing}
                type="select"
                options={tdsPercentageOptions}
                required
                hint="Standard TDS rate for commission income"
              />
            )}
          </div>

          {/* TDS Information */}
          {formData.tds_applicable && (
            <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-blue-400 font-medium">TDS Information</p>
                  <p className="text-gray-400 text-sm mt-1">
                    TDS at {formData.tds_percentage}% will be deducted from your commission
                    payouts as per Income Tax Act. You can claim this TDS credit while filing
                    your Income Tax Return.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Income Tax Details */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" />
            Income Tax Details
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Income Tax Category"
              icon={Shield}
              value={formData.income_tax_category}
              onChange={(v) => onChange('income_tax_category', v)}
              isEditing={isEditing}
              type="select"
              options={incomeTaxCategoryOptions}
              hint="Your tax filing category"
            />

            <FormField
              label="TAN Number"
              icon={FileText}
              value={formData.tan_number}
              onChange={(v) => onChange('tan_number', v.toUpperCase())}
              isEditing={isEditing}
              placeholder="e.g., DELA12345F"
              maxLength={10}
              hint="Tax Deduction Account Number (if applicable)"
            />
          </div>
        </div>

        {/* Compliance Notice */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
            <div>
              <p className="text-orange-400 font-medium">Compliance Reminder</p>
              <p className="text-gray-400 text-sm mt-1">
                Ensure your tax information is accurate and up-to-date. Incorrect tax
                details may result in commission payout delays or eligibility issues.
                Contact support if you need assistance with tax documentation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}
