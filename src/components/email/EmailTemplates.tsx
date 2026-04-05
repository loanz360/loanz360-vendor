'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  FileText,
  Users,
  Building2,
  Eye,
  Check,
  Mail,
  HandshakeIcon,
  Clock,
  AlertCircle,
  PartyPopper,
  CalendarCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailTemplatesProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: { subject: string; body_html: string }) => void
}

type TemplateCategory = 'Customer Communication' | 'Partner Communication' | 'Internal'

interface EmailTemplate {
  id: string
  title: string
  category: TemplateCategory
  subject: string
  body_html: string
  icon: React.ReactNode
  variables: string[]
}

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

const TEMPLATES: EmailTemplate[] = [
  {
    id: 'lead-followup',
    title: 'Lead Follow-Up',
    category: 'Customer Communication',
    icon: <Mail className="h-4 w-4" />,
    subject: 'Thank you for your interest in {LoanType} - LOANZ360',
    variables: ['CustomerName', 'LoanType', 'AgentName', 'AgentPhone'],
    body_html: `<p>Dear {CustomerName},</p>
<p>Thank you for your interest in <strong>{LoanType}</strong>. We appreciate you choosing LOANZ360 for your financial needs.</p>
<p>I would love to walk you through our competitive rates and help you find the best option suited to your requirements. Could we schedule a brief call at your convenience?</p>
<p>Here is what we can help you with:</p>
<ul>
  <li>Pre-approved offers from 50+ lending partners</li>
  <li>Competitive interest rates starting from the lowest in the market</li>
  <li>Quick disbursal within 24-72 hours</li>
  <li>Minimal documentation with digital processing</li>
</ul>
<p>Feel free to reach out to me directly at <strong>{AgentPhone}</strong> or simply reply to this email.</p>
<p>Best regards,<br/>{AgentName}<br/>LOANZ360</p>`,
  },
  {
    id: 'document-request',
    title: 'Document Request',
    category: 'Customer Communication',
    icon: <FileText className="h-4 w-4" />,
    subject: 'Documents Required for Your {LoanType} Application - LOANZ360',
    variables: ['CustomerName', 'LoanType', 'DocumentList', 'Deadline', 'AgentName'],
    body_html: `<p>Dear {CustomerName},</p>
<p>To process your <strong>{LoanType}</strong> application, we require the following documents:</p>
<p>{DocumentList}</p>
<p>Please submit the above documents by <strong>{Deadline}</strong> to avoid any delay in processing your application.</p>
<p><strong>How to submit:</strong></p>
<ul>
  <li>Upload directly through your LOANZ360 portal</li>
  <li>Reply to this email with scanned copies</li>
  <li>Share via WhatsApp to our official number</li>
</ul>
<p>All documents are securely encrypted and handled in compliance with data protection regulations.</p>
<p>If you have any questions about the required documents, please do not hesitate to reach out.</p>
<p>Best regards,<br/>{AgentName}<br/>LOANZ360</p>`,
  },
  {
    id: 'loan-status-update',
    title: 'Loan Status Update',
    category: 'Customer Communication',
    icon: <Clock className="h-4 w-4" />,
    subject: 'Application #{ApplicationId} Status Update - LOANZ360',
    variables: ['CustomerName', 'ApplicationId', 'Status', 'NextSteps', 'AgentName'],
    body_html: `<p>Dear {CustomerName},</p>
<p>We are writing to update you on the status of your loan application.</p>
<table style="border-collapse:collapse;width:100%;margin:16px 0;">
  <tr style="background:#1e293b;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Application ID</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">#{ApplicationId}</td>
  </tr>
  <tr style="background:#0f172a;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Current Status</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#FF6700;font-weight:600;">{Status}</td>
  </tr>
</table>
<p><strong>Next Steps:</strong><br/>{NextSteps}</p>
<p>You can track your application in real time by logging into your LOANZ360 portal.</p>
<p>Best regards,<br/>{AgentName}<br/>LOANZ360</p>`,
  },
  {
    id: 'partner-welcome',
    title: 'Partner Welcome',
    category: 'Partner Communication',
    icon: <HandshakeIcon className="h-4 w-4" />,
    subject: 'Welcome to LOANZ360 Partner Network!',
    variables: ['PartnerName', 'PartnerCode', 'RMName', 'RMPhone'],
    body_html: `<p>Dear {PartnerName},</p>
<p>Welcome to the <strong>LOANZ360 Partner Network</strong>! We are thrilled to have you on board.</p>
<p>Your partner details:</p>
<table style="border-collapse:collapse;width:100%;margin:16px 0;">
  <tr style="background:#1e293b;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Partner Code</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{PartnerCode}</td>
  </tr>
  <tr style="background:#0f172a;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Relationship Manager</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{RMName} ({RMPhone})</td>
  </tr>
</table>
<p><strong>Getting started:</strong></p>
<ul>
  <li>Log in to your Partner Portal at portal.loanz360.com</li>
  <li>Complete your KYC verification</li>
  <li>Access our product catalog and commission structure</li>
  <li>Start referring leads and earn competitive commissions (1-3%)</li>
</ul>
<p>Our dedicated partner support team is available to assist you at every step.</p>
<p>Best regards,<br/>The LOANZ360 Team</p>`,
  },
  {
    id: 'emi-reminder',
    title: 'EMI Reminder',
    category: 'Customer Communication',
    icon: <AlertCircle className="h-4 w-4" />,
    subject: 'EMI Payment Reminder - Due on {DueDate}',
    variables: ['CustomerName', 'Amount', 'LoanType', 'DueDate', 'AccountNumber'],
    body_html: `<p>Dear {CustomerName},</p>
<p>This is a friendly reminder that your EMI payment is approaching.</p>
<table style="border-collapse:collapse;width:100%;margin:16px 0;">
  <tr style="background:#1e293b;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Loan Type</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{LoanType}</td>
  </tr>
  <tr style="background:#0f172a;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">EMI Amount</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#FF6700;font-weight:600;">\u20B9{Amount}</td>
  </tr>
  <tr style="background:#1e293b;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Due Date</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{DueDate}</td>
  </tr>
  <tr style="background:#0f172a;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Account</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{AccountNumber}</td>
  </tr>
</table>
<p>Please ensure sufficient balance in your linked account for auto-debit, or make a manual payment through your LOANZ360 portal.</p>
<p>Timely payments help maintain a healthy credit score.</p>
<p>Best regards,<br/>LOANZ360 Collections Team</p>`,
  },
  {
    id: 'approval-congratulations',
    title: 'Approval Congratulations',
    category: 'Customer Communication',
    icon: <PartyPopper className="h-4 w-4" />,
    subject: 'Congratulations! Your {LoanType} Has Been Approved!',
    variables: ['CustomerName', 'LoanType', 'Amount', 'InterestRate', 'Tenure', 'AgentName'],
    body_html: `<p>Dear {CustomerName},</p>
<p>\ud83c\udf89 <strong>Congratulations!</strong></p>
<p>We are delighted to inform you that your <strong>{LoanType}</strong> application has been <span style="color:#22c55e;font-weight:700;">APPROVED</span>!</p>
<table style="border-collapse:collapse;width:100%;margin:16px 0;">
  <tr style="background:#1e293b;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Approved Amount</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#22c55e;font-weight:700;">\u20B9{Amount}</td>
  </tr>
  <tr style="background:#0f172a;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Interest Rate</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{InterestRate}% p.a.</td>
  </tr>
  <tr style="background:#1e293b;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Tenure</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{Tenure}</td>
  </tr>
</table>
<p><strong>Next steps for disbursal:</strong></p>
<ol>
  <li>Review and e-sign the loan agreement</li>
  <li>Set up eNACH / UPI AutoPay for EMI</li>
  <li>Funds will be disbursed within 24-48 hours</li>
</ol>
<p>Log in to your portal to complete the remaining steps.</p>
<p>Best regards,<br/>{AgentName}<br/>LOANZ360</p>`,
  },
  {
    id: 'rejection-suggestions',
    title: 'Rejection with Suggestions',
    category: 'Customer Communication',
    icon: <AlertCircle className="h-4 w-4" />,
    subject: 'Update on Your Loan Application - LOANZ360',
    variables: ['CustomerName', 'LoanType', 'Reason', 'AlternativeLoan', 'AgentName'],
    body_html: `<p>Dear {CustomerName},</p>
<p>We regret to inform you that your <strong>{LoanType}</strong> application could not be approved at this time.</p>
<p><strong>Reason:</strong> {Reason}</p>
<p>However, we would like you to know that this is not the end of the road. Based on your profile, you may be eligible for:</p>
<ul>
  <li><strong>{AlternativeLoan}</strong> - with different eligibility criteria</li>
  <li>Secured loan options with collateral</li>
  <li>Joint application with a co-applicant</li>
</ul>
<p><strong>Steps to improve your eligibility:</strong></p>
<ol>
  <li>Review and improve your credit score</li>
  <li>Clear any existing outstanding dues</li>
  <li>Provide additional income documentation</li>
  <li>Consider a co-applicant for better approval chances</li>
</ol>
<p>I would be happy to discuss alternative options that may work for you. Please feel free to reach out.</p>
<p>Best regards,<br/>{AgentName}<br/>LOANZ360</p>`,
  },
  {
    id: 'meeting-confirmation',
    title: 'Meeting Confirmation',
    category: 'Internal',
    icon: <CalendarCheck className="h-4 w-4" />,
    subject: 'Meeting Confirmed: {Purpose} on {Date}',
    variables: ['RecipientName', 'Date', 'Time', 'Purpose', 'Location', 'AgentName'],
    body_html: `<p>Dear {RecipientName},</p>
<p>This confirms our meeting with the following details:</p>
<table style="border-collapse:collapse;width:100%;margin:16px 0;">
  <tr style="background:#1e293b;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Date</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{Date}</td>
  </tr>
  <tr style="background:#0f172a;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Time</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{Time}</td>
  </tr>
  <tr style="background:#1e293b;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Purpose</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#FF6700;font-weight:600;">{Purpose}</td>
  </tr>
  <tr style="background:#0f172a;">
    <td style="padding:10px 16px;border:1px solid #334155;color:#94a3b8;font-weight:600;">Location</td>
    <td style="padding:10px 16px;border:1px solid #334155;color:#f1f5f9;">{Location}</td>
  </tr>
</table>
<p>Please ensure to bring any relevant documents or information that may be needed for the discussion.</p>
<p>If you need to reschedule, kindly inform us at least 24 hours in advance.</p>
<p>Looking forward to our meeting.</p>
<p>Best regards,<br/>{AgentName}<br/>LOANZ360</p>`,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<TemplateCategory, { color: string; icon: React.ReactNode }> = {
  'Customer Communication': {
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Users className="h-3 w-3" />,
  },
  'Partner Communication': {
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <HandshakeIcon className="h-3 w-3" />,
  },
  Internal: {
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: <Building2 className="h-3 w-3" />,
  },
}

/** Highlight {VariableName} placeholders in orange */
function highlightVariables(text: string): React.ReactNode[] {
  const parts = text.split(/(\{[A-Za-z]+\})/)
  return parts.map((part, i) =>
    /^\{[A-Za-z]+\}$/.test(part) ? (
      <span key={i} className="text-[#FF6700] font-semibold">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

/** Strip HTML tags for plain-text preview */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmailTemplates({ isOpen, onClose, onSelectTemplate }: EmailTemplatesProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All')
  const [previewId, setPreviewId] = useState<string | null>(null)

  const categories: (TemplateCategory | 'All')[] = [
    'All',
    'Customer Communication',
    'Partner Communication',
    'Internal',
  ]

  const filtered = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchesCategory = activeCategory === 'All' || t.category === activeCategory
      const matchesSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [search, activeCategory])

  const previewTemplate = previewId ? TEMPLATES.find((t) => t.id === previewId) : null

  const handleSelect = (template: EmailTemplate) => {
    onSelectTemplate({ subject: template.subject, body_html: template.body_html })
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-8 lg:inset-16 z-50 flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* ---- Header ---- */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#FF6700]" />
                <h2 className="text-lg font-semibold text-slate-100">Email Templates</h2>
                <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                  {filtered.length} templates
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* ---- Toolbar ---- */}
            <div className="px-6 py-3 border-b border-slate-700 flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-[#FF6700]/40"
                />
              </div>

              {/* Category tabs */}
              <div className="flex gap-1.5 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                      activeCategory === cat
                        ? 'bg-[#FF6700]/20 text-[#FF6700] border-[#FF6700]/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Body ---- */}
            <div className="flex-1 flex overflow-hidden">
              {/* Template list */}
              <div
                className={cn(
                  'overflow-y-auto p-4 space-y-3',
                  previewTemplate ? 'w-1/2 border-r border-slate-700' : 'w-full'
                )}
              >
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <Search className="h-10 w-10 mb-3 opacity-40" />
                    <p className="text-sm">No templates found</p>
                  </div>
                )}

                <div
                  className={cn(
                    'grid gap-3',
                    previewTemplate
                      ? 'grid-cols-1'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  )}
                >
                  {filtered.map((template) => {
                    const catCfg = CATEGORY_CONFIG[template.category]
                    const isActive = previewId === template.id

                    return (
                      <div
                        key={template.id}
                        className={cn(
                          'group relative flex flex-col rounded-lg border p-4 transition-all cursor-pointer',
                          isActive
                            ? 'bg-slate-800 border-[#FF6700]/50 ring-1 ring-[#FF6700]/30'
                            : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                        )}
                        onClick={() => setPreviewId(isActive ? null : template.id)}
                      >
                        {/* Title row */}
                        <div className="flex items-start gap-2 mb-2">
                          <span className="mt-0.5 text-slate-400">{template.icon}</span>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-slate-100 truncate">
                              {template.title}
                            </h3>
                            <Badge
                              variant="outline"
                              className={cn('mt-1 text-[10px] gap-1', catCfg.color)}
                            >
                              {catCfg.icon}
                              {template.category}
                            </Badge>
                          </div>
                        </div>

                        {/* Subject with highlighted vars */}
                        <p className="text-xs text-slate-400 mb-2 line-clamp-1">
                          <span className="text-slate-500 font-medium">Subject: </span>
                          {highlightVariables(template.subject)}
                        </p>

                        {/* Preview text */}
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                          {stripHtml(template.body_html).slice(0, 120)}...
                        </p>

                        {/* Variables */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {template.variables.slice(0, 4).map((v) => (
                            <span
                              key={v}
                              className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#FF6700]/10 text-[#FF6700] border border-[#FF6700]/20"
                            >
                              {`{${v}}`}
                            </span>
                          ))}
                          {template.variables.length > 4 && (
                            <span className="text-[10px] text-slate-500">
                              +{template.variables.length - 4} more
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-auto">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-8 text-xs text-slate-300 hover:text-slate-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewId(previewId === template.id ? null : template.id)
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs bg-[#FF6700] hover:bg-[#FF6700]/90 text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelect(template)
                            }}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Use Template
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Preview panel */}
              <AnimatePresence>
                {previewTemplate && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="w-1/2 flex flex-col overflow-hidden"
                  >
                    {/* Preview header */}
                    <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/30 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-slate-100">
                          {previewTemplate.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Template Preview</p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-white"
                        onClick={() => handleSelect(previewTemplate)}
                      >
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Use This Template
                      </Button>
                    </div>

                    {/* Preview subject */}
                    <div className="px-5 py-3 border-b border-slate-700/50">
                      <p className="text-xs text-slate-500 mb-1">Subject</p>
                      <p className="text-sm text-slate-200">
                        {highlightVariables(previewTemplate.subject)}
                      </p>
                    </div>

                    {/* Preview body */}
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                        <div
                          className="prose prose-sm prose-invert max-w-none
                            prose-p:text-slate-300 prose-p:leading-relaxed
                            prose-strong:text-slate-100
                            prose-li:text-slate-300
                            prose-td:text-slate-300
                            prose-th:text-slate-400
                            [&_span.variable]:text-[#FF6700] [&_span.variable]:font-semibold"
                          dangerouslySetInnerHTML={{
                            __html: previewTemplate.body_html.replace(
                              /\{([A-Za-z]+)\}/g,
                              '<span class="variable">{$1}</span>'
                            ),
                          }}
                        />
                      </div>

                      {/* Variables reference */}
                      <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <p className="text-xs font-medium text-slate-400 mb-2">
                          Template Variables
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {previewTemplate.variables.map((v) => (
                            <span
                              key={v}
                              className="inline-flex items-center text-xs px-2 py-1 rounded bg-[#FF6700]/10 text-[#FF6700] border border-[#FF6700]/20"
                            >
                              {`{${v}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
