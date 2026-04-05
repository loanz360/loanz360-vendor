'use client'

import { toast } from 'sonner'

import { useState } from 'react'
import { Upload, File, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface KYCDocument {
  id?: string
  document_type: string
  file_name: string
  file_size: number
  uploaded_at?: string
  status?: 'pending' | 'approved' | 'rejected'
}

interface KYCDocumentUploadProps {
  customerId: string
  onUploadSuccess?: () => void
}

const DOCUMENT_TYPES = [
  { value: 'PAN_CARD', label: 'PAN Card' },
  { value: 'AADHAAR_CARD', label: 'Aadhaar Card' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'SALARY_SLIP', label: 'Salary Slip' },
  { value: 'ITR', label: 'Income Tax Return' },
  { value: 'BUSINESS_PROOF', label: 'Business Proof' },
  { value: 'ADDRESS_PROOF', label: 'Address Proof' },
]

export default function KYCDocumentUpload({ customerId, onUploadSuccess }: KYCDocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [documents, setDocuments] = useState<KYCDocument[]>([])
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !documentType) {
      toast.error('Please select both file and document type')
      return
    }

    setUploading(true)

    try {
      // Prepare form data
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('document_type', documentType)
      formData.append('customer_id', customerId)

      // Upload to API (to be created)
      const response = await fetch(`/api/customers/${customerId}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()

        // Add to documents list
        setDocuments([...documents, {
          document_type: documentType,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          status: 'pending'
        }])

        // Reset form
        setSelectedFile(null)
        setDocumentType('')

        // Call success callback
        onUploadSuccess?.()

        toast.success('Document uploaded successfully!')
      } else {
        toast.error('Upload failed. Please try again.')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload KYC Document</h2>

        {/* Document Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Type *
          </label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select document type</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="space-y-3">
              <File className="w-12 h-12 text-blue-600 mx-auto" />
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-600">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-12 h-12 text-gray-400 mx-auto" />
              <div>
                <p className="text-gray-900 font-medium mb-1">
                  Drag and drop your file here
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  or click to browse
                </p>
                <label className="inline-block">
                  <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                    Choose File
                  </span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Supported formats: PDF, JPG, PNG (Max 10MB)
              </p>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || !documentType || uploading}
          className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Uploading...
            </span>
          ) : (
            'Upload Document'
          )}
        </button>
      </div>

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Uploaded Documents ({documents.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {documents.map((doc, index) => (
              <div key={index} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <File className="w-10 h-10 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{doc.file_name}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>
                        {DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label}
                      </span>
                      <span>•</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      {doc.uploaded_at && (
                        <>
                          <span>•</span>
                          <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(doc.status)}
                  <span className="text-sm text-gray-600 capitalize">
                    {doc.status || 'pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Upload className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-900 font-medium">KYC Upload System Ready</p>
            <p className="text-sm text-blue-700 mt-1">
              This component is ready to integrate with document storage. To activate:
            </p>
            <ul className="text-sm text-blue-700 list-disc list-inside ml-2 mt-2">
              <li>Create API endpoint: /api/customers/[id]/documents</li>
              <li>Set up Supabase Storage bucket for documents</li>
              <li>Implement file upload handler</li>
              <li>Add document verification workflow</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
