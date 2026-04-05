/**
 * Payout Batches Table Component
 * Displays all payout batches with actions (approve, mark paid)
 */

'use client'

import { useState } from 'react'
import {
  CheckCircleIcon,
  BanknotesIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils/cn'

export interface PayoutBatch {
  id: string
  batch_number: string
  batch_date: string
  partner_type: string
  total_leads: number
  total_amount: number
  status: string
  created_by: string
  created_at: string
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  remarks: string | null
}

interface PayoutBatchesTableProps {
  batches: PayoutBatch[]
  loading?: boolean
  onApproveBatch: (batchId: string) => Promise<void>
  onMarkPaid: (batchId: string) => Promise<void>
}

export default function PayoutBatchesTable({
  batches,
  loading = false,
  onApproveBatch,
  onMarkPaid,
}: PayoutBatchesTableProps) {
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

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
      { color: string; icon: typeof ClockIcon; label: string }
    > = {
      PENDING: {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        icon: ClockIcon,
        label: 'Pending',
      },
      APPROVED: {
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: CheckCircleIcon,
        label: 'Approved',
      },
      PAID: {
        color: 'bg-green-100 text-green-800 border-green-300',
        icon: BanknotesIcon,
        label: 'Paid',
      },
      CANCELLED: {
        color: 'bg-red-100 text-red-800 border-red-300',
        icon: XCircleIcon,
        label: 'Cancelled',
      },
    }

    const config = statusConfig[status] || statusConfig.PENDING
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

  const handleApprove = async (batchId: string) => {
    if (confirm('Are you sure you want to approve this batch for payment?')) {
      setProcessingBatchId(batchId)
      try {
        await onApproveBatch(batchId)
      } finally {
        setProcessingBatchId(null)
      }
    }
  }

  const handleMarkPaid = async (batchId: string) => {
    if (confirm('Confirm that payment has been processed for this batch?')) {
      setProcessingBatchId(batchId)
      try {
        await onMarkPaid(batchId)
      } finally {
        setProcessingBatchId(null)
      }
    }
  }

  const filterBatches = () => {
    if (statusFilter === 'ALL') return batches
    return batches.filter(b => b.status === statusFilter)
  }

  const filteredBatches = filterBatches()

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 w-full rounded bg-gray-100"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <strong>{filteredBatches.length}</strong> batch(es)
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block rounded-lg border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {filteredBatches.length === 0 ? (
          <div className="p-12 text-center">
            <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No batches found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {statusFilter !== 'ALL'
                ? 'Try adjusting your filter'
                : 'Create your first payout batch'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Batch Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Partner Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Leads
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {batch.batch_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        Created {formatDate(batch.created_at)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(batch.batch_date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                        {batch.partner_type === 'BUSINESS_ASSOCIATE' ? 'BA' : 'BP'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {batch.total_leads}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-bold text-green-600">
                        {formatCurrency(batch.total_amount)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {getStatusBadge(batch.status)}
                      {batch.paid_at && (
                        <div className="mt-1 text-xs text-gray-500">
                          Paid {formatDate(batch.paid_at)}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {batch.status === 'PENDING' && (
                        <button
                          onClick={() => handleApprove(batch.id)}
                          disabled={processingBatchId === batch.id}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                        >
                          {processingBatchId === batch.id ? 'Approving...' : 'Approve'}
                        </button>
                      )}
                      {batch.status === 'APPROVED' && (
                        <button
                          onClick={() => handleMarkPaid(batch.id)}
                          disabled={processingBatchId === batch.id}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          {processingBatchId === batch.id ? 'Processing...' : 'Mark as Paid'}
                        </button>
                      )}
                      {batch.status === 'PAID' && (
                        <span className="text-gray-500">Complete</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
