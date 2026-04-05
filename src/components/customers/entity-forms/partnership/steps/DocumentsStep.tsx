'use client'

import React, { useState } from 'react'
import { FileCheck, Upload, CheckCircle, AlertCircle, X, FileText, Loader2 } from 'lucide-react'
import { PartnershipStepProps } from '../../types/partnership'

interface DocumentCardProps {
  title: string
  description: string
  required: boolean
  value: string
  error?: string
  onUpload: (url: string) => void
  onRemove: () => void
}

function DocumentCard({ title, description, required, value, error, onUpload, onRemove }: DocumentCardProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = async (file: File) => {
    if (!file) return

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return
    }

    try {
      setUploading(true)
      // Simulate upload - in production, this would call your S3 upload API
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'partnership-documents')

      // Mock upload URL - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      const mockUrl = `https://storage.example.com/partnership/${Date.now()}-${file.name}`
      onUpload(mockUrl)
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className={`bg-gray-800/50 rounded-xl border p-4 ${
      error ? 'border-red-500/50' : value ? 'border-orange-500/50' : 'border-gray-700'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            value ? 'bg-orange-500/20' : 'bg-gray-700'
          }`}>
            {value ? (
              <CheckCircle className="w-5 h-5 text-orange-400" />
            ) : (
              <FileText className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <h4 className="font-medium text-white">
              {title}
              {required && <span className="text-red-400 ml-1">*</span>}
            </h4>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        {value && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!value ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            dragActive ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Uploading...</span>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                Drag & drop or{' '}
                <label className="text-orange-400 hover:text-orange-300 cursor-pointer">
                  browse
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (max 5MB)</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg">
          <CheckCircle className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-orange-400">Document uploaded</span>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  )
}

export default function DocumentsStep({ data, errors, onUpdate }: PartnershipStepProps) {
  const firmDocuments = [
    {
      key: 'partnership_deed_url',
      title: 'Partnership Deed',
      description: 'Registered partnership deed document',
      required: true
    },
    {
      key: 'registration_certificate_url',
      title: 'Certificate of Registration',
      description: 'From Registrar of Firms (if registered)',
      required: false
    },
    {
      key: 'firm_pan_url',
      title: 'Firm PAN Card',
      description: 'PAN card of the partnership firm',
      required: true
    },
    {
      key: 'bank_statement_url',
      title: 'Bank Statement',
      description: 'Last 6 months bank statement',
      required: true
    },
    {
      key: 'address_proof_url',
      title: 'Address Proof',
      description: 'Utility bill, rent agreement, or property document',
      required: true
    },
    {
      key: 'itr_documents_url',
      title: 'ITR Documents',
      description: 'Last 2 years Income Tax Returns',
      required: false
    },
    {
      key: 'gst_certificate_url',
      title: 'GST Certificate',
      description: 'GST registration certificate',
      required: data.gst_registration_status === 'REGISTERED'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Documents & KYC</h2>
        <p className="text-gray-400">Upload required documents for verification</p>
      </div>

      {/* Firm Documents */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <FileCheck className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Firm Documents</h3>
            <p className="text-sm text-gray-500">Partnership firm related documents</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {firmDocuments.map((doc) => (
            <DocumentCard
              key={doc.key}
              title={doc.title}
              description={doc.description}
              required={doc.required}
              value={data[doc.key as keyof typeof data] as string}
              error={errors[doc.key]}
              onUpload={(url) => onUpdate({ [doc.key]: url })}
              onRemove={() => onUpdate({ [doc.key]: '' })}
            />
          ))}
        </div>
      </div>

      {/* Partner Documents Info */}
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Partner Documents</p>
            <p className="text-yellow-300 text-sm mt-1">
              Individual partner documents (PAN, Aadhaar, Photo) can be uploaded in the Partners section.
              Make sure all partners have their KYC documents uploaded.
            </p>
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Upload Progress</span>
          <span className="text-white font-medium">
            {firmDocuments.filter(d => data[d.key as keyof typeof data]).length} / {firmDocuments.length} documents
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{
              width: `${(firmDocuments.filter(d => data[d.key as keyof typeof data]).length / firmDocuments.length) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  )
}
