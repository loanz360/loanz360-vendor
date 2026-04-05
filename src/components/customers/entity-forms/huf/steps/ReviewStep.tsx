'use client'

import React from 'react'
import { CheckCircle, Edit2, AlertCircle, Home, User, Users, MapPin, FileText } from 'lucide-react'
import { HUFData, RELATIONSHIP_TO_KARTA_OPTIONS, ANNUAL_INCOME_RANGE_OPTIONS, HUF_BUSINESS_OPTIONS } from '../../types/huf'

interface ReviewStepProps {
  data: HUFData
  onEdit: (step: number) => void
}

interface SectionCardProps {
  title: string
  icon: React.ElementType
  isComplete: boolean
  onEdit: () => void
  children: React.ReactNode
}

function SectionCard({ title, icon: Icon, isComplete, onEdit, children }: SectionCardProps) {
  return (
    <div className={`bg-gray-800/50 rounded-xl p-5 border ${isComplete ? 'border-orange-500/30' : 'border-yellow-500/30'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isComplete ? 'bg-orange-500/20' : 'bg-yellow-500/20'}`}>
            <Icon className={`w-5 h-5 ${isComplete ? 'text-orange-400' : 'text-yellow-400'}`} />
          </div>
          <div>
            <h3 className="text-white font-medium">{title}</h3>
            <div className="flex items-center gap-1 text-xs">
              {isComplete ? (
                <>
                  <CheckCircle className="w-3 h-3 text-orange-400" />
                  <span className="text-orange-400">Complete</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-yellow-400" />
                  <span className="text-yellow-400">Needs attention</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </button>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{value || '-'}</span>
    </div>
  )
}

export default function ReviewStep({ data, onEdit }: ReviewStepProps) {
  const coparceners = data.coparceners || []

  const hufComplete = !!(data.huf_name && data.huf_pan)
  const kartaComplete = !!(data.karta.full_name && data.karta.pan_number && data.karta.mobile)
  const coparcenersComplete = coparceners.some(c => c.full_name && c.relationship_to_karta)
  const addressComplete = !!(data.huf_address_line1 && data.huf_city && data.huf_state && data.huf_pincode)
  const documentsComplete = !!(data.huf_pan_url && data.bank_statement_url)

  const allComplete = hufComplete && kartaComplete && addressComplete && documentsComplete

  const businessLabel = HUF_BUSINESS_OPTIONS.find(o => o.value === data.nature_of_huf_business)?.label
  const incomeLabel = ANNUAL_INCOME_RANGE_OPTIONS.find(o => o.value === data.annual_income_range)?.label

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Review & Submit</h2>
          <p className="text-gray-400 text-sm">Review your information before submitting</p>
        </div>
      </div>

      {!allComplete && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">Some sections need attention</p>
              <p className="text-yellow-300 text-sm mt-1">
                Please complete all required fields before submitting your profile.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* HUF Details */}
        <SectionCard
          title="HUF Details"
          icon={Home}
          isComplete={hufComplete}
          onEdit={() => onEdit(1)}
        >
          <InfoRow label="HUF Name" value={data.huf_name} />
          <InfoRow label="HUF PAN" value={data.huf_pan} />
          <InfoRow label="Nature of Business" value={businessLabel} />
          <InfoRow label="Annual Income" value={incomeLabel} />
          {data.gstin && <InfoRow label="GSTIN" value={data.gstin} />}
        </SectionCard>

        {/* Karta Details */}
        <SectionCard
          title="Karta Details"
          icon={User}
          isComplete={kartaComplete}
          onEdit={() => onEdit(2)}
        >
          <InfoRow label="Name" value={data.karta.full_name} />
          <InfoRow label="PAN" value={data.karta.pan_number} />
          <InfoRow label="Mobile" value={data.karta.mobile} />
          <InfoRow label="Email" value={data.karta.email} />
        </SectionCard>

        {/* Coparceners */}
        <SectionCard
          title="Coparceners"
          icon={Users}
          isComplete={coparcenersComplete}
          onEdit={() => onEdit(3)}
        >
          {coparceners.filter(c => c.full_name).length > 0 ? (
            <>
              <p className="text-gray-400 mb-2">
                {coparceners.filter(c => c.full_name).length} coparcener(s) added
              </p>
              {coparceners.filter(c => c.full_name).map((member, index) => (
                <div key={index} className="flex justify-between py-1 border-t border-gray-700">
                  <span className="text-gray-300">{member.full_name}</span>
                  <span className="text-orange-400 text-xs">
                    {RELATIONSHIP_TO_KARTA_OPTIONS.find(r => r.value === member.relationship_to_karta)?.label}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p className="text-gray-400">No coparceners added</p>
          )}
        </SectionCard>

        {/* Address */}
        <SectionCard
          title="HUF Address"
          icon={MapPin}
          isComplete={addressComplete}
          onEdit={() => onEdit(4)}
        >
          {addressComplete ? (
            <p className="text-white">
              {data.huf_address_line1}
              {data.huf_address_line2 && `, ${data.huf_address_line2}`}
              <br />
              {data.huf_city}, {data.huf_state} - {data.huf_pincode}
            </p>
          ) : (
            <p className="text-yellow-400">Address not provided</p>
          )}
        </SectionCard>

        {/* Documents */}
        <SectionCard
          title="Documents"
          icon={FileText}
          isComplete={documentsComplete}
          onEdit={() => onEdit(5)}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              {data.huf_pan_url ? (
                <CheckCircle className="w-4 h-4 text-orange-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              )}
              <span className={data.huf_pan_url ? 'text-white' : 'text-gray-400'}>
                HUF PAN
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.bank_statement_url ? (
                <CheckCircle className="w-4 h-4 text-orange-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              )}
              <span className={data.bank_statement_url ? 'text-white' : 'text-gray-400'}>
                Bank Statement
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.huf_deed_url ? (
                <CheckCircle className="w-4 h-4 text-orange-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-gray-600" />
              )}
              <span className={data.huf_deed_url ? 'text-white' : 'text-gray-400'}>
                HUF Deed
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.karta_pan_url ? (
                <CheckCircle className="w-4 h-4 text-orange-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-gray-600" />
              )}
              <span className={data.karta_pan_url ? 'text-white' : 'text-gray-400'}>
                Karta PAN
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      {allComplete && (
        <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-400 font-medium">Ready to submit!</p>
              <p className="text-orange-300 text-sm mt-1">
                All required information has been provided. Click "Submit Profile" to complete your registration.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
