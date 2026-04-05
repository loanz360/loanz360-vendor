'use client'

import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DailyPerformanceGraphProps {
  bdeId: string
  month: number
  year: number
}

interface DailyData {
  date: string
  day: number
  daily: {
    leadsContacted: number
    conversions: number
    revenue: number
  }
  mtd: {
    leadsContacted: number
    conversions: number
    revenue: number
  }
  status: string
}

export default function DailyPerformanceGraph({ bdeId, month, year }: DailyPerformanceGraphProps) {
  const [graphData, setGraphData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'daily' | 'cumulative'>('daily')

  useEffect(() => {
    fetchGraphData()
  }, [bdeId, month, year])

  const fetchGraphData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/bdm/team-targets/bde/${bdeId}/daily-graph?month=${month}&year=${year}`)
      const data = await response.json()

      if (data.success) {
        const chartData = data.data.dailyData.map((day: DailyData) => ({
          day: day.day,
          date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          leads: viewMode === 'daily' ? day.daily.leadsContacted : day.mtd.leadsContacted,
          conversions: viewMode === 'daily' ? day.daily.conversions : day.mtd.conversions,
          revenue: viewMode === 'daily' ? day.daily.revenue / 100000 : day.mtd.revenue / 100000, // Convert to lakhs
        }))
        setGraphData(chartData)
      }
    } catch (error) {
      console.error('Error fetching graph data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (graphData.length > 0) {
      fetchGraphData() // Refetch when view mode changes
    }
  }, [viewMode])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* View Mode Toggle */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <span className="text-sm text-gray-400">View:</span>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'daily' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setViewMode('cumulative')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'cumulative' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Cumulative (MTD)
          </button>
        </div>
      </div>

      {/* Graph */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={graphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
          <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff',
            }}
            labelStyle={{ color: '#9CA3AF' }}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF' }} />
          <Line
            type="monotone"
            dataKey="leads"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={{ fill: '#8B5CF6', r: 3 }}
            activeDot={{ r: 5 }}
            name="Leads Contacted"
          />
          <Line
            type="monotone"
            dataKey="conversions"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', r: 3 }}
            activeDot={{ r: 5 }}
            name="Conversions"
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ fill: '#F59E0B', r: 3 }}
            activeDot={{ r: 5 }}
            name="Revenue (₹L)"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend Info */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-gray-400">Leads Contacted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-400">Conversions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span className="text-gray-400">Revenue (in Lakhs)</span>
        </div>
      </div>
    </div>
  )
}
