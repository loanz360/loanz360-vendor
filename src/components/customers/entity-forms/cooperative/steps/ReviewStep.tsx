'use client'

import React from 'react'
import { CheckCircle, Edit2, AlertCircle, Building2, Users, MapPin, FileText } from 'lucide-react'
import { CooperativeData, COOPERATIVE_TYPE_OPTIONS, BOARD_DESIGNATION_OPTIONS } from '../../types/cooperative'

interface ReviewStepProps {
  data: CooperativeData
  onEdit: (step: number) => void
}

interface SectionCardProps {
  title: string
  icon: React.ElementType
  stepNumber: number
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
  const board_members = data.board_members || []

  const societyComplete = !!(data.society_name && data.registration_number && data.society_pan && data.cooperative_type)
  const boardComplete = board_members.some(m => m.designation === 'CHAIRMAN' && m.full_name && m.pan_number)
  const addressComplete = !!(data.registered_address_line1 && data.registered_city && data.registered_state && data.registered_pincode)
  const documentsComplete = !!(data.registration_certificate_url && data.society_pan_url)

  const allComplete = societyComplete && boardComplete && addressComplete && documentsComplete

  const cooperativeTypeLabel = COOPERATIVE_TYPE_OPTIONS.find(o => o.value === data.cooperative_type)?.label

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
        {/* Society Details */}
        <SectionCard
          title="Society Details"
          icon={Building2}
          stepNumber={1}
          isComplete={societyComplete}
          onEdit={() => onEdit(1)}
        >
          <InfoRow label="Society Name" value={data.society_name} />
          <InfoRow label="Registration Number" value={data.registration_number} />
          <InfoRow label="Cooperative Type" value={cooperativeTypeLabel} />
          <InfoRow label="Society PAN" value={data.society_pan} />
          <InfoRow label="Number of Members" value={data.number_of_members} />
          {data.gstin && <InfoRow label="GSTIN" value={data.gstin} />}
        </SectionCard>

        {/* Board Members */}
        <SectionCard
          title="Board Members"
          icon={Users}
          stepNumber={2}
          isComplete={boardComplete}
          onEdit={() => onEdit(2)}
        >
          {board_members.filter(m => m.full_name).length > 0 ? (
            <>
              <p className="text-gray-400 mb-2">
                {board_members.filter(m => m.full_name).length} member(s) added
              </p>
              {board_members.filter(m => m.full_name).map((member, index) => (
                <div key={index} className="flex justify-between py-1 border-t border-gray-700">
                  <span className="text-gray-300">{member.full_name}</span>
                  <span className="text-orange-400 text-xs">
                    {BOARD_DESIGNATION_OPTIONS.find(d => d.value === member.designation)?.label}
                    {member.is_authorized_signatory && ' (Signatory)'}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p className="text-yellow-400">No board members added</p>
          )}
        </SectionCard>

        {/* Address */}
        <SectionCard
          title="Registered Office Address"
          icon={MapPin}
          stepNumber={3}
          isComplete={addressComplete}
          onEdit={() => onEdit(3)}
        >
          {addressComplete ? (
            <p className="text-white">
              {data.registered_address_line1}
              {data.registered_address_line2 && `, ${data.registered_address_line2}`}
              <br />
              {data.registered_city}, {data.registered_state} - {data.registered_pincode}
            </p>
          ) : (
            <p className="text-yellow-400">Address not provided</p>
          )}
        </SectionCard>

        {/* Documents */}
        <SectionCard
          title="Documents"
          icon={FileText}
          stepNumber={4}
          isComplete={documentsComplete}
          onEdit={() => onEdit(4)}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              {data.registration_certificate_url ? (
                <CheckCircle className="w-4 h-4 text-orange-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              )}
              <span className={data.registration_certificate_url ? 'text-white' : 'text-gray-400'}>
                Registration Certificate
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.society_pan_url ? (
                <CheckCircle className="w-4 h-4 text-orange-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              )}
              <span className={data.society_pan_url ? 'text-white' : 'text-gray-400'}>
                Society PAN
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.bye_laws_url ? (
                <CheckCircle className="w-4 h-4 text-orange-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-gray-600" />
              )}
              <span className={data.bye_laws_url ? 'text-white' : 'text-gray-400'}>
                Bye-Laws
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.resolution_url ? (
                <CheckCircle className="w-4 h-4 text-orange-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-gray-600" />
              )}
              <span className={data.resolution_url ? 'text-white' : 'text-gray-400'}>
                Board Resolution
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
