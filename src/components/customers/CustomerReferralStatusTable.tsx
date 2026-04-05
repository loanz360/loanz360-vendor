'use client'

/**
 * Customer Referral Status Table Component
 * Displays all referrals with search, filter, and action buttons
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  Search,
  Filter,
  Copy,
  CheckCircle,
  Smartphone,
  ExternalLink,
  Gift,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users
} from 'lucide-react'
import type { CustomerReferral, ReferralStatus, ReferralFormStatus } from '@/types/customer-referrals'

interface CustomerReferralStatusTableProps {
  refreshTrigger?: number
}

export function CustomerReferralStatusTable({ refreshTrigger }: CustomerReferralStatusTableProps) {
  const { user } = useAuth()
  const [referrals, setReferrals] = useState<CustomerReferral[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | ''>('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 10

  const fetchReferrals = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }
      if (statusFilter) {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/customers/referrals?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setReferrals(data.data || [])
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1)
          setTotalCount(data.pagination.total || 0)
        }
      }
    } catch (error) {
      console.error('Error fetching referrals:', error)
    } finally {
      setLoading(false)
    }
  }, [user, page, searchTerm, statusFilter])

  useEffect(() => {
    fetchReferrals()
  }, [fetchReferrals, refreshTrigger])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter])

  const handleCopyLink = (referral: CustomerReferral) => {
    if (referral.short_link) {
      navigator.clipboard.writeText(referral.short_link)
      setCopiedId(referral.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleWhatsApp = (referral: CustomerReferral) => {
    const message = `Hey${referral.referred_name ? ' ' + referral.referred_name : ''}! I thought you might find this useful for your loan needs: ${referral.short_link}`
    const encodedMessage = encodeURIComponent(message)
    const mobile = referral.referred_mobile.replace(/\+/g, '')
    window.open(`https://wa.me/${mobile}?text=${encodedMessage}`, '_blank')
  }

  const getStatusBadge = (status: ReferralStatus) => {
    const badges: Record<ReferralStatus, { bg: string; text: string; label: string }> = {
      NEW: { bg: 'bg-yellow-600/30', text: 'text-yellow-300', label: 'Pending' },
      LINK_OPENED: { bg: 'bg-blue-600/30', text: 'text-blue-300', label: 'Link Opened' },
      REGISTERED: { bg: 'bg-purple-600/30', text: 'text-purple-300', label: 'Registered' },
      APPLIED: { bg: 'bg-cyan-600/30', text: 'text-cyan-300', label: 'Applied' },
      CONVERTED: { bg: 'bg-green-600/30', text: 'text-green-300', label: 'Converted' },
    }
    const badge = badges[status] || { bg: 'bg-neutral-600/30', text: 'text-neutral-300', label: status }
    return (
      <span className={`px-2 py-0.5 text-xs ${badge.bg} ${badge.text} rounded`}>
        {badge.label}
      </span>
    )
  }

  const getFormStatusBadge = (status: ReferralFormStatus) => {
    const badges: Record<ReferralFormStatus, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-gray-600/30', text: 'text-gray-300', label: 'Not Started' },
      OPENED: { bg: 'bg-blue-600/30', text: 'text-blue-300', label: 'Opened' },
      FILLED: { bg: 'bg-yellow-600/30', text: 'text-yellow-300', label: 'In Progress' },
      SUBMITTED: { bg: 'bg-green-600/30', text: 'text-green-300', label: 'Submitted' },
    }
    const badge = badges[status] || { bg: 'bg-neutral-600/30', text: 'text-neutral-300', label: status }
    return (
      <span className={`px-2 py-0.5 text-xs ${badge.bg} ${badge.text} rounded`}>
        {badge.label}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatAmount = (amount: number | null) => {
    if (!amount) return '-'
    return `₹${amount.toLocaleString('en-IN')}`
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, mobile, or referral ID..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReferralStatus | '')}
            className="pl-10 pr-8 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none"
          >
            <option value="">All Status</option>
            <option value="NEW">Pending</option>
            <option value="LINK_OPENED">Link Opened</option>
            <option value="REGISTERED">Registered</option>
            <option value="APPLIED">Applied</option>
            <option value="CONVERTED">Converted</option>
          </select>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchReferrals}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Results Count */}
      <div className="text-sm text-neutral-400">
        {totalCount} referral{totalCount !== 1 ? 's' : ''} found
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : referrals.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No referrals found</p>
          <p className="text-sm mt-1">
            {searchTerm || statusFilter
              ? 'Try adjusting your search or filters'
              : 'Start referring friends to earn points!'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Referral ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Friend</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Loan Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Form Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Points</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr
                  key={referral.id}
                  className="border-b border-neutral-800 hover:bg-neutral-800/50 transition"
                >
                  <td className="py-3 px-4">
                    <span className="text-sm font-mono text-orange-400">{referral.referral_id}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {referral.referred_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-neutral-500">{referral.referred_mobile}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-neutral-300">{referral.loan_type || '-'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-neutral-300">
                      {formatAmount(referral.required_loan_amount)}
                    </span>
                  </td>
                  <td className="py-3 px-4">{getFormStatusBadge(referral.form_status)}</td>
                  <td className="py-3 px-4">{getStatusBadge(referral.referral_status)}</td>
                  <td className="py-3 px-4">
                    {referral.points_awarded > 0 ? (
                      <span className="flex items-center gap-1 text-sm text-yellow-400">
                        <Gift className="w-3 h-3" />
                        +{referral.points_awarded}
                      </span>
                    ) : (
                      <span className="text-sm text-neutral-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-neutral-400">{formatDate(referral.created_at)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {referral.short_link && (
                        <>
                          <button
                            onClick={() => handleCopyLink(referral)}
                            className="p-1.5 rounded bg-neutral-700 hover:bg-neutral-600 transition"
                            title="Copy Link"
                          >
                            {copiedId === referral.id ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-neutral-300" />
                            )}
                          </button>
                          <button
                            onClick={() => handleWhatsApp(referral)}
                            className="p-1.5 rounded bg-green-700 hover:bg-green-600 transition"
                            title="Send via WhatsApp"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-white" />
                          </button>
                          <a
                            href={referral.short_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded bg-neutral-700 hover:bg-neutral-600 transition"
                            title="Open Link"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-300" />
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-neutral-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
