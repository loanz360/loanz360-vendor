/**
 * AI Conversion Predictor
 *
 * Calculates conversion probability and estimated closing date
 * for contacts and leads based on engagement signals, AI scores,
 * and historical patterns.
 *
 * Uses a weighted scoring model (not ML) that considers:
 * - AI call rating and sentiment
 * - Interest level from AI analysis
 * - Number of calls and engagement depth
 * - Document upload completion
 * - Time in pipeline
 * - Loan type and amount patterns
 */

interface PredictionInput {
  // Engagement
  callCount: number
  totalCallDuration: number // seconds
  lastContactedDaysAgo: number
  notesCount: number

  // AI Analysis
  latestAIRating: number | null // 1-10
  sentiment: string | null // positive, neutral, negative
  interestLevel: string | null // high, medium, low

  // Documents
  documentsUploaded: number
  requiredDocuments: number

  // Pipeline
  daysInPipeline: number
  currentStage: string

  // Loan
  loanType: string | null
  loanAmount: number | null
}

interface ConversionPrediction {
  probability: number // 0-100
  confidence: string // 'low' | 'medium' | 'high'
  estimatedClosingDays: number | null
  estimatedClosingDate: string | null
  factors: PredictionFactor[]
  recommendation: string
}

interface PredictionFactor {
  name: string
  impact: 'positive' | 'negative' | 'neutral'
  weight: number // contribution to score
  detail: string
}

// Weights for different signals
const WEIGHTS = {
  AI_RATING: 25,        // Max 25 points from AI rating
  INTEREST_LEVEL: 15,   // Max 15 points from interest level
  SENTIMENT: 10,        // Max 10 points from sentiment
  ENGAGEMENT: 20,       // Max 20 points from call/note engagement
  DOCUMENTS: 15,        // Max 15 points from document completion
  RECENCY: 10,          // Max 10 points from recent activity
  PIPELINE_STAGE: 5,    // Max 5 points from pipeline progress
}

// Stage progression scores
const STAGE_SCORES: Record<string, number> = {
  new: 0,
  contacted: 1,
  qualified: 3,
  docs_pending: 4,
  ready_to_convert: 5,
}

// Average days to close by loan type (heuristic)
const AVG_CLOSING_DAYS: Record<string, number> = {
  PERSONAL_LOAN: 14,
  BUSINESS_LOAN: 30,
  HOME_LOAN: 45,
  LAP: 35,
  VEHICLE_LOAN: 21,
  GOLD_LOAN: 7,
  EDUCATION_LOAN: 30,
  DEFAULT: 25,
}

export function predictConversion(input: PredictionInput): ConversionPrediction {
  const factors: PredictionFactor[] = []
  let totalScore = 0

  // 1. AI Rating (0-25 points)
  if (input.latestAIRating !== null && input.latestAIRating > 0) {
    const aiScore = (input.latestAIRating / 10) * WEIGHTS.AI_RATING
    totalScore += aiScore
    factors.push({
      name: 'AI Call Rating',
      impact: input.latestAIRating >= 7 ? 'positive' : input.latestAIRating >= 4 ? 'neutral' : 'negative',
      weight: Math.round(aiScore),
      detail: `${input.latestAIRating}/10 rating from AI analysis`,
    })
  } else {
    factors.push({
      name: 'AI Call Rating',
      impact: 'neutral',
      weight: 0,
      detail: 'No AI analysis available yet',
    })
  }

  // 2. Interest Level (0-15 points)
  const interestScores: Record<string, number> = { high: 15, medium: 8, low: 2 }
  const interestScore = interestScores[input.interestLevel || ''] || 0
  totalScore += interestScore
  if (input.interestLevel) {
    factors.push({
      name: 'Customer Interest',
      impact: input.interestLevel === 'high' ? 'positive' : input.interestLevel === 'low' ? 'negative' : 'neutral',
      weight: interestScore,
      detail: `${input.interestLevel} interest level detected`,
    })
  }

  // 3. Sentiment (0-10 points)
  const sentimentScores: Record<string, number> = { positive: 10, neutral: 5, negative: 1 }
  const sentimentScore = sentimentScores[input.sentiment || ''] || 0
  totalScore += sentimentScore
  if (input.sentiment) {
    factors.push({
      name: 'Sentiment',
      impact: input.sentiment === 'positive' ? 'positive' : input.sentiment === 'negative' ? 'negative' : 'neutral',
      weight: sentimentScore,
      detail: `${input.sentiment} sentiment from conversations`,
    })
  }

  // 4. Engagement (0-20 points)
  let engagementScore = 0
  // Calls: up to 12 points (max at 5+ calls)
  engagementScore += Math.min(12, input.callCount * 3)
  // Call duration: up to 4 points (max at 10+ min total)
  engagementScore += Math.min(4, (input.totalCallDuration / 600) * 4)
  // Notes: up to 4 points
  engagementScore += Math.min(4, input.notesCount * 2)
  engagementScore = Math.min(WEIGHTS.ENGAGEMENT, engagementScore)
  totalScore += engagementScore
  factors.push({
    name: 'Engagement Depth',
    impact: engagementScore >= 12 ? 'positive' : engagementScore >= 6 ? 'neutral' : 'negative',
    weight: Math.round(engagementScore),
    detail: `${input.callCount} calls, ${input.notesCount} notes`,
  })

  // 5. Document Completion (0-15 points)
  if (input.requiredDocuments > 0) {
    const docPct = input.documentsUploaded / input.requiredDocuments
    const docScore = Math.min(WEIGHTS.DOCUMENTS, docPct * WEIGHTS.DOCUMENTS)
    totalScore += docScore
    factors.push({
      name: 'Document Status',
      impact: docPct >= 0.8 ? 'positive' : docPct >= 0.4 ? 'neutral' : 'negative',
      weight: Math.round(docScore),
      detail: `${input.documentsUploaded}/${input.requiredDocuments} documents uploaded`,
    })
  } else if (input.documentsUploaded > 0) {
    const docScore = Math.min(WEIGHTS.DOCUMENTS, input.documentsUploaded * 3)
    totalScore += docScore
    factors.push({
      name: 'Document Status',
      impact: 'positive',
      weight: Math.round(docScore),
      detail: `${input.documentsUploaded} documents uploaded`,
    })
  }

  // 6. Recency (0-10 points) - penalize stale leads
  let recencyScore = WEIGHTS.RECENCY
  if (input.lastContactedDaysAgo > 14) recencyScore = 2
  else if (input.lastContactedDaysAgo > 7) recencyScore = 5
  else if (input.lastContactedDaysAgo > 3) recencyScore = 7
  else if (input.lastContactedDaysAgo > 1) recencyScore = 9
  totalScore += recencyScore
  factors.push({
    name: 'Recent Activity',
    impact: recencyScore >= 7 ? 'positive' : recencyScore >= 5 ? 'neutral' : 'negative',
    weight: recencyScore,
    detail: input.lastContactedDaysAgo === 0
      ? 'Contacted today'
      : `Last contacted ${input.lastContactedDaysAgo} days ago`,
  })

  // 7. Pipeline Stage (0-5 points)
  const stageScore = ((STAGE_SCORES[input.currentStage] || 0) / 5) * WEIGHTS.PIPELINE_STAGE
  totalScore += stageScore
  factors.push({
    name: 'Pipeline Stage',
    impact: stageScore >= 3 ? 'positive' : stageScore >= 1 ? 'neutral' : 'negative',
    weight: Math.round(stageScore),
    detail: `Currently in "${input.currentStage}" stage`,
  })

  // Clamp probability to 0-100
  const probability = Math.max(0, Math.min(100, Math.round(totalScore)))

  // Confidence based on data availability
  const dataPoints = [
    input.latestAIRating !== null,
    input.callCount > 0,
    input.sentiment !== null,
    input.interestLevel !== null,
    input.documentsUploaded > 0,
  ].filter(Boolean).length

  const confidence = dataPoints >= 4 ? 'high' : dataPoints >= 2 ? 'medium' : 'low'

  // Estimated closing days
  let estimatedClosingDays: number | null = null
  let estimatedClosingDate: string | null = null

  if (probability >= 30) {
    const baseDays = AVG_CLOSING_DAYS[input.loanType?.toUpperCase() || 'DEFAULT'] || AVG_CLOSING_DAYS.DEFAULT
    // Adjust based on probability: higher probability = fewer days
    const adjustmentFactor = 1 - ((probability - 30) / 140) // 0.5 to 1.0 range
    estimatedClosingDays = Math.max(3, Math.round(baseDays * adjustmentFactor))

    // Subtract days already in pipeline
    estimatedClosingDays = Math.max(1, estimatedClosingDays - Math.floor(input.daysInPipeline * 0.3))

    const closingDate = new Date()
    closingDate.setDate(closingDate.getDate() + estimatedClosingDays)
    estimatedClosingDate = closingDate.toISOString().split('T')[0]
  }

  // Recommendation
  let recommendation: string
  if (probability >= 75) {
    recommendation = 'High conversion potential. Prioritize this lead and push for document completion.'
  } else if (probability >= 50) {
    recommendation = 'Good prospects. Schedule a follow-up call to maintain momentum.'
  } else if (probability >= 30) {
    recommendation = 'Moderate potential. Focus on building rapport and understanding needs.'
  } else {
    recommendation = 'Low conversion signals. Consider re-qualifying or deprioritizing.'
  }

  return {
    probability,
    confidence,
    estimatedClosingDays,
    estimatedClosingDate,
    factors: factors.sort((a, b) => b.weight - a.weight),
    recommendation,
  }
}
