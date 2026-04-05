'use client'

import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  AlertCircle,
  Target,
  Award,
  Calendar,
} from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface PerformanceMetrics {
  totalAssigned: number
  loginCompleted: number
  sanctioned: number
  dropped: number
  disbursed: number
  rejected: number
}

interface LastMonthSummary {
  filesDisbursed: number
  volumeDisbursed: number
}

interface DailyTrend {
  date: string
  filesProcessed: number
  sanctioned: number
  disbursed: number
  dropped: number
}

interface Benchmark {
  avgCasesByBDEs: number
  totalCasesInOrg: number
}

interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  location: string
  disbursed: number
  volume: number
  conversionRate: number
  isCurrentUser: boolean
}

interface PerformanceData {
  userId: string
  userName: string
  currentMonth: PerformanceMetrics
  lastMonth: LastMonthSummary
  dailyTrends: DailyTrend[]
  benchmark: Benchmark
  leaderboard: LeaderboardEntry[]
  currentUserRank: number
}

export default function BDEPerformancePage() {
  const [activeTab, setActiveTab] = useState('current')
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  useEffect(() => {
    fetchCurrentMonthData()
  }, [])

  const fetchCurrentMonthData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/employees/bde/performance/current')
      
      if (!response.ok) {
        throw new Error('Failed to fetch performance data')
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err: unknown) {
      console.error('Error fetching performance data:', err)
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  const fetchHistoricalData = async (month: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/employees/bde/performance/history?month=${month}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch historical data')
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err: unknown) {
      console.error('Error fetching historical data:', err)
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load historical data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <PerformanceSkeleton />
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No performance data available</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-roboto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">My Performance</h1>
        <p className="text-gray-400">
          Track your application processing performance and compare with peers
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#2E2E2E] border border-orange-500/30">
          <TabsTrigger
            value="current"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Current Month
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Current Month Tab */}
        <TabsContent value="current" className="space-y-6">
          {/* Performance Cards */}
          <PerformanceCards metrics={data.currentMonth} />

          {/* Last Month Summary */}
          <LastMonthSummarySection lastMonth={data.lastMonth} />

          {/* Performance Graphs */}
          <PerformanceGraphs
            dailyTrends={data.dailyTrends}
            benchmark={data.benchmark}
          />

          {/* Leaderboard */}
          <LeaderboardSection
            leaderboard={data.leaderboard}
            currentUserRank={data.currentUserRank}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          {/* Month Selector */}
          <MonthSelector
            selectedMonth={selectedMonth}
            onMonthChange={(month) => {
              setSelectedMonth(month)
              fetchHistoricalData(month)
            }}
          />

          {/* Historical Performance Cards */}
          <PerformanceCards metrics={data.currentMonth} showTrends={true} />

          {/* Historical Graphs */}
          <PerformanceGraphs
            dailyTrends={data.dailyTrends}
            benchmark={data.benchmark}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Performance Cards Component
function PerformanceCards({
  metrics,
  showTrends = false,
}: {
  metrics: PerformanceMetrics
  showTrends?: boolean
}) {
  const cards = [
    {
      title: 'Total Applications',
      value: metrics.totalAssigned,
      icon: FileText,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
    },
    {
      title: 'Login Completed',
      value: metrics.loginCompleted,
      icon: CheckCircle,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      title: 'Sanctioned',
      value: metrics.sanctioned,
      icon: Award,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
    {
      title: 'Dropped',
      value: metrics.dropped,
      icon: TrendingDown,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
    },
    {
      title: 'Disbursed',
      value: metrics.disbursed,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-600/10',
      borderColor: 'border-emerald-600/30',
    },
    {
      title: 'Rejected',
      value: metrics.rejected,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.title}
            className={`bg-[#2E2E2E] border ${card.borderColor} hover:border-opacity-60 transition-all`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${card.color}`}>
                {card.value}
              </div>
              {showTrends && (
                <div className="flex items-center mt-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-500">+12%</span>
                  <span className="text-gray-500 ml-2">vs last month</span>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Last Month Summary Component
function LastMonthSummarySection({ lastMonth }: { lastMonth: LastMonthSummary }) {
  return (
    <Card className="bg-[#2E2E2E] border border-orange-500/30">
      <CardHeader>
        <CardTitle className="text-xl text-white flex items-center">
          <Target className="h-5 w-5 text-orange-500 mr-2" />
          Last Month Summary
        </CardTitle>
        <CardDescription className="text-gray-400">
          Performance overview from previous month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Files Disbursed</p>
            <p className="text-3xl font-bold text-green-500">
              {lastMonth.filesDisbursed}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Volume Disbursed</p>
            <p className="text-3xl font-bold text-green-500">
              ₹{(lastMonth.volumeDisbursed / 100000).toFixed(2)}L
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Performance Graphs Component
function PerformanceGraphs({
  dailyTrends,
  benchmark,
}: {
  dailyTrends: DailyTrend[]
  benchmark: Benchmark
}) {
  const dates = dailyTrends.map((t) => new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

  // Graph 1: Files Processed
  const filesProcessedData = {
    labels: dates,
    datasets: [
      {
        label: 'Files Processed',
        data: dailyTrends.map((t) => t.filesProcessed),
        borderColor: '#FF6700',
        backgroundColor: 'rgba(255, 103, 0, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  // Graph 2: Multi-metric Comparison
  const comparisonData = {
    labels: dates,
    datasets: [
      {
        label: 'Sanctioned',
        data: dailyTrends.map((t) => t.sanctioned),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Disbursed',
        data: dailyTrends.map((t) => t.disbursed),
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Dropped',
        data: dailyTrends.map((t) => t.dropped),
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Org Average',
        data: Array(dates.length).fill(benchmark.avgCasesByBDEs),
        borderColor: '#6B7280',
        borderDash: [5, 5],
        tension: 0,
        pointRadius: 0,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#FFFFFF',
          font: {
            family: 'Roboto',
          },
        },
      },
      tooltip: {
        backgroundColor: '#2E2E2E',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        borderColor: '#FF6700',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#9CA3AF',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        ticks: {
          color: '#9CA3AF',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Graph 1 */}
      <Card className="bg-[#2E2E2E] border border-orange-500/30">
        <CardHeader>
          <CardTitle className="text-white">Files Processed Over Time</CardTitle>
          <CardDescription className="text-gray-400">
            Daily trend of total files processed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <Line data={filesProcessedData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Graph 2 */}
      <Card className="bg-[#2E2E2E] border border-orange-500/30">
        <CardHeader>
          <CardTitle className="text-white">Performance Comparison</CardTitle>
          <CardDescription className="text-gray-400">
            Multi-metric performance vs organization average
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <Line data={comparisonData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Leaderboard Component
function LeaderboardSection({
  leaderboard,
  currentUserRank,
}: {
  leaderboard: LeaderboardEntry[]
  currentUserRank: number
}) {
  return (
    <Card className="bg-[#2E2E2E] border border-orange-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-white flex items-center">
              <Award className="h-5 w-5 text-orange-500 mr-2" />
              Leaderboard
            </CardTitle>
            <CardDescription className="text-gray-400">
              Your rank: #{currentUserRank}
            </CardDescription>
          </div>
          <Badge className="bg-orange-500 text-white">
            Top Performers
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Rank</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Location</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Disbursed</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Volume</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr
                  key={entry.userId}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                    entry.isCurrentUser ? 'bg-orange-500/10 border-orange-500/50' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      {entry.rank <= 3 ? (
                        <Award className={`h-5 w-5 mr-2 ${
                          entry.rank === 1 ? 'text-yellow-500' :
                          entry.rank === 2 ? 'text-gray-400' :
                          'text-orange-700'
                        }`} />
                      ) : null}
                      <span className="text-white font-medium">#{entry.rank}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`${entry.isCurrentUser ? 'text-orange-500 font-semibold' : 'text-white'}`}>
                      {entry.name}
                      {entry.isCurrentUser && (
                        <Badge className="ml-2 bg-orange-500 text-white text-xs">You</Badge>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400">{entry.location}</td>
                  <td className="py-3 px-4 text-right text-green-500 font-semibold">
                    {entry.disbursed}
                  </td>
                  <td className="py-3 px-4 text-right text-green-500 font-semibold">
                    ₹{(entry.volume / 100000).toFixed(2)}L
                  </td>
                  <td className="py-3 px-4 text-right text-blue-500 font-semibold">
                    {entry.conversionRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// Month Selector Component
function MonthSelector({
  selectedMonth,
  onMonthChange,
}: {
  selectedMonth: string
  onMonthChange: (month: string) => void
}) {
  const months = generateMonthOptions(12) // Last 12 months

  return (
    <Card className="bg-[#2E2E2E] border border-orange-500/30">
      <CardHeader>
        <CardTitle className="text-white">Select Month</CardTitle>
      </CardHeader>
      <CardContent>
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="w-full md:w-auto px-4 py-2 bg-black border border-orange-500/30 rounded-lg text-white focus:outline-none focus:border-orange-500"
        >
          <option value="">Select a month</option>
          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  )
}

// Helper function to generate month options
function generateMonthOptions(count: number) {
  const options = []
  const now = new Date()

  for (let i = 1; i <= count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }

  return options
}

// Skeleton Loader
function PerformanceSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-12 w-64 bg-gray-800" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 bg-gray-800" />
        ))}
      </div>
      <Skeleton className="h-64 bg-gray-800" />
    </div>
  )
}
