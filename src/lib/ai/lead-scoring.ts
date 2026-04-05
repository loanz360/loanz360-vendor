import { SupabaseClient } from '@supabase/supabase-js'

interface LeadData {
  id: string
  customer_name?: string
  loan_type?: string
  loan_amount_required?: number
  monthly_income?: number
  cibil_score?: number
  employment_type?: string
  status?: string
  created_at?: string
}

interface ScoringFactors {
  cibilScore: number
  incomeToLoanRatio: number
  engagementScore: number
  aiSentimentScore: number
  documentCompleteness: number
  recencyScore: number
  interestScore: number
}

interface LeadScoreResult {
  score: number
  classification: 'Hot' | 'Warm' | 'Cold'
  factors: ScoringFactors
  breakdown: Array<{ factor: string; score: number; maxScore: number; reason: string }>
}

/**
 * AI Lead Scoring Engine
 * Calculates a 0-100 score based on multiple weighted factors.
 * Auto-classifies as Hot (70+), Warm (40-69), Cold (0-39).
 */
export async function calculateLeadScore(
  supabase: SupabaseClient,
  leadId: string,
  croId?: string
): Promise<LeadScoreResult> {
  // Fetch lead data
  const { data: lead } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (!lead) {
    return { score: 0, classification: 'Cold', factors: emptyFactors(), breakdown: [] }
  }

  // Fetch related data in parallel
  const [callLogsResult, followupsResult] = await Promise.all([
    supabase
      .from('cro_call_logs')
      .select('call_outcome, ai_rating, ai_sentiment, interest_level, call_started_at')
      .eq('entity_table_id', leadId)
      .order('call_started_at', { ascending: false })
      .limit(20),
    supabase
      .from('crm_followups')
      .select('status')
      .eq('lead_id', leadId),
  ])

  const callLogs = callLogsResult.data || []
  const followups = followupsResult.data || []

  const breakdown: LeadScoreResult['breakdown'] = []

  // 1. CIBIL Score (0-20 points)
  let cibilScore = 0
  if (lead.cibil_score) {
    const cibil = Number(lead.cibil_score)
    if (cibil >= 750) cibilScore = 20
    else if (cibil >= 700) cibilScore = 16
    else if (cibil >= 650) cibilScore = 12
    else if (cibil >= 600) cibilScore = 8
    else if (cibil >= 500) cibilScore = 4
    else cibilScore = 0

    breakdown.push({
      factor: 'CIBIL Score',
      score: cibilScore,
      maxScore: 20,
      reason: `CIBIL: ${cibil}${cibil >= 750 ? ' (Excellent)' : cibil >= 700 ? ' (Good)' : cibil >= 650 ? ' (Fair)' : ' (Needs improvement)'}`,
    })
  } else {
    breakdown.push({ factor: 'CIBIL Score', score: 0, maxScore: 20, reason: 'No CIBIL score available' })
  }

  // 2. Income-to-Loan Ratio (0-15 points)
  let incomeToLoanRatio = 0
  const income = Number(lead.monthly_income || lead.net_monthly_income || 0)
  const loanAmount = Number(lead.loan_amount_required || lead.loan_amount || 0)
  if (income > 0 && loanAmount > 0) {
    const ratio = (income * 12) / loanAmount // Annual income to loan ratio
    if (ratio >= 3) incomeToLoanRatio = 15
    else if (ratio >= 2) incomeToLoanRatio = 12
    else if (ratio >= 1.5) incomeToLoanRatio = 9
    else if (ratio >= 1) incomeToLoanRatio = 6
    else incomeToLoanRatio = 3

    breakdown.push({
      factor: 'Income-to-Loan Ratio',
      score: incomeToLoanRatio,
      maxScore: 15,
      reason: `Annual income ${ratio.toFixed(1)}x of loan amount`,
    })
  } else {
    breakdown.push({ factor: 'Income-to-Loan Ratio', score: 0, maxScore: 15, reason: 'Income or loan amount not available' })
  }

  // 3. Engagement Score (0-20 points)
  let engagementScore = 0
  const totalCalls = callLogs.length
  const connectedCalls = callLogs.filter(c =>
    ['connected', 'interested', 'callback_requested'].includes(c.call_outcome)
  ).length

  if (totalCalls > 0) {
    // Points for call volume (max 8)
    engagementScore += Math.min(8, totalCalls * 2)

    // Points for connected calls (max 8)
    engagementScore += Math.min(8, connectedCalls * 3)

    // Points for follow-up completion (max 4)
    const completedFollowups = followups.filter(f => f.status === 'Completed').length
    engagementScore += Math.min(4, completedFollowups * 2)
  }

  engagementScore = Math.min(20, engagementScore)
  breakdown.push({
    factor: 'Engagement',
    score: engagementScore,
    maxScore: 20,
    reason: `${totalCalls} calls, ${connectedCalls} connected, ${followups.filter(f => f.status === 'Completed').length} follow-ups done`,
  })

  // 4. AI Sentiment Score (0-15 points)
  let aiSentimentScore = 0
  const ratedCalls = callLogs.filter(c => c.ai_rating)
  if (ratedCalls.length > 0) {
    const avgRating = ratedCalls.reduce((sum, c) => sum + (c.ai_rating || 0), 0) / ratedCalls.length
    aiSentimentScore = Math.min(15, Math.round(avgRating * 1.5))

    // Sentiment bonus
    const positiveSentiments = callLogs.filter(c => c.ai_sentiment === 'positive').length
    if (positiveSentiments > 0) aiSentimentScore = Math.min(15, aiSentimentScore + 2)
  }

  breakdown.push({
    factor: 'AI Analysis',
    score: aiSentimentScore,
    maxScore: 15,
    reason: ratedCalls.length > 0
      ? `Avg AI rating: ${(ratedCalls.reduce((s, c) => s + (c.ai_rating || 0), 0) / ratedCalls.length).toFixed(1)}/10`
      : 'No AI analysis available',
  })

  // 5. Document Completeness (0-10 points)
  let documentCompleteness = 0
  const notesTimeline = Array.isArray(lead.notes_timeline) ? lead.notes_timeline : []
  const docChecklist = notesTimeline.find((n: Record<string, unknown>) => n.type === 'document_checklist')
  if (docChecklist && Array.isArray(docChecklist.documents)) {
    const docs = docChecklist.documents as Array<{ status: string }>
    const totalDocs = docs.length
    const completedDocs = docs.filter(d => d.status === 'uploaded' || d.status === 'verified').length
    documentCompleteness = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 10) : 0
  }

  breakdown.push({
    factor: 'Document Completeness',
    score: documentCompleteness,
    maxScore: 10,
    reason: docChecklist ? `${documentCompleteness * 10}% documents collected` : 'No documents tracked',
  })

  // 6. Recency Score (0-10 points) - how recently was there engagement
  let recencyScore = 0
  const lastActivity = callLogs[0]?.call_started_at || lead.updated_at || lead.created_at
  if (lastActivity) {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince <= 1) recencyScore = 10
    else if (daysSince <= 3) recencyScore = 8
    else if (daysSince <= 7) recencyScore = 6
    else if (daysSince <= 14) recencyScore = 4
    else if (daysSince <= 30) recencyScore = 2
    else recencyScore = 0
  }

  breakdown.push({
    factor: 'Recency',
    score: recencyScore,
    maxScore: 10,
    reason: lastActivity
      ? `Last activity: ${new Date(lastActivity).toLocaleDateString('en-IN')}`
      : 'No activity recorded',
  })

  // 7. Interest Level (0-10 points)
  let interestScore = 0
  const latestInterest = callLogs.find(c => c.interest_level)?.interest_level
  if (latestInterest === 'high') interestScore = 10
  else if (latestInterest === 'medium') interestScore = 7
  else if (latestInterest === 'low') interestScore = 4
  else if (latestInterest === 'none') interestScore = 1

  breakdown.push({
    factor: 'Interest Level',
    score: interestScore,
    maxScore: 10,
    reason: latestInterest ? `Latest interest: ${latestInterest}` : 'Not assessed',
  })

  // Calculate total
  const totalScore = Math.min(100,
    cibilScore + incomeToLoanRatio + engagementScore +
    aiSentimentScore + documentCompleteness + recencyScore + interestScore
  )

  // Classify
  let classification: LeadScoreResult['classification'] = 'Cold'
  if (totalScore >= 70) classification = 'Hot'
  else if (totalScore >= 40) classification = 'Warm'

  return {
    score: totalScore,
    classification,
    factors: {
      cibilScore,
      incomeToLoanRatio,
      engagementScore,
      aiSentimentScore,
      documentCompleteness,
      recencyScore,
      interestScore,
    },
    breakdown,
  }
}

/**
 * Score and update a lead in the database.
 */
export async function scoreAndUpdateLead(
  supabase: SupabaseClient,
  leadId: string,
  croId?: string
): Promise<LeadScoreResult> {
  const result = await calculateLeadScore(supabase, leadId, croId)

  // Update lead_score and priority in crm_leads
  const priority = result.classification === 'Hot' ? 'High'
    : result.classification === 'Warm' ? 'Medium' : 'Low'

  await supabase
    .from('crm_leads')
    .update({
      lead_score: result.score,
      priority,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  return result
}

function emptyFactors(): ScoringFactors {
  return {
    cibilScore: 0,
    incomeToLoanRatio: 0,
    engagementScore: 0,
    aiSentimentScore: 0,
    documentCompleteness: 0,
    recencyScore: 0,
    interestScore: 0,
  }
}
