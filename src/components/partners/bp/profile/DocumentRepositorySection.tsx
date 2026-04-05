'use client'

import React, { useState, useRef } from 'react'
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Clock,
  AlertTriangle,
  Search,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import { VerificationStatus } from '@/components/partners/shared/StatusIndicator'
import type { BPDocument, DocumentType, VerificationStatus as VerificationStatusType } from '@/types/bp-profile'
import { DOCUMENT_TYPE_LABELS } from '@/types/bp-profile'
import { cn } from '@/lib/utils/cn'

interface DocumentRepositorySectionProps {
  documents: BPDocument[]
  onUpload?: (type: DocumentType, file: File) => Promise<void>
  onDelete?: (documentId: string) => Promise<void>
  onView?: (document: BPDocument) => void
  isEditing: boolean
  uploadingType?: DocumentType | null
  deletingId?: string | null
}

const documentCategories: Array<{
  title: string
  types: DocumentType[]
}> = [
  {
    title: 'Identity Documents',
    types: ['PAN_CARD', 'AADHAAR_CARD', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID'],
  },
  {
    title: 'Business Documents',
    types: [
      'CIN_CERTIFICATE',
      'GST_CERTIFICATE',
      'PARTNERSHIP_DEED',
      'LLP_AGREEMENT',
      'INCORPORATION_CERTIFICATE',
      'BUSINESS_REGISTRATION',
    ],
  },
  {
    title: 'Financial Documents',
    types: ['BANK_PROOF', 'CANCELLED_CHEQUE', 'ITR_DOCUMENT'],
  },
  {
    title: 'Agreement Documents',
    types: ['PARTNER_AGREEMENT', 'DIGITAL_SIGNATURE'],
  },
  {
    title: 'Other Documents',
    types: ['ADDRESS_PROOF', 'PHOTOGRAPH', 'PROFESSIONAL_CERTIFICATE', 'OTHER'],
  },
]

export default function DocumentRepositorySection({
  documents,
  onUpload,
  onDelete,
  onView,
  isEditing,
  uploadingType,
  deletingId,
}: DocumentRepositorySectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDocType, setUploadDocType] = useState<DocumentType | null>(null)

  const getVerificationStatusType = (
    status: VerificationStatusType
  ): 'not_submitted' | 'pending' | 'verified' | 'failed' | 'expired' | 'rejected' => {
    const mapping: Record<
      VerificationStatusType,
      'not_submitted' | 'pending' | 'verified' | 'failed' | 'expired' | 'rejected'
    > = {
      NOT_SUBMITTED: 'not_submitted',
      PENDING: 'pending',
      VERIFIED: 'verified',
      FAILED: 'failed',
      EXPIRED: 'expired',
      REJECTED: 'rejected',
    }
    return mapping[status]
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleUploadClick = (docType: DocumentType) => {
    setUploadDocType(docType)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && uploadDocType && onUpload) {
      await onUpload(uploadDocType, file)
      setUploadDocType(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getDocumentsByType = (type: DocumentType) => {
    return documents.filter((doc) => doc.document_type === type && doc.is_latest)
  }

  const verifiedCount = documents.filter((d) => d.verification_status === 'VERIFIED').length
  const pendingCount = documents.filter((d) => d.verification_status === 'PENDING').length

  return (
    <CollapsibleSection
      title="Document Repository"
      icon={FileText}
      badge={
        documents.length > 0
          ? {
              text: `${verifiedCount}/${documents.length} Verified`,
              variant: verifiedCount === documents.length ? 'success' : 'warning',
            }
          : undefined
      }
    >
      <div className="space-y-6 mt-4">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-800/30 rounded-lg text-center">
            <p className="text-2xl font-bold text-white">{documents.length}</p>
            <p className="text-gray-400 text-sm">Total Documents</p>
          </div>
          <div className="p-4 bg-green-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-400">{verifiedCount}</p>
            <p className="text-gray-400 text-sm">Verified</p>
          </div>
          <div className="p-4 bg-yellow-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
            <p className="text-gray-400 text-sm">Pending</p>
          </div>
          <div className="p-4 bg-red-500/10 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-400">
              {documents.filter((d) => d.is_expired).length}
            </p>
            <p className="text-gray-400 text-sm">Expired</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/50 text-white pl-10 pr-4 py-2.5 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-800/50 text-white px-3 py-2.5 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-gray-800/50 text-white px-3 py-2.5 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="ALL">All Categories</option>
              {documentCategories.map((cat) => (
                <option key={cat.title} value={cat.title}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Document Categories */}
        {documentCategories.map((category) => {
          if (selectedCategory !== 'ALL' && selectedCategory !== category.title) {
            return null
          }

          return (
            <div key={category.title} className="border-t border-gray-700/50 pt-6">
              <h4 className="text-white font-medium mb-4">{category.title}</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.types.map((docType) => {
                  const doc = getDocumentsByType(docType)[0]
                  const isUploading = uploadingType === docType

                  return (
                    <div
                      key={docType}
                      className={cn(
                        'p-4 rounded-lg border transition-all',
                        doc
                          ? doc.verification_status === 'VERIFIED'
                            ? 'bg-green-500/5 border-green-500/30'
                            : doc.verification_status === 'REJECTED'
                            ? 'bg-red-500/5 border-red-500/30'
                            : 'bg-gray-800/30 border-gray-700/50'
                          : 'bg-gray-800/30 border-gray-700/50 border-dashed'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">
                            {DOCUMENT_TYPE_LABELS[docType]}
                          </p>
                          {doc && (
                            <p className="text-gray-500 text-xs mt-1 truncate">
                              {doc.file_name}
                            </p>
                          )}
                        </div>
                        {doc && (
                          <VerificationStatus
                            status={getVerificationStatusType(doc.verification_status)}
                            size="sm"
                            showLabel={false}
                          />
                        )}
                      </div>

                      {doc ? (
                        <>
                          <div className="flex items-center gap-3 text-gray-400 text-xs mb-3">
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span>•</span>
                            <span>{formatDate(doc.uploaded_at)}</span>
                          </div>

                          {doc.admin_comments && (
                            <div className="mb-3 p-2 bg-gray-800/50 rounded text-xs text-gray-400">
                              <span className="text-gray-500">Admin: </span>
                              {doc.admin_comments}
                            </div>
                          )}

                          {doc.expiry_date && (
                            <div
                              className={cn(
                                'mb-3 flex items-center gap-1 text-xs',
                                doc.is_expired ? 'text-red-400' : 'text-gray-400'
                              )}
                            >
                              {doc.is_expired ? (
                                <AlertTriangle className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              Expires: {formatDate(doc.expiry_date)}
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                              onClick={() => onView?.(doc)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                              asChild
                            >
                              <a href={doc.file_url} download>
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                            {isEditing && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-orange-400 hover:text-orange-300"
                                  onClick={() => handleUploadClick(docType)}
                                  disabled={isUploading}
                                >
                                  {isUploading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4" />
                                  )}
                                </Button>
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300"
                                    onClick={() => onDelete(doc.id)}
                                    disabled={deletingId === doc.id}
                                  >
                                    {deletingId === doc.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          {isEditing ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-orange-400"
                              onClick={() => handleUploadClick(docType)}
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4 mr-2" />
                              )}
                              Upload Document
                            </Button>
                          ) : (
                            <p className="text-gray-500 text-sm">Not uploaded</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Empty State */}
        {documents.length === 0 && (
          <div className="text-center py-12 bg-gray-800/30 rounded-lg">
            <FileText className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-white font-medium mb-2">No Documents Uploaded</p>
            <p className="text-gray-400 text-sm mb-4">
              Upload your documents to complete your profile verification
            </p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
