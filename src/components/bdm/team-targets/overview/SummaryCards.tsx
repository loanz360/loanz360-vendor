'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface SummaryCardsProps {
  month: number
  year: number
}

interface SummaryCard {
  id: string
  title: string
  value: number | string
  target?: number
  achievement?: number
  trend: {
    direction: 'up' | 'down' | 'stable'
    percentage: number
    comparison: string
  }
  color: string
  icon: string
  subtitle?: string
}

export default function SummaryCards({ month, year }: SummaryCardsProps) {
  const [summaryData, setSummaryData] = useState<Record<string, SummaryCard>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSummaryData()
  }, [month, year])

  const fetchSummaryData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/bdm/team-targets/overview/summary?month=${month}&year=${year}`)
      const data = await response.json()

      if (data.success) {
        setSummaryData(data.data)
      }
    } catch (error) {
      console.error('Error fetching summary data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatValue = (value: number | string, cardId: string) => {
    if (typeof value === 'string') return value
    if (cardId === 'total_revenue') {
      return `₹${(value / 10000000).toFixed(2)}Cr`
    }
    if (cardId === 'avg_conversion') {
      return `${value}%`
    }
    return value.toLocaleString()
  }

  const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    if (direction === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />
    if (direction === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-500" />
  }

  const getTrendColor = (direction: 'up' | 'down' | 'stable') => {
    if (direction === 'up') return 'text-green-500'
    if (direction === 'down') return 'text-red-500'
    return 'text-gray-500'
  }

  const cards = [
    summaryData.teamAchievementRate,
    summaryData.totalLeadsContacted,
    summaryData.totalConversions,
    summaryData.totalRevenue,
    summaryData.avgConversionRate,
    summaryData.atRiskBDEs,
  ].filter(Boolean)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="content-card animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-gray-800 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card) => {
        if (!card) return null

        return (
          <Card
            key={card.id}
            className="content-card hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/20"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{card.icon}</span>
                    <h3 className="text-sm font-medium text-gray-400">{card.title}</h3>
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-bold text-white">
                      {formatValue(card.value, card.id)}
                    </p>
                    {card.target && (
                      <p className="text-sm text-gray-500 mt-1">
                        Target: {formatValue(card.target, card.id)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Achievement Bar */}
              {card.achievement !== undefined && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Achievement</span>
                    <span className="font-semibold">{card.achievement.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, card.achievement)}%`,
                        backgroundColor: card.color,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Trend */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {getTrendIcon(card.trend.direction)}
                  <span className={`text-sm font-medium ${getTrendColor(card.trend.direction)}`}>
                    {card.trend.percentage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500">{card.trend.comparison}</span>
                </div>
                {card.subtitle && <span className="text-xs text-gray-500">{card.subtitle}</span>}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
