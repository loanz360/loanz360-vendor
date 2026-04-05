'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Target, TrendingUp, AlertTriangle, Users, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ExportButton from './ExportButton'

interface QuickActionsProps {
  month: number
  year: number
}

export default function QuickActions({ month, year }: QuickActionsProps) {
  const router = useRouter()

  const actions = [
    {
      icon: <Target className="w-5 h-5" />,
      title: 'Set Team Targets',
      description: 'Configure monthly targets for your team',
      color: 'bg-blue-600 hover:bg-blue-700',
      action: () => router.push('/employees/bdm/team-targets?tab=target-settings'),
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'View Predictions',
      description: 'AI-powered end-of-month projections',
      color: 'bg-purple-600 hover:bg-purple-700',
      action: () => router.push('/employees/bdm/team-targets?tab=predictive'),
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'At-Risk BDEs',
      description: 'View team members needing attention',
      color: 'bg-orange-600 hover:bg-orange-700',
      action: () => {
        // Filter BDEs by status
      },
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: 'Team Leaderboard',
      description: 'View rankings and top performers',
      color: 'bg-green-600 hover:bg-green-700',
      action: () => router.push('/employees/bdm/team-targets?tab=leaderboard'),
    },
    {
      icon: <Settings className="w-5 h-5" />,
      title: 'Manage Settings',
      description: 'Configure targets and preferences',
      color: 'bg-gray-600 hover:bg-gray-700',
      action: () => router.push('/employees/bdm/team-targets?tab=target-settings'),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton month={month} year={year} />
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action, index) => (
          <Card
            key={index}
            className="content-card hover:border-orange-500/50 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/10"
            onClick={action.action}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${action.color} text-white flex-shrink-0`}>{action.icon}</div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{action.title}</h3>
                  <p className="text-sm text-gray-400">{action.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
