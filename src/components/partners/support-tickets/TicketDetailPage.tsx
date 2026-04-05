'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { useTicketDetailRealtime, RealtimeConnectionIndicator } from '@/hooks/useSupportTicketRealtime'

interface Message {
  id: string
  ticket_id: string
  sender_id: string
  sender_name: string
  sender_type: 'partner' | 'employee' | 'system'
  sender_role: string
  message: string
  is_internal: boolean
  reply_to_id?: string
  created_at: string
}

interface Attachment {
  id: string
  ticket_id: string
  file_name: string
  file_size: number
  file_type: string
  file_url: string
  uploaded_by: string
  uploaded_by_name: string
  created_at: string
}

interface ActivityLog {
  id: string
  action: string
  description: string
  performed_by: string
  performed_by_name: string
  created_at: string
}

interface TicketDetail {
  id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  partner_id: string
  partner_name: string
  partner_email: string
  partner_sub_role: string
  assigned_to_partner_support_id: string | null
  assigned_to_partner_support_name: string | null
  routed_to_employee_id: string | null
  routed_to_department: string | null
  sla_deadline: string
  sla_breached: boolean
  escalation_level: number
  reopened_count: number
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  response_time_hours: number | null
  resolution_time_hours: number | null
  satisfaction_rating: number | null
  satisfaction_feedback: string | null
  is_confidential: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

interface TicketDetailPageProps {
  ticketId: string
  partnerSubrole: 'ba' | 'bp' | 'cp'
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/50',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/50'
}

const statusColors: Record<string, string> = {
  new: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  pending_partner: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  pending_internal: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/50',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  on_hold: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  escalated: 'bg-red-500/20 text-red-400 border-red-500/50',
  reopened: 'bg-pink-500/20 text-pink-400 border-pink-500/50'
}

const categoryLabels: Record<string, string> = {
  payout_commission: 'Payout & Commission',
  sales_support: 'Sales Support',
  technical: 'Technical Issue',
  account_management: 'Account Management',
  training_resources: 'Training & Resources',
  compliance_legal: 'Compliance & Legal',
  customer_issues: 'Customer Issues',
  partnership_management: 'Partnership Management',
  general: 'General Inquiry'
}

function getSlaCountdown(slaDeadline: string, slaBreached: boolean) {
  if (slaBreached) return { text: 'SLA BREACHED', color: 'text-red-400', barColor: 'bg-red-500', percent: 100 }
  const diffMs = new Date(slaDeadline).getTime() - Date.now()
  if (diffMs <= 0) return { text: 'BREACHED', color: 'text-red-400', barColor: 'bg-red-500', percent: 100 }
  const h = Math.floor(diffMs / 3600000)
  const m = Math.floor((diffMs % 3600000) / 60000)
  if (h < 1) return { text: `${m}m left`, color: 'text-red-400', barColor: 'bg-red-500', percent: 90 }
  if (h < 4) return { text: `${h}h ${m}m left`, color: 'text-orange-400', barColor: 'bg-orange-500', percent: 70 }
  if (h < 24) return { text: `${h}h left`, color: 'text-yellow-400', barColor: 'bg-yellow-500', percent: 40 }
  return { text: `${Math.floor(h / 24)}d ${h % 24}h left`, color: 'text-green-400', barColor: 'bg-green-500', percent: 15 }
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function TicketDetailPage({ ticketId, partnerSubrole }: TicketDetailPageProps) {
  const router = useRouter()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'conversation' | 'attachments' | 'activity'>('conversation')

  // Message form
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // File upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Rating
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingFeedback, setRatingFeedback] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)

  // Realtime
  const { isConnected } = useTicketDetailRealtime(ticketId, 'PARTNER', {
    onUpdate: () => { fetchTicket(); fetchMessages() },
  })

  useEffect(() => {
    fetchTicket()
    fetchMessages()
  }, [ticketId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchTicket = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/partner-support/tickets/${ticketId}`)
      const data = await res.json()
      if (res.ok) {
        setTicket(data.ticket)
        if (data.ticket.satisfaction_rating) {
          setRating(data.ticket.satisfaction_rating)
          setRatingFeedback(data.ticket.satisfaction_feedback || '')
        }
        setError(null)
      } else {
        setError(data.error || 'Failed to load ticket')
      }
    } catch {
      setError('Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/partner-support/tickets/${ticketId}/messages`)
      const data = await res.json()
      if (res.ok) setMessages(data.messages || [])
    } catch (e) {
      console.error('Failed to fetch messages:', e)
    }
  }, [ticketId])

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/partner-support/tickets/${ticketId}/attachments`)
      const data = await res.json()
      if (res.ok) setAttachments(data.attachments || [])
    } catch (e) {
      console.error('Failed to fetch attachments:', e)
    }
  }, [ticketId])

  useEffect(() => {
    if (activeTab === 'attachments') fetchAttachments()
  }, [activeTab])

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return
    try {
      setSending(true)
      const res = await fetch(`/api/partner-support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage.trim(),
          reply_to_id: replyToId
        })
      })
      if (res.ok) {
        setNewMessage('')
        setReplyToId(null)
        fetchMessages()
      }
    } catch (e) {
      console.error('Failed to send message:', e)
    } finally {
      setSending(false)
    }
  }

  const handleReopenTicket = async () => {
    try {
      const res = await fetch(`/api/partner-support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reopened' })
      })
      if (res.ok) fetchTicket()
    } catch (e) {
      console.error('Failed to reopen ticket:', e)
    }
  }

  const submitRating = async () => {
    try {
      setSubmittingRating(true)
      const res = await fetch(`/api/partner-support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satisfaction_rating: rating,
          satisfaction_feedback: ratingFeedback
        })
      })
      if (res.ok) {
        setShowRating(false)
        fetchTicket()
      }
    } catch (e) {
      console.error('Failed to submit rating:', e)
    } finally {
      setSubmittingRating(false)
    }
  }

  const handleFileUpload = async () => {
    if (uploadFiles.length === 0 || uploading) return
    try {
      setUploading(true)
      for (const file of uploadFiles) {
        const formData = new FormData()
        formData.append('file', file)
        await fetch(`/api/partner-support/tickets/${ticketId}/attachments`, {
          method: 'POST',
          body: formData
        })
      }
      setUploadFiles([])
      fetchAttachments()
    } catch (e) {
      console.error('Failed to upload files:', e)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    setUploadFiles(prev => [...prev, ...files])
  }

  const copyTicketNumber = () => {
    if (ticket) navigator.clipboard.writeText(ticket.ticket_number)
  }

  const formatStatus = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading ticket...</p>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{error || 'Ticket not found'}</p>
            <button onClick={() => router.back()} className="mt-4 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg">
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sla = ticket.sla_deadline ? getSlaCountdown(ticket.sla_deadline, ticket.sla_breached) : null
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed'

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push(`/partners/${partnerSubrole}/support-tickets`)}
            className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-poppins text-white">{ticket.subject}</h1>
              <RealtimeConnectionIndicator isConnected={isConnected} />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={copyTicketNumber} className="text-orange-400 font-mono text-sm hover:text-orange-300" title="Click to copy">
                {ticket.ticket_number}
              </button>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${priorityColors[ticket.priority] || ''}`}>
                {ticket.priority.toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[ticket.status] || ''}`}>
                {formatStatus(ticket.status)}
              </span>
              {ticket.escalation_level > 0 && (
                <span className="flex items-center gap-1">
                  {Array.from({ length: ticket.escalation_level }).map((_, i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-red-400" />
                  ))}
                  <span className="text-xs text-red-400 ml-1">Escalation L{ticket.escalation_level}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isResolved && !ticket.satisfaction_rating && (
              <button onClick={() => setShowRating(true)}
                className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg text-sm border border-yellow-500/50">
                Rate Support
              </button>
            )}
            {isResolved && (
              <button onClick={handleReopenTicket}
                className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-4 py-2 rounded-lg text-sm border border-purple-500/50">
                Reopen Ticket
              </button>
            )}
            <button onClick={() => window.print()}
              className="bg-white/5 hover:bg-white/10 text-gray-400 px-4 py-2 rounded-lg text-sm border border-white/10">
              Print
            </button>
          </div>
        </div>

        {/* Rating Modal */}
        {showRating && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-white mb-4 font-poppins">Rate Your Support Experience</h3>
              <div className="flex gap-2 justify-center mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRating(star)}
                    className={`text-3xl transition-colors ${star <= rating ? 'text-yellow-400' : 'text-gray-600'}`}>
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
                placeholder="Share your feedback (optional)..."
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none h-24"
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowRating(false)} className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg hover:bg-gray-700">Cancel</button>
                <button onClick={submitRating} disabled={rating === 0 || submittingRating}
                  className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50">
                  {submittingRating ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Description</h3>
              <div className="text-white whitespace-pre-wrap">{ticket.description}</div>
              {ticket.tags && ticket.tags.length > 0 && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                  {ticket.tags.map(tag => (
                    <span key={tag} className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10">
              {(['conversation', 'attachments', 'activity'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab ? 'bg-white/10 text-white border-b-2 border-orange-500' : 'text-gray-400 hover:text-white'
                  }`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'conversation' && <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded-full">{messages.length}</span>}
                  {tab === 'attachments' && <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded-full">{attachments.length}</span>}
                </button>
              ))}
            </div>

            {/* Conversation Tab */}
            {activeTab === 'conversation' && (
              <div className="space-y-4">
                {messages.map(msg => {
                  const isPartner = msg.sender_type === 'partner'
                  const replyTo = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null
                  return (
                    <div key={msg.id} className={`flex ${isPartner ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg p-4 ${
                        msg.sender_type === 'system'
                          ? 'bg-gray-500/10 border border-gray-500/20 text-gray-400 text-sm italic w-full max-w-full text-center'
                          : isPartner
                            ? 'bg-orange-500/10 border border-orange-500/20'
                            : 'bg-blue-500/10 border border-blue-500/20'
                      }`}>
                        {replyTo && (
                          <div className="bg-black/30 rounded p-2 mb-2 text-xs text-gray-400 border-l-2 border-gray-600">
                            <span className="font-medium">{replyTo.sender_name}:</span> {replyTo.message.slice(0, 100)}...
                          </div>
                        )}
                        {msg.sender_type !== 'system' && (
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isPartner ? 'text-orange-400' : 'text-blue-400'}`}>
                              {msg.sender_name}
                              {msg.sender_role && <span className="text-gray-500 ml-2 text-xs">({msg.sender_role})</span>}
                            </span>
                            <span className="text-xs text-gray-500">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                          </div>
                        )}
                        <div className="text-white whitespace-pre-wrap">{msg.message}</div>
                        {msg.sender_type !== 'system' && (
                          <button onClick={() => setReplyToId(msg.id)}
                            className="text-xs text-gray-500 hover:text-gray-300 mt-2">
                            Reply
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />

                {/* Reply Form */}
                {!isResolved && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    {replyToId && (
                      <div className="flex items-center justify-between bg-gray-800 rounded p-2 mb-3 text-sm">
                        <span className="text-gray-400">
                          Replying to {messages.find(m => m.id === replyToId)?.sender_name}
                        </span>
                        <button onClick={() => setReplyToId(null)} className="text-gray-500 hover:text-white">x</button>
                      </div>
                    )}
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none h-24"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendMessage()
                      }}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-xs text-gray-500">Ctrl+Enter to send</span>
                      <button onClick={sendMessage} disabled={!newMessage.trim() || sending}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
                        {sending ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Attachments Tab */}
            {activeTab === 'attachments' && (
              <div className="space-y-4">
                {/* Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOver ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-white/5'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <svg className="w-12 h-12 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-400 mb-2">Drag and drop files here or</p>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="text-orange-400 hover:text-orange-300 font-medium">
                    browse files
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={(e) => setUploadFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
                </div>

                {uploadFiles.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Files to upload ({uploadFiles.length})</h4>
                    {uploadFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <span className="text-white text-sm">{file.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{formatBytes(file.size)}</span>
                        </div>
                        <button onClick={() => setUploadFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                      </div>
                    ))}
                    <button onClick={handleFileUpload} disabled={uploading}
                      className="mt-3 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                      {uploading ? 'Uploading...' : 'Upload All'}
                    </button>
                  </div>
                )}

                {/* Existing Attachments */}
                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map(att => (
                      <div key={att.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{att.file_name}</p>
                          <p className="text-gray-500 text-xs">{formatBytes(att.file_size)} - Uploaded by {att.uploaded_by_name} {formatDistanceToNow(new Date(att.created_at), { addSuffix: true })}</p>
                        </div>
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 text-sm font-medium">Download</a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">No attachments yet</div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="space-y-3">
                {activities.length > 0 ? activities.map(act => (
                  <div key={act.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-white text-sm">{act.description}</p>
                      <p className="text-gray-500 text-xs">{act.performed_by_name} - {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500">No activity logs</div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* SLA Widget */}
            {sla && !isResolved && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">SLA Status</h3>
                <div className={`text-lg font-bold ${sla.color}`}>{sla.text}</div>
                <div className="w-full h-2 bg-gray-700 rounded-full mt-2">
                  <div className={`h-2 rounded-full ${sla.barColor} transition-all`} style={{ width: `${sla.percent}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Deadline: {format(new Date(ticket.sla_deadline), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}

            {/* Ticket Details */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Category</span>
                  <span className="text-white">{categoryLabels[ticket.category] || ticket.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Created</span>
                  <span className="text-white">{format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Updated</span>
                  <span className="text-white">{formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}</span>
                </div>
                {ticket.assigned_to_partner_support_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Assigned To</span>
                    <span className="text-white">{ticket.assigned_to_partner_support_name}</span>
                  </div>
                )}
                {ticket.routed_to_department && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Department</span>
                    <span className="text-white">{ticket.routed_to_department}</span>
                  </div>
                )}
                {ticket.first_response_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">First Response</span>
                    <span className="text-white">{ticket.response_time_hours?.toFixed(1)}h</span>
                  </div>
                )}
                {ticket.resolved_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Resolution Time</span>
                    <span className="text-white">{ticket.resolution_time_hours?.toFixed(1)}h</span>
                  </div>
                )}
                {ticket.reopened_count > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reopened</span>
                    <span className="text-orange-400">{ticket.reopened_count} time(s)</span>
                  </div>
                )}
                {ticket.is_confidential && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Confidential</span>
                    <span className="text-yellow-400">Yes</span>
                  </div>
                )}
              </div>
            </div>

            {/* Satisfaction Rating */}
            {ticket.satisfaction_rating && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Your Rating</h3>
                <div className="flex gap-1 text-2xl">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={star <= ticket.satisfaction_rating! ? 'text-yellow-400' : 'text-gray-600'}>★</span>
                  ))}
                </div>
                {ticket.satisfaction_feedback && (
                  <p className="text-gray-400 text-sm mt-2">&ldquo;{ticket.satisfaction_feedback}&rdquo;</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
