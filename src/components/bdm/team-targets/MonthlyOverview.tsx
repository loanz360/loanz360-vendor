'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SummaryCards from './overview/SummaryCards'
import CalendarHeatmap from './overview/CalendarHeatmap'
import BDEPerformanceTable from './overview/BDEPerformanceTable'
import QuickActions from './overview/QuickActions'

interface MonthlyOverviewProps {
  month: number
  year: number
}

export default function MonthlyOverview({ month, year }: MonthlyOverviewProps) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    setIsLoading(false)
  }, [month, year])

  return (
    <div className="space-y-6">
      {/* Summary Cards - Top KPIs */}
      <SummaryCards month={month} year={year} />

      {/* Calendar Heatmap */}
      <Card className="content-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">
            📅 Team Activity Calendar
          </CardTitle>
          <p className="text-sm text-gray-400">Daily performance heatmap for the entire month</p>
        </CardHeader>
        <CardContent>
          <CalendarHeatmap month={month} year={year} />
        </CardContent>
      </Card>

      {/* BDE Performance Table */}
      <Card className="content-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">
            👥 Team Performance Overview
          </CardTitle>
          <p className="text-sm text-gray-400">Detailed metrics for each team member</p>
        </CardHeader>
        <CardContent>
          <BDEPerformanceTable month={month} year={year} />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <QuickActions month={month} year={year} />
    </div>
  )
}
