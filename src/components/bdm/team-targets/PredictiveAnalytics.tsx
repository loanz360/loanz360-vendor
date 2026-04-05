'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, AlertTriangle, CheckCircle, AlertCircle, Target, Zap } from 'lucide-react'

interface PredictiveAnalyticsProps {
  month: number
  year: number
}

interface Projection {
  bdeId: string
  bdeName: string
  employeeCode: string
  current: {
    conversions: number
    revenue: number
    achievementRate: number
  }
  projection: {
    conversions: number
    revenue: number
    achievementRate: number
    remainingDays: number
  }
  confidence: string
  status: string
  recommendation: string
}

interface Risk {
  type: string
  severity: string
  bdeName: string
  title: string
  description: string
  recommendation: string
  urgency: string
}

interface Opportunity {
  type: string
  potential: string
  bdeName: string
  title: string
  description: string
  action: string
  recommendation: string
}

export default function PredictiveAnalytics({ month, year }: PredictiveAnalyticsProps) {
  const [projections, setProjections] = useState<Projection[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'projections' | 'risks' | 'opportunities'>('projections')

  useEffect(() => {
    fetchProjections()
    fetchRisksOpportunities()
  }, [month, year])

  const fetchProjections = async () => {
    try {
      const response = await fetch(`/api/bdm/team-targets/projections/month-end?month=${month}&year=${year}`)
      const data = await response.json()
      if (data.success) {
        setProjections(data.data.projections || [])
      }
    } catch (error) {
      console.error('Error fetching projections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRisksOpportunities = async () => {
    try {
      const response = await fetch(`/api/bdm/team-targets/projections/risks-opportunities?month=${month}&year=${year}`)
      const data = await response.json()
      if (data.success) {
        setRisks(data.data.risks || [])
        setOpportunities(data.data.opportunities || [])
      }
    } catch (error) {
      console.error('Error fetching risks/opportunities:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track':
        return 'bg-green-600'
      case 'needs_push':
        return 'bg-blue-600'
      case 'at_risk':
        return 'bg-orange-600'
      case 'critical':
        return 'bg-red-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600'
      case 'high':
        return 'bg-orange-600'
      case 'medium':
        return 'bg-yellow-600'
      default:
        return 'bg-gray-600'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="flex gap-2 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('projections')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'projections'
              ? 'text-orange-500 border-orange-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          Month-End Projections
        </button>
        <button
          onClick={() => setActiveTab('risks')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'risks'
              ? 'text-orange-500 border-orange-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Risks ({risks.length})
        </button>
        <button
          onClick={() => setActiveTab('opportunities')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'opportunities'
              ? 'text-orange-500 border-orange-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Opportunities ({opportunities.length})
        </button>
      </div>

      {/* Projections Tab */}
      {activeTab === 'projections' && (
        <div className="space-y-4">
          <Card className="content-card">
            <CardHeader>
              <CardTitle className="text-white">Team Performance Projections</CardTitle>
              <p className="text-sm text-gray-400">Predicted end-of-month outcomes based on current trends</p>
            </CardHeader>
          </Card>

          {projections.map((projection) => (
            <Card key={projection.bdeId} className="content-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{projection.bdeName}</h3>
                    <p className="text-sm text-gray-400">{projection.employeeCode}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(projection.status)}>
                      {projection.status.replace(/_/g, ' ')}
                    </Badge>
                    <Badge className="bg-gray-700">
                      {projection.confidence} confidence
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Current Progress</div>
                    <div className="text-2xl font-bold text-white">{projection.current.conversions}</div>
                    <div className="text-sm text-gray-400">conversions</div>
                    <div className="text-lg font-semibold text-orange-500 mt-2">
                      {projection.current.achievementRate.toFixed(0)}%
                    </div>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Projected End Result</div>
                    <div className="text-2xl font-bold text-white">{projection.projection.conversions}</div>
                    <div className="text-sm text-gray-400">conversions</div>
                    <div className="text-lg font-semibold text-blue-500 mt-2">
                      {projection.projection.achievementRate.toFixed(0)}%
                    </div>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Revenue Projection</div>
                    <div className="text-2xl font-bold text-white">
                      ₹{(projection.projection.revenue / 100000).toFixed(1)}L
                    </div>
                    <div className="text-sm text-gray-400">{projection.projection.remainingDays} days remaining</div>
                  </div>
                </div>

                <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-400">
                    <strong>Recommendation:</strong> {projection.recommendation}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          {projections.length === 0 && (
            <Card className="content-card">
              <CardContent className="p-12 text-center">
                <p className="text-gray-400">No projection data available</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Risks Tab */}
      {activeTab === 'risks' && (
        <div className="space-y-4">
          <Card className="content-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Performance Risks
              </CardTitle>
              <p className="text-sm text-gray-400">Issues requiring immediate attention</p>
            </CardHeader>
          </Card>

          {risks.map((risk, index) => (
            <Card key={index} className="content-card border-l-4 border-l-red-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{risk.title}</h3>
                    <p className="text-sm text-gray-400">{risk.bdeName}</p>
                  </div>
                  <Badge className={getSeverityColor(risk.severity)}>{risk.severity}</Badge>
                </div>

                <p className="text-gray-300 mb-3">{risk.description}</p>

                <div className="p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                  <p className="text-sm text-orange-400">
                    <strong>Action:</strong> {risk.recommendation}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          {risks.length === 0 && (
            <Card className="content-card">
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-gray-400">No critical risks detected - team is performing well!</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          <Card className="content-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Growth Opportunities
              </CardTitle>
              <p className="text-sm text-gray-400">Areas where team can excel</p>
            </CardHeader>
          </Card>

          {opportunities.map((opp, index) => (
            <Card key={index} className="content-card border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{opp.title}</h3>
                    <p className="text-sm text-gray-400">{opp.bdeName}</p>
                  </div>
                  <Badge className="bg-green-600">{opp.potential} potential</Badge>
                </div>

                <p className="text-gray-300 mb-3">{opp.description}</p>

                <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg mb-3">
                  <p className="text-sm text-green-400">
                    <strong>Action:</strong> {opp.action}
                  </p>
                </div>

                <p className="text-sm text-gray-400">{opp.recommendation}</p>
              </CardContent>
            </Card>
          ))}

          {opportunities.length === 0 && (
            <Card className="content-card">
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No specific opportunities identified at this time</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
