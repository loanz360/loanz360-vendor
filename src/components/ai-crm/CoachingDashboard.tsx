'use client'

import { useState, useEffect } from 'react'
import {
  Target, TrendingUp, Brain, Star, Phone,
  ArrowUpRight, AlertTriangle, CheckCircle2,
  Loader2, ChevronRight, Zap,
} from 'lucide-react'

interface LeadPrediction {
  entity_id: string
  entity_name: string
  loan_type: string
  loan_amount: number
  stage: string
  probability: number
  confidence: string
  estimatedClosingDays: number | null
  estimatedClosingDate: string | null
  recommendation: string
}

interface CoachingData {
  today: {
    callsMade: number
    callsConnected: number
    positiveCalls: number
    avgAIRating: number
  }
  performance: {
    bestPoints: string[]
    improvementAreas: string[]
  }
}

export default function CoachingDashboard() {
  const [predictions, setPredictions] = useState<LeadPrediction[]>([])
  const [coaching, setCoaching] = useState<CoachingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchPredictions(), fetchCoaching()]).finally(() => setIsLoading(false))
  }, [])

  const fetchPredictions = async () => {
    try {
      const response = await fetch('/api/ai-crm/cro/predictions?type=leads')
      const result = await response.json()
      if (result.success) setPredictions(result.data || [])
    } catch { /* ignore */ }
  }

  const fetchCoaching = async () => {
    try {
      const response = await fetch('/api/ai-crm/cro/analytics')
      const result = await response.json()
      if (result.success) setCoaching(result.data)
    } catch { /* ignore */ }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  const hotLeads = predictions.filter((p) => p.probability >= 60)
  const warmLeads = predictions.filter((p) => p.probability >= 30 && p.probability < 60)
  const coldLeads = predictions.filter((p) => p.probability < 30)
  const totalPipelineValue = predictions.reduce((sum, p) => sum + (p.loan_amount || 0), 0)
  const weightedValue = predictions.reduce(
    (sum, p) => sum + (p.loan_amount || 0) * (p.probability / 100),
    0
  )

  return (
    <div className="space-y-6">
      {/* AI Insights Header */}
      <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 rounded-xl p-5 border border-orange-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Coaching Insights</h2>
            <p className="text-xs text-gray-400">Personalized recommendations based on your activity</p>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <p className="text-xs text-gray-500">Hot Leads</p>
            <p className="text-xl font-bold text-green-400">{hotLeads.length}</p>
            <p className="text-xs text-green-400/70">60%+ probability</p>
          </div>
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <p className="text-xs text-gray-500">Warm Leads</p>
            <p className="text-xl font-bold text-yellow-400">{warmLeads.length}</p>
            <p className="text-xs text-yellow-400/70">30-60% probability</p>
          </div>
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <p className="text-xs text-gray-500">Pipeline Value</p>
            <p className="text-xl font-bold text-white">₹{formatAmount(totalPipelineValue)}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <p className="text-xs text-gray-500">Weighted Value</p>
            <p className="text-xl font-bold text-orange-400">₹{formatAmount(weightedValue)}</p>
            <p className="text-xs text-gray-500">Probability-adjusted</p>
          </div>
        </div>
      </div>

      {/* Today's Focus */}
      {coaching && (
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-500" /> Today&apos;s Focus
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Your Strengths</p>
              {coaching.performance.bestPoints.slice(0, 3).map((point, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-300">{point}</p>
                </div>
              ))}
              {coaching.performance.bestPoints.length === 0 && (
                <p className="text-sm text-gray-500">Make more calls to see AI insights</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">Areas to Improve</p>
              {coaching.performance.improvementAreas.slice(0, 3).map((area, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-300">{area}</p>
                </div>
              ))}
              {coaching.performance.improvementAreas.length === 0 && (
                <p className="text-sm text-gray-500">No improvement areas identified yet</p>
              )}
            </div>
          </div>

          {/* Daily stats mini bar */}
          <div className="flex items-center gap-6 mt-4 pt-3 border-t border-white/5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" /> {coaching.today.callsMade} calls today
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" /> {coaching.today.avgAIRating.toFixed(1)} avg AI rating
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {coaching.today.positiveCalls} positive
            </span>
          </div>
        </div>
      )}

      {/* Hot Leads - Priority Action */}
      {hotLeads.length > 0 && (
        <div className="bg-green-500/5 rounded-xl p-5 border border-green-500/20">
          <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Hot Leads - Act Now ({hotLeads.length})
          </h3>
          <div className="space-y-2">
            {hotLeads.slice(0, 5).map((lead) => (
              <LeadPredictionRow key={lead.entity_id} lead={lead} />
            ))}
          </div>
        </div>
      )}

      {/* Warm Leads */}
      {warmLeads.length > 0 && (
        <div className="bg-yellow-500/5 rounded-xl p-5 border border-yellow-500/20">
          <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Warm Leads - Follow Up ({warmLeads.length})
          </h3>
          <div className="space-y-2">
            {warmLeads.slice(0, 5).map((lead) => (
              <LeadPredictionRow key={lead.entity_id} lead={lead} />
            ))}
          </div>
        </div>
      )}

      {/* Cold Leads */}
      {coldLeads.length > 0 && (
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Cold Leads - Re-evaluate ({coldLeads.length})
          </h3>
          <div className="space-y-2">
            {coldLeads.slice(0, 3).map((lead) => (
              <LeadPredictionRow key={lead.entity_id} lead={lead} />
            ))}
          </div>
        </div>
      )}

      {predictions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Brain className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p>No leads to analyze yet.</p>
          <p className="text-xs mt-1">Start working on leads to see AI predictions.</p>
        </div>
      )}
    </div>
  )
}

function LeadPredictionRow({ lead }: { lead: LeadPrediction }) {
  const probabilityColor =
    lead.probability >= 60
      ? 'text-green-400'
      : lead.probability >= 30
        ? 'text-yellow-400'
        : 'text-gray-400'

  const barColor =
    lead.probability >= 60
      ? 'bg-green-500'
      : lead.probability >= 30
        ? 'bg-yellow-500'
        : 'bg-gray-500'

  return (
    <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-white font-medium truncate">{lead.entity_name}</p>
          <span className="text-xs text-gray-500">{lead.loan_type}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full max-w-[120px]">
            <div
              className={`h-full rounded-full ${barColor} transition-all`}
              style={{ width: `${lead.probability}%` }}
            />
          </div>
          <span className={`text-xs font-bold ${probabilityColor}`}>
            {lead.probability}%
          </span>
          {lead.estimatedClosingDays && (
            <span className="text-xs text-gray-500">
              ~{lead.estimatedClosingDays}d
            </span>
          )}
        </div>
      </div>
      {lead.loan_amount > 0 && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          ₹{formatAmount(lead.loan_amount)}
        </span>
      )}
      <a
        href={`/employees/cro/ai-crm/leads/${lead.entity_id}`}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
      >
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </a>
    </div>
  )
}

function formatAmount(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`
  return String(amount)
}
