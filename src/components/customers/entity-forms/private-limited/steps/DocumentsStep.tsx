'use client'

import React, { useState } from 'react'
import { FileCheck, Upload, CheckCircle, AlertCircle, X, FileText, Loader2 } from 'lucide-react'
import { PrivateLimitedStepProps } from '../../types/private-limited'

interface DocCardProps { title: string; description: string; required: boolean; value: string; error?: string; onUpload: (url: string) => void; onRemove: () => void }

function DocCard({ title, description, required, value, error, onUpload, onRemove }: DocCardProps) {
  const [uploading, setUploading] = useState(false)
  const handleFile = async (file: File) => {
    if (!file) return
    try { setUploading(true); await new Promise(r => setTimeout(r, 1000)); onUpload(`https://storage.example.com/pvtltd/${Date.now()}-${file.name}`) }
    catch (e) { console.error(e) } finally { setUploading(false) }
  }
  return (
    <div className={`bg-gray-800/50 rounded-xl border p-4 ${error ? 'border-red-500/50' : value ? 'border-orange-500/50' : 'border-gray-700'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${value ? 'bg-orange-500/20' : 'bg-gray-700'}`}>
            {value ? <CheckCircle className="w-5 h-5 text-orange-400" /> : <FileText className="w-5 h-5 text-gray-400" />}
          </div>
          <div><h4 className="font-medium text-white">{title}{required && <span className="text-red-400 ml-1">*</span>}</h4><p className="text-sm text-gray-500">{description}</p></div>
        </div>
        {value && <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg"><X className="w-4 h-4" /></button>}
      </div>
      {!value ? (
        <div className="border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-lg p-4 text-center">
          {uploading ? <div className="flex items-center justify-center gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" />Uploading...</div> : (
            <><Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" /><p className="text-sm text-gray-400">Drag & drop or <label className="text-orange-400 cursor-pointer">browse<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" /></label></p></>
          )}
        </div>
      ) : <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg"><CheckCircle className="w-4 h-4 text-orange-400" /><span className="text-sm text-orange-400">Uploaded</span></div>}
      {error && <p className="mt-2 text-sm text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
    </div>
  )
}

export default function DocumentsStep({ data, errors, onUpdate }: PrivateLimitedStepProps) {
  const docs = [
    { key: 'certificate_of_incorporation_url', title: 'Certificate of Incorporation', description: 'COI from ROC', required: true },
    { key: 'moa_url', title: 'Memorandum of Association', description: 'MOA document', required: true },
    { key: 'aoa_url', title: 'Articles of Association', description: 'AOA document', required: true },
    { key: 'company_pan_url', title: 'Company PAN Card', description: 'PAN card of the company', required: true },
    { key: 'board_resolution_url', title: 'Board Resolution', description: 'Resolution for loan/signatory', required: true },
    { key: 'share_certificates_url', title: 'Share Certificates', description: 'All share certificates', required: false },
    { key: 'bank_statement_url', title: 'Bank Statement', description: 'Last 6 months', required: true },
    { key: 'registered_office_proof_url', title: 'Registered Office Proof', description: 'Address proof', required: true },
    { key: 'audited_financials_url', title: 'Audited Financials', description: 'Last 2 years', required: false },
    { key: 'gst_certificate_url', title: 'GST Certificate', description: 'If registered', required: data.gst_registration_status === 'REGISTERED' },
    { key: 'annual_return_url', title: 'Annual Return (MGT-7)', description: 'Latest return', required: false }
  ]

  return (
    <div className="space-y-8">
      <div><h2 className="text-2xl font-bold text-white mb-2">Documents & KYC</h2><p className="text-gray-400">Upload required documents</p></div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center"><FileCheck className="w-5 h-5 text-orange-400" /></div>
        <div><h3 className="text-lg font-semibold text-white">Company Documents</h3></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.map(d => <DocCard key={d.key} {...d} value={data[d.key as keyof typeof data] as string} error={errors[d.key]} onUpload={url => onUpdate({ [d.key]: url })} onRemove={() => onUpdate({ [d.key]: '' })} />)}
      </div>
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3"><AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" /><div><p className="text-yellow-400 font-medium">Director Documents</p><p className="text-yellow-300 text-sm">Individual director documents can be uploaded in the Directors section.</p></div></div>
      </div>
    </div>
  )
}
