'use client'

import React from 'react'
import { Building, Users, PieChart, MapPin, FileCheck, CheckCircle, AlertCircle, Edit2 } from 'lucide-react'
import { PrivateLimitedData } from '../../types/private-limited'

interface ReviewStepProps { data: PrivateLimitedData; onEdit: (step: number) => void }
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
  // Defensive: ensure arrays exist
  const directors = data.directors || []
  const shareholders = data.shareholders || []

  const isCompanyComplete = !!(data.company_name && data.cin && data.date_of_incorporation && data.company_pan && data.roc_office)
  const isDirectorsComplete = directors.length >= 2 && directors.every(d => d.full_name && d.din && d.pan_number)
  const isShareholdersComplete = shareholders.length >= 2
  const isAddressComplete = !!(data.registered_address_line1 && data.registered_city && data.registered_state && data.registered_pincode)
  const isDocsComplete = !!(data.certificate_of_incorporation_url && data.moa_url && data.aoa_url && data.company_pan_url)
  const isAllComplete = isCompanyComplete && isDirectorsComplete && isShareholdersComplete && isAddressComplete && isDocsComplete

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-white mb-2">Review & Submit</h2><p className="text-gray-400">Review your company details</p></div>

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
            <div><span className="text-gray-500">Paid-up Capital</span><p className="text-white">{data.paid_up_capital ? `₹${data.paid_up_capital.toLocaleString()}` : '-'}</p></div>
          </div>
        </ReviewCard>

        <ReviewCard title={`Directors (${directors.length})`} icon={<Users className={`w-5 h-5 ${isDirectorsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={2} onEdit={onEdit} isComplete={isDirectorsComplete}>
          <div className="space-y-2">
            {directors.map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                <p className="text-white text-sm">{d.full_name || `Director ${i + 1}`}</p>
                <span className="text-xs text-gray-500">DIN: {d.din || '-'}</span>
                {d.director_type === 'MANAGING_DIRECTOR' && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">MD</span>}
              </div>
            ))}
          </div>
        </ReviewCard>

        <ReviewCard title={`Shareholders (${shareholders.length})`} icon={<PieChart className={`w-5 h-5 ${isShareholdersComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={3} onEdit={onEdit} isComplete={isShareholdersComplete}>
          <div className="space-y-2">
            {shareholders.slice(0, 5).map((s, i) => (
              <div key={s.id} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                <p className="text-white text-sm">{s.name || `Shareholder ${i + 1}`}</p>
                <span className="text-xs text-gray-400">{(s.shareholding_percent || 0).toFixed(2)}%</span>
              </div>
            ))}
            {shareholders.length > 5 && <p className="text-xs text-gray-500 text-center">+{shareholders.length - 5} more</p>}
          </div>
        </ReviewCard>

        <ReviewCard title="Address" icon={<MapPin className={`w-5 h-5 ${isAddressComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={4} onEdit={onEdit} isComplete={isAddressComplete}>
          <p className="text-white text-sm">{[data.registered_address_line1, data.registered_address_line2, data.registered_city, data.registered_state, data.registered_pincode].filter(Boolean).join(', ') || '-'}</p>
        </ReviewCard>

        <ReviewCard title="Documents" icon={<FileCheck className={`w-5 h-5 ${isDocsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={5} onEdit={onEdit} isComplete={isDocsComplete}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[{ l: 'COI', v: data.certificate_of_incorporation_url }, { l: 'MOA', v: data.moa_url }, { l: 'AOA', v: data.aoa_url }, { l: 'Company PAN', v: data.company_pan_url }, { l: 'Board Resolution', v: data.board_resolution_url }, { l: 'Bank Statement', v: data.bank_statement_url }].map(d => (
              <div key={d.l} className="flex items-center gap-2">
                {d.v ? <CheckCircle className="w-4 h-4 text-orange-400" /> : <div className="w-4 h-4 rounded-full border border-gray-600" />}
                <span className={d.v ? 'text-white' : 'text-gray-500'}>{d.l}</span>
              </div>
            ))}
          </div>
        </ReviewCard>
      </div>

      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-400">By submitting, I declare all information is accurate.</p>
      </div>
    </div>
  )
}
