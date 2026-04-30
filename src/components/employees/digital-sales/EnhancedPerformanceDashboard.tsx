'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Download, RefreshCw, Calendar, TrendingUp, TrendingDown,
  BarChart3, Trophy, Target, Zap, Award, Flame, Star,
  AlertCircle, CheckCircle, Clock, Users, ArrowUp, ArrowDown,
  Activity, Brain, History, Medal
} from 'lucide-react'
import { PageLoading } from '@/components/ui/loading-spinner'
import { MetricCard } from '@/components/performance/shared/MetricCard'
import { LeaderboardTable } from '@/components/performance/shared/LeaderboardTable'
import { PerformanceGraph } from '@/components/performance/shared/PerformanceGraph'
import { AIInsightsPanel } from '@/components/performance/shared/AIInsightsPanel'
import { PerformanceSummaryCard } from '@/components/performance/shared/PerformanceSummaryCard'

// Real-time update interval (30 seconds)
const REALTIME_INTERVAL = 30000

export default function EnhancedPerformanceDashboard() {
  // Core state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Data states
  const [performanceData, setPerformanceData] = useState<any>(null)
  const [realtimeData, setRealtimeData] = useState<any>(null)
  const [gamificationData, setGamificationData] = useState<any>(null)
  const [predictionsData, setPredictionsData] = useState<any>(null)
  const [historyData, setHistoryData] = useState<any>(null)
  const [leaderboardData, setLeaderboardData] = useState<any[]>([])
  const [graphData, setGraphData] = useState<any[]>([])
  const [insights, setInsights] = useState<any[]>([])

  // UI state
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Fetch all data
  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const [
        perfRes, realtimeRes, gamificationRes, predictionsRes,
        historyRes, leaderRes, graphRes, insightsRes
      ] = await Promise.all([
        fetch('/api/performance/digital-sales/current-month'),
        fetch('/api/performance/digital-sales/realtime'),
        fetch('/api/performance/digital-sales/gamification'),
        fetch('/api/performance/digital-sales/predictions'),
        fetch('/api/performance/digital-sales/history-extended?years=2&groupBy=month'),
        fetch('/api/performance/digital-sales/leaderboard'),
        fetch('/api/performance/digital-sales/graph-data?days=30&metric=revenue'),
        fetch('/api/performance/digital-sales/ai-insights'),
      ])

      const results = await Promise.all([
        perfRes.ok ? perfRes.json() : null,
        realtimeRes.ok ? realtimeRes.json() : null,
        gamificationRes.ok ? gamificationRes.json() : null,
        predictionsRes.ok ? predictionsRes.json() : null,
        historyRes.ok ? historyRes.json() : null,
        leaderRes.ok ? leaderRes.json() : null,
        graphRes.ok ? graphRes.json() : null,
        insightsRes.ok ? insightsRes.json() : null,
      ])

      setPerformanceData(results[0])
      setRealtimeData(results[1])
      setGamificationData(results[2])
      setPredictionsData(results[3])
      setHistoryData(results[4])
      setLeaderboardData(results[5]?.leaderboard || [])
      setGraphData(results[6]?.graphData || [])
      setInsights(results[7]?.insights || [])
      setLastUpdated(new Date())

    } catch (err: unknown) {
      console.error('Error fetching data:', err)
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load performance data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Fetch realtime data only (for periodic updates)
  const fetchRealtimeOnly = useCallback(async () => {
    try {
      const res = await fetch('/api/performance/digital-sales/realtime')
      if (res.ok) {
        const data = await res.json()
        setRealtimeData(data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Error fetching realtime data:', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(fetchRealtimeOnly, REALTIME_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchRealtimeOnly])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <PageLoading text="Loading Performance Dashboard..." subText="Fetching your metrics" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black p-4 lg:p-6">
        <Card className="border-red-500/50 bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <h2 className="text-xl font-semibold text-red-400">Error Loading Dashboard</h2>
            </div>
            <p className="text-red-300 mb-4">{error}</p>
            <Button onClick={() => fetchAllData()} className="bg-orange-500 hover:bg-orange-600">
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black font-poppins">
      {/* Main Content */}
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 lg:p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                  <BarChart3 className="w-6 h-6 lg:w-8 lg:h-8 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white">My Performance</h1>
                  <p className="text-gray-400 text-sm lg:text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    {lastUpdated && (
                      <span className="text-xs text-gray-500">
                        · Updated {lastUpdated.toLocaleTimeString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fetchAllData(true)}
                  disabled={refreshing}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                  <Download className="w-4 h-4 mr-2" /> Export
                </Button>
              </div>
            </div>

            {/* Real-time Stats Bar */}
            {realtimeData && <RealtimeStatsBar data={realtimeData} />}

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 lg:space-y-6">
              <TabsList className="bg-gray-900 border border-gray-700 w-full flex flex-wrap h-auto p-1 gap-1">
                <TabsTrigger value="overview" className="flex-1 min-w-[80px] data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400 text-xs lg:text-sm px-2 lg:px-4">
                  <Activity className="w-4 h-4 mr-1 lg:mr-2" /> <span className="hidden sm:inline">Overview</span><span className="sm:hidden">Home</span>
                </TabsTrigger>
                <TabsTrigger value="predictions" className="flex-1 min-w-[80px] data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400 text-xs lg:text-sm px-2 lg:px-4">
                  <Brain className="w-4 h-4 mr-1 lg:mr-2" /> <span className="hidden sm:inline">AI Predictions</span><span className="sm:hidden">AI</span>
                </TabsTrigger>
                <TabsTrigger value="achievements" className="flex-1 min-w-[80px] data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400 text-xs lg:text-sm px-2 lg:px-4">
                  <Trophy className="w-4 h-4 mr-1 lg:mr-2" /> <span className="hidden sm:inline">Achievements</span><span className="sm:hidden">Awards</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 min-w-[80px] data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400 text-xs lg:text-sm px-2 lg:px-4">
                  <History className="w-4 h-4 mr-1 lg:mr-2" /> <span className="hidden sm:inline">History</span><span className="sm:hidden">Past</span>
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="flex-1 min-w-[80px] data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400 text-xs lg:text-sm px-2 lg:px-4">
                  <Users className="w-4 h-4 mr-1 lg:mr-2" /> <span className="hidden sm:inline">Leaderboard</span><span className="sm:hidden">Rank</span>
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 lg:space-y-6">
                {/* Performance Summary */}
                {performanceData?.summary && (
                  <PerformanceSummaryCard summary={performanceData.summary} />
                )}

                {/* KPI Grid */}
                <div>
                  <h2 className="text-lg lg:text-xl font-semibold text-white mb-4">Key Performance Indicators</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-4">
                    {performanceData?.metrics?.map((metric: unknown, idx: number) => (
                      <MetricCard key={idx} metric={metric} />
                    ))}
                  </div>
                </div>

                {/* AI Insights */}
                {insights.length > 0 && <AIInsightsPanel insights={insights} />}

                {/* Trends */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  <PerformanceGraph
                    data={graphData}
                    title="Revenue Trend (30 Days)"
                    description="Your daily revenue vs average"
                    type="line"
                    dataKeys={{ primary: 'value', secondary: 'average' }}
                    colors={{ primary: '#3B82F6', secondary: '#10B981' }}
                  />
                  <PerformanceGraph
                    data={graphData}
                    title="Lead Generation"
                    description="Daily leads across channels"
                    type="area"
                    dataKeys={{ primary: 'value' }}
                    colors={{ primary: '#8B5CF6' }}
                  />
                </div>
              </TabsContent>

              {/* AI Predictions Tab */}
              <TabsContent value="predictions" className="space-y-4 lg:space-y-6">
                {predictionsData && <PredictionsPanel data={predictionsData} />}
              </TabsContent>

              {/* Achievements Tab */}
              <TabsContent value="achievements" className="space-y-4 lg:space-y-6">
                {gamificationData && <GamificationPanel data={gamificationData} />}
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 lg:space-y-6">
                {historyData && <HistoryPanel data={historyData} />}
              </TabsContent>

              {/* Leaderboard Tab */}
              <TabsContent value="leaderboard" className="space-y-4 lg:space-y-6">
                <LeaderboardTable
                  entries={leaderboardData}
                  title="Digital Sales Leaderboard"
                  description="Top performers this month"
                  primaryMetricLabel="Revenue"
                  secondaryMetricLabel="Conversions"
                  tertiaryMetricLabel="Conversion %"
                  showTopOnly={20}
                  currentUserId={performanceData?.userId}
                />
              </TabsContent>
            </Tabs>
      </div>
    </div>
  )
}

// Real-time Stats Bar Component
function RealtimeStatsBar({ data }: { data: unknown}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
      <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-500/30">
        <CardContent className="p-3 lg:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-blue-300">Today's Leads</p>
              <p className="text-xl lg:text-2xl font-bold text-white">{data.today?.leads || 0}</p>
            </div>
            <TrendIndicator value={data.comparisons?.vsYesterday?.leads || 0} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/30">
        <CardContent className="p-3 lg:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-green-300">Today's Revenue</p>
              <p className="text-xl lg:text-2xl font-bold text-white">
                ₹{((data.today?.revenue || 0) / 1000).toFixed(0)}K
              </p>
            </div>
            <TrendIndicator value={data.comparisons?.vsYesterday?.revenue || 0} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/30">
        <CardContent className="p-3 lg:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-purple-300">Month Progress</p>
              <p className="text-xl lg:text-2xl font-bold text-white">
                {Math.round(data.monthProgress?.percentComplete || 0)}%
              </p>
            </div>
            <Clock className="w-6 h-6 lg:w-8 lg:h-8 text-purple-400" />
          </div>
          <Progress value={data.monthProgress?.percentComplete || 0} className="mt-2 h-1" />
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 border-orange-500/30">
        <CardContent className="p-3 lg:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-orange-300">Daily Rank</p>
              <p className="text-xl lg:text-2xl font-bold text-white">
                #{data.ranking?.currentDailyRank || '-'}
              </p>
            </div>
            <Medal className="w-6 h-6 lg:w-8 lg:h-8 text-orange-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Trend Indicator Component
function TrendIndicator({ value }: { value: number }) {
  const isPositive = value >= 0
  return (
    <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
      {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
      <span className="text-sm font-medium">{Math.abs(Math.round(value))}%</span>
    </div>
  )
}

// Predictions Panel Component
function PredictionsPanel({ data }: { data: unknown}) {
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Prediction Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" /> Predicted Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-white">{data.predictions?.leads?.predicted || 0}</span>
              <span className="text-gray-400 mb-1">/ {data.targets?.leads || 0}</span>
            </div>
            <Progress value={data.predictions?.leads?.achievement || 0} className="mt-2" />
            <div className="flex items-center justify-between mt-2">
              <Badge variant={data.predictions?.leads?.willMeetTarget ? 'default' : 'destructive'}>
                {data.predictions?.leads?.willMeetTarget ? 'On Track' : 'At Risk'}
              </Badge>
              <span className="text-sm text-gray-400">
                {data.predictions?.leads?.confidence || 0}% confidence
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" /> Predicted Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-white">
                ₹{((data.predictions?.revenue?.predicted || 0) / 100000).toFixed(1)}L
              </span>
              <span className="text-gray-400 mb-1">
                / ₹{((data.targets?.revenue || 0) / 100000).toFixed(1)}L
              </span>
            </div>
            <Progress value={data.predictions?.revenue?.achievement || 0} className="mt-2" />
            <div className="flex items-center justify-between mt-2">
              <Badge variant={data.predictions?.revenue?.willMeetTarget ? 'default' : 'destructive'}>
                {data.predictions?.revenue?.willMeetTarget ? 'On Track' : 'At Risk'}
              </Badge>
              <span className="text-sm text-gray-400">
                {data.predictions?.revenue?.confidence || 0}% confidence
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" /> Predicted Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <span className="text-5xl font-bold text-yellow-400">
                {data.predictions?.grade?.predicted || 'B'}
              </span>
              <p className="text-gray-400 mt-2">
                Overall Achievement: {data.predictions?.grade?.overallAchievement || 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Required Pace */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-400" /> Required Daily Pace
          </CardTitle>
          <CardDescription className="text-gray-400">
            What you need to achieve daily to meet your targets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Required Daily Leads</p>
              <p className="text-2xl font-bold text-white">{data.requiredPace?.dailyLeads || 0}</p>
              <Badge className="mt-2" variant={data.requiredPace?.feasibility?.leads === 'achievable' ? 'default' : 'destructive'}>
                {data.requiredPace?.feasibility?.leads || 'unknown'}
              </Badge>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Required Daily Revenue</p>
              <p className="text-2xl font-bold text-white">
                ₹{((data.requiredPace?.dailyRevenue || 0) / 1000).toFixed(0)}K
              </p>
              <Badge className="mt-2" variant={data.requiredPace?.feasibility?.revenue === 'achievable' ? 'default' : 'destructive'}>
                {data.requiredPace?.feasibility?.revenue || 'unknown'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" /> AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.recommendations.map((rec: unknown, idx: number) => (
              <div key={idx} className={`p-4 rounded-lg border ${
                rec.priority === 'high' ? 'bg-red-950/30 border-red-500/50' :
                rec.priority === 'medium' ? 'bg-yellow-950/30 border-yellow-500/50' :
                'bg-gray-800 border-gray-700'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                    {rec.priority}
                  </Badge>
                  <h4 className="font-semibold text-white">{rec.title}</h4>
                </div>
                <p className="text-gray-300 text-sm mb-2">{rec.message}</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  {rec.actions?.map((action: string, aIdx: number) => (
                    <li key={aIdx} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" /> {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Gamification Panel Component
function GamificationPanel({ data }: { data: unknown}) {
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Level & Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-purple-900/50 to-blue-900/30 border-purple-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-purple-300 text-sm">Current Level</p>
                <p className="text-4xl font-bold text-white">{data.level?.current || 1}</p>
                <p className="text-purple-400 font-semibold">{data.level?.title || 'Rookie'}</p>
              </div>
              <Star className="w-16 h-16 text-yellow-400" />
            </div>
            <Progress value={data.level?.levelProgress || 0} className="mb-2" />
            <p className="text-sm text-gray-400">
              {data.level?.pointsToNextLevel || 0} points to {data.level?.nextTitle || 'next level'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/50 to-teal-900/30 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-300 text-sm">Total Points</p>
                <p className="text-4xl font-bold text-white">{(data.level?.totalPoints || 0).toLocaleString()}</p>
                <p className="text-gray-400 text-sm mt-1">
                  Lifetime: {(data.level?.lifetimePoints || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Points Rank</p>
                <p className="text-2xl font-bold text-green-400">#{data.level?.pointsRank || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Streaks */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" /> Active Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-4">
            {Object.entries(data.streaks || {}).map(([key, streak]: [string, any]) => (
              <div key={key} className="text-center p-3 lg:p-4 bg-gray-800 rounded-lg">
                <Flame className={`w-6 h-6 lg:w-8 lg:h-8 mx-auto mb-1 lg:mb-2 ${streak.current > 0 ? 'text-orange-400' : 'text-gray-600'}`} />
                <p className="text-xl lg:text-2xl font-bold text-white">{streak.current || 0}</p>
                <p className="text-[10px] lg:text-xs text-gray-400 capitalize truncate">{key.replace(/_/g, ' ')}</p>
                <p className="text-[10px] lg:text-xs text-gray-500">Best: {streak.longest || 0}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Achievements
            <Badge className="ml-2">{data.achievements?.unlocked || 0}/{data.achievements?.total || 0}</Badge>
          </CardTitle>
          <Progress value={data.achievements?.completionPercentage || 0} className="mt-2" />
        </CardHeader>
        <CardContent>
          {/* Recent Achievements */}
          {data.achievements?.recent?.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-400 mb-3">Recently Unlocked</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3">
                {data.achievements.recent.map((achievement: unknown, idx: number) => (
                  <div key={idx} className="p-2 lg:p-3 bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border border-yellow-500/30 rounded-lg text-center">
                    <Award className="w-6 h-6 lg:w-8 lg:h-8 mx-auto mb-1 lg:mb-2 text-yellow-400" />
                    <p className="text-xs lg:text-sm font-semibold text-white truncate">{achievement.name}</p>
                    <p className="text-[10px] lg:text-xs text-gray-400">+{achievement.points_reward} pts</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Achievements by Category */}
          <div className="space-y-4">
            {Object.entries(data.achievements?.byCategory || {}).map(([category, catData]: [string, any]) => (
              <div key={category}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-400 capitalize">{category}</h4>
                  <span className="text-xs text-gray-500">{catData.unlocked}/{catData.total}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1 lg:gap-2">
                  {catData.items?.slice(0, 6).map((achievement: unknown, idx: number) => (
                    <div
                      key={idx}
                      className={`p-1.5 lg:p-2 rounded-lg text-center ${
                        achievement.unlocked
                          ? 'bg-gray-800 border border-green-500/30'
                          : 'bg-gray-900 border border-gray-700 opacity-50'
                      }`}
                    >
                      <Award className={`w-5 h-5 lg:w-6 lg:h-6 mx-auto mb-0.5 lg:mb-1 ${achievement.unlocked ? 'text-green-400' : 'text-gray-600'}`} />
                      <p className="text-[10px] lg:text-xs text-white truncate">{achievement.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// History Panel Component
function HistoryPanel({ data }: { data: unknown}) {
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month')

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Career Summary */}
      {data.careerSummary && (
        <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/30 border-blue-500/30">
          <CardHeader className="pb-2 lg:pb-4">
            <CardTitle className="text-white text-base lg:text-lg">Career Summary ({data.dateRange?.yearsIncluded || 0} Years)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
              <div className="p-2 lg:p-0">
                <p className="text-gray-400 text-xs lg:text-sm">Total Revenue</p>
                <p className="text-lg lg:text-2xl font-bold text-white">
                  ₹{((data.careerSummary.totalRevenue || 0) / 10000000).toFixed(1)}Cr
                </p>
              </div>
              <div className="p-2 lg:p-0">
                <p className="text-gray-400 text-xs lg:text-sm">Total Leads</p>
                <p className="text-lg lg:text-2xl font-bold text-white">
                  {(data.careerSummary.totalLeads || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-2 lg:p-0">
                <p className="text-gray-400 text-xs lg:text-sm">Avg Monthly Revenue</p>
                <p className="text-lg lg:text-2xl font-bold text-white">
                  ₹{((data.careerSummary.avgMonthlyRevenue || 0) / 100000).toFixed(1)}L
                </p>
              </div>
              <div className="p-2 lg:p-0">
                <p className="text-gray-400 text-xs lg:text-sm">Average Score</p>
                <p className="text-lg lg:text-2xl font-bold text-white">{data.careerSummary.avgScore || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Bests */}
      {data.personalBests && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Medal className="w-5 h-5 text-yellow-400" /> Personal Bests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
              <div className="p-3 lg:p-4 bg-gray-800 rounded-lg text-center">
                <Trophy className="w-6 h-6 lg:w-8 lg:h-8 mx-auto mb-1 lg:mb-2 text-yellow-400" />
                <p className="text-lg lg:text-xl font-bold text-white">
                  ₹{((data.personalBests.highestRevenue?.value || 0) / 100000).toFixed(1)}L
                </p>
                <p className="text-[10px] lg:text-xs text-gray-400">Highest Revenue</p>
                <p className="text-[10px] lg:text-xs text-gray-500 truncate">{data.personalBests.highestRevenue?.period}</p>
              </div>
              <div className="p-3 lg:p-4 bg-gray-800 rounded-lg text-center">
                <Target className="w-6 h-6 lg:w-8 lg:h-8 mx-auto mb-1 lg:mb-2 text-blue-400" />
                <p className="text-lg lg:text-xl font-bold text-white">{data.personalBests.highestLeads?.value || 0}</p>
                <p className="text-[10px] lg:text-xs text-gray-400">Most Leads</p>
                <p className="text-[10px] lg:text-xs text-gray-500 truncate">{data.personalBests.highestLeads?.period}</p>
              </div>
              <div className="p-3 lg:p-4 bg-gray-800 rounded-lg text-center">
                <Award className="w-6 h-6 lg:w-8 lg:h-8 mx-auto mb-1 lg:mb-2 text-green-400" />
                <p className="text-lg lg:text-xl font-bold text-white">{data.personalBests.highestScore?.grade || 'N/A'}</p>
                <p className="text-[10px] lg:text-xs text-gray-400">Best Grade</p>
                <p className="text-[10px] lg:text-xs text-gray-500 truncate">{data.personalBests.highestScore?.period}</p>
              </div>
              <div className="p-3 lg:p-4 bg-gray-800 rounded-lg text-center">
                <Medal className="w-6 h-6 lg:w-8 lg:h-8 mx-auto mb-1 lg:mb-2 text-purple-400" />
                <p className="text-lg lg:text-xl font-bold text-white">#{data.personalBests.bestRank?.value || '-'}</p>
                <p className="text-[10px] lg:text-xs text-gray-400">Best Rank</p>
                <p className="text-[10px] lg:text-xs text-gray-500 truncate">{data.personalBests.bestRank?.period}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Performance */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-white">Performance History</CardTitle>
            <div className="flex gap-1 lg:gap-2">
              {['month', 'quarter', 'year'].map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={viewMode === mode ? 'default' : 'outline'}
                  onClick={() => setViewMode(mode as unknown)}
                  className={`text-xs lg:text-sm px-2 lg:px-3 ${viewMode === mode ? 'bg-orange-500' : ''}`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
            {data.data?.slice(0, 24).map((period: unknown, idx: number) => (
              <Card key={idx} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-white">{period.period}</h4>
                    <span className={`text-2xl font-bold ${
                      period.performance?.grade === 'A+' || period.performance?.grade === 'A' ? 'text-green-400' :
                      period.performance?.grade === 'B+' || period.performance?.grade === 'B' ? 'text-blue-400' :
                      'text-yellow-400'
                    }`}>
                      {period.performance?.grade || period.performance?.avgScore || '-'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Revenue</span>
                      <span className="text-white">₹{((period.metrics?.revenue || 0) / 100000).toFixed(1)}L</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Leads</span>
                      <span className="text-white">{period.metrics?.leads || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Conversion</span>
                      <span className="text-white">{(period.metrics?.conversionRate || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Year over Year Growth */}
      {data.yearOverYearGrowth && data.yearOverYearGrowth.length > 0 && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2 lg:pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-base lg:text-lg">
              <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-green-400" /> Year-over-Year Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
              {data.yearOverYearGrowth.map((yoy: unknown, idx: number) => (
                <div key={idx} className="p-3 lg:p-4 bg-gray-800 rounded-lg">
                  <p className="text-xs lg:text-sm text-gray-400">{yoy.vsYear} → {yoy.year}</p>
                  <div className="flex items-center gap-1 lg:gap-2 mt-1 lg:mt-2">
                    {yoy.revenueGrowth >= 0 ? (
                      <ArrowUp className="w-4 h-4 lg:w-5 lg:h-5 text-green-400" />
                    ) : (
                      <ArrowDown className="w-4 h-4 lg:w-5 lg:h-5 text-red-400" />
                    )}
                    <span className={`text-lg lg:text-xl font-bold ${yoy.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Math.abs(Math.round(yoy.revenueGrowth))}%
                    </span>
                  </div>
                  <p className="text-[10px] lg:text-xs text-gray-500 mt-1">Revenue Growth</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
