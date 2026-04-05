'use client'

import React from 'react'
import { Scale, Users, MapPin, FileCheck, CheckCircle, AlertCircle, Edit2, User, Shield, Percent } from 'lucide-react'
import { LLPData } from '../../types/llp'
import { NATURE_OF_BUSINESS_OPTIONS, BUSINESS_CATEGORY_OPTIONS } from '../../types'

interface ReviewStepProps {
  data: LLPData
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
    <div className={`bg-gray-800/50 rounded-xl border p-6 ${isComplete ? 'border-orange-500/30' : 'border-yellow-500/30'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isComplete ? 'bg-orange-500/20' : 'bg-yellow-500/20'}`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <div className="flex items-center gap-1 text-sm">
              {isComplete ? (
                <><CheckCircle className="w-3.5 h-3.5 text-orange-400" /><span className="text-orange-400">Complete</span></>
              ) : (
                <><AlertCircle className="w-3.5 h-3.5 text-yellow-400" /><span className="text-yellow-400">Incomplete</span></>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => onEdit(step)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
          <Edit2 className="w-4 h-4" /> Edit
        </button>
      </div>
      {children}
    </div>
  )
}

export default function ReviewStep({ data, onEdit }: ReviewStepProps) {
  // Defensive: ensure partners array exists
  const partners = data.partners || []

  const isLLPDetailsComplete = !!(data.llp_name && data.llpin && data.date_of_incorporation && data.llp_pan && data.roc_office)
  const designatedPartners = partners.filter(p => p.partner_type === 'DESIGNATED_PARTNER')
  const isPartnersComplete = designatedPartners.length >= 2 && partners.every(p => p.full_name && p.pan_number)
  const isAddressComplete = !!(data.registered_address_line1 && data.registered_city && data.registered_state && data.registered_pincode)
  const isDocumentsComplete = !!(data.llp_agreement_url && data.certificate_of_incorporation_url && data.llp_pan_url && data.bank_statement_url)
  const isAllComplete = isLLPDetailsComplete && isPartnersComplete && isAddressComplete && isDocumentsComplete

  const getNatureLabel = (value: string) => NATURE_OF_BUSINESS_OPTIONS.find(o => o.value === value)?.label || value
  const getCategoryLabel = (value: string) => BUSINESS_CATEGORY_OPTIONS.find(o => o.value === value)?.label || value

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Review & Submit</h2>
        <p className="text-gray-400">Review your LLP details before submitting</p>
      </div>

      <div className={`p-4 rounded-xl border ${isAllComplete ? 'bg-orange-500/10 border-orange-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
        <div className="flex items-center gap-3">
          {isAllComplete ? <CheckCircle className="w-6 h-6 text-orange-400" /> : <AlertCircle className="w-6 h-6 text-yellow-400" />}
          <div>
            <p className={`font-medium ${isAllComplete ? 'text-orange-400' : 'text-yellow-400'}`}>
              {isAllComplete ? 'Ready to Submit' : 'Some sections need attention'}
            </p>
            <p className={`text-sm ${isAllComplete ? 'text-orange-300' : 'text-yellow-300'}`}>
              {isAllComplete ? 'All required information has been provided.' : 'Please complete all required sections.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <ReviewCard title="LLP Details" icon={<Scale className={`w-5 h-5 ${isLLPDetailsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={1} onEdit={onEdit} isComplete={isLLPDetailsComplete}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">LLP Name</span><p className="text-white">{data.llp_name || '-'}</p></div>
            <div><span className="text-gray-500">LLPIN</span><p className="text-white font-mono">{data.llpin || '-'}</p></div>
            <div><span className="text-gray-500">Date of Incorporation</span><p className="text-white">{data.date_of_incorporation || '-'}</p></div>
            <div><span className="text-gray-500">ROC Office</span><p className="text-white">{data.roc_office || '-'}</p></div>
            <div><span className="text-gray-500">LLP PAN</span><p className="text-white font-mono">{data.llp_pan || '-'}</p></div>
            <div><span className="text-gray-500">GSTIN</span><p className="text-white font-mono">{data.gstin || 'Not Registered'}</p></div>
            <div><span className="text-gray-500">Nature of Business</span><p className="text-white">{getNatureLabel(data.nature_of_business) || '-'}</p></div>
            <div><span className="text-gray-500">Paid-up Capital</span><p className="text-white">{data.paid_up_capital ? `₹${data.paid_up_capital.toLocaleString()}` : '-'}</p></div>
          </div>
        </ReviewCard>

        <ReviewCard title={`Partners (${partners.length})`} icon={<Users className={`w-5 h-5 ${isPartnersComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={2} onEdit={onEdit} isComplete={isPartnersComplete}>
          <div className="space-y-3">
            {partners.map((partner, index) => (
              <div key={partner.id} className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${partner.partner_type === 'DESIGNATED_PARTNER' ? 'bg-orange-500/20' : 'bg-gray-700'}`}>
                  {partner.partner_type === 'DESIGNATED_PARTNER' ? <Shield className="w-4 h-4 text-orange-400" /> : <User className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{partner.full_name || `Partner ${index + 1}`}</p>
                    {partner.partner_type === 'DESIGNATED_PARTNER' && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Designated</span>}
                    {partner.is_authorized_signatory && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Signatory</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span>PAN: {partner.pan_number || '-'}</span>
                    {partner.dpin_din && <span>DPIN: {partner.dpin_din}</span>}
                    {partner.profit_sharing_percent && <span className="flex items-center gap-1"><Percent className="w-3 h-3" />Profit: {partner.profit_sharing_percent}%</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ReviewCard>

        <ReviewCard title="Address" icon={<MapPin className={`w-5 h-5 ${isAddressComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={3} onEdit={onEdit} isComplete={isAddressComplete}>
          <div className="text-sm">
            <span className="text-gray-500">Registered Office</span>
            <p className="text-white">
              {[data.registered_address_line1, data.registered_address_line2, data.registered_city, data.registered_state, data.registered_pincode].filter(Boolean).join(', ') || '-'}
            </p>
          </div>
        </ReviewCard>

        <ReviewCard title="Documents" icon={<FileCheck className={`w-5 h-5 ${isDocumentsComplete ? 'text-orange-400' : 'text-yellow-400'}`} />} step={4} onEdit={onEdit} isComplete={isDocumentsComplete}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'LLP Agreement', value: data.llp_agreement_url },
              { label: 'Certificate of Incorporation', value: data.certificate_of_incorporation_url },
              { label: 'LLP PAN Card', value: data.llp_pan_url },
              { label: 'Bank Statement', value: data.bank_statement_url },
              { label: 'Registered Office Proof', value: data.registered_office_proof_url },
              { label: 'ITR Documents', value: data.itr_documents_url },
              { label: 'GST Certificate', value: data.gst_certificate_url },
              { label: 'Annual Return', value: data.annual_return_url }
            ].map((doc) => (
              <div key={doc.label} className="flex items-center gap-2">
                {doc.value ? <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0" /> : <div className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0" />}
                <span className={doc.value ? 'text-white' : 'text-gray-500'}>{doc.label}</span>
              </div>
            ))}
          </div>
        </ReviewCard>
      </div>

      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-400">
          By submitting this form, I declare that all the information provided is true and accurate to the best of my knowledge.
        </p>
      </div>
    </div>
  )
}
