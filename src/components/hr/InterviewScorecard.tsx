'use client'

import React, { useState } from 'react'
import { Star, Save, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface ScorecardCriteria {
  id: string
  name: string
  description: string
  category: string
  weight: number // 1-5
}

interface CriteriaScore {
  criteria_id: string
  score: number // 1-5
  notes: string
}

interface InterviewScorecardProps {
  candidateName: string
  position: string
  interviewType: 'screening' | 'technical' | 'hr' | 'final'
  criteria?: ScorecardCriteria[]
  onSubmit: (scores: CriteriaScore[], overallNotes: string, recommendation: 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO' | 'STRONG_NO') => Promise<void>
  readOnly?: boolean
  initialScores?: CriteriaScore[]
  initialNotes?: string
  initialRecommendation?: string
}

const DEFAULT_CRITERIA: Record<string, ScorecardCriteria[]> = {
  screening: [
    { id: 'comm', name: 'Communication Skills', description: 'Clarity, articulation, listening', category: 'Soft Skills', weight: 4 },
    { id: 'exp', name: 'Relevant Experience', description: 'Years and quality of experience', category: 'Background', weight: 5 },
    { id: 'moti', name: 'Motivation', description: 'Interest in role and company', category: 'Soft Skills', weight: 3 },
    { id: 'cult', name: 'Cultural Fit', description: 'Alignment with company values', category: 'Soft Skills', weight: 3 },
    { id: 'avail', name: 'Availability', description: 'Notice period and joining timeline', category: 'Logistics', weight: 2 },
  ],
  technical: [
    { id: 'tech', name: 'Technical Knowledge', description: 'Domain expertise and depth', category: 'Technical', weight: 5 },
    { id: 'prob', name: 'Problem Solving', description: 'Analytical and logical thinking', category: 'Technical', weight: 5 },
    { id: 'code', name: 'Code Quality', description: 'Clean, maintainable, efficient code', category: 'Technical', weight: 4 },
    { id: 'sys', name: 'System Design', description: 'Architecture and scalability thinking', category: 'Technical', weight: 4 },
    { id: 'learn', name: 'Learning Ability', description: 'Adaptability to new technologies', category: 'Technical', weight: 3 },
  ],
  hr: [
    { id: 'comm', name: 'Communication', description: 'Professional communication skills', category: 'Soft Skills', weight: 4 },
    { id: 'team', name: 'Teamwork', description: 'Collaboration and team dynamics', category: 'Soft Skills', weight: 4 },
    { id: 'lead', name: 'Leadership Potential', description: 'Initiative and leadership qualities', category: 'Soft Skills', weight: 3 },
    { id: 'cult', name: 'Cultural Alignment', description: 'Values and work style fit', category: 'Culture', weight: 5 },
    { id: 'salary', name: 'Salary Expectation', description: 'Within budget and reasonable', category: 'Logistics', weight: 3 },
  ],
  final: [
    { id: 'overall', name: 'Overall Impression', description: 'General assessment', category: 'General', weight: 5 },
    { id: 'vision', name: 'Vision Alignment', description: 'Alignment with company direction', category: 'Strategic', weight: 4 },
    { id: 'growth', name: 'Growth Potential', description: 'Long-term potential in organization', category: 'Strategic', weight: 4 },
    { id: 'ref', name: 'Reference Check', description: 'Quality of references provided', category: 'Background', weight: 3 },
    { id: 'offer', name: 'Offer Readiness', description: 'Ready to extend offer', category: 'Decision', weight: 5 },
  ],
}

const RECOMMENDATION_OPTIONS = [
  { value: 'STRONG_YES', label: 'Strong Yes', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'YES', label: 'Yes', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'MAYBE', label: 'Maybe', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'NO', label: 'No', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'STRONG_NO', label: 'Strong No', color: 'bg-red-700/20 text-red-300 border-red-700/30' },
]

export function InterviewScorecard({
  candidateName, position, interviewType,
  criteria, onSubmit, readOnly = false,
  initialScores, initialNotes, initialRecommendation
}: InterviewScorecardProps) {
  const scorecardCriteria = criteria || DEFAULT_CRITERIA[interviewType] || DEFAULT_CRITERIA.screening
  const [scores, setScores] = useState<Record<string, CriteriaScore>>(
    () => {
      const initial: Record<string, CriteriaScore> = {}
      if (initialScores) {
        initialScores.forEach(s => { initial[s.criteria_id] = s })
      } else {
        scorecardCriteria.forEach(c => { initial[c.id] = { criteria_id: c.id, score: 0, notes: '' } })
      }
      return initial
    }
  )
  const [overallNotes, setOverallNotes] = useState(initialNotes || '')
  const [recommendation, setRecommendation] = useState(initialRecommendation || '')
  const [expandedCriteria, setExpandedCriteria] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setScore = (criteriaId: string, score: number) => {
    if (readOnly) return
    setScores(prev => ({ ...prev, [criteriaId]: { ...prev[criteriaId], score } }))
  }

  const setNotes = (criteriaId: string, notes: string) => {
    if (readOnly) return
    setScores(prev => ({ ...prev, [criteriaId]: { ...prev[criteriaId], notes } }))
  }

  const totalScore = scorecardCriteria.reduce((sum, c) => {
    const s = scores[c.id]?.score || 0
    return sum + (s * c.weight)
  }, 0)
  const maxScore = scorecardCriteria.reduce((sum, c) => sum + (5 * c.weight), 0)
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

  const handleSubmit = async () => {
    if (!recommendation) return
    setIsSubmitting(true)
    try {
      await onSubmit(
        Object.values(scores),
        overallNotes,
        recommendation as 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO' | 'STRONG_NO'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const categories = Array.from(new Set(scorecardCriteria.map(c => c.category)))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-[#FF6700]/10 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{candidateName}</h3>
            <p className="text-sm text-gray-400">{position} • {interviewType.charAt(0).toUpperCase() + interviewType.slice(1)} Round</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#FF6700]">{percentage}%</div>
            <div className="text-xs text-gray-400">{totalScore}/{maxScore} pts</div>
          </div>
        </div>
      </div>

      {/* Criteria by Category */}
      <div className="p-6 space-y-6">
        {categories.map(category => (
          <div key={category}>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{category}</h4>
            <div className="space-y-3">
              {scorecardCriteria.filter(c => c.category === category).map(criteria => (
                <div key={criteria.id} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{criteria.name}</span>
                        <span className="text-xs text-gray-500">&times;{criteria.weight}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{criteria.description}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setScore(criteria.id, star)}
                          disabled={readOnly}
                          className="p-0.5 transition-transform hover:scale-110 disabled:cursor-default"
                          aria-label={`Rate ${criteria.name} ${star} out of 5`}
                        >
                          <Star
                            className={`w-5 h-5 ${star <= (scores[criteria.id]?.score || 0) ? 'fill-[#FF6700] text-[#FF6700]' : 'text-gray-600'}`}
                          />
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setExpandedCriteria(expandedCriteria === criteria.id ? null : criteria.id)}
                      className="ml-3 p-1 text-gray-400 hover:text-white"
                      aria-label={expandedCriteria === criteria.id ? 'Collapse notes' : 'Expand notes'}
                    >
                      {expandedCriteria === criteria.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {expandedCriteria === criteria.id && (
                    <textarea
                      value={scores[criteria.id]?.notes || ''}
                      onChange={e => setNotes(criteria.id, e.target.value)}
                      placeholder="Add notes for this criteria..."
                      readOnly={readOnly}
                      className="w-full mt-3 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6700] resize-none"
                      rows={2}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Overall Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Overall Notes</label>
          <textarea
            value={overallNotes}
            onChange={e => setOverallNotes(e.target.value)}
            readOnly={readOnly}
            placeholder="Share your overall impression of the candidate..."
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6700] resize-none"
            rows={3}
          />
        </div>

        {/* Recommendation */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Recommendation</label>
          <div className="flex gap-2 flex-wrap">
            {RECOMMENDATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => !readOnly && setRecommendation(opt.value)}
                disabled={readOnly}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  recommendation === opt.value ? opt.color + ' ring-1 ring-offset-1 ring-offset-gray-800' : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:border-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        {!readOnly && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !recommendation || Object.values(scores).some(s => s.score === 0)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#FF6700] text-white rounded-xl font-medium hover:bg-[#FF6700]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Submit Scorecard
          </button>
        )}
      </div>
    </div>
  )
}
