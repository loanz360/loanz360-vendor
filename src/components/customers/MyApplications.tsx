/**
 * My Applications Component for Customer Portal
 * Shows all loan applications for authenticated customer
 * IMPORTANT: Does NOT show referral information or payout details
 */

'use client'

import { useState, useEffect } from 'react'
import { Tab } from '@headlessui/react'
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { InlineLoading } from '@/components/ui/loading-spinner'
import { formatCurrency } from '@/lib/utils/cn'

interface Application {
  lead_id: string
  lead_uuid: string
  loan_type: string
  loan_amount: number
  loan_purpose: string | null
  status: string
  form_status: string
  progress_percentage: number
  applied_at: string
  last_updated: string
  can_proceed_to_detailed: boolean
  assigned_bde_name?: string
  document_count: number
  note_count: number
}

interface MyApplicationsData {
  success: boolean
  customer_id: string
  customer_name: string
  active_applications: Application[]
  past_applications: Application[]
  stats: {
    total_applications: number
    active_count: number
    past_count: number
  }
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function MyApplications() {
  const [data, setData] = useState<MyApplicationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState(0)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/customer/my-applications')

      if (!response.ok) {
        throw new Error('Failed to fetch applications')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications')
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

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      NEW: { color: 'bg-blue-100 text-blue-800', icon: ClockIcon, label: 'New Application' },
      IN_PROGRESS: { color: 'bg-yellow-100 text-yellow-800', icon: ChartBarIcon, label: 'In Progress' },
      UNDER_REVIEW: { color: 'bg-purple-100 text-purple-800', icon: DocumentTextIcon, label: 'Under Review' },
      DOCUMENTS_PENDING: { color: 'bg-orange-100 text-orange-800', icon: DocumentTextIcon, label: 'Documents Needed' },
      APPROVED: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, label: 'Approved' },
      SANCTIONED: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, label: 'Sanctioned' },
      REJECTED: { color: 'bg-red-100 text-red-800', icon: XCircleIcon, label: 'Rejected' },
      CLOSED: { color: 'bg-gray-100 text-gray-800', icon: XCircleIcon, label: 'Closed' },
    }

    return statusConfig[status] || { color: 'bg-gray-100 text-gray-800', icon: ClockIcon, label: status }
  }

  const getNextStep = (app: Application) => {
    if (app.status === 'NEW' && app.can_proceed_to_detailed) {
      return 'Complete detailed form to proceed'
    }
    if (app.status === 'DOCUMENTS_PENDING') {
      return 'Upload required documents'
    }
    if (app.status === 'IN_PROGRESS') {
      return 'Application is being processed'
    }
    if (app.status === 'UNDER_REVIEW') {
      return 'Under review by our team'
    }
    if (app.status === 'APPROVED' || app.status === 'SANCTIONED') {
      return 'Congratulations! Your loan is approved'
    }
    if (app.status === 'REJECTED') {
      return 'Application was not approved'
    }
    return 'Processing your application'
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <InlineLoading size="sm" />
          <p className="mt-2 text-sm text-gray-600">Loading your applications...</p>
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
              onClick={fetchApplications}
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
      {/* Welcome Header */}
      <div className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
        <h2 className="text-2xl font-bold">My Loan Applications</h2>
        <p className="mt-1 text-orange-100">Track and manage all your loan applications</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Total Applications</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            {data?.stats.total_applications || 0}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Active</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-orange-600">
            {data?.stats.active_count || 0}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Completed</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">
            {data?.stats.past_count || 0}
          </dd>
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
            <span>Active Applications</span>
            <span className={classNames(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              selected ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              {data?.stats.active_count || 0}
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
            <span>Past Applications</span>
            <span className={classNames(
              'ml-2 px-2 py-0.5 rounded-full text-xs font-semibold',
              selected ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-700'
            )}>
              {data?.stats.past_count || 0}
            </span>
          </Tab>
        </Tab.List>

        <Tab.Panels className="mt-4">
          {/* Active Applications Tab */}
          <Tab.Panel>
            {data?.active_applications.length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No active applications</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by applying for a loan</p>
                <div className="mt-6">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500"
                  >
                    Apply for Loan
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data?.active_applications.map((app) => {
                  const statusInfo = getStatusInfo(app.status)
                  const StatusIcon = statusInfo.icon

                  return (
                    <div
                      key={app.lead_uuid}
                      className="relative overflow-hidden rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg"
                    >
                      {/* Progress Bar */}
                      <div className="absolute left-0 top-0 h-1 w-full bg-gray-200">
                        <div
                          className="h-full bg-orange-600 transition-all"
                          style={{ width: `${app.progress_percentage}%` }}
                        />
                      </div>

                      {/* Lead ID */}
                      <div className="mb-4">
                        <span className="text-xs font-medium text-gray-500">Application ID</span>
                        <p className="text-sm font-semibold text-gray-900">{app.lead_id}</p>
                      </div>

                      {/* Loan Type and Amount */}
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-gray-900">
                          {app.loan_type.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(app.loan_amount)}</p>
                      </div>

                      {/* Status Badge */}
                      <div className="mb-4">
                        <span
                          className={classNames(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusInfo.color
                          )}
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>Progress</span>
                          <span className="font-semibold">{app.progress_percentage}%</span>
                        </div>
                      </div>

                      {/* Next Step */}
                      <div className="mb-4 rounded-md bg-blue-50 p-3">
                        <p className="text-xs text-blue-900">
                          <strong>Next Step:</strong> {getNextStep(app)}
                        </p>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Applied on:</span>
                          <span className="font-medium">{formatDate(app.applied_at)}</span>
                        </div>
                        {app.assigned_bde_name && (
                          <div className="flex justify-between">
                            <span>Assigned to:</span>
                            <span className="font-medium">{app.assigned_bde_name}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Documents:</span>
                          <span className="font-medium">{app.document_count} uploaded</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      {app.can_proceed_to_detailed && (
                        <div className="mt-4">
                          <button className="w-full inline-flex items-center justify-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500">
                            Continue Application
                            <ArrowRightIcon className="ml-2 h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Tab.Panel>

          {/* Past Applications Tab */}
          <Tab.Panel>
            {data?.past_applications.length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No past applications</h3>
                <p className="mt-1 text-sm text-gray-500">Your completed applications will appear here</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Application
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Loan Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {data?.past_applications.map((app) => {
                      const statusInfo = getStatusInfo(app.status)
                      const StatusIcon = statusInfo.icon

                      return (
                        <tr key={app.lead_uuid} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{app.lead_id}</div>
                            <div className="text-xs text-gray-500">Applied {formatDate(app.applied_at)}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {app.loan_type.replace(/_/g, ' ')}
                            </div>
                            <div className="text-sm font-semibold text-gray-700">
                              {formatCurrency(app.loan_amount)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={classNames(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                statusInfo.color
                              )}
                            >
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {formatDate(app.last_updated)}
                          </td>
                        </tr>
                      )
                    })}
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
