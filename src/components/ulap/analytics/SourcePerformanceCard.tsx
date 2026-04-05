'use client'

/**
 * Source Performance Card
 *
 * Displays performance metrics for a specific lead source
 * Used in the analytics dashboard to compare source effectiveness
 */

import { motion } from 'framer-motion'
import {
  Building2,
  Users,
  Phone,
  MapPin,
  Globe,
  UserPlus,
  Footprints,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  DollarSign
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/cn'

interface SourcePerformanceCardProps {
  source: string
  leads: number
  conversions: number
  conversionRate: number
  avgAmount: number
  avgProcessingDays: number
  rank: number
  trend?: 'up' | 'down' | 'stable'
  onClick?: () => void
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  'Business Associate': Building2,
  'Business Partner': Users,
  'DSE Direct': Target,
  'Telecaller': Phone,
  'Field Sales': MapPin,
  'Customer Self-Service': Globe,
  'Referral': UserPlus,
  'Walk-In': Footprints,
  'Direct Submission': Target,
  'Website': Globe,
  'Other': Users
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Business Associate': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  'Business Partner': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  'DSE Direct': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  'Telecaller': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  'Field Sales': { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
  'Customer Self-Service': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  'Referral': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'Walk-In': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  'Direct Submission': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  'Website': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  'Other': { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' }
}

export default function SourcePerformanceCard({
  source,
  leads,
  conversions,
  conversionRate,
  avgAmount,
  avgProcessingDays,
  rank,
  trend = 'stable',
  onClick
}: SourcePerformanceCardProps) {
  const Icon = SOURCE_ICONS[source] || Users
  const colors = SOURCE_COLORS[source] || SOURCE_COLORS['Other']

  const getConversionColor = (rate: number) => {
    if (rate >= 40) return 'text-green-400'
    if (rate >= 30) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getProcessingColor = (days: number) => {
    if (days <= 4) return 'text-green-400'
    if (days <= 5) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '1st' }
    if (rank === 2) return { bg: 'bg-gray-400/20', text: 'text-gray-300', label: '2nd' }
    if (rank === 3) return { bg: 'bg-orange-600/20', text: 'text-orange-400', label: '3rd' }
    return { bg: 'bg-white/5', text: 'text-gray-500', label: `${rank}th` }
  }

  const rankBadge = getRankBadge(rank)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`bg-zinc-900/50 border ${colors.border} rounded-xl p-5 cursor-pointer hover:border-white/20 transition-all`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${colors.text}`} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{source}</h3>
            <p className="text-xs text-gray-500">{leads} leads</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${rankBadge.bg} ${rankBadge.text} font-medium`}>
            {rankBadge.label}
          </span>
          {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Conversion Rate */}
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">Conv. Rate</span>
          </div>
          <p className={`text-lg font-bold ${getConversionColor(conversionRate)}`}>
            {conversionRate}%
          </p>
          <p className="text-xs text-gray-500">{conversions} converted</p>
        </div>

        {/* Avg Processing Time */}
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">Avg. Time</span>
          </div>
          <p className={`text-lg font-bold ${getProcessingColor(avgProcessingDays)}`}>
            {avgProcessingDays} days
          </p>
          <p className="text-xs text-gray-500">to disburse</p>
        </div>

        {/* Avg Amount */}
        <div className="col-span-2 bg-white/5 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">Avg. Disbursement</span>
              </div>
              <p className="text-lg font-bold text-white">{formatCurrency(avgAmount)}</p>
            </div>

            {/* Mini conversion bar */}
            <div className="w-24">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${conversionRate}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${
                    conversionRate >= 40 ? 'bg-green-500' :
                    conversionRate >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
              </div>
              <p className="text-xs text-gray-500 text-right mt-1">{conversionRate}%</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
