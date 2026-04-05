'use client'

import React, { useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CreditCard,
  Building2,
  Hash,
  CheckCircle,
  Upload,
  Info
} from 'lucide-react'
import type { PartnerProfileData } from '@/types/partner-profile'
import { validateIFSC, validateMICR } from '@/types/partner-profile'

interface BankDetailsSectionProps {
  profileData: PartnerProfileData
  onChange: (field: keyof PartnerProfileData, value: string | null) => void
  onFileUpload: (field: keyof PartnerProfileData, file: File) => Promise<void>
  uploadingField: string | null
  readonly?: boolean
}

export default function BankDetailsSection({
  profileData,
  onChange,
  onFileUpload,
  uploadingField,
  readonly = false,
}: BankDetailsSectionProps) {
  const cancelledChequeRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (
    field: keyof PartnerProfileData,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      await onFileUpload(field, file)
    }
  }

  // Validate IFSC code in real-time
  const isIFSCValid = profileData.ifsc_code ? validateIFSC(profileData.ifsc_code) : true
  const isMICRValid = profileData.micr_code ? validateMICR(profileData.micr_code) : true

  return (
    <Card className="bg-brand-card border-brand-card-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-brand-primary" />
          Bank Details (For Payout)
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Your commission payouts will be credited to this bank account
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bank Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bank Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={profileData.bank_name}
              onChange={(e) => onChange('bank_name', e.target.value)}
              placeholder="e.g., State Bank of India, HDFC Bank, ICICI Bank"
              disabled={readonly}
              className="w-full bg-brand-black text-white border border-white/20 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>
        </div>

        {/* Branch Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Branch Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={profileData.branch_name}
              onChange={(e) => onChange('branch_name', e.target.value)}
              placeholder="e.g., Connaught Place Branch, Mumbai Main Branch"
              disabled={readonly}
              className="w-full bg-brand-black text-white border border-white/20 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
            />
          </div>
        </div>

        {/* Account Holder Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Account Holder Name <span className="text-red-400">*</span>
          </label>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2 flex items-start gap-2">
            <Info className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-400">
              Should match your firm name if applicable, or your full name as per bank records
            </p>
          </div>
          <input
            type="text"
            value={profileData.account_holder_name}
            onChange={(e) => onChange('account_holder_name', e.target.value)}
            placeholder="Enter account holder name as per bank"
            disabled={readonly}
            className="w-full bg-brand-black text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
          />
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bank Account Number <span className="text-red-400">*</span>
          </label>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2 flex items-start gap-2">
            <Info className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-400">
              All payouts will be credited to this account number. Please verify carefully.
            </p>
          </div>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={profileData.account_number}
              onChange={(e) => onChange('account_number', e.target.value.replace(/\D/g, ''))}
              placeholder="Enter bank account number (9-18 digits)"
              maxLength={18}
              disabled={readonly}
              className="w-full bg-brand-black text-white border border-white/20 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 font-mono tracking-wider"
            />
          </div>
        </div>

        {/* IFSC Code */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            IFSC Code <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={profileData.ifsc_code}
              onChange={(e) => onChange('ifsc_code', e.target.value.toUpperCase())}
              placeholder="e.g., SBIN0001234 (11 characters)"
              maxLength={11}
              disabled={readonly}
              className={`w-full bg-brand-black text-white border rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 disabled:opacity-50 font-mono tracking-wider ${
                profileData.ifsc_code && !isIFSCValid
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-white/20 focus:ring-brand-primary'
              }`}
            />
          </div>
          {profileData.ifsc_code && !isIFSCValid && (
            <p className="text-xs text-red-400 mt-1">
              Invalid IFSC format. Should be like: SBIN0001234 (4 letters + 0 + 6 alphanumeric)
            </p>
          )}
          {profileData.ifsc_code && isIFSCValid && (
            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Valid IFSC code format
            </p>
          )}
        </div>

        {/* MICR Code (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            MICR Code <span className="text-gray-500 text-xs">(Optional - 9 digits)</span>
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={profileData.micr_code || ''}
              onChange={(e) => onChange('micr_code', e.target.value.replace(/\D/g, ''))}
              placeholder="e.g., 110002001 (optional)"
              maxLength={9}
              disabled={readonly}
              className={`w-full bg-brand-black text-white border rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 disabled:opacity-50 font-mono tracking-wider ${
                profileData.micr_code && !isMICRValid
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-white/20 focus:ring-brand-primary'
              }`}
            />
          </div>
          {profileData.micr_code && !isMICRValid && (
            <p className="text-xs text-red-400 mt-1">
              MICR code must be exactly 9 digits
            </p>
          )}
          {profileData.micr_code && isMICRValid && (
            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Valid MICR code format
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-6" />

        {/* Upload Cancelled Cheque */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Upload Cancelled Cheque <span className="text-red-400">*</span>
            <span className="text-gray-500 text-xs ml-2">(Image or PDF, max 5MB)</span>
          </label>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-400">
              <p className="font-medium mb-1">Why do we need a cancelled cheque?</p>
              <p>
                A cancelled cheque helps us verify your bank account details (Account number, IFSC, Account holder name).
                This ensures accurate payout processing.
              </p>
            </div>
          </div>

          <div className="border-2 border-dashed border-white/20 rounded-lg p-6">
            {profileData.cancelled_cheque_url ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-green-400" />
                </div>
                <p className="text-green-400 text-center font-medium">
                  Cancelled cheque uploaded successfully
                </p>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href={profileData.cancelled_cheque_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary hover:text-brand-primary/80 text-sm underline"
                  >
                    View uploaded document
                  </a>
                  {!readonly && (
                    <>
                      <span className="text-gray-500">|</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelledChequeRef.current?.click()}
                        disabled={uploadingField === 'cancelled_cheque_url'}
                        className="text-white hover:text-brand-primary"
                      >
                        Upload different file
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center">
                <input
                  ref={cancelledChequeRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange('cancelled_cheque_url', e)}
                  className="hidden"
                  disabled={readonly || uploadingField === 'cancelled_cheque_url'}
                />
                <Upload className="w-12 h-12 text-gray-400 mb-3" />
                <p className="text-white text-center mb-1">
                  {uploadingField === 'cancelled_cheque_url'
                    ? 'Uploading...'
                    : 'Click to upload cancelled cheque'}
                </p>
                <p className="text-gray-400 text-sm text-center">
                  Supported formats: JPG, PNG, PDF (max 5MB)
                </p>
                <p className="text-gray-500 text-xs text-center mt-2">
                  Write &quot;CANCELLED&quot; across the cheque before uploading
                </p>
              </label>
            )}
          </div>
        </div>

        {/* Information Alert */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-brand-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-white mb-1">Important Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Ensure all bank details are correct and match your cancelled cheque</li>
                <li>Payouts will be processed to this account only</li>
                <li>Any changes to bank details will require re-verification</li>
                <li>Keep your cancelled cheque and account details up to date</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
