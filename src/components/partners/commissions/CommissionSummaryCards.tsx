/**
 * Commission Summary Cards Component
 * Displays commission overview metrics for BA/BP partners
 * Shows: Calculated, Approved, Paid, Dropped, Lost, and Pending Payout
 *
 * Theme: Dark theme matching LOANZ 360 design system
 */

'use client'

import {
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  CurrencyRupeeIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils/cn'

export interface CommissionSummary {
  total_estimated: number
  total_calculated: number
  total_approved: number
  total_paid: number
  total_dropped: number
  total_lost: number
  pending_payout: number
  total_leads: number
}

interface CommissionSummaryCardsProps {
  summary: CommissionSummary
  loading?: boolean
}

export default function CommissionSummaryCards({
  summary,
  loading = false,
}: CommissionSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse overflow-hidden rounded-lg bg-[var(--portal-card-bg)] px-4 py-5 border border-gray-700/50 sm:p-6"
          >
            <div className="h-4 w-24 rounded bg-gray-700"></div>
            <div className="mt-2 h-8 w-32 rounded bg-gray-700"></div>
            <div className="mt-2 h-3 w-20 rounded bg-gray-700"></div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      name: 'Pending Payout',
      value: summary.pending_payout,
      subtitle: 'Awaiting approval',
      icon: ClockIcon,
      iconColor: 'text-blue-400',
      valueColor: 'text-blue-400',
      labelColor: 'text-blue-300',
      cardClass: 'stat-card-blue',
      iconBg: 'bg-blue-500/20',
    },
    {
      name: 'Total Calculated',
      value: summary.total_calculated,
      subtitle: 'Commission earned',
      icon: CheckCircleIcon,
      iconColor: 'text-emerald-400',
      valueColor: 'text-emerald-400',
      labelColor: 'text-emerald-300',
      cardClass: 'stat-card-emerald',
      iconBg: 'bg-emerald-500/20',
    },
    {
      name: 'Total Paid',
      value: summary.total_paid,
      subtitle: 'Successfully paid',
      icon: BanknotesIcon,
      iconColor: 'text-orange-500',
      valueColor: 'text-orange-500',
      labelColor: 'text-orange-300',
      cardClass: 'stat-card-orange',
      iconBg: 'bg-orange-500/20',
    },
    {
      name: 'Total Dropped',
      value: summary.total_dropped,
      subtitle: 'Customer cancellations',
      icon: ExclamationCircleIcon,
      iconColor: 'text-gray-400',
      valueColor: 'text-gray-400',
      labelColor: 'text-gray-300',
      cardClass: 'stat-card',
      iconBg: 'bg-gray-500/20',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.name}
            className={`${card.cardClass} overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-3">
              <dt className={`flex items-center text-sm font-medium ${card.labelColor}`}>
                <card.icon className={`mr-2 h-5 w-5 ${card.iconColor}`} />
                {card.name}
              </dt>
              <div className={`p-2 ${card.iconBg} rounded-lg`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
            <dd className={`text-3xl font-semibold tracking-tight ${card.valueColor}`}>
              {formatCurrency(card.value)}
            </dd>
            <dd className="mt-1 text-xs text-gray-400">{card.subtitle}</dd>
          </div>
        ))}
      </div>

      {/* Lifetime Earnings Banner */}
      <div className="overflow-hidden rounded-lg loanz-gradient p-6 text-white shadow-lg loanz-glow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <dt className="flex items-center text-sm font-medium text-white/80">
              <CurrencyRupeeIcon className="mr-2 h-5 w-5" />
              Lifetime Earnings
            </dt>
            <dd className="mt-2 text-4xl font-bold tracking-tight text-white">
              {formatCurrency(summary.total_paid)}
            </dd>
            <dd className="mt-1 text-sm text-white/80">
              From {summary.total_leads} total leads
            </dd>
          </div>
          <div className="flex flex-col items-end">
            <ArrowTrendingUpIcon className="h-16 w-16 text-white/30" />
            {summary.total_calculated > 0 && (
              <div className="mt-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                {formatCurrency(summary.total_calculated)} calculated
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Stats - Lost Commissions */}
      {summary.total_lost > 0 && (
        <div className="overflow-hidden rounded-lg bg-red-900/30 border border-red-800/50 p-4">
          <div className="flex items-center">
            <XCircleIcon className="h-8 w-8 text-red-400" />
            <div className="ml-3">
              <dt className="text-sm font-medium text-red-300">Lost Commissions</dt>
              <dd className="mt-1 text-2xl font-semibold text-red-400">
                {formatCurrency(summary.total_lost)}
              </dd>
              <dd className="text-xs text-red-400/80">Due to lead rejections by bank/system</dd>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Summary */}
      <div className="content-card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <div className="text-xs text-gray-400">Calculated</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {formatCurrency(summary.total_calculated)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Approved</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {formatCurrency(summary.total_approved)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Pending</div>
            <div className="mt-1 text-lg font-semibold text-blue-400">
              {formatCurrency(summary.pending_payout)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Paid</div>
            <div className="mt-1 text-lg font-semibold text-emerald-400">
              {formatCurrency(summary.total_paid)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
