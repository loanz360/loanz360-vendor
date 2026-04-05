/**
 * Commission History Table Component
 * Displays detailed commission history with pagination and filtering
 * Shows lead-wise commission breakdown with status tracking
 *
 * Theme: Dark theme matching LOANZ 360 design system
 */

'use client'

import { useState } from 'react'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { exportCommissionHistoryToExcel } from '@/lib/utils/export-utils'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/cn'

export interface CommissionHistoryItem {
  id: string
  lead_id: string
  customer_name: string
  customer_phone: string
  loan_type: string
  bank_name: string | null
  location: string | null
  required_loan_amount: number
  commission_percentage: number | null
  commission_amount: number | null
  commission_status: string
  commission_calculated_at: string | null
  commission_paid_at: string | null
  payout_batch_id: string | null
  payout_remarks: string | null
  lead_status: string
  created_at: string
  payout_applied?: boolean
  payout_application_id?: string | null
}

interface CommissionHistoryTableProps {
  data: CommissionHistoryItem[]
  loading?: boolean
  total?: number
  page?: number
  limit?: number
  onPageChange?: (page: number) => void
  onStatusFilter?: (status: string) => void
  onApplyForPayout?: (item: CommissionHistoryItem) => void
  applyingId?: string | null
}

const statusOptions = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CALCULATED', label: 'Calculated' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAID', label: 'Paid' },
  { value: 'DROPPED', label: 'Dropped' },
  { value: 'LOST', label: 'Lost' },
  { value: 'REFERRAL_CHANGED', label: 'Referral Changed' },
]

export default function CommissionHistoryTable({
  data,
  loading = false,
  total = 0,
  page = 1,
  limit = 50,
  onPageChange,
  onStatusFilter,
  onApplyForPayout,
  applyingId,
}: CommissionHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { color: string; icon: typeof CheckCircleIcon; label: string }
    > = {
      PENDING: {
        color: 'bg-gray-700/50 text-gray-300 border-gray-600',
        icon: ClockIcon,
        label: 'Pending',
      },
      CALCULATED: {
        color: 'bg-blue-900/50 text-blue-300 border-blue-700',
        icon: CheckCircleIcon,
        label: 'Calculated',
      },
      APPROVED: {
        color: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
        icon: CheckCircleIcon,
        label: 'Approved',
      },
      PAID: {
        color: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
        icon: CheckCircleIcon,
        label: 'Paid',
      },
      DROPPED: {
        color: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
        icon: ExclamationCircleIcon,
        label: 'Dropped',
      },
      LOST: {
        color: 'bg-red-900/50 text-red-300 border-red-700',
        icon: XCircleIcon,
        label: 'Lost',
      },
      REFERRAL_CHANGED: {
        color: 'bg-purple-900/50 text-purple-300 border-purple-700',
        icon: ExclamationCircleIcon,
        label: 'Referral Changed',
      },
      NOT_APPLICABLE: {
        color: 'bg-gray-700/50 text-gray-400 border-gray-600',
        icon: XCircleIcon,
        label: 'N/A',
      },
    }

    const config = statusConfig[status] || statusConfig.NOT_APPLICABLE
    const Icon = config.icon

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  const filterData = () => {
    if (!searchTerm) return data

    const searchLower = searchTerm.toLowerCase()
    return data.filter(
      (item) =>
        item.lead_id.toLowerCase().includes(searchLower) ||
        item.customer_name.toLowerCase().includes(searchLower) ||
        item.customer_phone.includes(searchTerm) ||
        item.loan_type.toLowerCase().includes(searchLower) ||
        (item.bank_name && item.bank_name.toLowerCase().includes(searchLower))
    )
  }

  const filteredData = filterData()

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status)
    if (onStatusFilter) {
      onStatusFilter(status)
    }
  }

  const handleExport = () => {
    if (data.length === 0) {
      toast.error('No data to export')
      return
    }

    const exportData = data.map(item => ({
      lead_id: item.lead_id,
      customer_name: item.customer_name,
      customer_phone: item.customer_phone,
      loan_type: item.loan_type,
      bank_name: item.bank_name,
      location: item.location,
      required_loan_amount: item.required_loan_amount,
      commission_percentage: item.commission_percentage,
      commission_amount: item.commission_amount,
      commission_status: item.commission_status,
      commission_calculated_at: item.commission_calculated_at,
      commission_paid_at: item.commission_paid_at,
      payout_batch_id: item.payout_batch_id,
    }))

    exportCommissionHistoryToExcel(exportData)
  }

  const totalPages = Math.ceil(total / limit)

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg bg-[var(--portal-card-bg)] border border-gray-700/50">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-full rounded bg-gray-700"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 w-full rounded bg-gray-700"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="content-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by lead ID, customer, phone, bank..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-lg border border-gray-700/50 bg-gray-900 py-2 pl-10 pr-3 text-sm text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="block rounded-lg border border-gray-700/50 bg-gray-900 py-2 pl-3 pr-10 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Export Button */}
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700/50 bg-[var(--portal-card-bg)] px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 hover:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            onClick={handleExport}
            disabled={data.length === 0}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export to Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-[var(--portal-card-bg)] border border-gray-700/50">
        {filteredData.length === 0 ? (
          <div className="p-12 text-center">
            <ExclamationCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-white">No commission records</h3>
            <p className="mt-1 text-sm text-gray-400">
              {searchTerm ? 'Try adjusting your search' : 'Commission records will appear here'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700/50">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-orange-500">
                      Lead ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-orange-500">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-orange-500">
                      Loan Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-orange-500">
                      Bank / Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-orange-500">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-orange-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-orange-500">
                      Date
                    </th>
                    {onApplyForPayout && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-orange-500">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50 bg-[var(--portal-card-bg)]">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-white">{item.lead_id}</div>
                        {item.payout_batch_id && (
                          <div className="text-xs text-gray-400">
                            Batch: {item.payout_batch_id.slice(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">
                          {item.customer_name}
                        </div>
                        <div className="text-sm text-gray-400">{item.customer_phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white">
                          {item.loan_type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-sm font-semibold text-orange-500">
                          {formatCurrency(item.required_loan_amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white">
                          {item.bank_name || 'Not specified'}
                        </div>
                        {item.location && (
                          <div className="text-xs text-gray-400">{item.location}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.commission_amount !== null && item.commission_percentage !== null ? (
                          <>
                            <div
                              className={`text-sm font-bold ${
                                item.commission_status === 'PAID'
                                  ? 'text-emerald-400'
                                  : item.commission_status === 'LOST'
                                    ? 'text-red-400'
                                    : item.commission_status === 'DROPPED'
                                      ? 'text-gray-400'
                                      : 'text-blue-400'
                              }`}
                            >
                              {formatCurrency(item.commission_amount)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {item.commission_percentage}%
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {getStatusBadge(item.commission_status)}
                        {item.payout_remarks && (
                          <div className="mt-1 text-xs text-gray-400">
                            {item.payout_remarks.substring(0, 30)}
                            {item.payout_remarks.length > 30 && '...'}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400">
                        {item.commission_paid_at
                          ? formatDate(item.commission_paid_at)
                          : item.commission_calculated_at
                            ? formatDate(item.commission_calculated_at)
                            : formatDate(item.created_at)}
                      </td>
                      {onApplyForPayout && (
                        <td className="whitespace-nowrap px-6 py-4">
                          {item.payout_applied ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700 bg-emerald-900/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                              <CheckCircleIcon className="h-3 w-3" />
                              Applied
                            </span>
                          ) : (item.lead_status === 'DISBURSED' || item.commission_status === 'APPROVED' || item.commission_status === 'CALCULATED') && item.commission_amount && item.commission_amount > 0 ? (
                            <button
                              onClick={() => onApplyForPayout(item)}
                              disabled={applyingId === item.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400 hover:bg-orange-500/20 hover:border-orange-500 disabled:opacity-50 transition-colors"
                            >
                              {applyingId === item.id ? (
                                <>
                                  <ClockIcon className="h-3 w-3 animate-spin" />
                                  Applying...
                                </>
                              ) : (
                                'Apply for Payout'
                              )}
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-700/50 bg-gray-900 px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => onPageChange && onPageChange(page - 1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-700/50 bg-[var(--portal-card-bg)] px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => onPageChange && onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-700/50 bg-[var(--portal-card-bg)] px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      Showing{' '}
                      <span className="font-medium text-white">{(page - 1) * limit + 1}</span> to{' '}
                      <span className="font-medium text-white">
                        {Math.min(page * limit, total)}
                      </span>{' '}
                      of <span className="font-medium text-white">{total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md">
                      <button
                        onClick={() => onPageChange && onPageChange(page - 1)}
                        disabled={page === 1}
                        className="relative inline-flex items-center rounded-l-md border border-gray-700/50 bg-[var(--portal-card-bg)] px-2 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {[...Array(totalPages)].map((_, i) => {
                        const pageNum = i + 1
                        // Show first, last, current, and adjacent pages
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= page - 1 && pageNum <= page + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => onPageChange && onPageChange(pageNum)}
                              className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium ${
                                pageNum === page
                                  ? 'z-10 border-orange-500 bg-orange-500/20 text-orange-500'
                                  : 'border-gray-700/50 bg-[var(--portal-card-bg)] text-gray-400 hover:bg-gray-800'
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        } else if (
                          pageNum === page - 2 ||
                          pageNum === page + 2
                        ) {
                          return (
                            <span
                              key={pageNum}
                              className="relative inline-flex items-center border border-gray-700/50 bg-[var(--portal-card-bg)] px-4 py-2 text-sm font-medium text-gray-400"
                            >
                              ...
                            </span>
                          )
                        }
                        return null
                      })}
                      <button
                        onClick={() => onPageChange && onPageChange(page + 1)}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center rounded-r-md border border-gray-700/50 bg-[var(--portal-card-bg)] px-2 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
