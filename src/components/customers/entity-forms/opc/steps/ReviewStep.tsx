'use client'

import React from 'react'
import { Building, User, UserPlus, MapPin, FileCheck, CheckCircle, AlertCircle, Edit2 } from 'lucide-react'
import { OPCData } from '../../types/opc'

interface ReviewStepProps { data: OPCData; onEdit: (step: number) => void }
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
  const isCompanyComplete = !!(data.company_name && data.cin && data.date_of_incorporation && data.company_pan && data.roc_office)
  const isDirectorComplete = !!(data.director.full_name && data.director.din && data.director.pan_number && data.director.mobile && data.director.email)
  const isNomineeComplete = !!(data.nominee.nominee_name && data.nominee.nominee_pan && data.nominee.relationship)
  const isAddressComplete = !!(data.registered_address_line1 && data.registered_city && data.registered_state && data.registered_pincode)
  const isDocsComplete = !!(data.certificate_of_incorporation_url && data.moa_url && data.aoa_url && data.company_pan_url && data.bank_statement_url)
  const isAllComplete = isCompanyComplete && isDirectorComplete && isNomineeComplete && isAddressComplete && isDocsComplete

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-white mb-2">Review & Submit</h2><p className="text-gray-400">Review your One Person Company details</p></div>

      <div className={`p-4 rounded-xl border ${isAllComplete ? 'bg-orange-500/10 border-orange-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
        <div className="flex items-center gap-3">
          {isAllComplete ? <CheckCircle className="w-6 h-6 text-orange-400" /> : <AlertCircle className="w-6 h-6 text-yellow-400" />}
          <div><p className={`font-medium ${isAllComplete ? 'text-orange-400' : 'text-yellow-400'}`}>{isAllComplete ? 'Ready to Submit' : 'Some sections need attention'}</p></div>
        </div>
      </div>

      <div className="space-y-4">
        <ReviewCard title="Company Details" icon={<Building className={`w-5 h-5 ${isCompanyComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={1} onEdit={onEdit} isComplete={isCompanyComplete}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Company Name</span><p className="text-white">{data.company_name || '-'}</p></div>
            <div><span className="text-gray-500">CIN</span><p className="text-white font-mono">{data.cin || '-'}</p></div>
            <div><span className="text-gray-500">Date of Incorporation</span><p className="text-white">{data.date_of_incorporation || '-'}</p></div>
            <div><span className="text-gray-500">Company PAN</span><p className="text-white font-mono">{data.company_pan || '-'}</p></div>
            <div><span className="text-gray-500">ROC Office</span><p className="text-white">{data.roc_office || '-'}</p></div>
            <div><span className="text-gray-500">Paid-up Capital</span><p className="text-white">{data.paid_up_capital ? `Rs.${data.paid_up_capital.toLocaleString()}` : '-'}</p></div>
          </div>
        </ReviewCard>

        <ReviewCard title="Sole Director" icon={<User className={`w-5 h-5 ${isDirectorComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={2} onEdit={onEdit} isComplete={isDirectorComplete}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Full Name</span><p className="text-white">{data.director.full_name || '-'}</p></div>
            <div><span className="text-gray-500">DIN</span><p className="text-white font-mono">{data.director.din || '-'}</p></div>
            <div><span className="text-gray-500">PAN Number</span><p className="text-white font-mono">{data.director.pan_number || '-'}</p></div>
            <div><span className="text-gray-500">Mobile</span><p className="text-white">{data.director.mobile || '-'}</p></div>
            <div><span className="text-gray-500">Email</span><p className="text-white">{data.director.email || '-'}</p></div>
          </div>
        </ReviewCard>

        <ReviewCard title="Nominee Director" icon={<UserPlus className={`w-5 h-5 ${isNomineeComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={3} onEdit={onEdit} isComplete={isNomineeComplete}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Nominee Name</span><p className="text-white">{data.nominee.nominee_name || '-'}</p></div>
            <div><span className="text-gray-500">Relationship</span><p className="text-white">{data.nominee.relationship || '-'}</p></div>
            <div><span className="text-gray-500">Nominee PAN</span><p className="text-white font-mono">{data.nominee.nominee_pan || '-'}</p></div>
          </div>
        </ReviewCard>

        <ReviewCard title="Registered Address" icon={<MapPin className={`w-5 h-5 ${isAddressComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={4} onEdit={onEdit} isComplete={isAddressComplete}>
          <p className="text-white text-sm">{[data.registered_address_line1, data.registered_address_line2, data.registered_city, data.registered_state, data.registered_pincode].filter(Boolean).join(', ') || '-'}</p>
        </ReviewCard>

        <ReviewCard title="Documents" icon={<FileCheck className={`w-5 h-5 ${isDocsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={5} onEdit={onEdit} isComplete={isDocsComplete}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[{ l: 'COI', v: data.certificate_of_incorporation_url }, { l: 'MOA', v: data.moa_url }, { l: 'AOA', v: data.aoa_url }, { l: 'Company PAN', v: data.company_pan_url }, { l: 'Bank Statement', v: data.bank_statement_url }, { l: 'Office Proof', v: data.registered_office_proof_url }].map(d => (
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
