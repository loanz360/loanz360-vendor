'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ArrowLeft,
  Send,
  Paperclip,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  EyeOff,
  Users,
  FileText,
  MessageSquare,
  Tag,
  Calendar,
  Activity,
  Shield,
  RefreshCw
} from 'lucide-react'

interface DepartmentTicketDetailProps {
  ticketId: string
  department: string
  departmentName: string
  backUrl: string
  apiEndpoint?: string
  primaryColor?: string
}

export default function DepartmentTicketDetail({
  ticketId,
  department,
  departmentName,
  backUrl,
  apiEndpoint = '/api/support/tickets',
  primaryColor = 'orange'
}: DepartmentTicketDetailProps) {
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [newPriority, setNewPriority] = useState('')
  const [escalating, setEscalating] = useState(false)
  const [escalateTo, setEscalateTo] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const colorVariants: Record<string, { bg: string; border: string; text: string; hover: string }> = {
    orange: {
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      hover: 'hover:bg-orange-500/30'
    },
    blue: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      hover: 'hover:bg-blue-500/30'
    },
    green: {
      bg: 'bg-green-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      hover: 'hover:bg-green-500/30'
    },
    purple: {
      bg: 'bg-purple-500/20',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      hover: 'hover:bg-purple-500/30'
    }
  }

  const colors = colorVariants[primaryColor] || colorVariants.orange

  useEffect(() => {
    fetchTicketDetails()
  }, [ticketId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchTicketDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${apiEndpoint}/${ticketId}`)
      const data = await response.json()

      if (response.ok) {
        const ticketData = data.ticket
        setTicket(ticketData)
        setMessages(ticketData.messages || [])
        setAttachments(ticketData.attachments || data.attachments || [])
        setActivityLog(ticketData.activity_log || data.activityLog || [])
        setNewStatus(ticketData.status)
        setNewPriority(ticketData.priority)
      }
    } catch (err) {
      console.error('Error fetching ticket details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      setSending(true)
      const response = await fetch(`${apiEndpoint}/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage,
          is_internal: isInternalNote
        })
      })

      if (response.ok) {
        setNewMessage('')
        setIsInternalNote(false)
        fetchTicketDetails()
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setUploading(true)
      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch(`${apiEndpoint}/${ticketId}/attachments`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        fetchTicketDetails()
      }
    } catch (err) {
      console.error('Error uploading files:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleUpdateStatus = async () => {
    try {
      setUpdatingStatus(true)
      const response = await fetch(`${apiEndpoint}/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        fetchTicketDetails()
      }
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleUpdatePriority = async () => {
    try {
      setUpdatingPriority(true)
      const response = await fetch(`${apiEndpoint}/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority })
      })

      if (response.ok) {
        fetchTicketDetails()
      }
    } catch (err) {
      console.error('Error updating priority:', err)
    } finally {
      setUpdatingPriority(false)
    }
  }

  const handleEscalate = async () => {
    if (!escalateTo) return
    try {
      setEscalating(true)
      const response = await fetch(`${apiEndpoint}/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: escalateTo })
      })

      if (response.ok) {
        // Add escalation message
        await fetch(`${apiEndpoint}/${ticketId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Ticket escalated from ${department} to ${escalateTo.replace(/_/g, ' ')}`,
            is_internal: true
          })
        })
        fetchTicketDetails()
        setEscalateTo('')
      }
    } catch (err) {
      console.error('Error escalating ticket:', err)
    } finally {
      setEscalating(false)
    }
  }

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  }

  const statusColors: Record<string, string> = {
    open: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    new: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    pending_customer: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    reopened: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading ticket details...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300 text-lg mb-2">Ticket not found</p>
          <button
            onClick={() => router.push(backUrl)}
            className={`${colors.text} hover:underline`}
          >
            Back to Tickets
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push(backUrl)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-poppins">{ticket.ticket_number}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                {departmentName}
              </span>
            </div>
            <p className="text-gray-400 mt-1">{ticket.subject}</p>
          </div>
          <button
            onClick={fetchTicketDetails}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Info Card */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColors[ticket.priority] || priorityColors.medium}`}>
                      {(ticket.priority || 'medium').toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[ticket.status] || statusColors.open}`}>
                      {(ticket.status || 'open').replace(/_/g, ' ').toUpperCase()}
                    </span>
                    {ticket.sla_breached && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                        SLA BREACHED
                      </span>
                    )}
                    {ticket.is_confidential && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        <Shield className="w-3 h-3 inline mr-1" />
                        CONFIDENTIAL
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Submitted By:</span>
                      <p className="text-white font-medium">
                        {ticket.is_anonymous ? 'Anonymous' : (ticket.employee?.full_name || ticket.submitter_name || 'Unknown')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Category:</span>
                      <p className="text-white font-medium">{(ticket.category || 'General').replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Created:</span>
                      <p className="text-white">{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Last Updated:</span>
                      <p className="text-white">{formatDistanceToNow(new Date(ticket.updated_at || ticket.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 font-poppins">
                <MessageSquare className="w-5 h-5" />
                Conversation ({messages.length})
              </h2>

              <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto pr-2">
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No messages yet. Start the conversation!</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-lg ${
                        msg.is_internal
                          ? 'bg-purple-500/10 border border-purple-500/30'
                          : msg.sender_type === 'employee' || msg.sender_id === ticket.employee_id
                          ? 'bg-white/5 border border-white/10'
                          : `${colors.bg} border ${colors.border}`
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-white font-medium text-sm">
                            {msg.sender_name || 'Unknown'}
                          </span>
                          {msg.is_internal && (
                            <span className="text-xs text-purple-400 flex items-center gap-1">
                              <EyeOff className="w-3 h-3" /> Internal Note
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap">{msg.message || msg.content}</p>

                      {/* Message Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {msg.attachments.map((att: unknown) => (
                            <a
                              key={att.id}
                              href={att.file_url || `/api/support/tickets/${ticketId}/attachments/${att.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-sm"
                            >
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-300 truncate max-w-[150px]">{att.file_name}</span>
                              <Download className="w-3 h-3 text-gray-400" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="border-t border-white/10 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(!isInternalNote)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isInternalNote
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {isInternalNote ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {isInternalNote ? 'Internal Note' : 'Public Reply'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={isInternalNote ? "Add an internal note..." : "Type your reply..."}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className={`px-4 py-3 ${colors.bg} ${colors.text} ${colors.border} border rounded-lg ${colors.hover} transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                  >
                    <Send className="w-5 h-5" />
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 font-poppins">Quick Actions</h3>

              {/* Status Update */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 block mb-2">Update Status</label>
                <div className="flex gap-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus || newStatus === ticket.status}
                    className={`px-3 py-2 ${colors.bg} ${colors.text} rounded-lg ${colors.hover} transition-colors disabled:opacity-50`}
                  >
                    {updatingStatus ? '...' : 'Update'}
                  </button>
                </div>
              </div>

              {/* Priority Update */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 block mb-2">Update Priority</label>
                <div className="flex gap-2">
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <button
                    onClick={handleUpdatePriority}
                    disabled={updatingPriority || newPriority === ticket.priority}
                    className={`px-3 py-2 ${colors.bg} ${colors.text} rounded-lg ${colors.hover} transition-colors disabled:opacity-50`}
                  >
                    {updatingPriority ? '...' : 'Update'}
                  </button>
                </div>
              </div>

              {/* Escalate / Route to Department */}
              <div className="mb-4 pt-4 border-t border-white/10">
                <label className="text-sm text-gray-400 block mb-2">Escalate / Route To</label>
                <div className="flex gap-2">
                  <select
                    value={escalateTo}
                    onChange={(e) => setEscalateTo(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="">Select department...</option>
                    <option value="hr">HR</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="finance">Finance</option>
                    <option value="accounts">Accounts</option>
                    <option value="payout_specialist">Payout Specialist</option>
                    <option value="technical_support">Technical Support</option>
                    <option value="compliance">Compliance</option>
                  </select>
                  <button
                    onClick={handleEscalate}
                    disabled={escalating || !escalateTo || escalateTo === ticket.assigned_to}
                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    {escalating ? '...' : 'Escalate'}
                  </button>
                </div>
              </div>
            </div>

            {/* Ticket Details */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 font-poppins">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Ticket ID</span>
                  <span className="text-white font-mono">{ticket.id?.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Assigned To</span>
                  <span className="text-white capitalize">{(ticket.assigned_to || department).replace(/_/g, ' ')}</span>
                </div>
                {ticket.subcategory && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Subcategory</span>
                    <span className="text-white">{ticket.subcategory.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {ticket.resolved_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Resolved At</span>
                    <span className="text-green-400">{format(new Date(ticket.resolved_at), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {ticket.resolution_time_hours && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Resolution Time</span>
                    <span className="text-white">{ticket.resolution_time_hours.toFixed(1)}h</span>
                  </div>
                )}
              </div>
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 font-poppins flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Attachments ({attachments.length})
                </h3>
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.file_url || att.signed_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{att.file_name}</p>
                        <p className="text-xs text-gray-400">{att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}</p>
                      </div>
                      <Download className="w-4 h-4 text-gray-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Log */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
              <button
                onClick={() => setShowActivityLog(!showActivityLog)}
                className="w-full flex items-center justify-between text-lg font-semibold font-poppins"
              >
                <span className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Activity Log
                </span>
                <span className="text-sm text-gray-400">{showActivityLog ? 'Hide' : 'Show'}</span>
              </button>

              {showActivityLog && (
                <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
                  {activityLog.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No activity recorded</p>
                  ) : (
                    activityLog.map((activity) => (
                      <div key={activity.id} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-gray-400 mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="text-gray-300">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {activity.action_by_name} • {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
