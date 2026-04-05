'use client'

import { TrendingUp, ArrowLeft, Star, Clock, CheckCircle, Target, BarChart3, ThumbsUp, Zap, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useState } from 'react'

export default function VendorPerformancePage() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  const kpis = [
    { label: 'Overall Rating', value: '--', unit: '/5.0', icon: Star, color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20' },
    { label: 'Completion Rate', value: '--', unit: '%', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
    { label: 'Avg Response Time', value: '--', unit: 'hrs', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20' },
    { label: 'SLA Compliance', value: '--', unit: '%', icon: Target, color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20' },
    { label: 'Client Satisfaction', value: '--', unit: '%', icon: ThumbsUp, color: 'text-gray-400', bg: 'bg-gray-500/20' },
    { label: 'Tasks Completed', value: '0', unit: '', icon: Zap, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  ]

  const periods = [
    { key: 'month' as const, label: 'This Month' },
    { key: 'quarter' as const, label: 'This Quarter' },
    { key: 'year' as const, label: 'This Year' },
  ]

  return (
    <div className="min-h-screen bg-black font-poppins text-xs">
      {/* Header */}
      <header className="bg-black border-b border-neutral-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/vendors">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white font-poppins">Performance</h1>
              <p className="text-gray-400 text-sm mt-1">Track your performance metrics and service quality</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex items-center space-x-2">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                period === p.key
                  ? 'bg-[#FF6700] text-black'
                  : 'bg-neutral-800 text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-brand-ash">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 ${kpi.bg} rounded-lg flex items-center justify-center`}>
                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                  <Badge variant="closed">No data</Badge>
                </div>
                <p className="text-gray-400 text-xs">{kpi.label}</p>
                <p className="text-white text-2xl font-bold mt-1">
                  {kpi.value}<span className="text-sm text-gray-400 font-normal ml-1">{kpi.unit}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Performance Chart Placeholder */}
        <Card className="bg-brand-ash">
          <CardHeader>
            <CardTitle className="text-white text-sm">Performance Trend</CardTitle>
            <CardDescription>Your performance metrics over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center border border-dashed border-neutral-700 rounded-lg">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                <p className="text-gray-400">Performance chart will appear here once sufficient data is available</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rating Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-brand-ash">
            <CardHeader>
              <CardTitle className="text-white text-sm">Rating Breakdown</CardTitle>
              <CardDescription>Client ratings distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="flex items-center space-x-3">
                    <span className="text-gray-400 text-xs w-12">{star} star</span>
                    <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-700 rounded-full" style={{ width: '0%' }} />
                    </div>
                    <span className="text-gray-500 text-xs w-8 text-right">0</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-center mt-4 text-xs">No ratings received yet</p>
            </CardContent>
          </Card>

          <Card className="bg-brand-ash">
            <CardHeader>
              <CardTitle className="text-white text-sm">Achievements</CardTitle>
              <CardDescription>Badges and milestones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-14 h-14 bg-[#FF6700]/20 rounded-full flex items-center justify-center mb-3">
                  <Award className="w-7 h-7 text-[#FF6700]" />
                </div>
                <h3 className="text-white font-semibold mb-1">No achievements yet</h3>
                <p className="text-gray-400 text-center text-xs max-w-xs">
                  Complete services and maintain high ratings to unlock achievement badges
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
