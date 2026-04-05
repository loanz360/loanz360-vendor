// TeleSales AI Call Scoring Types

// Scoring Template
export interface TSScoringTemplate {
  id: string
  name: string
  description: string | null
  category: 'GENERAL' | 'SALES' | 'SUPPORT' | 'COLLECTION'
  criteria: TSScoringCriteriaItem[]
  max_score: number
  passing_score: number
  is_active: boolean
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TSScoringCriteriaItem {
  id: string
  name: string
  max_score: number
  weight: number
  description?: string
}

// Call Score
export interface TSCallScore {
  id: string
  call_id: string
  sales_executive_id: string
  scoring_template_id: string | null
  total_score: number
  max_possible_score: number
  percentage_score: number
  grade: TSGrade
  passed: boolean
  criteria_scores: TSCriteriaScore[]
  scoring_method: 'MANUAL' | 'AI_ASSISTED' | 'FULLY_AUTOMATED'
  ai_confidence: number | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  is_disputed: boolean
  dispute_reason: string | null
  dispute_resolved_at: string | null
  scored_at: string
  created_at: string
  updated_at: string
}

export type TSGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'

export interface TSCriteriaScore {
  criteria_id: string
  name: string
  score: number
  max_score: number
  weight: number
  notes?: string
}

// Scoring Criteria Library
export interface TSScoringCriteria {
  id: string
  name: string
  description: string | null
  category: string
  max_score: number
  weight: number
  scoring_guide: Record<string, string>
  keywords_positive: string[]
  keywords_negative: string[]
  ai_scoreable: boolean
  ai_prompt: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

// Call Transcription
export interface TSCallTranscription {
  id: string
  call_id: string
  sales_executive_id: string
  full_transcription: string | null
  transcription_segments: TSTranscriptionSegment[]
  audio_duration_seconds: number | null
  transcription_provider: 'WHISPER' | 'GOOGLE_SPEECH' | 'MANUAL' | null
  transcription_confidence: number | null
  language: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface TSTranscriptionSegment {
  speaker: 'AGENT' | 'CUSTOMER'
  text: string
  start_time: number
  end_time: number
  confidence?: number
}

// Call Insights
export interface TSCallInsights {
  id: string
  call_id: string
  transcription_id: string | null
  sales_executive_id: string
  overall_sentiment: TSSentiment
  customer_sentiment: TSSentiment
  agent_sentiment: TSSentiment
  sentiment_score: number
  talk_ratio: number
  silence_percentage: number
  interruptions_count: number
  average_response_time_seconds: number
  key_topics: string[]
  customer_objections: string[]
  agent_responses: string[]
  action_items: string[]
  customer_intent: TSCustomerIntent
  intent_confidence: number
  improvement_suggestions: TSImprovement[]
  coaching_points: TSCoachingPoint[]
  call_summary: string | null
  next_steps: string[]
  created_at: string
  updated_at: string
}

export type TSSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED'

export type TSCustomerIntent =
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'NEEDS_INFO'
  | 'READY_TO_BUY'
  | 'PRICE_SENSITIVE'
  | 'COMPARING_OPTIONS'
  | 'CALLBACK_REQUESTED'
  | 'UNDECIDED'

export interface TSImprovement {
  area: string
  suggestion: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface TSCoachingPoint {
  topic: string
  observation: string
  recommendation: string
}

// Scoring Benchmarks
export interface TSScoringBenchmark {
  id: string
  period_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
  period_start: string
  period_end: string
  total_calls_scored: number
  average_score: number
  median_score: number
  highest_score: number
  lowest_score: number
  standard_deviation: number
  grade_distribution: Record<TSGrade, number>
  top_performers: TSTopPerformer[]
  criteria_averages: Record<string, number>
  score_trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  trend_percentage: number
  created_at: string
  updated_at: string
}

export interface TSTopPerformer {
  user_id: string
  user_name?: string
  average_score: number
  calls_scored: number
}

// API Response types
export interface TSCallScoreStats {
  total_scored: number
  average_score: number
  average_percentage: number
  pass_rate: number
  grade_distribution: Record<TSGrade, number>
  improvement_areas: string[]
  strengths: string[]
  recent_trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
}

export interface TSScoreCallRequest {
  call_id: string
  scoring_template_id?: string
  criteria_scores: {
    criteria_id: string
    score: number
    notes?: string
  }[]
  review_notes?: string
}

// Grade color mapping for UI
export const GRADE_COLORS: Record<TSGrade, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  'A': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  'B+': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  'B': { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300' },
  'C+': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  'C': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  'D': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  'F': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
}

// Sentiment color mapping
export const SENTIMENT_COLORS: Record<TSSentiment, { bg: string; text: string }> = {
  'POSITIVE': { bg: 'bg-green-100', text: 'text-green-800' },
  'NEUTRAL': { bg: 'bg-gray-100', text: 'text-gray-800' },
  'NEGATIVE': { bg: 'bg-red-100', text: 'text-red-800' },
  'MIXED': { bg: 'bg-purple-100', text: 'text-purple-800' },
}
