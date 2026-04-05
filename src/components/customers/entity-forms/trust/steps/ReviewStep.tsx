'use client'

import React from 'react'
import { Heart, Users, MapPin, FileCheck, CheckCircle, AlertCircle, Edit2 } from 'lucide-react'
import { TrustData } from '../../types/trust'

interface ReviewStepProps { data: TrustData; onEdit: (step: number) => void }
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
  const trustees = data.trustees || []
  const beneficiaries = data.beneficiaries || []

  const isTrustComplete = !!(data.trust_name && data.trust_type && data.date_of_creation && data.trust_pan)
  const isTrusteesComplete = trustees.length >= 1 && trustees.some(t => t.trustee_type === 'MANAGING_TRUSTEE') && trustees.every(t => t.full_name && t.pan_number)
  const isAddressComplete = !!(data.trust_address_line1 && data.trust_city && data.trust_state && data.trust_pincode)
  const isDocsComplete = !!(data.trust_deed_url && data.trust_pan_url && data.bank_statement_url)
  const isAllComplete = isTrustComplete && isTrusteesComplete && isAddressComplete && isDocsComplete

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-white mb-2">Review & Submit</h2><p className="text-gray-400">Review your Trust details</p></div>

      <div className={`p-4 rounded-xl border ${isAllComplete ? 'bg-orange-500/10 border-orange-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
        <div className="flex items-center gap-3">
          {isAllComplete ? <CheckCircle className="w-6 h-6 text-orange-400" /> : <AlertCircle className="w-6 h-6 text-yellow-400" />}
          <div><p className={`font-medium ${isAllComplete ? 'text-orange-400' : 'text-yellow-400'}`}>{isAllComplete ? 'Ready to Submit' : 'Some sections need attention'}</p></div>
        </div>
      </div>

      <div className="space-y-4">
        <ReviewCard title="Trust Details" icon={<Heart className={`w-5 h-5 ${isTrustComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={1} onEdit={onEdit} isComplete={isTrustComplete}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Trust Name</span><p className="text-white">{data.trust_name || '-'}</p></div>
            <div><span className="text-gray-500">Trust Type</span><p className="text-white">{data.trust_type || '-'}</p></div>
            <div><span className="text-gray-500">Date of Creation</span><p className="text-white">{data.date_of_creation || '-'}</p></div>
            <div><span className="text-gray-500">Trust PAN</span><p className="text-white font-mono">{data.trust_pan || '-'}</p></div>
            <div><span className="text-gray-500">12A Registration</span><p className="text-white">{data.registration_12a || '-'}</p></div>
            <div><span className="text-gray-500">80G Registration</span><p className="text-white">{data.registration_80g || '-'}</p></div>
          </div>
        </ReviewCard>

        <ReviewCard title={`Trustees (${trustees.length})`} icon={<Users className={`w-5 h-5 ${isTrusteesComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={2} onEdit={onEdit} isComplete={isTrusteesComplete}>
          <div className="space-y-2">
            {trustees.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                <p className="text-white text-sm">{t.full_name || `Trustee ${i + 1}`}</p>
                <span className="text-xs text-gray-500">PAN: {t.pan_number || '-'}</span>
                {t.trustee_type === 'MANAGING_TRUSTEE' && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Managing</span>}
              </div>
            ))}
          </div>
        </ReviewCard>

        <ReviewCard title="Trust Address" icon={<MapPin className={`w-5 h-5 ${isAddressComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={3} onEdit={onEdit} isComplete={isAddressComplete}>
          <p className="text-white text-sm">{[data.trust_address_line1, data.trust_address_line2, data.trust_city, data.trust_state, data.trust_pincode].filter(Boolean).join(', ') || '-'}</p>
        </ReviewCard>

        <ReviewCard title="Documents" icon={<FileCheck className={`w-5 h-5 ${isDocsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={4} onEdit={onEdit} isComplete={isDocsComplete}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[{ l: 'Trust Deed', v: data.trust_deed_url }, { l: 'Registration Cert', v: data.registration_certificate_url }, { l: 'Trust PAN', v: data.trust_pan_url }, { l: '12A Certificate', v: data.certificate_12a_url }, { l: '80G Certificate', v: data.certificate_80g_url }, { l: 'Bank Statement', v: data.bank_statement_url }].map(d => (
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
