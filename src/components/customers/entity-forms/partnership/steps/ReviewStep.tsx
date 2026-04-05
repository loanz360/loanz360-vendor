'use client'

import React from 'react'
import {
  Building2,
  Users,
  MapPin,
  FileCheck,
  CheckCircle,
  AlertCircle,
  Edit2,
  User,
  Phone,
  Mail,
  Percent
} from 'lucide-react'
import { PartnershipData } from '../../types/partnership'
import { NATURE_OF_BUSINESS_OPTIONS, BUSINESS_CATEGORY_OPTIONS } from '../../types'

interface ReviewStepProps {
  data: PartnershipData
  onEdit: (step: number) => void
}

interface ReviewCardProps {
  title: string
  icon: React.ReactNode
  step: number
  onEdit: (step: number) => void
  isComplete: boolean
  children: React.ReactNode
}

function ReviewCard({ title, icon, step, onEdit, isComplete, children }: ReviewCardProps) {
  return (
    <div className={`bg-gray-800/50 rounded-xl border p-6 ${
      isComplete ? 'border-orange-500/30' : 'border-yellow-500/30'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isComplete ? 'bg-orange-500/20' : 'bg-yellow-500/20'
          }`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <div className="flex items-center gap-1 text-sm">
              {isComplete ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-orange-400">Complete</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-400">Incomplete</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onEdit(step)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </button>
      </div>
      {children}
    </div>
  )
}

export default function ReviewStep({ data, onEdit }: ReviewStepProps) {
  // Defensive: ensure partners array exists
  const partners = data.partners || []

  // Check completion status for each section
  const isFirmDetailsComplete = !!(
    data.firm_name &&
    data.nature_of_business &&
    data.date_of_formation &&
    data.partnership_deed_number &&
    data.firm_pan
  )

  const isPartnersComplete = partners.length >= 2 &&
    partners.every(p => p.full_name && p.pan_number && p.partner_type) &&
    partners.some(p => p.partner_type === 'MANAGING_PARTNER')

  const isAddressComplete = !!(
    data.registered_address_line1 &&
    data.registered_city &&
    data.registered_state &&
    data.registered_pincode
  )

  const isDocumentsComplete = !!(
    data.partnership_deed_url &&
    data.firm_pan_url &&
    data.bank_statement_url
  )

  const isAllComplete = isFirmDetailsComplete && isPartnersComplete && isAddressComplete && isDocumentsComplete

  const getNatureLabel = (value: string) =>
    NATURE_OF_BUSINESS_OPTIONS.find(o => o.value === value)?.label || value

  const getCategoryLabel = (value: string) =>
    BUSINESS_CATEGORY_OPTIONS.find(o => o.value === value)?.label || value

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Review & Submit</h2>
        <p className="text-gray-400">Review your partnership details before submitting</p>
      </div>

      {/* Overall Status */}
      <div className={`p-4 rounded-xl border ${
        isAllComplete
          ? 'bg-orange-500/10 border-orange-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
      }`}>
        <div className="flex items-center gap-3">
          {isAllComplete ? (
            <CheckCircle className="w-6 h-6 text-orange-400" />
          ) : (
            <AlertCircle className="w-6 h-6 text-yellow-400" />
          )}
          <div>
            <p className={`font-medium ${isAllComplete ? 'text-orange-400' : 'text-yellow-400'}`}>
              {isAllComplete ? 'Ready to Submit' : 'Some sections need attention'}
            </p>
            <p className={`text-sm ${isAllComplete ? 'text-orange-300' : 'text-yellow-300'}`}>
              {isAllComplete
                ? 'All required information has been provided. You can now submit your profile.'
                : 'Please complete all required sections before submitting.'}
            </p>
          </div>
        </div>
      </div>

      {/* Review Cards */}
      <div className="space-y-4">
        {/* Firm Details */}
        <ReviewCard
          title="Firm Details"
          icon={<Building2 className={`w-5 h-5 ${isFirmDetailsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />}
          step={1}
          onEdit={onEdit}
          isComplete={isFirmDetailsComplete}
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Firm Name</span>
              <p className="text-white">{data.firm_name || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Trading Name</span>
              <p className="text-white">{data.trading_name || 'Same as firm name'}</p>
            </div>
            <div>
              <span className="text-gray-500">Nature of Business</span>
              <p className="text-white">{getNatureLabel(data.nature_of_business) || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Business Category</span>
              <p className="text-white">{getCategoryLabel(data.business_category) || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Date of Formation</span>
              <p className="text-white">{data.date_of_formation || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Firm PAN</span>
              <p className="text-white font-mono">{data.firm_pan || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">Partnership Deed No.</span>
              <p className="text-white">{data.partnership_deed_number || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">GSTIN</span>
              <p className="text-white font-mono">{data.gstin || 'Not Registered'}</p>
            </div>
          </div>
        </ReviewCard>

        {/* Partners */}
        <ReviewCard
          title={`Partners (${partners.length})`}
          icon={<Users className={`w-5 h-5 ${isPartnersComplete ? 'text-orange-400' : 'text-yellow-400'}`} />}
          step={2}
          onEdit={onEdit}
          isComplete={isPartnersComplete}
        >
          <div className="space-y-3">
            {partners.map((partner, index) => (
              <div
                key={partner.id}
                className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  partner.partner_type === 'MANAGING_PARTNER' ? 'bg-orange-500/20' : 'bg-gray-700'
                }`}>
                  <User className={`w-4 h-4 ${
                    partner.partner_type === 'MANAGING_PARTNER' ? 'text-orange-400' : 'text-gray-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{partner.full_name || `Partner ${index + 1}`}</p>
                    {partner.partner_type === 'MANAGING_PARTNER' && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                        Managing
                      </span>
                    )}
                    {partner.is_authorized_signatory && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                        Signatory
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span>PAN: {partner.pan_number || '-'}</span>
                    {partner.capital_contribution_percent && (
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Capital: {partner.capital_contribution_percent}%
                      </span>
                    )}
                    {partner.profit_sharing_percent && (
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Profit: {partner.profit_sharing_percent}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ReviewCard>

        {/* Address */}
        <ReviewCard
          title="Address"
          icon={<MapPin className={`w-5 h-5 ${isAddressComplete ? 'text-orange-400' : 'text-yellow-400'}`} />}
          step={3}
          onEdit={onEdit}
          isComplete={isAddressComplete}
        >
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-gray-500">Registered Office</span>
              <p className="text-white">
                {[
                  data.registered_address_line1,
                  data.registered_address_line2,
                  data.registered_city,
                  data.registered_state,
                  data.registered_pincode
                ].filter(Boolean).join(', ') || '-'}
              </p>
            </div>
            {!data.business_same_as_registered && data.business_address_line1 && (
              <div>
                <span className="text-gray-500">Business Address</span>
                <p className="text-white">
                  {[
                    data.business_address_line1,
                    data.business_address_line2,
                    data.business_city,
                    data.business_state,
                    data.business_pincode
                  ].filter(Boolean).join(', ') || '-'}
                </p>
              </div>
            )}
          </div>
        </ReviewCard>

        {/* Documents */}
        <ReviewCard
          title="Documents"
          icon={<FileCheck className={`w-5 h-5 ${isDocumentsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />}
          step={4}
          onEdit={onEdit}
          isComplete={isDocumentsComplete}
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Partnership Deed', value: data.partnership_deed_url },
              { label: 'Registration Certificate', value: data.registration_certificate_url },
              { label: 'Firm PAN Card', value: data.firm_pan_url },
              { label: 'Bank Statement', value: data.bank_statement_url },
              { label: 'Address Proof', value: data.address_proof_url },
              { label: 'ITR Documents', value: data.itr_documents_url },
              { label: 'GST Certificate', value: data.gst_certificate_url }
            ].map((doc) => (
              <div key={doc.label} className="flex items-center gap-2">
                {doc.value ? (
                  <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0" />
                )}
                <span className={doc.value ? 'text-white' : 'text-gray-500'}>{doc.label}</span>
              </div>
            ))}
          </div>
        </ReviewCard>
      </div>

      {/* Declaration */}
      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-400">
          By submitting this form, I declare that all the information provided is true and accurate
          to the best of my knowledge. I understand that any false information may result in the
          rejection of my application or termination of services.
        </p>
      </div>
    </div>
  )
}
