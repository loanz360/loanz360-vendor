/**
 * Payout Status Dashboard Component
 * For BA (Business Associate) and BP (Business Partner) ONLY
 * Shows: Estimated Payout, Payout Earned, Payout Dropped, Payout Lost
 *
 * NOT available for: CP, Employee, Customer, or Direct referrals
 */

'use client'

import { useState, useEffect } from 'react'
import { Tab } from '@headlessui/react'
import {
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  CurrencyRupeeIcon,
} from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils/cn'

interface PayoutLead {
  lead_id: string
  lead_uuid: string
  customer_name: string
  customer_phone: string
  loan_type: string
  loan_amount: number
  commission_percentage: number | null
  commission_amount: number | null
  commission_status: string
  lead_status: string
  applied_at: string
  updated_at: string
  payout_remarks: string | null
}

interface PayoutCategory {
  count: number
  total_amount: number
  leads: PayoutLead[]
}

interface PayoutStatusData {
  success: boolean
  referral_id: string
  partner_type: string
  partner_name: string
  payout_summary: {
    estimated: PayoutCategory
    earned: PayoutCategory
    dropped: PayoutCategory
    lost: PayoutCategory
    referral_changed: PayoutCategory
    lifetime_earnings: number
    total_leads: number
  }
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function PayoutStatusDashboard() {
  const [data, setData] = useState<PayoutStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPayoutStatus()
  }, [])

  const fetchPayoutStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/partners/payout-status')

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch payout status')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payout status')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      UNDER_REVIEW: 'bg-purple-100 text-purple-800',
      APPROVED: 'bg-green-100 text-green-800',
      SANCTIONED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
      CUSTOMER_DROPPED: 'bg-gray-100 text-gray-800',
    }

    return (
      <span className={classNames('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || 'bg-gray-100 text-gray-800')}>
        {status.replace(/_/g, ' ')}
      </span>
    )
  }

  const filterLeads = (leads: PayoutLead[]) => {
    if (!searchTerm) return leads

    const searchLower = searchTerm.toLowerCase()
    return leads.filter((lead) =>
      lead.lead_id.toLowerCase().includes(searchLower) ||
      lead.customer_name.toLowerCase().includes(searchLower) ||
      lead.customer_phone.includes(searchTerm) ||
      lead.loan_type.toLowerCase().includes(searchLower)
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Loading payout status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <div className="flex">
          <XCircleIcon className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchPayoutStatus}
              className="mt-3 text-sm font-medium text-red-800 hover:text-red-900"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { payout_summary } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Payout Status</h2>
            <p className="mt-1 text-orange-100">
              {data.partner_type} - {data.partner_name} ({data.referral_id})
            </p>
          </div>
          <button
            onClick={fetchPayoutStatus}
            className="inline-flex items-center rounded-md bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Estimated Payout */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="flex items-center text-sm font-medium text-gray-500">
            <ClockIcon className="mr-2 h-5 w-5 text-blue-500" />
            Estimated Payout
          </dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-blue-600">
            {formatCurrency(payout_summary.estimated.total_amount)}
          </dd>
          <dd className="mt-1 text-xs text-gray-500">{payout_summary.estimated.count} leads in progress</dd>
        </div>

        {/* Payout Earned */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="flex items-center text-sm font-medium text-gray-500">
            <CheckCircleIcon className="mr-2 h-5 w-5 text-green-500" />
            Payout Earned
          </dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">
            {formatCurrency(payout_summary.earned.total_amount)}
          </dd>
          <dd className="mt-1 text-xs text-gray-500">{payout_summary.earned.count} approved leads</dd>
        </div>

        {/* Payout Dropped */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="flex items-center text-sm font-medium text-gray-500">
            <ExclamationCircleIcon className="mr-2 h-5 w-5 text-gray-500" />
            Payout Dropped
          </dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-600">
            {formatCurrency(payout_summary.dropped.total_amount)}
          </dd>
          <dd className="mt-1 text-xs text-gray-500">{payout_summary.dropped.count} customers dropped</dd>
        </div>

        {/* Payout Lost */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="flex items-center text-sm font-medium text-gray-500">
            <XCircleIcon className="mr-2 h-5 w-5 text-red-500" />
            Payout Lost
          </dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-red-600">
            {formatCurrency(payout_summary.lost.total_amount)}
          </dd>
          <dd className="mt-1 text-xs text-gray-500">{payout_summary.lost.count} leads rejected</dd>
        </div>
      </div>

      {/* Lifetime Earnings Card */}
      <div className="overflow-hidden rounded-lg bg-gradient-to-r from-green-500 to-green-600 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <dt className="flex items-center text-sm font-medium text-green-100">
              <CurrencyRupeeIcon className="mr-2 h-5 w-5" />
              Lifetime Earnings
            </dt>
            <dd className="mt-2 text-4xl font-bold tracking-tight">
              {formatCurrency(payout_summary.lifetime_earnings)}
            </dd>
            <dd className="mt-1 text-sm text-green-100">
              From {payout_summary.earned.count} approved leads out of {payout_summary.total_leads} total leads
            </dd>
          </div>
          <ChartBarIcon className="h-16 w-16 text-white/30" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by lead ID, customer name, phone, or loan type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 py-2 pl-3 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="mb-6 flex">
          <Tab
            className={({ selected }) =>
              classNames(
                'flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-medium text-sm transition-all duration-200',
                'focus:outline-none',
                selected
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              )
            }
          >
            <span>Estimated</span>
            <span className={classNames(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              selected ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              {payout_summary.estimated.count}
            </span>
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-medium text-sm transition-all duration-200',
                'focus:outline-none',
                selected
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              )
            }
          >
            <span>Earned</span>
            <span className={classNames(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              selected ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              {payout_summary.earned.count}
            </span>
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-medium text-sm transition-all duration-200',
                'focus:outline-none',
                selected
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              )
            }
          >
            <span>Dropped</span>
            <span className={classNames(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              selected ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              {payout_summary.dropped.count}
            </span>
          </Tab>
          <Tab
            className={({ selected }) =>
              classNames(
                'flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-medium text-sm transition-all duration-200',
                'focus:outline-none',
                selected
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              )
            }
          >
            <span>Lost</span>
            <span className={classNames(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              selected ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              {payout_summary.lost.count}
            </span>
          </Tab>
        </Tab.List>

        <Tab.Panels className="mt-4">
          {/* Estimated Payout Tab */}
          <Tab.Panel>
            {filterLeads(payout_summary.estimated.leads).length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No estimated payouts</h3>
                <p className="mt-1 text-sm text-gray-500">Leads with estimated payouts will appear here</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Lead ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Loan Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Commission
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Applied On
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filterLeads(payout_summary.estimated.leads).map((lead) => (
                      <tr key={lead.lead_uuid} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {lead.lead_id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                          <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{lead.loan_type.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-semibold text-gray-700">{formatCurrency(lead.loan_amount)}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {getStatusBadge(lead.lead_status)}
                        </td>
                        <td className="px-6 py-4">
                          {lead.commission_percentage && lead.commission_amount ? (
                            <>
                              <div className="text-sm font-semibold text-blue-600">{formatCurrency(lead.commission_amount)}</div>
                              <div className="text-xs text-gray-500">{lead.commission_percentage}%</div>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">Calculating...</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(lead.applied_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tab.Panel>

          {/* Earned Payout Tab */}
          <Tab.Panel>
            {filterLeads(payout_summary.earned.leads).length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No earned payouts yet</h3>
                <p className="mt-1 text-sm text-gray-500">Approved leads with earned payouts will appear here</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Lead ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Loan Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Commission Earned
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Approved On
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filterLeads(payout_summary.earned.leads).map((lead) => (
                      <tr key={lead.lead_uuid} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {lead.lead_id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                          <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{lead.loan_type.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-semibold text-gray-700">{formatCurrency(lead.loan_amount)}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {getStatusBadge(lead.lead_status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-green-600">{formatCurrency(lead.commission_amount || 0)}</div>
                          <div className="text-xs text-gray-500">{lead.commission_percentage}%</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(lead.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tab.Panel>

          {/* Dropped Payout Tab */}
          <Tab.Panel>
            {filterLeads(payout_summary.dropped.leads).length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <ExclamationCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No dropped payouts</h3>
                <p className="mt-1 text-sm text-gray-500">Leads where customers dropped will appear here</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Lead ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Loan Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Lost Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filterLeads(payout_summary.dropped.leads).map((lead) => (
                      <tr key={lead.lead_uuid} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {lead.lead_id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                          <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{lead.loan_type.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-semibold text-gray-700">{formatCurrency(lead.loan_amount)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-500">{lead.payout_remarks || 'Customer dropped'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-600">
                            {lead.commission_amount ? formatCurrency(lead.commission_amount) : '-'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(lead.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tab.Panel>

          {/* Lost Payout Tab */}
          <Tab.Panel>
            {filterLeads(payout_summary.lost.leads).length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <XCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No lost payouts</h3>
                <p className="mt-1 text-sm text-gray-500">Rejected leads will appear here</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Lead ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Loan Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Lost Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Rejected On
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filterLeads(payout_summary.lost.leads).map((lead) => (
                      <tr key={lead.lead_uuid} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {lead.lead_id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                          <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{lead.loan_type.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-semibold text-gray-700">{formatCurrency(lead.loan_amount)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-500">{lead.payout_remarks || 'Rejected by bank'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-red-600">
                            {lead.commission_amount ? formatCurrency(lead.commission_amount) : '-'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(lead.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  )
}
