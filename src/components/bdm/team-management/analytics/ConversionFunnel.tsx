'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ConversionFunnelProps {
  data: {
    stages: Array<{
      stage: string
      count: number
      percentage: number
      dropoffRate: number
    }>
  }
}

export default function ConversionFunnel({ data }: ConversionFunnelProps) {
  const maxCount = Math.max(...data.stages.map(s => s.count), 1)

  const getStageColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-rose-500',
      'bg-green-500',
    ]
    return colors[index % colors.length]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
        <CardDescription>Lead progression through stages</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.stages.map((stage, index) => {
            const widthPercentage = (stage.count / maxCount) * 100

            return (
              <div key={stage.stage} className="space-y-2">
                {/* Stage Header */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{stage.stage}</span>
                    {stage.dropoffRate > 0 && (
                      <span className="text-xs text-red-600">
                        -{stage.dropoffRate.toFixed(1)}% drop
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{stage.count} leads</span>
                    <span className="font-medium">{stage.percentage.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Funnel Bar */}
                <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${getStageColor(index)} transition-all duration-500 flex items-center justify-center`}
                    style={{ width: `${widthPercentage}%` }}
                  >
                    {widthPercentage > 15 && (
                      <span className="text-white font-semibold text-sm">
                        {stage.count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {data.stages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No funnel data available</p>
            </div>
          )}
        </div>

        {/* Summary */}
        {data.stages.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {data.stages[0]?.count || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total Leads</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {data.stages[data.stages.length - 1]?.count || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Conversions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {data.stages[data.stages.length - 1]?.percentage.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Overall Rate</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
