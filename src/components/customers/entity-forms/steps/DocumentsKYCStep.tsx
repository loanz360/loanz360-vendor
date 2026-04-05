'use client'

import React, { useCallback } from 'react'
import {
  FileCheck,
  CreditCard,
  Fingerprint,
  Camera,
  FileText,
  Building2,
  Award,
  Upload,
  CheckCircle,
  X,
  Loader2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { useS3Upload } from '@/hooks/useS3Upload'
import type { SoleProprietorshipStepProps, SoleProprietorshipData } from '../types'

interface DocumentConfig {
  key: keyof SoleProprietorshipData
  label: string
  icon: React.ElementType
  iconColor: string
  required: boolean
  description?: string
  acceptedFormats?: string
}

const DOCUMENT_CONFIGS: DocumentConfig[] = [
  {
    key: 'pan_document_url',
    label: 'PAN Card',
    icon: CreditCard,
    iconColor: 'text-orange-400',
    required: true,
    description: 'Upload clear copy of your PAN card'
  },
  {
    key: 'aadhaar_front_url',
    label: 'Aadhaar Card (Front)',
    icon: Fingerprint,
    iconColor: 'text-orange-400',
    required: true,
    description: 'Front side of your Aadhaar card'
  },
  {
    key: 'aadhaar_back_url',
    label: 'Aadhaar Card (Back)',
    icon: Fingerprint,
    iconColor: 'text-orange-400',
    required: true,
    description: 'Back side of your Aadhaar card'
  },
  {
    key: 'passport_photo_url',
    label: 'Passport Size Photo',
    icon: Camera,
    iconColor: 'text-orange-400',
    required: true,
    description: 'Recent passport size photograph'
  },
  {
    key: 'bank_statement_url',
    label: 'Bank Statement (3 months)',
    icon: FileText,
    iconColor: 'text-orange-400',
    required: true,
    description: 'Last 3 months bank statement'
  },
  {
    key: 'itr_documents_url',
    label: 'ITR Documents (Last 2 years)',
    icon: FileText,
    iconColor: 'text-yellow-400',
    required: false,
    description: 'Income Tax Returns for last 2 years'
  },
  {
    key: 'gst_certificate_url',
    label: 'GST Registration Certificate',
    icon: Building2,
    iconColor: 'text-orange-400',
    required: false,
    description: 'Only if GST registered'
  },
  {
    key: 'shop_license_document_url',
    label: 'Shop & Establishment License',
    icon: FileCheck,
    iconColor: 'text-orange-400',
    required: false,
    description: 'If applicable'
  },
  {
    key: 'udyam_certificate_url',
    label: 'UDYAM Registration Certificate',
    icon: Award,
    iconColor: 'text-orange-400',
    required: false,
    description: 'MSME registration certificate'
  },
  {
    key: 'business_address_proof_document_url',
    label: 'Business Address Proof',
    icon: Building2,
    iconColor: 'text-orange-400',
    required: true,
    description: 'Utility bill, rent agreement, or property document'
  }
]

export default function DocumentsKYCStep({
  data,
  errors,
  onUpdate
}: SoleProprietorshipStepProps) {
  // Create upload hooks for each document type
  const uploadHooks = {
    pan_document_url: useS3Upload(),
    aadhaar_front_url: useS3Upload(),
    aadhaar_back_url: useS3Upload(),
    passport_photo_url: useS3Upload(),
    bank_statement_url: useS3Upload(),
    itr_documents_url: useS3Upload(),
    gst_certificate_url: useS3Upload(),
    shop_license_document_url: useS3Upload(),
    udyam_certificate_url: useS3Upload(),
    business_address_proof_document_url: useS3Upload()
  }

  // Handle file upload
  const handleFileUpload = useCallback(async (
    file: File,
    documentKey: keyof SoleProprietorshipData
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

    const uploadHook = uploadHooks[documentKey as keyof typeof uploadHooks]
    if (!uploadHook) return

    try {
      const result = await uploadHook.upload(file, documentKey as string)

      if (result.success && result.url) {
        onUpdate({ [documentKey]: result.url })
        toast.success('Document uploaded successfully')
      } else {
        toast.error(result.error || 'Failed to upload document')
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload document')
    }
  }, [onUpdate, uploadHooks])

  // Remove uploaded document
  const handleRemoveDocument = useCallback((documentKey: keyof SoleProprietorshipData) => {
    onUpdate({ [documentKey]: '' })
  }, [onUpdate])

  // Render document upload card
  const renderDocumentCard = (config: DocumentConfig) => {
    const Icon = config.icon
    const documentUrl = data[config.key] as string
    const uploadHook = uploadHooks[config.key as keyof typeof uploadHooks]
    const isUploading = uploadHook?.isUploading || false
    const hasError = errors[config.key as string]

    return (
      <div
        key={config.key}
        className={`p-4 bg-gray-800/50 rounded-xl border transition-colors ${
          hasError
            ? 'border-red-500/50'
            : documentUrl
              ? 'border-orange-500/30'
              : 'border-gray-700'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${config.iconColor}`} />
            <span className="text-sm font-medium text-white">{config.label}</span>
            {config.required ? (
              <span className="text-xs text-red-400">*</span>
            ) : (
              <span className="text-xs text-gray-500">(Optional)</span>
            )}
          </div>
          {documentUrl && (
            <span className="flex items-center gap-1 text-orange-400 text-xs">
              <ShieldCheck className="w-3 h-3" /> Uploaded
            </span>
          )}
        </div>

        {/* Description */}
        {config.description && (
          <p className="text-xs text-gray-500 mb-3">{config.description}</p>
        )}

        {/* Upload Area or Uploaded State */}
        {documentUrl ? (
          <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <CheckCircle className="w-5 h-5 text-orange-400" />
            <span className="text-orange-400 text-sm flex-1">Document uploaded</span>
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 text-sm"
            >
              View
            </a>
            <button
              type="button"
              onClick={() => handleRemoveDocument(config.key)}
              className="text-gray-400 hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              hasError
                ? 'border-red-500 bg-red-500/5 hover:bg-red-500/10'
                : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-orange-500'
            }`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file, config.key)
              }}
              disabled={isUploading}
              className="hidden"
            />
            {isUploading ? (
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

        {/* Error Message */}
        {hasError && (
          <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors[config.key as string]}
          </p>
        )}
      </div>
    )
  }

  // Calculate completion stats
  const requiredDocs = DOCUMENT_CONFIGS.filter(d => d.required)
  const uploadedRequiredDocs = requiredDocs.filter(d => !!data[d.key])
  const completionPercent = Math.round((uploadedRequiredDocs.length / requiredDocs.length) * 100)

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <FileCheck className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Documents & KYC</h2>
            <p className="text-sm text-gray-400">
              Upload required documents for verification
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Document Upload Progress</span>
          <span className="text-sm font-medium text-white">
            {uploadedRequiredDocs.length}/{requiredDocs.length} Required Documents
          </span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              completionPercent === 100
                ? 'bg-orange-500'
                : completionPercent >= 50
                  ? 'bg-yellow-500'
                  : 'bg-orange-500'
            }`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* Identity Documents */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-orange-400" />
          Identity Documents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOCUMENT_CONFIGS.filter(d =>
            ['pan_document_url', 'aadhaar_front_url', 'aadhaar_back_url', 'passport_photo_url'].includes(d.key as string)
          ).map(renderDocumentCard)}
        </div>
      </div>

      {/* Financial Documents */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-orange-400" />
          Financial Documents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOCUMENT_CONFIGS.filter(d =>
            ['bank_statement_url', 'itr_documents_url'].includes(d.key as string)
          ).map(renderDocumentCard)}
        </div>
      </div>

      {/* Business Documents */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-orange-400" />
          Business Documents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOCUMENT_CONFIGS.filter(d =>
            ['gst_certificate_url', 'shop_license_document_url', 'udyam_certificate_url', 'business_address_proof_document_url'].includes(d.key as string)
          ).map(renderDocumentCard)}
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <FileCheck className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-400 font-medium text-sm">Document Guidelines</p>
            <ul className="text-orange-300 text-xs mt-2 space-y-1">
              <li>• All documents must be clear and readable</li>
              <li>• Accepted formats: JPG, PNG, WebP, PDF</li>
              <li>• Maximum file size: 5MB per document</li>
              <li>• Ensure all details are visible and not cropped</li>
              <li>• Documents with watermarks may be rejected</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
