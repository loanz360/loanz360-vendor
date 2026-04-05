'use client'

import React, { useState } from 'react'
import { FileCheck, Upload, X, File, CheckCircle, Loader2 } from 'lucide-react'
import { HUFStepProps } from '../../types/huf'

interface DocumentUploadCardProps {
  title: string
  description: string
  currentUrl: string
  isRequired?: boolean
  onUpload: (url: string) => void
  error?: string
}

function DocumentUploadCard({
  title,
  description,
  currentUrl,
  isRequired,
  onUpload,
  error
}: DocumentUploadCardProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    // Simulate upload - in production, this would upload to storage
    await new Promise(resolve => setTimeout(resolve, 1000))
    onUpload(`https://storage.example.com/${file.name}`)
    setUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0])
    }
  }

  return (
    <div className={`bg-gray-800/50 rounded-xl p-4 border ${error ? 'border-red-500' : currentUrl ? 'border-orange-500/50' : 'border-gray-700'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-white font-medium">
            {title} {isRequired && <span className="text-red-400">*</span>}
          </h4>
          <p className="text-gray-500 text-sm">{description}</p>
        </div>
        {currentUrl && (
          <div className="flex items-center gap-1 text-orange-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs">Uploaded</span>
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragActive ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-orange-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Uploading...</span>
          </div>
        ) : currentUrl ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">
              <File className="w-5 h-5 text-orange-400" />
              <span className="text-sm truncate max-w-[200px]">
                {currentUrl.split('/').pop()}
              </span>
            </div>
            <button
              onClick={() => onUpload('')}
              className="p-1 text-gray-400 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="hidden"
            />
            <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Drop file or click to upload</p>
            <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
          </label>
        )}
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}

export default function DocumentsStep({ data, errors, onUpdate }: HUFStepProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <FileCheck className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Documents</h2>
          <p className="text-gray-400 text-sm">Upload required documents for KYC verification</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DocumentUploadCard
          title="HUF PAN Card"
          description="PAN card of the HUF"
          currentUrl={data.huf_pan_url}
          isRequired={true}
          onUpload={(url) => onUpdate({ huf_pan_url: url })}
          error={errors.huf_pan_url}
        />

        <DocumentUploadCard
          title="HUF Deed"
          description="HUF formation deed"
          currentUrl={data.huf_deed_url}
          onUpload={(url) => onUpdate({ huf_deed_url: url })}
        />

        <DocumentUploadCard
          title="Karta PAN Card"
          description="PAN card of the Karta"
          currentUrl={data.karta_pan_url}
          onUpload={(url) => onUpdate({ karta_pan_url: url })}
        />

        <DocumentUploadCard
          title="Karta Aadhaar (Front)"
          description="Aadhaar card front side"
          currentUrl={data.karta_aadhaar_front_url}
          onUpload={(url) => onUpdate({ karta_aadhaar_front_url: url })}
        />

        <DocumentUploadCard
          title="Karta Aadhaar (Back)"
          description="Aadhaar card back side"
          currentUrl={data.karta_aadhaar_back_url}
          onUpload={(url) => onUpdate({ karta_aadhaar_back_url: url })}
        />

        <DocumentUploadCard
          title="Karta Photo"
          description="Recent passport size photo"
          currentUrl={data.karta_photo_url}
          onUpload={(url) => onUpdate({ karta_photo_url: url })}
        />

        <DocumentUploadCard
          title="Bank Statement"
          description="Last 6 months bank statement"
          currentUrl={data.bank_statement_url}
          isRequired={true}
          onUpload={(url) => onUpdate({ bank_statement_url: url })}
          error={errors.bank_statement_url}
        />

        <DocumentUploadCard
          title="Address Proof"
          description="Utility bill or rent agreement"
          currentUrl={data.address_proof_url}
          onUpload={(url) => onUpdate({ address_proof_url: url })}
        />

        <DocumentUploadCard
          title="ITR of HUF"
          description="Latest ITR filed by HUF"
          currentUrl={data.itr_huf_url}
          onUpload={(url) => onUpdate({ itr_huf_url: url })}
        />
      </div>

      <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <p className="text-orange-300 text-sm">
          All documents should be clear and readable. Supported formats: PDF, JPG, PNG (Max 5MB each).
        </p>
      </div>
    </div>
  )
}
