'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import {
  FileText,
  Users,
  Building2,
  CheckCircle,
  TrendingUp,
  Clock,
  AlertTriangle,
  PauseCircle,
  XCircle,
  ArrowUpRight,
} from 'lucide-react'

interface PipelineStats {
  cp: { pending: number; in_verification: number; verified_today: number; sa_approved: number; finance_processing: number }
  ba: { pending: number; in_verification: number; verified_today: number; sa_approved: number; finance_processing: number }
  bp: { pending: number; in_verification: number; verified_today: number; sa_approved: number; finance_processing: number }
  pending_total: number
  in_progress_total: number
  verified_today_total: number
  monthly: { cp_verified: number; ba_verified: number; bp_verified: number; total_verified: number }
  sa_approved_total: number
  finance_processing_total: number
}

interface AgingData {
  cp_overdue: number
  ba_overdue: number
  bp_overdue: number
  total_overdue: number
}

interface Props {
  stats: PipelineStats
  aging: AgingData
  rejectedToday: number
  onHoldTotal: number
}

export default function ManagerStatsGrid({ stats, aging, rejectedToday, onHoldTotal }: Props) {
  const router = useRouter()

  const cards = [
    {
      label: 'CP Pending',
      value: stats.cp.pending,
      icon: FileText,
      color: 'yellow',
      onClick: () => router.push('/employees/accounts-executive/cp-applications'),
    },
    {
      label: 'BA Pending',
      value: stats.ba.pending,
      icon: Users,
      color: 'orange',
      onClick: () => router.push('/employees/accounts-executive/ba-applications'),
    },
    {
      label: 'BP Pending',
      value: stats.bp.pending,
      icon: Building2,
      color: 'amber',
      onClick: () => router.push('/employees/accounts-executive/bp-applications'),
    },
    {
      label: 'In Verification',
      value: stats.in_progress_total,
      icon: Clock,
      color: 'purple',
    },
    {
      label: 'Verified Today',
      value: stats.verified_today_total,
      icon: CheckCircle,
      color: 'green',
    },
    {
      label: 'Monthly Verified',
      value: stats.monthly.total_verified,
      icon: TrendingUp,
      color: 'blue',
    },
  ]

  const colorMap: Record<string, string> = {
    yellow: 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20',
    orange: 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20',
    amber: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
    purple: 'bg-purple-500/10 border-purple-500/30',
    green: 'bg-green-500/10 border-green-500/30',
    blue: 'bg-blue-500/10 border-blue-500/30',
  }

  const iconColorMap: Record<string, string> = {
    yellow: 'text-yellow-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
  }

  return (
    <div className="space-y-4">
      {/* Primary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.label}
              className={`${colorMap[card.color]} ${card.onClick ? 'cursor-pointer' : ''} transition-colors`}
              onClick={card.onClick}
            >
              <CardContent className="p-4 text-center">
                <Icon className={`w-8 h-8 ${iconColorMap[card.color]} mx-auto mb-2`} />
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Secondary alert row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-lg font-bold text-white">{aging.total_overdue}</p>
            <p className="text-xs text-gray-400">Overdue (&gt;3 days)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <PauseCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-lg font-bold text-white">{onHoldTotal}</p>
            <p className="text-xs text-gray-400">On Hold</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/15">
          <XCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
          <div>
            <p className="text-lg font-bold text-white">{rejectedToday}</p>
            <p className="text-xs text-gray-400">Rejected Today</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <ArrowUpRight className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-lg font-bold text-white">{stats.sa_approved_total}</p>
            <p className="text-xs text-gray-400">SA Approved</p>
          </div>
        </div>
      </div>
    </div>
  )
}
