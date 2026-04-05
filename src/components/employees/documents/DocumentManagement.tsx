'use client'

import { toast } from 'sonner'

import React, { useState, useEffect, useCallback } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Clock, AlertTriangle, Download, Trash2, Eye } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

interface Document {
  id: string
  file_name: string
  file_url: string
  file_size_kb: number
  file_type: string
  document_number: string
  verification_status: string
  uploaded_at: string
  expiry_date: string | null
  issue_date: string | null
  document_type: {
    id: string
    type_name: string
    type_code: string
    category: string
    is_mandatory: boolean
    max_file_size_mb: number
    allowed_file_types: string[]
  }
}

interface DocumentData {
  documents: Document[]
  documentTypes: any[]
  stats: {
    total: number
    verified: number
    pending: number
    rejected: number
    completion_percentage: number
    expiring_soon: number
  }
  expiringDocuments: Document[]
}

export default function DocumentManagement() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DocumentData | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/employees/documents?current_only=true')
      if (response.ok) {
        const result = await response.json()
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (docType: any, file: File) => {
    setUploadingType(docType.id)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type_id', docType.id)
      formData.append('documentType', 'employee-onboarding')

      const response = await fetch('/api/employees/documents/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        await fetchDocuments() // Refresh list
        setUploadProgress(100)
        setTimeout(() => {
          setUploadingType(null)
          setUploadProgress(0)
        }, 1000)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Upload failed')
        setUploadingType(null)
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Upload failed')
      setUploadingType(null)
    }
  }

  const deleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const response = await fetch(`/api/employees/documents?id=${docId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchDocuments()
      } else {
        toast.error('Delete failed')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Delete failed')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-400" />
      default:
        return <AlertTriangle className="w-5 h-5 text-orange-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-500/20 text-green-300'
      case 'REJECTED':
        return 'bg-red-500/20 text-red-300'
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-300'
      default:
        return 'bg-orange-500/20 text-orange-300'
    }
  }

  const getCategoryIcon = (category: string) => {
    return <FileText className="w-6 h-6 text-orange-500" />
  }

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false
    const daysUntilExpiry = Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading documents...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-300">Failed to load documents. Please refresh the page.</p>
      </div>
    )
  }

  const categories = ['ALL', 'IDENTITY', 'FINANCIAL', 'EDUCATION', 'EMPLOYMENT', 'MEDICAL', 'OTHER']
  const filteredDocs = selectedCategory === 'ALL'
    ? data.documents
    : data.documents.filter(d => d.document_type?.category === selectedCategory)

  const filteredTypes = selectedCategory === 'ALL'
    ? data.documentTypes
    : data.documentTypes.filter(dt => dt.category === selectedCategory)

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Document Management</h2>
            <p className="text-gray-400 mt-1">Upload and manage your documents</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-orange-500">{data.stats.completion_percentage}%</div>
            <p className="text-sm text-gray-400">Complete</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden mb-6">
          <div
            className="bg-gradient-to-r from-orange-500 to-yellow-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${data.stats.completion_percentage}%` }}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-2xl font-bold text-white">{data.stats.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="text-center p-3 bg-green-900/30 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{data.stats.verified}</div>
            <div className="text-xs text-gray-400">Verified</div>
          </div>
          <div className="text-center p-3 bg-yellow-900/30 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{data.stats.pending}</div>
            <div className="text-xs text-gray-400">Pending</div>
          </div>
          <div className="text-center p-3 bg-red-900/30 rounded-lg">
            <div className="text-2xl font-bold text-red-400">{data.stats.rejected}</div>
            <div className="text-xs text-gray-400">Rejected</div>
          </div>
          <div className="text-center p-3 bg-orange-900/30 rounded-lg">
            <div className="text-2xl font-bold text-orange-400">{data.stats.expiring_soon}</div>
            <div className="text-xs text-gray-400">Expiring Soon</div>
          </div>
        </div>
      </div>

      {/* Expiring Documents Alert */}
      {data.expiringDocuments.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-300">Documents Expiring Soon</h3>
              <p className="text-sm text-orange-200 mt-1">
                You have {data.expiringDocuments.length} document(s) expiring within 90 days. Please renew them.
              </p>
              <ul className="mt-2 space-y-1">
                {data.expiringDocuments.map(doc => (
                  <li key={doc.id} className="text-sm text-orange-200">
                    • {doc.document_type.type_name} - Expires on {new Date(doc.expiry_date!).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              selectedCategory === category
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Document Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTypes.map((docType) => {
          const existingDoc = filteredDocs.find(d => d.document_type.id === docType.id)
          const isUploading = uploadingType === docType.id

          return (
            <div
              key={docType.id}
              className={`frosted-card p-5 rounded-lg border-l-4 ${
                existingDoc?.verification_status === 'VERIFIED'
                  ? 'border-green-500'
                  : existingDoc?.verification_status === 'REJECTED'
                  ? 'border-red-500'
                  : docType.is_mandatory
                  ? 'border-orange-500'
                  : 'border-gray-600'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {getCategoryIcon(docType.category)}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {docType.type_name}
                        {docType.is_mandatory && (
                          <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">{docType.description}</p>
                    </div>

                    {existingDoc && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(existingDoc.verification_status)}`}>
                        {existingDoc.verification_status}
                      </span>
                    )}
                  </div>

                  {/* Existing Document */}
                  {existingDoc && (
                    <div className="mt-3 p-3 bg-gray-900/50 rounded flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(existingDoc.verification_status)}
                        <div>
                          <p className="text-sm text-white">{existingDoc.file_name}</p>
                          <p className="text-xs text-gray-400">
                            {Math.round(existingDoc.file_size_kb)} KB • Uploaded {new Date(existingDoc.uploaded_at).toLocaleDateString()}
                          </p>
                          {existingDoc.expiry_date && (
                            <p className={`text-xs mt-1 ${isExpiringSoon(existingDoc.expiry_date) ? 'text-orange-400' : 'text-gray-400'}`}>
                              Expires: {new Date(existingDoc.expiry_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={existingDoc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        {existingDoc.verification_status !== 'VERIFIED' && (
                          <button
                            onClick={() => deleteDocument(existingDoc.id)}
                            className="p-2 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Upload Button */}
                  {!existingDoc && (
                    <div className="mt-3">
                      <label className="block">
                        <input
                          type="file"
                          accept={docType.allowed_file_types.map((t: string) => `.${t}`).join(',')}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(docType, file)
                          }}
                          disabled={isUploading}
                          className="hidden"
                        />
                        <div className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition ${
                          isUploading
                            ? 'border-orange-500/50 bg-orange-500/10'
                            : 'border-gray-600 hover:border-orange-500 hover:bg-orange-500/5'
                        }`}>
                          <Upload className="w-5 h-5 text-orange-500" />
                          <span className="text-sm text-gray-300">
                            {isUploading ? `Uploading... ${uploadProgress}%` : 'Click to upload'}
                          </span>
                        </div>
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        Max {docType.max_file_size_mb}MB • {docType.allowed_file_types.join(', ').toUpperCase()}
                      </p>
                    </div>
                  )}

                  {/* Re-upload for rejected/expired */}
                  {existingDoc && (existingDoc.verification_status === 'REJECTED' || isExpiringSoon(existingDoc.expiry_date)) && (
                    <div className="mt-3">
                      <label className="block">
                        <input
                          type="file"
                          accept={docType.allowed_file_types.map((t: string) => `.${t}`).join(',')}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(docType, file)
                          }}
                          disabled={isUploading}
                          className="hidden"
                        />
                        <button className="w-full px-4 py-2 bg-orange-500/20 text-orange-300 rounded hover:bg-orange-500/30 transition text-sm">
                          {isUploading ? 'Uploading...' : 'Upload New Version'}
                        </button>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredTypes.length === 0 && (
        <div className="frosted-card p-8 text-center rounded-lg">
          <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No documents in this category</p>
        </div>
      )}
    </div>
  )
}
