'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Plus, Search, Filter, AlertCircle, Clock } from 'lucide-react'
import { InlineLoading } from '@/components/ui/loading-spinner'

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  customer_support_status: string
  created_at: string
  updated_at: string
  sla_deadline: string
  sla_breached: boolean
  message_count: number
  unread_count: number
  attachments_count: number
}

interface TicketCounts {
  new: number
  in_progress: number
  pending_customer: number
  resolved: number
  closed: number
  total: number
}

interface TicketListPageProps {
  customerSubrole: string
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
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  on_hold: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  escalated: 'bg-red-500/20 text-red-400 border-red-500/30',
  reopened: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
}

export default function TicketListPage({ customerSubrole, basePath }: TicketListPageProps) {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [counts, setCounts] = useState<TicketCounts>({
    new: 0,
    in_progress: 0,
    pending_customer: 0,
    resolved: 0,
    closed: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchTickets()
  }, [filter])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.append('status', filter)
      }
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/customer-support/tickets?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        setTickets(data.tickets || [])
        setCounts(data.counts || counts)
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTicketClick = (ticketId: string) => {
    router.push(`${basePath}/support/${ticketId}`)
  }

  const handleCreateTicket = () => {
    router.push(`${basePath}/support/create`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchTickets()
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 font-poppins">Support Tickets</h1>
            <p className="text-gray-400">View and manage your support tickets</p>
          </div>
          <button
            onClick={handleCreateTicket}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create New Ticket
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Total</div>
            <div className="text-2xl font-bold text-white">{counts.total}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">New</div>
            <div className="text-2xl font-bold text-purple-400">{counts.new}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">In Progress</div>
            <div className="text-2xl font-bold text-cyan-400">{counts.in_progress}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Pending Response</div>
            <div className="text-2xl font-bold text-amber-400">{counts.pending_customer}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Resolved</div>
            <div className="text-2xl font-bold text-green-400">{counts.resolved}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Closed</div>
            <div className="text-2xl font-bold text-gray-400">{counts.closed}</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ticket number or subject..."
                className="w-full bg-black/50 text-white border border-white/20 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {['all', 'new', 'in_progress', 'pending_customer', 'resolved', 'closed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === status
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="text-center py-12">
            <InlineLoading size="md" text="Loading tickets..." />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-300 text-lg mb-2">No tickets found</p>
            <p className="text-gray-500">Create your first support ticket to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleTicketClick(ticket.id)}
                className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-orange-400 font-mono text-sm">{ticket.ticket_number}</span>
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
                    <h3 className="text-xl font-semibold mb-2 font-poppins">{ticket.subject}</h3>
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Category: {categoryLabels[ticket.category] || ticket.category}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                      {ticket.message_count > 0 && (
                        <>
                          <span>•</span>
                          <span>{ticket.message_count} messages</span>
                        </>
                      )}
                      {ticket.unread_count > 0 && (
                        <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                          {ticket.unread_count} new
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
