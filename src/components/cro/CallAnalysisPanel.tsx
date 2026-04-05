'use client'

import React from 'react'
import {
  Star, ThumbsUp, Target, Lightbulb, MessageSquare,
  TrendingUp, BarChart3, FileText
} from 'lucide-react'

interface CallAnalysis {
  ai_summary?: string
  ai_rating?: number
  ai_sentiment?: string
  ai_coaching_feedback?: string
  ai_positive_points?: string[]
  ai_improvement_points?: string[]
  ai_extracted_data?: {
    loanAmount?: string
    loanPurpose?: string
    monthlyIncome?: string
    businessType?: string
    urgency?: string
    concerns?: string[]
    nextSteps?: string[]
  }
  transcript?: string
  interest_level?: string
}

interface CallAnalysisPanelProps {
  analysis: CallAnalysis
  compact?: boolean
}

function getRatingColor(rating: number): string {
  if (rating >= 8) return 'text-green-400'
  if (rating >= 6) return 'text-yellow-400'
  if (rating >= 4) return 'text-orange-400'
  return 'text-red-400'
}

function getRatingBg(rating: number): string {
  if (rating >= 8) return 'from-green-500/20 to-green-600/5'
  if (rating >= 6) return 'from-yellow-500/20 to-yellow-600/5'
  if (rating >= 4) return 'from-orange-500/20 to-orange-600/5'
  return 'from-red-500/20 to-red-600/5'
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'very_positive':
    case 'positive':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'neutral':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    case 'negative':
    case 'very_negative':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

export default function CallAnalysisPanel({ analysis, compact = false }: CallAnalysisPanelProps) {
  const {
    ai_summary,
    ai_rating,
    ai_sentiment,
    ai_coaching_feedback,
    ai_positive_points,
    ai_improvement_points,
    ai_extracted_data,
    transcript,
    interest_level,
  } = analysis

  if (!ai_rating && !ai_summary && !transcript) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Score + Sentiment Header */}
      {(ai_rating || ai_sentiment) && (
        <div className={`bg-gradient-to-r ${getRatingBg(ai_rating || 0)} rounded-xl p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            {ai_rating && (
              <div className="text-center">
                <div className={`text-4xl font-bold ${getRatingColor(ai_rating)}`}>
                  {ai_rating.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 mt-1">AI Score</div>
              </div>
            )}
            {/* Score ring */}
            {ai_rating && (
              <div className="relative w-16 h-16">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-800" />
                  <circle
                    cx="32" cy="32" r="28" fill="none" strokeWidth="4"
                    strokeDasharray={`${(ai_rating / 10) * 175.9} 175.9`}
                    strokeLinecap="round"
                    className={getRatingColor(ai_rating)}
                  />
                </svg>
                <Star className={`absolute inset-0 m-auto w-5 h-5 ${getRatingColor(ai_rating)}`} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {ai_sentiment && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${getSentimentColor(ai_sentiment)}`}>
                {ai_sentiment.replaceAll('_', ' ')}
              </span>
            )}
            {interest_level && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${
                interest_level === 'high' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                interest_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                'bg-orange-500/20 text-orange-400 border-orange-500/30'
              }`}>
                {interest_level} interest
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {ai_summary && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Summary
          </h4>
          <p className="text-sm text-gray-400 leading-relaxed">{ai_summary}</p>
        </div>
      )}

      {!compact && (
        <>
          {/* What You Did Well */}
          {ai_positive_points && ai_positive_points.length > 0 && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <ThumbsUp className="w-4 h-4" />
                What You Did Well
              </h4>
              <ul className="space-y-2">
                {ai_positive_points.map((point, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas to Improve */}
          {ai_improvement_points && ai_improvement_points.length > 0 && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Areas to Improve
              </h4>
              <ul className="space-y-2">
                {ai_improvement_points.map((point, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">→</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coaching Feedback */}
          {ai_coaching_feedback && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Coaching Feedback
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed">{ai_coaching_feedback}</p>
            </div>
          )}

          {/* Extracted Data */}
          {ai_extracted_data && Object.keys(ai_extracted_data).length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Extracted Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {ai_extracted_data.loanAmount && (
                  <div>
                    <span className="text-gray-500">Loan Amount:</span>
                    <span className="text-white ml-2">{ai_extracted_data.loanAmount}</span>
                  </div>
                )}
                {ai_extracted_data.loanPurpose && (
                  <div>
                    <span className="text-gray-500">Purpose:</span>
                    <span className="text-white ml-2">{ai_extracted_data.loanPurpose}</span>
                  </div>
                )}
                {ai_extracted_data.monthlyIncome && (
                  <div>
                    <span className="text-gray-500">Income:</span>
                    <span className="text-white ml-2">{ai_extracted_data.monthlyIncome}</span>
                  </div>
                )}
                {ai_extracted_data.businessType && (
                  <div>
                    <span className="text-gray-500">Business:</span>
                    <span className="text-white ml-2">{ai_extracted_data.businessType}</span>
                  </div>
                )}
                {ai_extracted_data.urgency && (
                  <div>
                    <span className="text-gray-500">Urgency:</span>
                    <span className="text-white ml-2 capitalize">{ai_extracted_data.urgency}</span>
                  </div>
                )}
              </div>
              {ai_extracted_data.concerns && ai_extracted_data.concerns.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs text-gray-500 uppercase">Concerns</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {ai_extracted_data.concerns.map((c, i) => (
                      <span key={i} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ai_extracted_data.nextSteps && ai_extracted_data.nextSteps.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs text-gray-500 uppercase">Next Steps</span>
                  <ul className="mt-1 space-y-1">
                    {ai_extracted_data.nextSteps.map((s, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                        <TrendingUp className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Transcript */}
          {transcript && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Transcript
              </h4>
              <p className="text-sm text-gray-500 whitespace-pre-line max-h-48 overflow-y-auto">
                {transcript}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
