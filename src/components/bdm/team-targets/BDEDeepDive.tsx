'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Award, Target, Calendar, Activity } from 'lucide-react'

interface BDEDeepDiveProps {
  month: number
  year: number
}

interface BDEBasic {
  bdeId: string
  bdeName: string
  employeeCode: string
}

interface TrendData {
  period: string
  month: number
  year: number
  metrics: {
    leadsContacted: number
    conversions: number
    revenue: number
    conversionRate: number
  }
  targets: {
    conversions: number
    revenue: number
  }
  achievement: {
    conversions: number
    revenue: number
  }
  growth: {
    leadsContacted: number
    conversions: number
    revenue: number
    conversionRate: number
  } | null
}

interface TrendsResponse {
  trends: TrendData[]
  summary: {
    totalMonths: number
    averages: unknown; overallGrowth: unknown; bestMonth: unknown; worstMonth: unknown; consistency: unknown; patterns: unknown  }
}

export default function BDEDeepDive({ month, year }: BDEDeepDiveProps) {
  const [bdeList, setBdeList] = useState<BDEBasic[]>([])
  const [selectedBDE, setSelectedBDE] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [trendsData, setTrendsData] = useState<TrendsResponse | null>(null)
  const [loadingTrends, setLoadingTrends] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchBDEList()
  }, [month, year])

  useEffect(() => {
    if (selectedBDE) {
      fetchTrends()
    }
  }, [selectedBDE])

  const fetchBDEList = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/bdm/team-targets/overview/bde-table?month=${month}&year=${year}`)
      const data = await response.json()

      if (data.success) {
        const bdes = data.data.bdes.map((bde: unknown) => ({
          bdeId: bde.bdeId,
          bdeName: bde.bdeName,
          employeeCode: bde.employeeCode,
        }))
        setBdeList(bdes)
        if (bdes.length > 0) {
          setSelectedBDE(bdes[0].bdeId)
        }
      }
    } catch (error) {
      console.error('Error fetching BDE list:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTrends = async () => {
    if (!selectedBDE) return

    try {
      setLoadingTrends(true)
      const response = await fetch(`/api/bdm/team-targets/analytics/trends?bdeId=${selectedBDE}&months=6`)
      const data = await response.json()

      if (data.success) {
        setTrendsData(data.data)
      }
    } catch (error) {
      console.error('Error fetching trends:', error)
    } finally {
      setLoadingTrends(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (bdeList.length === 0) {
    return (
      <Card className="content-card">
        <CardContent className="p-12 text-center">
          <p className="text-gray-400 text-lg">No team members found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-6">
      {/* BDE List Sidebar */}
      <div className="col-span-1">
        <Card className="content-card">
          <CardHeader>
            <CardTitle className="text-white">Team Members</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {bdeList.map((bde) => (
                <button
                  key={bde.bdeId}
                  onClick={() => setSelectedBDE(bde.bdeId)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors ${
                    selectedBDE === bde.bdeId ? 'bg-orange-600 text-white' : 'text-gray-300'
                  }`}
                >
                  <div className="font-semibold">{bde.bdeName}</div>
                  <div className="text-xs opacity-70">{bde.employeeCode}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BDE Details */}
      <div className="col-span-3 space-y-6">
        {selectedBDE ? (
          <>
            {/* Header with Action */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {bdeList.find((b) => b.bdeId === selectedBDE)?.bdeName}
                </h2>
                <p className="text-gray-400 text-sm">
                  {bdeList.find((b) => b.bdeId === selectedBDE)?.employeeCode}
                </p>
              </div>
              <button
                onClick={() =>
                  router.push(`/employees/bdm/team-targets/bde/${selectedBDE}?month=${month}&year=${year}`)
                }
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors"
              >
                View Full Details
              </button>
            </div>

            {loadingTrends ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : trendsData ? (
              <>
                {/* Performance Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="content-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-900/30 rounded-lg">
                          <Activity className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Consistency</div>
                          <div className="text-2xl font-bold text-white capitalize">
                            {trendsData.summary.consistency.rating}
                          </div>
                          <div className="text-xs text-gray-500">
                            {trendsData.summary.consistency.score.toFixed(1)}% variance
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="content-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-900/30 rounded-lg">
                          <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Overall Growth</div>
                          <div
                            className={`text-2xl font-bold ${
                              trendsData.summary.overallGrowth?.conversions >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {trendsData.summary.overallGrowth?.conversions >= 0 ? '+' : ''}
                            {trendsData.summary.overallGrowth?.conversions.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">6-month trend</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="content-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-900/30 rounded-lg">
                          <Target className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Avg Achievement</div>
                          <div className="text-2xl font-bold text-white">
                            {trendsData.summary.averages.achievementConversions.toFixed(0)}%
                          </div>
                          <div className="text-xs text-gray-500">Target completion</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance Patterns */}
                <Card className="content-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-orange-500" />
                      Performance Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className={`p-4 rounded-lg border ${
                          trendsData.summary.patterns.improvingTrend
                            ? 'bg-green-900/20 border-green-500/30'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className={`w-5 h-5 ${trendsData.summary.patterns.improvingTrend ? 'text-green-400' : 'text-gray-500'}`} />
                          <span className={trendsData.summary.patterns.improvingTrend ? 'text-green-400' : 'text-gray-400'}>
                            Improving Trend
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {trendsData.summary.patterns.improvingTrend
                            ? 'Performance is consistently improving'
                            : 'No clear upward trend detected'}
                        </p>
                      </div>

                      <div
                        className={`p-4 rounded-lg border ${
                          trendsData.summary.patterns.consistentPerformer
                            ? 'bg-blue-900/20 border-blue-500/30'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className={`w-5 h-5 ${trendsData.summary.patterns.consistentPerformer ? 'text-blue-400' : 'text-gray-500'}`} />
                          <span className={trendsData.summary.patterns.consistentPerformer ? 'text-blue-400' : 'text-gray-400'}>
                            Consistent Performer
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {trendsData.summary.patterns.consistentPerformer
                            ? 'Low variance in performance'
                            : 'Performance varies significantly'}
                        </p>
                      </div>

                      <div
                        className={`p-4 rounded-lg border ${
                          trendsData.summary.patterns.recentImprovement
                            ? 'bg-purple-900/20 border-purple-500/30'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className={`w-5 h-5 ${trendsData.summary.patterns.recentImprovement ? 'text-purple-400' : 'text-gray-500'}`} />
                          <span className={trendsData.summary.patterns.recentImprovement ? 'text-purple-400' : 'text-gray-400'}>
                            Recent Improvement
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {trendsData.summary.patterns.recentImprovement
                            ? 'Strong gains in last 3 months'
                            : 'No recent improvement detected'}
                        </p>
                      </div>

                      <div
                        className={`p-4 rounded-lg border ${
                          trendsData.summary.patterns.decliningTrend
                            ? 'bg-red-900/20 border-red-500/30'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className={`w-5 h-5 ${trendsData.summary.patterns.decliningTrend ? 'text-red-400' : 'text-gray-500'}`} />
                          <span className={trendsData.summary.patterns.decliningTrend ? 'text-red-400' : 'text-gray-400'}>
                            Needs Attention
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {trendsData.summary.patterns.decliningTrend
                            ? 'Declining performance trend'
                            : 'No declining trend detected'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trends Chart */}
                <Card className="content-card">
                  <CardHeader>
                    <CardTitle className="text-white">6-Month Performance Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsData.trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="period" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                          labelStyle={{ color: '#F3F4F6' }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="metrics.conversions"
                          stroke="#10B981"
                          strokeWidth={2}
                          name="Conversions"
                        />
                        <Line
                          type="monotone"
                          dataKey="targets.conversions"
                          stroke="#6B7280"
                          strokeWidth={1}
                          strokeDasharray="5 5"
                          name="Target"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Achievement Chart */}
                <Card className="content-card">
                  <CardHeader>
                    <CardTitle className="text-white">Monthly Achievement Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={trendsData.trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="period" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                          labelStyle={{ color: '#F3F4F6' }}
                        />
                        <Legend />
                        <Bar dataKey="achievement.conversions" fill="#10B981" name="Conversion Achievement %" />
                        <Bar dataKey="achievement.revenue" fill="#F59E0B" name="Revenue Achievement %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Best/Worst Months */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="content-card">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        Best Month
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-400 mb-2">
                        {trendsData.summary.bestMonth.period}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Conversions:</span>
                          <span className="text-white font-semibold">{trendsData.summary.bestMonth.conversions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Revenue:</span>
                          <span className="text-white font-semibold">
                            ₹{(trendsData.summary.bestMonth.revenue / 100000).toFixed(2)}L
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="content-card">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-orange-400" />
                        Needs Improvement
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-400 mb-2">
                        {trendsData.summary.worstMonth.period}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Conversions:</span>
                          <span className="text-white font-semibold">{trendsData.summary.worstMonth.conversions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Revenue:</span>
                          <span className="text-white font-semibold">
                            ₹{(trendsData.summary.worstMonth.revenue / 100000).toFixed(2)}L
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card className="content-card">
                <CardContent className="p-12 text-center">
                  <p className="text-gray-400">No trends data available</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="content-card">
            <CardContent className="p-12 text-center">
              <p className="text-gray-400">Select a BDE to view details</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
