'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  FileText,
  Users,
  Building2,
  Calculator,
  Ticket,
  BarChart3,
  Layers,
} from 'lucide-react'

interface PipelineStats {
  cp: { pending: number }
  ba: { pending: number }
  bp: { pending: number }
}

interface Props {
  stats: PipelineStats
}

export default function ManagerQuickActions({ stats }: Props) {
  const router = useRouter()

  const actions = [
    {
      label: 'CP Applications',
      subtitle: `${stats.cp.pending} pending`,
      icon: FileText,
      href: '/employees/accounts-executive/cp-applications',
      gradient: 'from-yellow-500/10 to-yellow-500/5',
      border: 'border-yellow-500/20 hover:border-yellow-500/40',
      iconColor: 'text-yellow-400',
    },
    {
      label: 'BA Applications',
      subtitle: `${stats.ba.pending} pending`,
      icon: Users,
      href: '/employees/accounts-executive/ba-applications',
      gradient: 'from-orange-500/10 to-orange-500/5',
      border: 'border-orange-500/20 hover:border-orange-500/40',
      iconColor: 'text-orange-400',
    },
    {
      label: 'BP Applications',
      subtitle: `${stats.bp.pending} pending`,
      icon: Building2,
      href: '/employees/accounts-executive/bp-applications',
      gradient: 'from-amber-500/10 to-amber-500/5',
      border: 'border-amber-500/20 hover:border-amber-500/40',
      iconColor: 'text-amber-400',
    },
    {
      label: 'Accounts Overview',
      subtitle: 'View ledger',
      icon: Calculator,
      href: '/employees/accounting',
      gradient: 'from-blue-500/10 to-blue-500/5',
      border: 'border-blue-500/20 hover:border-blue-500/40',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Financial Reports',
      subtitle: 'Monthly & partner-wise',
      icon: BarChart3,
      href: '/employees/reports',
      gradient: 'from-emerald-500/10 to-emerald-500/5',
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Support Tickets',
      subtitle: 'View open tickets',
      icon: Ticket,
      href: '/employees/accounts-manager/tickets',
      gradient: 'from-purple-500/10 to-purple-500/5',
      border: 'border-purple-500/20 hover:border-purple-500/40',
      iconColor: 'text-purple-400',
    },
  ]

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <Layers className="w-5 h-5 text-orange-500" />
        Quick Actions
      </h2>
      <div className="space-y-2.5">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r ${action.gradient} border ${action.border} transition-colors text-left`}
            >
              <Icon className={`w-5 h-5 ${action.iconColor} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{action.label}</p>
                <p className="text-gray-500 text-xs">{action.subtitle}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
