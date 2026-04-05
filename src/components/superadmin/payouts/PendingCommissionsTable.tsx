/**
 * Pending Commissions Table Component
 * Displays all calculated commissions awaiting batch creation
 * With selection capability for batch creation
 */

'use client'

import { useState } from 'react'
import {
  CheckIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils/cn'

export interface PendingCommission {
  id: string
  lead_id: string
  partner_id: string
  partner_name: string
  partner_type: string
  customer_name: string
  loan_type: string
  bank_name: string | null
  location: string | null
  required_loan_amount: number
  commission_percentage: number
  commission_amount: number
  commission_calculated_at: string
  created_at: string
}

interface PendingCommissionsTableProps {
  commissions: PendingCommission[]
  loading?: boolean
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

export default function PendingCommissionsTable({
  commissions,
  loading = false,
  selectedIds,
  onSelectionChange,
}: PendingCommissionsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [partnerTypeFilter, setPartnerTypeFilter] = useState('ALL')

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const filterCommissions = () => {
    let filtered = commissions

    // Partner type filter
    if (partnerTypeFilter !== 'ALL') {
      filtered = filtered.filter(c => c.partner_type === partnerTypeFilter)
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(
        c =>
          c.lead_id.toLowerCase().includes(searchLower) ||
          c.partner_name.toLowerCase().includes(searchLower) ||
          c.customer_name.toLowerCase().includes(searchLower) ||
          (c.bank_name && c.bank_name.toLowerCase().includes(searchLower))
      )
    }

    return filtered
  }

  const filteredCommissions = filterCommissions()

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(filteredCommissions.map(c => c.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id])
    } else {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id))
    }
  }

  const allSelected = filteredCommissions.length > 0 && selectedIds.length === filteredCommissions.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < filteredCommissions.length

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-full rounded bg-gray-200"></div>
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
      {/* Search and Filter Bar */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by lead ID, partner, customer, bank..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Partner Type Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={partnerTypeFilter}
              onChange={(e) => setPartnerTypeFilter(e.target.value)}
              className="block rounded-lg border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="ALL">All Partners</option>
              <option value="BUSINESS_ASSOCIATE">Business Associates</option>
              <option value="BUSINESS_PARTNER">Business Partners</option>
            </select>
          </div>
        </div>

        {/* Selection Summary */}
        {selectedIds.length > 0 && (
          <div className="mt-3 rounded-md bg-orange-50 px-4 py-2 text-sm text-orange-800">
            <strong>{selectedIds.length}</strong> commission(s) selected •{' '}
            <strong>
              {formatCurrency(
                commissions
                  .filter(c => selectedIds.includes(c.id))
                  .reduce((sum, c) => sum + c.commission_amount, 0)
              )}
            </strong>{' '}
            total
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {filteredCommissions.length === 0 ? (
          <div className="p-12 text-center">
            <CheckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pending commissions</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || partnerTypeFilter !== 'ALL'
                ? 'Try adjusting your filters'
                : 'All commissions have been batched'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={input => {
                        if (input) input.indeterminate = someSelected
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Lead ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Partner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Loan Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Bank / Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Calculated On
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredCommissions.map((commission) => (
                  <tr
                    key={commission.id}
                    className={`hover:bg-gray-50 ${
                      selectedIds.includes(commission.id) ? 'bg-orange-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(commission.id)}
                        onChange={(e) => handleSelectOne(commission.id, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {commission.lead_id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {commission.partner_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {commission.partner_type === 'BUSINESS_ASSOCIATE' ? 'BA' : 'BP'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {commission.customer_name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {commission.loan_type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm font-semibold text-gray-700">
                        {formatCurrency(commission.required_loan_amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {commission.bank_name || 'Not specified'}
                      </div>
                      {commission.location && (
                        <div className="text-xs text-gray-500">{commission.location}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-green-600">
                        {formatCurrency(commission.commission_amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {commission.commission_percentage}%
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {formatDate(commission.commission_calculated_at)}
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
