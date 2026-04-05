'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface CreateTicketPageProps {
  partnerSubrole: 'ba' | 'bp' | 'cp'
}

const categories = [
  { value: 'payout_commission', label: 'Payout & Commission' },
  { value: 'sales_support', label: 'Sales Support' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'account_management', label: 'Account Management' },
  { value: 'training_resources', label: 'Training & Resources' },
  { value: 'compliance_legal', label: 'Compliance & Legal' },
  { value: 'customer_issues', label: 'Customer Issues' },
  { value: 'partnership_management', label: 'Partnership Management' },
  { value: 'general', label: 'General Inquiry' },
]

const priorities = [
  { value: 'low', label: 'Low', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/50', desc: 'General questions, no urgency' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/50', desc: 'Needs attention within a few days' },
  { value: 'high', label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/50', desc: 'Affecting business operations' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/50', desc: 'Critical - immediate attention needed' },
]

interface TicketTemplate {
  name: string
  icon: string
  subject: string
  description: string
  category: string
  priority: string
}

const templates: TicketTemplate[] = [
  {
    name: 'Commission Issue',
    icon: '💰',
    subject: 'Commission Payout Issue - ',
    description: 'I have an issue regarding my commission payout.\n\nLoan Reference/Application ID: \nExpected Commission: \nActual Amount Received: \nDate of Disbursement: \n\nDetails of the issue:\n',
    category: 'payout_commission',
    priority: 'high'
  },
  {
    name: 'Login Problem',
    icon: '🔐',
    subject: 'Unable to Access Portal - ',
    description: 'I am experiencing login/access issues with the partner portal.\n\nType of Issue:\n- [ ] Cannot login\n- [ ] Forgot password\n- [ ] Account locked\n- [ ] Portal not loading\n\nBrowser used: \nError message (if any): \n\nSteps to reproduce:\n1. \n2. \n3. \n',
    category: 'technical',
    priority: 'medium'
  },
  {
    name: 'Training Request',
    icon: '📚',
    subject: 'Training/Resource Request - ',
    description: 'I would like to request training or resources.\n\nTopic: \nPreferred format:\n- [ ] Online session\n- [ ] Documentation\n- [ ] Video tutorial\n- [ ] In-person training\n\nPreferred timing: \nNumber of attendees: \n\nAdditional details:\n',
    category: 'training_resources',
    priority: 'low'
  },
  {
    name: 'Complaint',
    icon: '⚠️',
    subject: 'Complaint - ',
    description: 'I would like to raise a formal complaint.\n\nNature of Complaint:\n- [ ] Service quality\n- [ ] Response delay\n- [ ] Incorrect processing\n- [ ] Staff behavior\n- [ ] Other\n\nDate of incident: \nPersonnel involved (if any): \n\nDetailed description:\n\nExpected resolution:\n',
    category: 'general',
    priority: 'high'
  },
  {
    name: 'Partnership Query',
    icon: '🤝',
    subject: 'Partnership Inquiry - ',
    description: 'I have a query regarding my partnership arrangement.\n\nQuery type:\n- [ ] Agreement terms\n- [ ] Sub-partner enrollment\n- [ ] Territory/product expansion\n- [ ] Performance metrics\n- [ ] Compliance requirements\n\nDetails:\n',
    category: 'partnership_management',
    priority: 'medium'
  }
]

const SUBJECT_MIN = 10
const SUBJECT_MAX = 200
const DESC_MIN = 30
const DESC_MAX = 5000

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function CreateTicketPage({ partnerSubrole }: CreateTicketPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('medium')
  const [isConfidential, setIsConfidential] = useState(false)
  const [isUrgentOverride, setIsUrgentOverride] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [createdTicketNumber, setCreatedTicketNumber] = useState('')

  // Payout application linkage (from URL params)
  const payoutApplicationId = searchParams.get('payout_application_id')
  const payoutApplicationType = searchParams.get('payout_application_type') as 'BA' | 'BP' | 'CP' | null
  const payoutAppId = searchParams.get('payout_app_id')

  // File upload
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Draft auto-save key
  const draftKey = `loanz360_ticket_draft_${partnerSubrole}`

  // Pre-fill from payout application context or load draft
  useEffect(() => {
    if (payoutAppId && payoutApplicationType) {
      // Pre-fill for payout application ticket
      setSubject(`Payout Query - ${payoutAppId}`)
      setDescription(`I have a query regarding my payout application.\n\nApplication ID: ${payoutAppId}\nPartner Type: ${payoutApplicationType}\n\nDetails of the issue:\n`)
      setCategory('payout_commission')
      setPriority('high')
      return
    }

    // Load draft from localStorage
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.subject) setSubject(draft.subject)
        if (draft.description) setDescription(draft.description)
        if (draft.category) setCategory(draft.category)
        if (draft.priority) setPriority(draft.priority)
        if (draft.isConfidential) setIsConfidential(draft.isConfidential)
      }
    } catch {}
  }, [])

  // Auto-save draft every 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (subject || description) {
        localStorage.setItem(draftKey, JSON.stringify({ subject, description, category, priority, isConfidential }))
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [subject, description, category, priority, isConfidential])

  const clearDraft = () => {
    localStorage.removeItem(draftKey)
  }

  const applyTemplate = (template: TicketTemplate) => {
    setSubject(template.subject)
    setDescription(template.description)
    setCategory(template.category)
    setPriority(template.priority)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...dropped])
  }

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (subject.length < SUBJECT_MIN) {
      setError(`Subject must be at least ${SUBJECT_MIN} characters`)
      return
    }
    if (description.length < DESC_MIN) {
      setError(`Description must be at least ${DESC_MIN} characters`)
      return
    }
    if (!category) {
      setError('Please select a category')
      return
    }

    try {
      setSubmitting(true)
      const payload: Record<string, unknown> = {
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority: isUrgentOverride ? 'urgent' : priority,
        is_confidential: isConfidential,
      }

      // Include payout application linkage if present
      if (payoutApplicationId && payoutApplicationType) {
        payload.payout_application_id = payoutApplicationId
        payload.payout_application_type = payoutApplicationType
        if (payoutAppId) payload.payout_app_id = payoutAppId
      }

      const res = await fetch('/api/partner-support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create ticket')
        return
      }

      const ticketId = data.ticket?.id
      setCreatedTicketNumber(data.ticket?.ticket_number || '')

      // Upload attachments if any
      if (ticketId && files.length > 0) {
        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)
          await fetch(`/api/partner-support/tickets/${ticketId}/attachments`, {
            method: 'POST',
            body: formData
          })
        }
      }

      clearDraft()
      setShowSuccess(true)

      setTimeout(() => {
        router.push(`/partners/${partnerSubrole}/support-tickets/${ticketId}`)
      }, 2000)
    } catch {
      setError('An error occurred while creating the ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const subjectProgress = Math.min(100, (subject.length / SUBJECT_MAX) * 100)
  const descProgress = Math.min(100, (description.length / DESC_MAX) * 100)

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold font-poppins text-white mb-2">Ticket Created Successfully!</h2>
          <p className="text-gray-400">Ticket {createdTicketNumber} has been submitted.</p>
          <p className="text-gray-500 text-sm mt-2">Redirecting to ticket details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold font-poppins text-white">Create Support Ticket</h1>
            <p className="text-gray-400 mt-1">Submit a new support request</p>
          </div>
        </div>

        {/* Templates */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Templates</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {templates.map(template => (
              <button key={template.name} onClick={() => applyTemplate(template)}
                className="bg-white/5 border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 hover:border-orange-500/50 transition-all">
                <div className="text-2xl mb-1">{template.icon}</div>
                <div className="text-xs text-gray-300 font-medium">{template.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
              placeholder="Brief summary of your issue..."
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs ${subject.length < SUBJECT_MIN ? 'text-red-400' : 'text-gray-500'}`}>
                {subject.length < SUBJECT_MIN ? `Min ${SUBJECT_MIN} characters` : ''}
              </span>
              <span className="text-xs text-gray-500">{subject.length}/{SUBJECT_MAX}</span>
            </div>
            <div className="w-full h-1 bg-gray-800 rounded-full mt-1">
              <div className={`h-1 rounded-full transition-all ${subject.length < SUBJECT_MIN ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${subjectProgress}%` }} />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Priority <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {priorities.map(p => (
                <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                  className={`rounded-lg p-3 text-left border transition-all ${
                    priority === p.value
                      ? `${p.bg} border-2`
                      : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                  }`}>
                  <div className={`font-semibold text-sm ${priority === p.value ? p.color : 'text-gray-400'}`}>
                    {p.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
              placeholder="Describe your issue in detail. Include any relevant reference numbers, dates, and steps to reproduce..."
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none h-48"
              required
            />
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs ${description.length < DESC_MIN ? 'text-red-400' : 'text-gray-500'}`}>
                {description.length < DESC_MIN ? `Min ${DESC_MIN} characters` : ''}
              </span>
              <span className="text-xs text-gray-500">{description.length}/{DESC_MAX}</span>
            </div>
            <div className="w-full h-1 bg-gray-800 rounded-full mt-1">
              <div className={`h-1 rounded-full transition-all ${description.length < DESC_MIN ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${descProgress}%` }} />
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Attachments (optional)</label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragOver ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-900'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <svg className="w-10 h-10 mx-auto text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-400 text-sm">Drag and drop files here or{' '}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-orange-400 hover:text-orange-300 font-medium">
                  browse
                </button>
              </p>
              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-white text-sm">{file.name}</span>
                      <span className="text-gray-500 text-xs ml-2">{formatBytes(file.size)}</span>
                    </div>
                    <button type="button" onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500" />
              <span className="text-gray-300 text-sm">Mark as Confidential</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isUrgentOverride} onChange={(e) => setIsUrgentOverride(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500" />
              <span className="text-gray-300 text-sm">Override to Urgent Priority</span>
            </label>
          </div>

          {/* Help Box */}
          <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
            <h4 className="text-blue-400 font-medium text-sm mb-2">Tips for faster resolution</h4>
            <ul className="text-blue-400/80 text-xs space-y-1">
              <li>- Include relevant reference numbers (loan IDs, application numbers)</li>
              <li>- Provide step-by-step details if reporting a technical issue</li>
              <li>- Attach screenshots or documents that help explain the issue</li>
              <li>- Select the correct category to ensure proper routing</li>
            </ul>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <button type="button" onClick={() => { clearDraft(); router.back() }}
              className="text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Draft auto-saved</span>
              <button type="submit" disabled={submitting || subject.length < SUBJECT_MIN || description.length < DESC_MIN || !category}
                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg">
                {submitting ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
