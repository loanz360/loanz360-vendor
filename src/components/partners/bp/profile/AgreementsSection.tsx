'use client'

import React, { useRef } from 'react'
import {
  FileText,
  Signature,
  Shield,
  CheckCircle,
  Clock,
  Upload,
  Download,
  ExternalLink,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import { SwitchField } from '@/components/partners/shared/FormField'
import type { BPAgreements, BPAgreementsForm } from '@/types/bp-profile'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

interface AgreementsSectionProps {
  data: BPAgreements | null
  formData: BPAgreementsForm
  onChange: (field: keyof BPAgreementsForm, value: boolean) => void
  onSignatureUpload?: (file: File) => Promise<void>
  isEditing: boolean
  uploadingSignature?: boolean
}

export default function AgreementsSection({
  data,
  formData,
  onChange,
  onSignatureUpload,
  isEditing,
  uploadingSignature = false,
}: AgreementsSectionProps) {
  const signatureInputRef = useRef<HTMLInputElement>(null)

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onSignatureUpload) {
      await onSignatureUpload(file)
    }
  }

  const isAgreementExpiringSoon = () => {
    if (!data?.agreement_expiry_date) return false
    const expiryDate = new Date(data.agreement_expiry_date)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    return expiryDate <= thirtyDaysFromNow
  }

  return (
    <CollapsibleSection
      title="Agreements & Consents"
      icon={FileText}
      badge={
        data?.agreement_signed
          ? { text: 'Signed', variant: 'success' }
          : { text: 'Pending', variant: 'warning' }
      }
    >
      <div className="space-y-6 mt-4">
        {/* Partner Agreement Status */}
        <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2 rounded-lg',
                  data?.agreement_signed ? 'bg-green-500/10' : 'bg-yellow-500/10'
                )}
              >
                <FileText
                  className={cn(
                    'w-5 h-5',
                    data?.agreement_signed ? 'text-green-400' : 'text-yellow-400'
                  )}
                />
              </div>
              <div>
                <h4 className="text-white font-medium">Business Partner Agreement</h4>
                <p className="text-gray-400 text-sm">
                  Version {data?.agreement_version || 'Not Available'}
                </p>
              </div>
            </div>

            {data?.agreement_signed ? (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Signed</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-400">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Pending</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Signed Date</p>
              <p className="text-white font-medium">
                {formatDate(data?.agreement_signed_date)}
              </p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Expiry Date</p>
              <p
                className={cn(
                  'font-medium',
                  isAgreementExpiringSoon() ? 'text-yellow-400' : 'text-white'
                )}
              >
                {formatDate(data?.agreement_expiry_date)}
                {isAgreementExpiringSoon() && (
                  <AlertTriangle className="w-4 h-4 inline ml-2" />
                )}
              </p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">Signed From IP</p>
              <p className="text-white font-medium font-mono text-sm">
                {data?.agreement_signed_ip || 'N/A'}
              </p>
            </div>
          </div>

          {data?.agreement_document_url && (
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                asChild
              >
                <a href={data.agreement_document_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Agreement
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-400 hover:bg-gray-800"
                asChild
              >
                <a href={data.agreement_document_url} download>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Digital Signature */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Signature className="w-4 h-4 text-orange-400" />
            Digital Signature
          </h4>

          <div className="flex items-center gap-6">
            {data?.digital_signature_url ? (
              <div className="p-4 bg-white rounded-lg">
                <Image
                  src={data.digital_signature_url}
                  alt="Digital Signature"
                  width={200}
                  height={64}
                  className="h-16 w-auto"
                />
              </div>
            ) : (
              <div className="p-8 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center">
                <div className="text-center">
                  <Signature className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No signature uploaded</p>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="space-y-2">
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/png"
                  onChange={handleSignatureUpload}
                  className="hidden"
                  disabled={uploadingSignature}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={uploadingSignature}
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingSignature
                    ? 'Uploading...'
                    : data?.digital_signature_url
                    ? 'Change Signature'
                    : 'Upload Signature'}
                </Button>
                <p className="text-gray-500 text-xs">
                  PNG with transparent background recommended
                </p>
              </div>
            )}

            {data?.digital_signature_uploaded_at && (
              <div className="text-gray-400 text-sm">
                <Calendar className="w-4 h-4 inline mr-1" />
                Uploaded: {formatDate(data.digital_signature_uploaded_at)}
              </div>
            )}
          </div>
        </div>

        {/* Policy Consents */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" />
            Policy Consents
          </h4>

          <div className="space-y-4">
            <SwitchField
              label="Code of Conduct"
              description="I agree to abide by the Loans360 Partner Code of Conduct"
              icon={Shield}
              value={formData.code_of_conduct_accepted}
              onChange={(v) => onChange('code_of_conduct_accepted', v)}
              isEditing={isEditing}
            />

            <SwitchField
              label="Privacy Policy"
              description="I have read and accept the Privacy Policy"
              icon={Shield}
              value={formData.privacy_policy_accepted}
              onChange={(v) => onChange('privacy_policy_accepted', v)}
              isEditing={isEditing}
            />

            <SwitchField
              label="Data Sharing Consent"
              description="I consent to sharing my data with lending partners for lead processing"
              icon={Shield}
              value={formData.data_sharing_consent}
              onChange={(v) => onChange('data_sharing_consent', v)}
              isEditing={isEditing}
            />

            <SwitchField
              label="Marketing Communications"
              description="I agree to receive marketing communications and promotional offers"
              icon={Shield}
              value={formData.marketing_consent}
              onChange={(v) => onChange('marketing_consent', v)}
              isEditing={isEditing}
            />

            <SwitchField
              label="WhatsApp Communications"
              description="I agree to receive important updates and notifications via WhatsApp"
              icon={Shield}
              value={formData.whatsapp_consent}
              onChange={(v) => onChange('whatsapp_consent', v)}
              isEditing={isEditing}
            />
          </div>
        </div>

        {/* Consent Timestamps */}
        {!isEditing && (data?.terms_conditions_accepted_at || data?.privacy_policy_accepted_at) && (
          <div className="border-t border-gray-700/50 pt-6">
            <h4 className="text-gray-400 text-sm mb-3">Consent Timestamps</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data?.code_of_conduct_accepted_at && (
                <div className="p-3 bg-gray-800/30 rounded-lg">
                  <p className="text-gray-500 text-xs">Code of Conduct Accepted</p>
                  <p className="text-white text-sm">{formatDate(data.code_of_conduct_accepted_at)}</p>
                </div>
              )}
              {data?.privacy_policy_accepted_at && (
                <div className="p-3 bg-gray-800/30 rounded-lg">
                  <p className="text-gray-500 text-xs">Privacy Policy Accepted</p>
                  <p className="text-white text-sm">
                    {formatDate(data.privacy_policy_accepted_at)}
                    {data.privacy_policy_version && (
                      <span className="text-gray-500 ml-2">v{data.privacy_policy_version}</span>
                    )}
                  </p>
                </div>
              )}
              {data?.data_sharing_consent_at && (
                <div className="p-3 bg-gray-800/30 rounded-lg">
                  <p className="text-gray-500 text-xs">Data Sharing Consent</p>
                  <p className="text-white text-sm">{formatDate(data.data_sharing_consent_at)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
