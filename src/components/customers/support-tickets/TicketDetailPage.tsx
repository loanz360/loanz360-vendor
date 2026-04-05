'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Send, Paperclip, AlertCircle, FileText, Download, Star } from 'lucide-react'
import { InlineLoading } from '@/components/ui/loading-spinner'

interface TicketDetailPageProps {
  ticketId: string
  basePath: string
}

const categoryLabels: Record<string, string> = {
  loan_application: 'Loan Application',
  loan_disbursement: 'Loan Disbursement',
  emi_payment: 'EMI Payment',
  account_access: 'Account Access',
  document_upload: 'Document Upload',
  loan_status: 'Loan Status',
  interest_rate: 'Interest Rate',
  prepayment: 'Prepayment',
  foreclosure: 'Foreclosure',
  customer_service: 'Customer Service',
  technical_issue: 'Technical Issue',
  complaint: 'Complaint',
  general_inquiry: 'General Inquiry'
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
}

const statusColors: Record<string, string> = {
  new: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  pending_customer: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  pending_internal: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

export default function TicketDetailPage({ ticketId, basePath }: TicketDetailPageProps) {
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [rating, setRating] = useState(0)

  useEffect(() => {
    fetchTicketDetails()
  }, [ticketId])

  const fetchTicketDetails = async () => {
    try {
      const response = await fetch(`/api/customer-support/tickets/${ticketId}`)
      const data = await response.json()

      if (response.ok) {
        setTicket(data.ticket)
        setMessages(data.messages || [])
        setAttachments(data.attachments || [])

        // Show feedback form if ticket is resolved and no feedback yet
        if (data.ticket.status === 'resolved' && !data.ticket.customer_satisfaction_rating) {
          setShowFeedback(true)
        }
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    setSending(true)
    try {
      const response = await fetch(`/api/customer-support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage })
      })

      if (response.ok) {
        setNewMessage('')
        await fetchTicketDetails()
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/customer-support/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        await fetchTicketDetails()
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitFeedback = async () => {
    if (rating === 0) return

    try {
      await fetch(`/api/customer-support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_satisfaction_rating: rating
        })
      })
      setShowFeedback(false)
      await fetchTicketDetails()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <InlineLoading size="md" />
          <p className="text-gray-400">Loading ticket details...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 font-poppins">Ticket Not Found</h2>
          <button
            onClick={() => router.push(`${basePath}/support`)}
            className="text-orange-500 hover:text-orange-400 transition-colors"
          >
            Go back to tickets
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <button
          onClick={() => router.push(`${basePath}/support`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Tickets
        </button>

        {/* Ticket Info */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-orange-400 font-mono text-lg">{ticket.ticket_number}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColors[ticket.priority]}`}>
                  {ticket.priority.toUpperCase()}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[ticket.status]}`}>
                  {ticket.status.replace(/_/g, ' ').toUpperCase()}
                </span>
                {ticket.sla_breached && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    SLA BREACHED
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-3 font-poppins">{ticket.subject}</h1>
              <p className="text-gray-300 mb-4">{ticket.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Category: {categoryLabels[ticket.category] || ticket.category}</span>
                <span>•</span>
                <span>Created: {format(new Date(ticket.created_at), 'PPpp')}</span>
                {ticket.updated_at !== ticket.created_at && (
                  <>
                    <span>•</span>
                    <span>Updated: {format(new Date(ticket.updated_at), 'PPpp')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Form */}
        {showFeedback && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3 font-poppins">Rate Your Support Experience</h3>
            <p className="text-gray-300 mb-4">How satisfied are you with the resolution?</p>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  className={`p-2 rounded-lg transition-colors ${
                    rating >= value
                      ? 'text-yellow-400 bg-yellow-400/20'
                      : 'text-gray-500 bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <Star className={`w-8 h-8 ${rating >= value ? 'fill-current' : ''}`} />
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmitFeedback}
              disabled={rating === 0}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Feedback
            </button>
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 font-poppins">
              <FileText className="w-5 h-5" />
              Attachments ({attachments.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-orange-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{att.file_name}</p>
                      <p className="text-gray-500 text-xs">
                        {(att.file_size / 1024).toFixed(1)} KB • {att.uploader_name}
                      </p>
                    </div>
                  </div>
                  <button className="text-orange-400 hover:text-orange-300 ml-3">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 font-poppins">Conversation</h2>

          {messages.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No messages yet</p>
          ) : (
            <div className="space-y-4 mb-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg ${
                    msg.sender_type === 'customer'
                      ? 'bg-orange-500/10 border border-orange-500/20 ml-8'
                      : msg.sender_type === 'employee'
                      ? 'bg-blue-500/10 border border-blue-500/20 mr-8'
                      : 'bg-gray-500/10 border border-gray-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-white">{msg.sender_name}</span>
                      {msg.sender_role && (
                        <span className="text-xs text-gray-400 ml-2">({msg.sender_role})</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(new Date(msg.created_at), 'PPpp')}
                    </span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply Form - Only show if ticket is not closed */}
          {ticket.status !== 'closed' && (
            <form onSubmit={handleSendMessage} className="space-y-4">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="w-full bg-black/50 text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                disabled={sending}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt"
                    />
                    <div className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                      <Paperclip className="w-5 h-5" />
                      <span className="text-sm">{uploading ? 'Uploading...' : 'Attach File'}</span>
                    </div>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          )}

          {ticket.status === 'closed' && (
            <div className="text-center py-6 bg-gray-500/10 border border-gray-500/20 rounded-lg">
              <p className="text-gray-400">This ticket is closed. No further messages can be added.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
