/**
 * My Customers Component
 * Shows Active and Old customers for referrals (BP/CP/Employee)
 */

'use client'

import { useState, useEffect } from 'react'
import { Tab } from '@headlessui/react'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils/cn'

interface ActiveCustomer {
  lead_id: string
  lead_uuid: string
  customer_id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  loan_type: string
  loan_amount: number
  status: string
  applied_at: string
  last_updated: string
  progress_percentage: number
  assigned_bde_name?: string
}

interface OldCustomer {
  lead_id: string
  lead_uuid: string
  customer_id: string
  customer_name: string
  customer_phone: string
  loan_type: string
  loan_amount: number
  status: string
  closed_at: string
  closure_reason: 'CONVERTED' | 'REJECTED' | 'REFERRAL_CHANGED' | 'CLOSED' | 'OTHER'
}

interface MyCustomersData {
  success: boolean
  referral_id: string
  active_customers: ActiveCustomer[]
  old_customers: OldCustomer[]
  stats: {
    active_count: number
    old_count: number
    total_referred: number
  }
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function MyCustomers() {
  const [data, setData] = useState<MyCustomersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTab, setSelectedTab] = useState(0)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/referral/my-customers')

      if (!response.ok) {
        throw new Error('Failed to fetch customers')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = (customers: any[], filename: string) => {
    if (!customers.length) return

    const headers = Object.keys(customers[0]).join(',')
    const rows = customers.map(customer =>
      Object.values(customer).map(val => `"${val}"`).join(',')
    )
    const csv = [headers, ...rows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  const filteredActiveCustomers = data?.active_customers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.lead_id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const filteredOldCustomers = data?.old_customers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.lead_id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      NEW: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      UNDER_REVIEW: 'bg-purple-100 text-purple-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      DOCUMENTS_PENDING: 'bg-orange-100 text-orange-800',
    }

    return (
      <span
        className={classNames(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          statusColors[status] || 'bg-gray-100 text-gray-800'
        )}
      >
        {status.replace(/_/g, ' ')}
      </span>
    )
  }

  const getClosureReasonBadge = (reason: string) => {
    const reasonConfig: Record<string, { icon: any; color: string; label: string }> = {
      CONVERTED: {
        icon: CheckCircleIcon,
        color: 'bg-green-100 text-green-800',
        label: 'Converted',
      },
      REJECTED: {
        icon: XCircleIcon,
        color: 'bg-red-100 text-red-800',
        label: 'Rejected',
      },
      REFERRAL_CHANGED: {
        icon: UserGroupIcon,
        color: 'bg-blue-100 text-blue-800',
        label: 'Referral Changed',
      },
      CLOSED: {
        icon: ClockIcon,
        color: 'bg-gray-100 text-gray-800',
        label: 'Closed',
      },
    }

    const config = reasonConfig[reason] || reasonConfig.CLOSED
    const Icon = config.icon

    return (
      <span className={classNames('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.color)}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Loading customers...</p>
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
            <h3 className="text-sm font-medium text-red-800">Error loading customers</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchCustomers}
              className="mt-3 text-sm font-medium text-red-800 hover:text-red-900"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Active Customers</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            {data?.stats.active_count || 0}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Old Customers</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            {data?.stats.old_count || 0}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Total Referred</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            {data?.stats.total_referred || 0}
          </dd>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, customer ID, or lead ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const customers = selectedTab === 0 ? filteredActiveCustomers : filteredOldCustomers
              exportToCSV(customers, `${selectedTab === 0 ? 'active' : 'old'}-customers-${new Date().toISOString().split('T')[0]}.csv`)
            }}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
            Export CSV
          </button>
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
            <span>Active Customers</span>
            <span className={classNames(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              selected ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              {filteredActiveCustomers.length}
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
            <span>Old Customers</span>
            <span className={classNames(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              selected ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              {filteredOldCustomers.length}
            </span>
          </Tab>
        </Tab.List>

        <Tab.Panels className="mt-4">
          {/* Active Customers Tab */}
          <Tab.Panel>
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
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      BDE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredActiveCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                        No active customers found
                      </td>
                    </tr>
                  ) : (
                    filteredActiveCustomers.map((customer) => (
                      <tr key={customer.lead_uuid} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {customer.lead_id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{customer.customer_name}</div>
                          <div className="text-sm text-gray-500">{customer.customer_id}</div>
                          <div className="text-sm text-gray-500">{customer.customer_phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{customer.loan_type.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-semibold text-gray-700">{formatCurrency(customer.loan_amount)}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {getStatusBadge(customer.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-orange-600 h-2 rounded-full"
                                style={{ width: `${customer.progress_percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600">{customer.progress_percentage}%</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {customer.assigned_bde_name || 'Not assigned'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(customer.last_updated)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Tab.Panel>

          {/* Old Customers Tab */}
          <Tab.Panel>
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
                      Final Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Closure Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Closed Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredOldCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                        No old customers found
                      </td>
                    </tr>
                  ) : (
                    filteredOldCustomers.map((customer) => (
                      <tr key={customer.lead_uuid} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {customer.lead_id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{customer.customer_name}</div>
                          <div className="text-sm text-gray-500">{customer.customer_id}</div>
                          <div className="text-sm text-gray-500">{customer.customer_phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{customer.loan_type.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-semibold text-gray-700">{formatCurrency(customer.loan_amount)}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {getStatusBadge(customer.status)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {getClosureReasonBadge(customer.closure_reason)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(customer.closed_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  )
}
