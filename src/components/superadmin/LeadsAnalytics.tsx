/**
 * Leads Analytics Component
 * Comprehensive analytics dashboard with growth trends and filters
 */

'use client'

import { useState, useEffect } from 'react'
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils/cn'

interface AnalyticsData {
  // Line 1: Time-based
  todayLeads: { count: number; growth: number }
  thisMonthLeads: { count: number; growth: number }
  thisYearLeads: { count: number; growth: number }

  // Line 2: Lead Status
  leadsReceived: { count: number; growth: number }
  leadsInProcess: { count: number; growth: number }
  leadsRejected: { count: number; growth: number }
  leadsSanctioned: { count: number; growth: number }
  leadsDropped: { count: number; growth: number }

  // Line 3: Source
  sourcePartners: { count: number; growth: number }
  sourceEmployees: { count: number; growth: number }
  sourceCustomerReferred: { count: number; growth: number }
  sourceDirectCustomer: { count: number; growth: number }

  // Line 4: Loan Amounts
  loanAmountLogin: { amount: number; growth: number }
  loanAmountProcess: { amount: number; growth: number }
  loanAmountSanction: { amount: number; growth: number }
  loanAmountDropped: { amount: number; growth: number }
  loanAmountRejected: { amount: number; growth: number }
}

interface LeadsAnalyticsProps {
  filterMonth?: string
  filterState?: string
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function LeadsAnalytics({ filterMonth, filterState }: LeadsAnalyticsProps) {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedState, setSelectedState] = useState<string>('all')
  const [selectedLoanType, setSelectedLoanType] = useState<string>('all')
  const [useDummyData, setUseDummyData] = useState(true) // Toggle for dummy data

  useEffect(() => {
    fetchAnalytics()
  }, [selectedMonth, selectedState, selectedLoanType, useDummyData])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        ...(selectedMonth !== 'all' && { month: selectedMonth }),
        ...(selectedState !== 'all' && { state: selectedState }),
        ...(selectedLoanType !== 'all' && { loan_type: selectedLoanType }),
        ...(useDummyData && { dummy: 'true' }), // Add dummy parameter
      })

      // Use credentials: 'include' to send HttpOnly cookies for authentication
      const response = await fetch(`/api/superadmin/leads/analytics?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Please log in as Super Admin')
        }
        throw new Error(`Failed to fetch analytics (${response.status})`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load analytics data')
      }

      setAnalytics(data.analytics)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      setError(error instanceof Error ? error.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num)
  }

  const TrendIndicator = ({ growth }: { growth: number }) => {
    const isPositive = growth >= 0
    const absGrowth = Math.abs(growth)

    return (
      <div className={classNames(
        'flex items-center text-xs font-medium',
        isPositive ? 'text-green-400' : 'text-red-400'
      )}>
        {isPositive ? (
          <ArrowUpIcon className="h-3 w-3 mr-1" />
        ) : (
          <ArrowDownIcon className="h-3 w-3 mr-1" />
        )}
        <span>{absGrowth.toFixed(1)}%</span>
      </div>
    )
  }

  const StatCard = ({
    title,
    value,
    growth,
    isCurrency = false,
    color = 'orange'
  }: {
    title: string
    value: number
    growth: number
    isCurrency?: boolean
    color?: string
  }) => {
    const colorClasses = {
      orange: 'border-orange-500/30 bg-orange-500/10',
      blue: 'border-blue-500/30 bg-blue-500/10',
      green: 'border-green-500/30 bg-green-500/10',
      red: 'border-red-500/30 bg-red-500/10',
      purple: 'border-purple-500/30 bg-purple-500/10',
      yellow: 'border-yellow-500/30 bg-yellow-500/10',
      cyan: 'border-cyan-500/30 bg-cyan-500/10',
      pink: 'border-pink-500/30 bg-pink-500/10',
    }

    return (
      <div className={classNames(
        'rounded-lg border backdrop-blur-lg p-4 shadow-lg transition-all hover:scale-105',
        colorClasses[color as keyof typeof colorClasses] || colorClasses.orange
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              {title}
            </p>
            <p className="text-2xl font-bold text-white mb-2">
              {isCurrency ? formatCurrency(value) : formatNumber(value)}
            </p>
            <TrendIndicator growth={growth} />
          </div>
        </div>
        {/* Mini trend line visualization */}
        <div className="mt-3 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={classNames(
              'h-full rounded-full transition-all',
              growth >= 0 ? 'bg-green-400' : 'bg-red-400'
            )}
            style={{ width: `${Math.min(Math.abs(growth), 100)}%` }}
          ></div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-400">Error Loading Analytics</h3>
            <p className="mt-2 text-sm text-red-300">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 inline-flex items-center px-3 py-2 border border-red-500/30 rounded-md bg-red-500/10 text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No analytics data available</p>
        <button
          onClick={fetchAnalytics}
          className="mt-4 inline-flex items-center px-4 py-2 border border-white/20 rounded-md bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Reload Analytics
        </button>
      </div>
    )
  }

  const months = [
    { value: 'all', label: 'All Time' },
    { value: '2025-01', label: 'January 2025' },
    { value: '2024-12', label: 'December 2024' },
    { value: '2024-11', label: 'November 2024' },
    { value: '2024-10', label: 'October 2024' },
    { value: '2024-09', label: 'September 2024' },
    { value: '2024-08', label: 'August 2024' },
  ]

  const states = [
    { value: 'all', label: 'All States' },
    { value: 'Karnataka', label: 'Karnataka' },
    { value: 'Maharashtra', label: 'Maharashtra' },
    { value: 'Tamil Nadu', label: 'Tamil Nadu' },
    { value: 'Delhi', label: 'Delhi' },
    { value: 'Telangana', label: 'Telangana' },
    { value: 'Gujarat', label: 'Gujarat' },
    { value: 'West Bengal', label: 'West Bengal' },
  ]

  const loanTypes = [
    { value: 'all', label: 'All Loan Types' },
    { value: 'PERSONAL_LOAN', label: 'Personal Loan' },
    { value: 'HOME_LOAN', label: 'Home Loan' },
    { value: 'BUSINESS_LOAN', label: 'Business Loan' },
    { value: 'CAR_LOAN', label: 'Car Loan' },
    { value: 'EDUCATION_LOAN', label: 'Education Loan' },
    { value: 'PROPERTY_LOAN', label: 'Property Loan' },
    { value: 'GOLD_LOAN', label: 'Gold Loan' },
    { value: 'MORTGAGE_LOAN', label: 'Mortgage Loan' },
  ]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-lg bg-white/5 backdrop-blur-lg border border-white/10 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Filters</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUseDummyData(!useDummyData)}
              className={classNames(
                'inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                useDummyData
                  ? 'border-green-500 bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'border-white/20 bg-white/5 text-gray-400 hover:bg-white/10'
              )}
            >
              {useDummyData ? '📊 Dummy Data ON' : '📊 Dummy Data OFF'}
            </button>
            <button
              onClick={fetchAnalytics}
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/20 bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="block w-full rounded-lg border border-white/20 bg-black/50 py-2 px-3 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              State
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="block w-full rounded-lg border border-white/20 bg-black/50 py-2 px-3 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {states.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Loan Type
            </label>
            <select
              value={selectedLoanType}
              onChange={(e) => setSelectedLoanType(e.target.value)}
              className="block w-full rounded-lg border border-white/20 bg-black/50 py-2 px-3 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {loanTypes.map((loanType) => (
                <option key={loanType.value} value={loanType.value}>
                  {loanType.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Line 1: Time-based Leads */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Lead Growth Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Today Leads"
            value={analytics.todayLeads.count}
            growth={analytics.todayLeads.growth}
            color="blue"
          />
          <StatCard
            title="This Month"
            value={analytics.thisMonthLeads.count}
            growth={analytics.thisMonthLeads.growth}
            color="purple"
          />
          <StatCard
            title="This Year"
            value={analytics.thisYearLeads.count}
            growth={analytics.thisYearLeads.growth}
            color="cyan"
          />
        </div>
      </div>

      {/* Line 2: Lead Status */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Lead Status Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard
            title="Leads Received"
            value={analytics.leadsReceived.count}
            growth={analytics.leadsReceived.growth}
            color="blue"
          />
          <StatCard
            title="Leads in Process"
            value={analytics.leadsInProcess.count}
            growth={analytics.leadsInProcess.growth}
            color="yellow"
          />
          <StatCard
            title="Leads Rejected"
            value={analytics.leadsRejected.count}
            growth={analytics.leadsRejected.growth}
            color="red"
          />
          <StatCard
            title="Leads Sanctioned"
            value={analytics.leadsSanctioned.count}
            growth={analytics.leadsSanctioned.growth}
            color="green"
          />
          <StatCard
            title="Leads Dropped"
            value={analytics.leadsDropped.count}
            growth={analytics.leadsDropped.growth}
            color="orange"
          />
        </div>
      </div>

      {/* Line 3: Source */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Lead Source Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Partners"
            value={analytics.sourcePartners.count}
            growth={analytics.sourcePartners.growth}
            color="purple"
          />
          <StatCard
            title="Employees"
            value={analytics.sourceEmployees.count}
            growth={analytics.sourceEmployees.growth}
            color="cyan"
          />
          <StatCard
            title="Customer Referred"
            value={analytics.sourceCustomerReferred.count}
            growth={analytics.sourceCustomerReferred.growth}
            color="green"
          />
          <StatCard
            title="Direct Customer"
            value={analytics.sourceDirectCustomer.count}
            growth={analytics.sourceDirectCustomer.growth}
            color="orange"
          />
        </div>
      </div>

      {/* Line 4: Loan Amounts */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Loan Amount Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard
            title="Loan Amount in Login"
            value={analytics.loanAmountLogin.amount}
            growth={analytics.loanAmountLogin.growth}
            isCurrency={true}
            color="blue"
          />
          <StatCard
            title="Loan Amount Process"
            value={analytics.loanAmountProcess.amount}
            growth={analytics.loanAmountProcess.growth}
            isCurrency={true}
            color="yellow"
          />
          <StatCard
            title="Loan Amount Sanction"
            value={analytics.loanAmountSanction.amount}
            growth={analytics.loanAmountSanction.growth}
            isCurrency={true}
            color="green"
          />
          <StatCard
            title="Loan Amount Dropped"
            value={analytics.loanAmountDropped.amount}
            growth={analytics.loanAmountDropped.growth}
            isCurrency={true}
            color="orange"
          />
          <StatCard
            title="Loan Amount Rejected"
            value={analytics.loanAmountRejected.amount}
            growth={analytics.loanAmountRejected.growth}
            isCurrency={true}
            color="red"
          />
        </div>
      </div>
    </div>
  )
}
