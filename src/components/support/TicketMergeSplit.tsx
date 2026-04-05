'use client'

import { useState, useEffect } from 'react'
import {
  GitMerge,
  GitBranch,
  Search,
  X,
  Check,
  AlertTriangle,
  ChevronRight,
  Loader2,
  MessageSquare,
  Clock,
  User
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

export type TicketSource = 'employee' | 'customer' | 'partner'

export interface TicketSummary {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  created_at: string
  creator_name?: string
  message_count?: number
}

export interface MergeResult {
  success: boolean
  primaryTicketId: string
  mergedTicketIds: string[]
  message: string
}

export interface SplitResult {
  success: boolean
  originalTicketId: string
  newTicketIds: string[]
  message: string
}

interface TicketMergeProps {
  primaryTicket: TicketSummary
  ticketSource: TicketSource
  onMergeComplete: (result: MergeResult) => void
  onCancel: () => void
}

interface TicketSplitProps {
  ticket: TicketSummary
  ticketSource: TicketSource
  messages: Array<{
    id: string
    content: string
    created_at: string
    sender_type: string
    sender_name?: string
  }>
  onSplitComplete: (result: SplitResult) => void
  onCancel: () => void
}

interface MergeSplitModalProps {
  isOpen: boolean
  mode: 'merge' | 'split'
  ticket: TicketSummary
  ticketSource: TicketSource
  messages?: Array<{
    id: string
    content: string
    created_at: string
    sender_type: string
    sender_name?: string
  }>
  onComplete: (result: MergeResult | SplitResult) => void
  onClose: () => void
}

// ============================================================================
// TICKET MERGE COMPONENT
// ============================================================================

export function TicketMerge({
  primaryTicket,
  ticketSource,
  onMergeComplete,
  onCancel
}: TicketMergeProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<TicketSummary[]>([])
  const [selectedTickets, setSelectedTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [mergeReason, setMergeReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Search for tickets to merge
  const searchTickets = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const endpoint = ticketSource === 'employee'
        ? '/api/support/tickets/search'
        : ticketSource === 'customer'
        ? '/api/customer-support/tickets/search'
        : '/api/partner-support/tickets/search'

      const response = await fetch(`${endpoint}?q=${encodeURIComponent(term)}&exclude=${primaryTicket.id}`)
      const data = await response.json()

      if (response.ok) {
        // Filter out already selected tickets and the primary ticket
        const filtered = (data.tickets || []).filter((t: TicketSummary) =>
          t.id !== primaryTicket.id &&
          !selectedTickets.some(s => s.id === t.id)
        )
        setSearchResults(filtered)
      }
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      searchTickets(searchTerm)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  const addTicket = (ticket: TicketSummary) => {
    setSelectedTickets(prev => [...prev, ticket])
    setSearchResults(prev => prev.filter(t => t.id !== ticket.id))
    setSearchTerm('')
  }

  const removeTicket = (ticketId: string) => {
    setSelectedTickets(prev => prev.filter(t => t.id !== ticketId))
  }

  const handleMerge = async () => {
    if (selectedTickets.length === 0) {
      setError('Please select at least one ticket to merge')
      return
    }

    if (!mergeReason.trim()) {
      setError('Please provide a reason for merging')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const endpoint = ticketSource === 'employee'
        ? '/api/support/tickets/merge'
        : ticketSource === 'customer'
        ? '/api/customer-support/tickets/merge'
        : '/api/partner-support/tickets/merge'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryTicketId: primaryTicket.id,
          ticketIdsToMerge: selectedTickets.map(t => t.id),
          reason: mergeReason
        })
      })

      const data = await response.json()

      if (response.ok) {
        onMergeComplete({
          success: true,
          primaryTicketId: primaryTicket.id,
          mergedTicketIds: selectedTickets.map(t => t.id),
          message: data.message || 'Tickets merged successfully'
        })
      } else {
        setError(data.error || 'Failed to merge tickets')
      }
    } catch (err) {
      setError('An error occurred while merging tickets')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <GitMerge className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Merge Tickets</h3>
          <p className="text-sm text-gray-400">Combine related tickets into one</p>
        </div>
      </div>

      {/* Primary Ticket */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Primary Ticket (will remain open)</label>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-blue-400 font-mono text-sm">{primaryTicket.ticket_number}</span>
            <span className="text-white font-medium">{primaryTicket.subject}</span>
          </div>
        </div>
      </div>

      {/* Search for tickets to merge */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Search tickets to merge</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ticket number or subject..."
            className="w-full bg-black/50 text-white pl-10 pr-4 py-3 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-2 bg-black/50 border border-white/10 rounded-lg max-h-48 overflow-y-auto">
            {searchResults.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => addTicket(ticket)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 font-mono text-sm">{ticket.ticket_number}</span>
                  <span className="text-gray-300 truncate max-w-[300px]">{ticket.subject}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Tickets to Merge */}
      {selectedTickets.length > 0 && (
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Tickets to merge ({selectedTickets.length} selected)
          </label>
          <div className="space-y-2">
            {selectedTickets.map(ticket => (
              <div
                key={ticket.id}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 font-mono text-sm">{ticket.ticket_number}</span>
                  <span className="text-gray-300">{ticket.subject}</span>
                </div>
                <button
                  onClick={() => removeTicket(ticket.id)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merge Reason */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Reason for merging *</label>
        <textarea
          value={mergeReason}
          onChange={(e) => setMergeReason(e.target.value)}
          placeholder="Explain why these tickets should be merged..."
          className="w-full bg-black/50 text-white px-4 py-3 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none resize-none h-24"
        />
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-yellow-400 font-medium">Important</p>
          <p className="text-gray-400 mt-1">
            Merging will move all messages and attachments from selected tickets to the primary ticket.
            The merged tickets will be marked as "merged" and closed.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleMerge}
          disabled={loading || selectedTickets.length === 0}
          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Merging...
            </>
          ) : (
            <>
              <GitMerge className="w-4 h-4" />
              Merge Tickets
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// TICKET SPLIT COMPONENT
// ============================================================================

export function TicketSplit({
  ticket,
  ticketSource,
  messages,
  onSplitComplete,
  onCancel
}: TicketSplitProps) {
  const [selectedMessages, setSelectedMessages] = useState<string[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [splitReason, setSplitReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleMessage = (messageId: string) => {
    setSelectedMessages(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    )
  }

  const handleSplit = async () => {
    if (selectedMessages.length === 0) {
      setError('Please select at least one message to split')
      return
    }

    if (!newSubject.trim()) {
      setError('Please provide a subject for the new ticket')
      return
    }

    if (!splitReason.trim()) {
      setError('Please provide a reason for splitting')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const endpoint = ticketSource === 'employee'
        ? '/api/support/tickets/split'
        : ticketSource === 'customer'
        ? '/api/customer-support/tickets/split'
        : '/api/partner-support/tickets/split'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalTicketId: ticket.id,
          messageIds: selectedMessages,
          newTicket: {
            subject: newSubject,
            priority: newPriority
          },
          reason: splitReason
        })
      })

      const data = await response.json()

      if (response.ok) {
        onSplitComplete({
          success: true,
          originalTicketId: ticket.id,
          newTicketIds: [data.newTicketId],
          message: data.message || 'Ticket split successfully'
        })
      } else {
        setError(data.error || 'Failed to split ticket')
      }
    } catch (err) {
      setError('An error occurred while splitting ticket')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <GitBranch className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Split Ticket</h3>
          <p className="text-sm text-gray-400">Create a new ticket from selected messages</p>
        </div>
      </div>

      {/* Original Ticket */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Original Ticket</label>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-orange-400 font-mono text-sm">{ticket.ticket_number}</span>
            <span className="text-white font-medium">{ticket.subject}</span>
          </div>
        </div>
      </div>

      {/* Messages to Split */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">
          Select messages for new ticket ({selectedMessages.length} selected)
        </label>
        <div className="bg-black/50 border border-white/10 rounded-lg max-h-64 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              No messages available to split
            </div>
          ) : (
            messages.map(message => (
              <button
                key={message.id}
                onClick={() => toggleMessage(message.id)}
                className={`w-full flex items-start gap-3 p-4 text-left transition-colors border-b border-white/5 last:border-0 ${
                  selectedMessages.includes(message.id)
                    ? 'bg-purple-500/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mt-0.5 ${
                  selectedMessages.includes(message.id)
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-white/20'
                }`}>
                  {selectedMessages.includes(message.id) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="text-sm text-gray-300">{message.sender_name || message.sender_type}</span>
                    <Clock className="w-3 h-3 text-gray-400 ml-2" />
                    <span className="text-xs text-gray-400">
                      {new Date(message.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{message.content}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* New Ticket Details */}
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">New Ticket Subject *</label>
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Enter subject for the new ticket..."
            className="w-full bg-black/50 text-white px-4 py-3 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Priority</label>
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            className="w-full bg-black/50 text-white px-4 py-3 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Reason for splitting *</label>
          <textarea
            value={splitReason}
            onChange={(e) => setSplitReason(e.target.value)}
            placeholder="Explain why this ticket should be split..."
            className="w-full bg-black/50 text-white px-4 py-3 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none resize-none h-24"
          />
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <MessageSquare className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-purple-400 font-medium">How splitting works</p>
          <p className="text-gray-400 mt-1">
            Selected messages will be copied to a new ticket. The original messages will remain
            in this ticket with a note indicating they were split.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSplit}
          disabled={loading || selectedMessages.length === 0}
          className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Splitting...
            </>
          ) : (
            <>
              <GitBranch className="w-4 h-4" />
              Split Ticket
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// MERGE/SPLIT MODAL
// ============================================================================

export function MergeSplitModal({
  isOpen,
  mode,
  ticket,
  ticketSource,
  messages = [],
  onComplete,
  onClose
}: MergeSplitModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="p-6">
          {mode === 'merge' ? (
            <TicketMerge
              primaryTicket={ticket}
              ticketSource={ticketSource}
              onMergeComplete={(result) => onComplete(result)}
              onCancel={onClose}
            />
          ) : (
            <TicketSplit
              ticket={ticket}
              ticketSource={ticketSource}
              messages={messages}
              onSplitComplete={(result) => onComplete(result)}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MERGE/SPLIT ACTION BUTTONS
// ============================================================================

interface MergeSplitButtonsProps {
  onMerge: () => void
  onSplit: () => void
  disabled?: boolean
  className?: string
}

export function MergeSplitButtons({
  onMerge,
  onSplit,
  disabled = false,
  className = ''
}: MergeSplitButtonsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={onMerge}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Merge with another ticket"
      >
        <GitMerge className="w-4 h-4" />
        <span className="text-sm">Merge</span>
      </button>
      <button
        onClick={onSplit}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Split into separate tickets"
      >
        <GitBranch className="w-4 h-4" />
        <span className="text-sm">Split</span>
      </button>
    </div>
  )
}

export default MergeSplitModal
