'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText, CheckCircle, Clock, XCircle,
  Upload, Loader2, ChevronDown, ChevronUp
} from 'lucide-react'

interface DocumentItem {
  id: string
  name: string
  status: 'pending' | 'uploaded' | 'verified' | 'rejected'
  required: boolean
  uploaded_at?: string
  notes?: string
}

interface DocumentChecklistProps {
  entityId: string
  entityType: 'contact' | 'positive_contact' | 'lead'
  loanType?: string
  compact?: boolean
}

const LOAN_DOCUMENTS: Record<string, Array<{ name: string; required: boolean }>> = {
  home_loan: [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Salary Slips (3 months)', required: true },
    { name: 'Bank Statements (6 months)', required: true },
    { name: 'Form 16 / ITR (2 years)', required: true },
    { name: 'Property Documents', required: true },
    { name: 'Sale Agreement', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Passport Photos', required: false },
    { name: 'Employment Letter', required: false },
  ],
  personal_loan: [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Salary Slips (3 months)', required: true },
    { name: 'Bank Statements (6 months)', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Form 16 / ITR', required: false },
    { name: 'Employment Letter', required: false },
  ],
  business_loan: [
    { name: 'PAN Card (Personal)', required: true },
    { name: 'PAN Card (Business)', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'GST Registration', required: true },
    { name: 'ITR (3 years)', required: true },
    { name: 'Bank Statements (12 months)', required: true },
    { name: 'Business Proof', required: true },
    { name: 'Balance Sheet & P&L', required: true },
    { name: 'Office Address Proof', required: false },
    { name: 'Business Vintage Proof', required: false },
  ],
  car_loan: [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Salary Slips (3 months)', required: true },
    { name: 'Bank Statements (6 months)', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Proforma Invoice', required: true },
    { name: 'Driving License', required: false },
  ],
  default: [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Income Proof', required: true },
    { name: 'Bank Statements (6 months)', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Photo ID', required: false },
  ],
}

// Bug #14 fix: Normalize loan type to match template keys
function normalizeLoanType(loanType?: string): string {
  if (!loanType) return 'default'
  const normalized = loanType.toLowerCase().replace(/\s+/g, '_')
  return LOAN_DOCUMENTS[normalized] ? normalized : 'default'
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Pending' },
  uploaded: { icon: Upload, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Uploaded' },
  verified: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Verified' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Rejected' },
}

export default function DocumentChecklist({
  entityId,
  entityType,
  loanType,
  compact = false,
}: DocumentChecklistProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(!compact)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [entityId, loanType])

  const loadDocuments = async () => {
    setIsLoading(true)
    try {
      // Try fetching saved document statuses for this entity
      const response = await fetch(
        `/api/cro/documents?entityId=${entityId}&entityType=${entityType}`
      )
      const result = await response.json()

      if (result.success && result.data?.length > 0) {
        setDocuments(result.data)
      } else {
        // Initialize from template with normalized loan type key
        const normalizedKey = normalizeLoanType(loanType)
        const template = LOAN_DOCUMENTS[normalizedKey]
        setDocuments(
          template.map((doc, idx) => ({
            id: `${entityId}-doc-${idx}`,
            name: doc.name,
            status: 'pending' as const,
            required: doc.required,
          }))
        )
      }
    } catch {
      // Fallback to template
      const normalizedKey = normalizeLoanType(loanType)
      const template = LOAN_DOCUMENTS[normalizedKey]
      setDocuments(
        template.map((doc, idx) => ({
          id: `${entityId}-doc-${idx}`,
          name: doc.name,
          status: 'pending' as const,
          required: doc.required,
        }))
      )
    } finally {
      setIsLoading(false)
    }
  }

  const [statusError, setStatusError] = useState<string | null>(null)

  const updateStatus = async (docId: string, newStatus: DocumentItem['status']) => {
    setUpdatingId(docId)
    setStatusError(null)
    // Save previous status for rollback on error
    const previousDoc = documents.find(d => d.id === docId)
    try {
      const response = await fetch('/api/cro/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          entityType,
          documentId: docId,
          status: newStatus,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update document status')
      }

      setDocuments(prev =>
        prev.map(d =>
          d.id === docId
            ? { ...d, status: newStatus, uploaded_at: newStatus === 'uploaded' ? new Date().toISOString() : d.uploaded_at }
            : d
        )
      )
    } catch (err) {
      // Revert to previous status on error
      if (previousDoc) {
        setDocuments(prev =>
          prev.map(d => (d.id === docId ? { ...d, status: previousDoc.status } : d))
        )
      }
      setStatusError(`Failed to update "${documents.find(d => d.id === docId)?.name}" status. Please try again.`)
      setTimeout(() => setStatusError(null), 4000)
    } finally {
      setUpdatingId(null)
    }
  }

  const total = documents.length
  const completed = documents.filter(d => d.status === 'verified' || d.status === 'uploaded').length
  const requiredDocs = documents.filter(d => d.required)
  const requiredCompleted = requiredDocs.filter(d => d.status === 'verified' || d.status === 'uploaded').length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header with progress */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-600/20 rounded-lg flex items-center justify-center">
            <FileText className="w-[18px] h-[18px] text-orange-500" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">Document Checklist</h3>
            <p className="text-xs text-gray-500">
              {requiredCompleted}/{requiredDocs.length} required &middot; {completed}/{total} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#374151"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={progress === 100 ? '#22c55e' : '#f97316'}
                strokeWidth="3"
                strokeDasharray={`${progress}, 100`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
              {progress}%
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Status update error */}
      {statusError && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-red-400 text-xs bg-red-900/20 px-3 py-2 rounded-lg">
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {statusError}
        </div>
      )}

      {/* Document list */}
      {isExpanded && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {documents.map(doc => {
            const config = STATUS_CONFIG[doc.status]
            const StatusIcon = config.icon

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <StatusIcon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">
                    {doc.name}
                    {doc.required && <span className="text-red-400 ml-1">*</span>}
                  </p>
                </div>

                {/* Status toggle */}
                {updatingId === doc.id ? (
                  <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                ) : (
                  <select
                    value={doc.status}
                    onChange={e => updateStatus(doc.id, e.target.value as DocumentItem['status'])}
                    className={`text-xs px-2 py-1 rounded border-0 ${config.bg} ${config.color} bg-transparent cursor-pointer focus:ring-1 focus:ring-orange-500 outline-none`}
                  >
                    <option value="pending" className="bg-gray-900 text-gray-400">Pending</option>
                    <option value="uploaded" className="bg-gray-900 text-blue-400">Uploaded</option>
                    <option value="verified" className="bg-gray-900 text-green-400">Verified</option>
                    <option value="rejected" className="bg-gray-900 text-red-400">Rejected</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
