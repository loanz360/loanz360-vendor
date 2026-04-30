'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import KPICards from './analytics/KPICards'
import PerformanceChart from './analytics/PerformanceChart'
import BDELeaderboard from './analytics/BDELeaderboard'
import ConversionFunnel from './analytics/ConversionFunnel'

interface AnalyticsData {
  kpis: unknown  trends: unknown[]
  leaderboard: unknown[]
  funnel: unknown}

export default function AnalyticsTab() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const { toast } = useToast()

  // Fetch analytics data
  const fetchAnalytics = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const response = await fetch('/api/bdm/team-management/analytics')

      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const result = await response.json()
      setData(result)

      if (isRefresh) {
        toast({
          title: 'Analytics refreshed',
          description: 'Latest data loaded successfully',
        })
      }
    } catch (error: unknown) {
      console.error('Error fetching analytics:', error)
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to load analytics',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Export analytics report
  const handleExport = async () => {
    try {
      toast({
        title: 'Exporting...',
        description: 'Generating analytics report',
      })

      // Generate CSV data from analytics
      const csvData = [
        ['BDM Performance Analytics Report'],
        ['Generated:', new Date().toLocaleDateString()],
        [''],
        ['KPI', 'Value'],
        ['Total Conversions', kpiData?.totalConversions || 0],
        ['Total Revenue', `₹${(kpiData?.totalRevenue || 0).toLocaleString('en-IN')}`],
        ['Avg TAT', `${kpiData?.avgTAT || 0} days`],
        ['Team Size', kpiData?.teamSize || 0],
        [''],
        ['BDE Leaderboard'],
        ['Rank', 'Name', 'Conversions', 'Revenue'],
        ...leaderboardData.map((bde: unknown, idx: number) => [
          idx + 1,
          bde.bdeName,
          bde.conversions,
          `₹${bde.revenue.toLocaleString('en-IN')}`
        ])
      ]

      // Convert to CSV string
      const csvContent = csvData.map(row => row.join(',')).join('\n')

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `bdm-analytics-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: 'Export complete',
        description: 'Analytics report downloaded as CSV',
      })
    } catch (error: unknown) {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">No analytics data available</p>
            <Button onClick={() => fetchAnalytics()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track your team's performance and identify trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards data={data.kpis} />

      {/* Performance Chart */}
      <PerformanceChart data={data.trends} />

      {/* Bottom Row: Leaderboard + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BDE Leaderboard */}
        <BDELeaderboard data={data.leaderboard} />

        {/* Conversion Funnel */}
        <ConversionFunnel data={data.funnel} />
      </div>
    </div>
  )
}
