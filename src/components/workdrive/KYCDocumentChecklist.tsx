'use client'

import { useState, useMemo } from 'react'
import {
  FileText,
  CreditCard,
  Building2,
  Landmark,
  Receipt,
  Car,
  Upload,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  MapPin,
  Briefcase,
  FileSpreadsheet,
  Home,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentStatus = 'pending' | 'uploaded' | 'verified' | 'rejected'

export interface ChecklistItem {
  key: string
  name: string
  description?: string
  status: DocumentStatus
  rejectionReason?: string
}

export interface KYCDocumentChecklistProps {
  loanType: string
  customerId?: string
  customerName?: string
  /** Called when the user clicks "Upload" on a specific document category */
  onUpload: (category: string) => void
  /** Optional: override the default status map (key → status + optional rejectionReason) */
  statusMap?: Record<string, { status: DocumentStatus; rejectionReason?: string }>
  /** Optional: callback when "View" is clicked */
  onView?: (category: string) => void
}

// ---------------------------------------------------------------------------
// Document definitions per loan type
// ---------------------------------------------------------------------------

interface DocDef {
  key: string
  name: string
  description?: string
}

const HOME_LOAN_DOCS: DocDef[] = [
  { key: 'AADHAAR', name: 'Aadhaar Card', description: 'Front & back copy of Aadhaar card' },
  { key: 'PAN', name: 'PAN Card', description: 'Clear copy of PAN card' },
  { key: 'BANK_STATEMENT_6M', name: 'Bank Statements (6 months)', description: 'Last 6 months bank statements from salary account' },
  { key: 'ITR_2Y', name: 'Income Tax Returns (2 years)', description: 'ITR-V / acknowledgement for last 2 assessment years' },
  { key: 'PROPERTY_DOCS', name: 'Property Documents', description: 'Sale deed, title deed, allotment letter, NOC' },
  { key: 'SALARY_SLIPS_3M', name: 'Salary Slips (3 months)', description: 'Last 3 months salary slips from current employer' },
  { key: 'EMPLOYMENT_PROOF', name: 'Employment Proof', description: 'Offer letter / appointment letter / employment certificate' },
  { key: 'ADDRESS_PROOF', name: 'Address Proof', description: 'Utility bill / rent agreement / passport' },
]

const PERSONAL_LOAN_DOCS: DocDef[] = [
  { key: 'AADHAAR', name: 'Aadhaar Card', description: 'Front & back copy of Aadhaar card' },
  { key: 'PAN', name: 'PAN Card', description: 'Clear copy of PAN card' },
  { key: 'BANK_STATEMENT_3M', name: 'Bank Statements (3 months)', description: 'Last 3 months bank statements from salary account' },
  { key: 'ITR_1Y', name: 'Income Tax Returns (1 year)', description: 'ITR-V for the last assessment year' },
  { key: 'SALARY_SLIPS_3M', name: 'Salary Slips (3 months)', description: 'Last 3 months salary slips from current employer' },
  { key: 'EMPLOYMENT_PROOF', name: 'Employment Proof', description: 'Offer letter / appointment letter / employment certificate' },
]

const BUSINESS_LOAN_DOCS: DocDef[] = [
  { key: 'AADHAAR', name: 'Aadhaar Card', description: 'Front & back copy of Aadhaar card' },
  { key: 'PAN', name: 'PAN Card', description: 'Clear copy of PAN card (individual + business)' },
  { key: 'BANK_STATEMENT_12M', name: 'Bank Statements (12 months)', description: 'Last 12 months bank statements from business current account' },
  { key: 'ITR_3Y', name: 'Income Tax Returns (3 years)', description: 'ITR-V for last 3 assessment years' },
  { key: 'GST_RETURNS_2Y', name: 'GST Returns (2 years)', description: 'GSTR-3B for last 24 months' },
  { key: 'BUSINESS_REGISTRATION', name: 'Business Registration', description: 'Certificate of incorporation / partnership deed / Udyam registration' },
  { key: 'FINANCIAL_STATEMENTS', name: 'Financial Statements', description: 'Audited P&L and balance sheet for last 2 years' },
  { key: 'BUSINESS_ADDRESS_PROOF', name: 'Business Address Proof', description: 'Utility bill / lease agreement for business premises' },
]

const VEHICLE_LOAN_DOCS: DocDef[] = [
  { key: 'AADHAAR', name: 'Aadhaar Card', description: 'Front & back copy of Aadhaar card' },
  { key: 'PAN', name: 'PAN Card', description: 'Clear copy of PAN card' },
  { key: 'BANK_STATEMENT_3M', name: 'Bank Statements (3 months)', description: 'Last 3 months bank statements' },
  { key: 'SALARY_SLIPS_3M', name: 'Salary Slips (3 months)', description: 'Last 3 months salary slips' },
  { key: 'VEHICLE_QUOTATION', name: 'Vehicle Quotation', description: 'Proforma invoice / quotation from dealer' },
  { key: 'DRIVING_LICENSE', name: 'Driving License', description: 'Valid driving license' },
]

const LAP_DOCS: DocDef[] = [
  ...HOME_LOAN_DOCS,
  { key: 'EXISTING_PROPERTY_DOCS', name: 'Existing Property Documents', description: 'Title deed, encumbrance certificate, property tax receipts for the mortgaged property' },
]

const LOAN_TYPE_DOCS: Record<string, DocDef[]> = {
  HOME_LOAN: HOME_LOAN_DOCS,
  PERSONAL_LOAN: PERSONAL_LOAN_DOCS,
  BUSINESS_LOAN: BUSINESS_LOAN_DOCS,
  VEHICLE_LOAN: VEHICLE_LOAN_DOCS,
  LAP: LAP_DOCS,
  LOAN_AGAINST_PROPERTY: LAP_DOCS,
}

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const DOC_ICON_MAP: Record<string, React.ElementType> = {
  AADHAAR: ShieldCheck,
  PAN: CreditCard,
  BANK_STATEMENT_3M: Landmark,
  BANK_STATEMENT_6M: Landmark,
  BANK_STATEMENT_12M: Landmark,
  ITR_1Y: Receipt,
  ITR_2Y: Receipt,
  ITR_3Y: Receipt,
  PROPERTY_DOCS: Home,
  EXISTING_PROPERTY_DOCS: Building2,
  SALARY_SLIPS_3M: FileSpreadsheet,
  EMPLOYMENT_PROOF: Briefcase,
  ADDRESS_PROOF: MapPin,
  GST_RETURNS_2Y: FileText,
  BUSINESS_REGISTRATION: Building2,
  FINANCIAL_STATEMENTS: FileSpreadsheet,
  BUSINESS_ADDRESS_PROOF: MapPin,
  VEHICLE_QUOTATION: Car,
  DRIVING_LICENSE: CreditCard,
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  verified: { label: 'Verified', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
  uploaded: { label: 'Under Review', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: Clock },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: XCircle },
  pending: { label: 'Not Uploaded', color: 'text-gray-500', bg: 'bg-gray-800 border-white/10', icon: AlertCircle },
}

// ---------------------------------------------------------------------------
// Loan type display name
// ---------------------------------------------------------------------------

const LOAN_TYPE_LABELS: Record<string, string> = {
  HOME_LOAN: 'Home Loan',
  PERSONAL_LOAN: 'Personal Loan',
  BUSINESS_LOAN: 'Business Loan',
  VEHICLE_LOAN: 'Vehicle Loan',
  LAP: 'Loan Against Property',
  LOAN_AGAINST_PROPERTY: 'Loan Against Property',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KYCDocumentChecklist({
  loanType,
  customerId,
  customerName,
  onUpload,
  statusMap = {},
  onView,
}: KYCDocumentChecklistProps) {
  const [expanded, setExpanded] = useState(true)

  const docs = useMemo(() => {
    const definitions = LOAN_TYPE_DOCS[loanType] ?? PERSONAL_LOAN_DOCS
    return definitions.map<ChecklistItem>((def) => {
      const override = statusMap[def.key]
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        status: override?.status ?? 'pending',
        rejectionReason: override?.rejectionReason,
      }
    })
  }, [loanType, statusMap])

  const stats = useMemo(() => {
    const total = docs.length
    const verified = docs.filter((d) => d.status === 'verified').length
    const uploaded = docs.filter((d) => d.status === 'uploaded').length
    const rejected = docs.filter((d) => d.status === 'rejected').length
    const pending = docs.filter((d) => d.status === 'pending').length
    const completionPct = total > 0 ? Math.round(((verified + uploaded) / total) * 100) : 0
    return { total, verified, uploaded, rejected, pending, completionPct }
  }, [docs])

  const loanLabel = LOAN_TYPE_LABELS[loanType] ?? loanType.replace(/_/g, ' ')

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900 text-white overflow-hidden">
      {/* ---- Header ---- */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 hover:bg-white/5 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-5 w-5 shrink-0 text-orange-400" />
          <div className="text-left min-w-0">
            <h3 className="text-sm font-semibold truncate">
              KYC Document Checklist &mdash; {loanLabel}
            </h3>
            {customerName && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                <User className="h-3 w-3 shrink-0" />
                {customerName}
                {customerId && <span className="text-gray-600">({customerId})</span>}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-400 hidden sm:inline">
            {stats.verified}/{stats.total} verified
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          {/* ---- Progress ---- */}
          <div className="px-5 py-3 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Completion</span>
              <span className="text-xs font-medium text-gray-300">{stats.completionPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  stats.completionPct === 100 ? 'bg-emerald-500' : stats.completionPct >= 50 ? 'bg-orange-500' : 'bg-orange-600'
                )}
                style={{ width: `${stats.completionPct}%` }}
              />
            </div>

            {/* Status summary chips */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {stats.verified > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> {stats.verified} Verified
                </span>
              )}
              {stats.uploaded > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-400">
                  <Clock className="h-3 w-3" /> {stats.uploaded} Under Review
                </span>
              )}
              {stats.rejected > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-400">
                  <XCircle className="h-3 w-3" /> {stats.rejected} Rejected
                </span>
              )}
              {stats.pending > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-2 py-0.5 text-[11px] text-gray-400">
                  <AlertCircle className="h-3 w-3" /> {stats.pending} Pending
                </span>
              )}
            </div>
          </div>

          {/* ---- Document list ---- */}
          <ul className="divide-y divide-white/5" role="list" aria-label="KYC document checklist">
            {docs.map((doc) => {
              const cfg = STATUS_CONFIG[doc.status]
              const StatusIcon = cfg.icon
              const DocIcon = DOC_ICON_MAP[doc.key] ?? FileText

              return (
                <li
                  key={doc.key}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]',
                  )}
                >
                  {/* Icon */}
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', cfg.bg)}>
                    <DocIcon className={cn('h-4 w-4', cfg.color)} />
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{doc.name}</p>
                    {doc.description && (
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{doc.description}</p>
                    )}
                    {doc.status === 'rejected' && doc.rejectionReason && (
                      <p className="text-[11px] text-red-400 mt-0.5 truncate">
                        Reason: {doc.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={cn(
                      'hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border shrink-0',
                      cfg.bg,
                      cfg.color,
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(doc.status === 'uploaded' || doc.status === 'verified') && (
                      <button
                        type="button"
                        onClick={() => onView?.(doc.key)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200"
                        aria-label={`View ${doc.name}`}
                        title="View document"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {(doc.status === 'pending' || doc.status === 'rejected') && (
                      <button
                        type="button"
                        onClick={() => onUpload(doc.key)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                        aria-label={`Upload ${doc.name}`}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{doc.status === 'rejected' ? 'Re-upload' : 'Upload'}</span>
                      </button>
                    )}
                    {doc.status === 'uploaded' && (
                      <span className="text-[11px] text-orange-400 sm:hidden">
                        <Clock className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
