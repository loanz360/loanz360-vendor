'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, TrendingUp, Users, PlayCircle, Info } from 'lucide-react'

interface Recommendation {
  type: 'rebalance' | 'resume' | 'capacity' | 'inactive'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  action: string
  affectedBDEs?: {
    overloaded?: string[]
    underutilized?: string[]
  } | string[]
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[]
  onActionClick?: (recommendation: Recommendation) => void
}

export default function RecommendationsPanel({
  recommendations,
  onActionClick,
}: RecommendationsPanelProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'rebalance':
        return TrendingUp
      case 'resume':
        return PlayCircle
      case 'capacity':
        return AlertTriangle
      case 'inactive':
        return Users
      default:
        return Info
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-l-red-500 bg-red-50'
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50'
      case 'low':
        return 'border-l-blue-500 bg-blue-50'
      default:
        return 'border-l-gray-500 bg-gray-50'
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>
      case 'medium':
        return <Badge variant="default" className="bg-yellow-600">Medium</Badge>
      case 'low':
        return <Badge variant="secondary">Low</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">All Good!</p>
            <p className="text-sm mt-1">No recommendations at this time</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI Recommendations</CardTitle>
          <Badge variant="outline">{recommendations.length} suggestion{recommendations.length > 1 ? 's' : ''}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((rec, index) => {
            const Icon = getIcon(rec.type)
            return (
              <div
                key={index}
                className={`border-l-4 ${getSeverityColor(rec.severity)} p-4 rounded-r-lg`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{rec.title}</h4>
                      {getSeverityBadge(rec.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>

                    {/* Affected BDEs */}
                    {rec.affectedBDEs && (
                      <div className="space-y-2 mb-3">
                        {typeof rec.affectedBDEs === 'object' && !Array.isArray(rec.affectedBDEs) && (
                          <>
                            {rec.affectedBDEs.overloaded && rec.affectedBDEs.overloaded.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-red-600 mb-1">Overloaded:</p>
                                <div className="flex flex-wrap gap-1">
                                  {rec.affectedBDEs.overloaded.map((name, idx) => (
                                    <Badge key={idx} variant="destructive" className="text-xs">
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {rec.affectedBDEs.underutilized && rec.affectedBDEs.underutilized.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-green-600 mb-1">Available:</p>
                                <div className="flex flex-wrap gap-1">
                                  {rec.affectedBDEs.underutilized.map((name, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs bg-green-100 text-green-700">
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {Array.isArray(rec.affectedBDEs) && rec.affectedBDEs.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {rec.affectedBDEs.map((name, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onActionClick?.(rec)}
                      >
                        {rec.action}
                      </Button>
                      {rec.severity === 'high' && (
                        <span className="text-xs text-red-600 font-medium">
                          Recommended Action
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
