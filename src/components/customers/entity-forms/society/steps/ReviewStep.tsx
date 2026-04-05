'use client'

import React from 'react'
import { Users2, Users, MapPin, FileCheck, CheckCircle, AlertCircle, Edit2 } from 'lucide-react'
import { SocietyData, GB_DESIGNATION_OPTIONS } from '../../types/society'

interface ReviewStepProps { data: SocietyData; onEdit: (step: number) => void }
interface ReviewCardProps { title: string; icon: React.ReactNode; step: number; onEdit: (s: number) => void; isComplete: boolean; children: React.ReactNode }

function ReviewCard({ title, icon, step, onEdit, isComplete, children }: ReviewCardProps) {
  return (
    <div className={`bg-gray-800/50 rounded-xl border p-6 ${isComplete ? 'border-orange-500/30' : 'border-yellow-500/30'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isComplete ? 'bg-orange-500/20' : 'bg-yellow-500/20'}`}>{icon}</div>
          <div><h3 className="font-semibold text-white">{title}</h3>
            <div className="flex items-center gap-1 text-sm">{isComplete ? <><CheckCircle className="w-3.5 h-3.5 text-orange-400" /><span className="text-orange-400">Complete</span></> : <><AlertCircle className="w-3.5 h-3.5 text-yellow-400" /><span className="text-yellow-400">Incomplete</span></>}</div>
          </div>
        </div>
        <button onClick={() => onEdit(step)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-orange-400 hover:bg-orange-500/10 rounded-lg"><Edit2 className="w-4 h-4" /> Edit</button>
      </div>
      {children}
    </div>
  )
}

export default function ReviewStep({ data, onEdit }: ReviewStepProps) {
  const governing_body = data.governing_body || []

  const isSocietyComplete = !!(data.society_name && data.registration_number && data.date_of_registration && data.society_pan)
  const hasKeyPositions = ['PRESIDENT', 'SECRETARY', 'TREASURER'].every(d => governing_body.some(m => m.designation === d))
  const isGBComplete = governing_body.length >= 3 && hasKeyPositions && governing_body.every(m => m.full_name && m.pan_number)
  const isAddressComplete = !!(data.registered_address_line1 && data.registered_city && data.registered_state && data.registered_pincode)
  const isDocsComplete = !!(data.registration_certificate_url && data.memorandum_of_association_url && data.society_pan_url && data.bank_statement_url)
  const isAllComplete = isSocietyComplete && isGBComplete && isAddressComplete && isDocsComplete

  const getDesignationLabel = (designation: string) => GB_DESIGNATION_OPTIONS.find(o => o.value === designation)?.label || designation

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-white mb-2">Review & Submit</h2><p className="text-gray-400">Review your Society details</p></div>

      <div className={`p-4 rounded-xl border ${isAllComplete ? 'bg-orange-500/10 border-orange-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
        <div className="flex items-center gap-3">
          {isAllComplete ? <CheckCircle className="w-6 h-6 text-orange-400" /> : <AlertCircle className="w-6 h-6 text-yellow-400" />}
          <div><p className={`font-medium ${isAllComplete ? 'text-orange-400' : 'text-yellow-400'}`}>{isAllComplete ? 'Ready to Submit' : 'Some sections need attention'}</p></div>
        </div>
      </div>

      <div className="space-y-4">
        <ReviewCard title="Society Details" icon={<Users2 className={`w-5 h-5 ${isSocietyComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={1} onEdit={onEdit} isComplete={isSocietyComplete}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Society Name</span><p className="text-white">{data.society_name || '-'}</p></div>
            <div><span className="text-gray-500">Registration No.</span><p className="text-white">{data.registration_number || '-'}</p></div>
            <div><span className="text-gray-500">Date of Registration</span><p className="text-white">{data.date_of_registration || '-'}</p></div>
            <div><span className="text-gray-500">Society PAN</span><p className="text-white font-mono">{data.society_pan || '-'}</p></div>
            <div><span className="text-gray-500">Society Type</span><p className="text-white">{data.society_type || '-'}</p></div>
            <div><span className="text-gray-500">12A Registration</span><p className="text-white">{data.registration_12a || '-'}</p></div>
          </div>
        </ReviewCard>

        <ReviewCard title={`Governing Body (${governing_body.length})`} icon={<Users className={`w-5 h-5 ${isGBComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={2} onEdit={onEdit} isComplete={isGBComplete}>
          <div className="space-y-2">
            {governing_body.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                <p className="text-white text-sm">{m.full_name || `Member ${i + 1}`}</p>
                <span className="text-xs text-gray-500">PAN: {m.pan_number || '-'}</span>
                {m.designation && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">{getDesignationLabel(m.designation)}</span>}
              </div>
            ))}
          </div>
        </ReviewCard>

        <ReviewCard title="Registered Address" icon={<MapPin className={`w-5 h-5 ${isAddressComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={3} onEdit={onEdit} isComplete={isAddressComplete}>
          <p className="text-white text-sm">{[data.registered_address_line1, data.registered_address_line2, data.registered_city, data.registered_state, data.registered_pincode].filter(Boolean).join(', ') || '-'}</p>
        </ReviewCard>

        <ReviewCard title="Documents" icon={<FileCheck className={`w-5 h-5 ${isDocsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={4} onEdit={onEdit} isComplete={isDocsComplete}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[{ l: 'Registration Cert', v: data.registration_certificate_url }, { l: 'MOA', v: data.memorandum_of_association_url }, { l: 'Rules & Regulations', v: data.rules_regulations_url }, { l: 'Society PAN', v: data.society_pan_url }, { l: '12A Certificate', v: data.certificate_12a_url }, { l: 'Bank Statement', v: data.bank_statement_url }].map(d => (
              <div key={d.l} className="flex items-center gap-2">
                {d.v ? <CheckCircle className="w-4 h-4 text-orange-400" /> : <div className="w-4 h-4 rounded-full border border-gray-600" />}
                <span className={d.v ? 'text-white' : 'text-gray-500'}>{d.l}</span>
              </div>
            ))}
          </div>
        </ReviewCard>
      </div>

      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-400">By submitting, I declare all information is accurate and I authorize verification.</p>
      </div>
    </div>
  )
}
