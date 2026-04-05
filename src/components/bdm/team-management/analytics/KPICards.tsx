'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, Users, DollarSign, Clock, Target } from 'lucide-react'

interface KPICardsProps {
  data: {
    totalConversions: number
    totalRevenue: number
    averageTAT: number
    teamSize: number
    trends: {
      conversions: number
      revenue: number
      tat: number
      teamSize: number
    }
  }
}

export default function KPICards({ data }: KPICardsProps) {
  const kpis = [
    {
      title: 'Total Conversions',
      value: data.totalConversions.toLocaleString(),
      trend: data.trends.conversions,
      icon: Target,
      format: 'number',
    },
    {
      title: 'Total Revenue',
      value: `₹${(data.totalRevenue / 10000000).toFixed(2)}Cr`,
      trend: data.trends.revenue,
      icon: DollarSign,
      format: 'currency',
    },
    {
      title: 'Avg TAT',
      value: `${data.averageTAT} days`,
      trend: data.trends.tat,
      icon: Clock,
      format: 'days',
      invertTrend: true, // Lower is better for TAT
    },
    {
      title: 'Team Size',
      value: data.teamSize.toString(),
      trend: data.trends.teamSize,
      icon: Users,
      format: 'number',
    },
  ]

  const getTrendIcon = (trend: number, invertTrend: boolean = false) => {
    const isPositive = invertTrend ? trend < 0 : trend > 0
    const isNegative = invertTrend ? trend > 0 : trend < 0

    if (isPositive) {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    } else if (isNegative) {
      return <TrendingDown className="h-4 w-4 text-red-600" />
    } else {
      return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getTrendColor = (trend: number, invertTrend: boolean = false) => {
    const isPositive = invertTrend ? trend < 0 : trend > 0
    const isNegative = invertTrend ? trend > 0 : trend < 0

    if (isPositive) return 'text-green-600'
    if (isNegative) return 'text-red-600'
    return 'text-gray-400'
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center mt-2 text-xs">
                {getTrendIcon(kpi.trend, kpi.invertTrend)}
                <span className={`ml-1 ${getTrendColor(kpi.trend, kpi.invertTrend)}`}>
                  {Math.abs(kpi.trend).toFixed(1)}%
                </span>
                <span className="ml-1 text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
