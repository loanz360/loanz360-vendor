/**
 * AI Engine - Enterprise-grade Intelligent Ticket Processing
 *
 * Features:
 * - Automatic ticket classification (category, priority)
 * - Sentiment analysis
 * - Smart response suggestions
 * - Similar ticket detection
 * - Knowledge base article recommendations
 * - Agent performance insights
 * - Trend detection & anomaly alerts
 */

import { createClient } from '@/lib/supabase/server'

// Types
export type SentimentScore = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive'
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low'

export interface ClassificationResult {
  category: string
  category_confidence: number
  subcategory?: string
  priority: string
  priority_confidence: number
  suggested_tags: string[]
  language: string
}

export interface SentimentResult {
  score: SentimentScore
  confidence: number
  emotions: {
    frustration: number
    satisfaction: number
    confusion: number
    urgency: number
  }
  keywords: string[]
}

export interface ResponseSuggestion {
  id: string
  type: 'canned' | 'generated' | 'article'
  content: string
  confidence: number
  source?: string
  article_id?: string
}

export interface SimilarTicket {
  ticket_id: string
  ticket_number: string
  subject: string
  similarity_score: number
  status: string
  resolution?: string
  source: string
}

export interface TicketInsights {
  classification: ClassificationResult
  sentiment: SentimentResult
  urgency_indicators: string[]
  suggested_responses: ResponseSuggestion[]
  similar_tickets: SimilarTicket[]
  recommended_articles: { id: string; title: string; relevance: number }[]
  estimated_resolution_time_hours: number
  risk_factors: string[]
}

// Category keywords for rule-based classification
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  loan_application: ['apply', 'application', 'new loan', 'eligibility', 'apply for', 'loan request', 'want loan', 'need loan'],
  loan_disbursement: ['disbursement', 'disburse', 'release', 'transfer', 'when will i get', 'money not received', 'fund transfer'],
  emi_payment: ['emi', 'payment', 'installment', 'due', 'pay', 'autopay', 'nach', 'mandate', 'bounce', 'failed payment'],
  account_access: ['login', 'password', 'otp', 'access', 'forgot', 'reset', 'locked', 'cannot login', 'sign in'],
  document_upload: ['document', 'upload', 'kyc', 'verification', 'aadhaar', 'pan', 'proof', 'submit documents'],
  loan_status: ['status', 'application status', 'where is my', 'update', 'progress', 'tracking', 'pending'],
  interest_rate: ['interest', 'rate', 'roi', 'apr', 'reduce rate', 'high interest', 'interest rate'],
  prepayment: ['prepay', 'prepayment', 'part payment', 'early payment', 'pay extra', 'reduce principal'],
  foreclosure: ['foreclose', 'foreclosure', 'close loan', 'settle', 'full payment', 'pay off'],
  customer_service: ['complaint', 'feedback', 'service', 'staff', 'behavior', 'experience', 'unhappy'],
  technical_issue: ['error', 'bug', 'not working', 'crash', 'app issue', 'website down', 'technical', 'glitch'],
  general_inquiry: ['question', 'inquiry', 'information', 'help', 'know', 'tell me', 'explain']
}

// Priority keywords
const PRIORITY_KEYWORDS: Record<string, string[]> = {
  urgent: ['urgent', 'emergency', 'asap', 'immediately', 'critical', 'life', 'death', 'legal notice', 'court', 'fraud', 'stolen', 'hack'],
  high: ['important', 'soon', 'quickly', 'frustrated', 'angry', 'unacceptable', 'escalate', 'manager', 'supervisor', 'complaint'],
  medium: ['help', 'need', 'want', 'please', 'request', 'issue', 'problem'],
  low: ['question', 'curious', 'wondering', 'information', 'general', 'when you can']
}

// Sentiment keywords
const SENTIMENT_KEYWORDS = {
  very_negative: ['worst', 'terrible', 'horrible', 'disgusting', 'scam', 'fraud', 'cheat', 'legal action', 'sue', 'police'],
  negative: ['bad', 'poor', 'disappointed', 'frustrated', 'angry', 'upset', 'unhappy', 'waste', 'useless'],
  positive: ['good', 'nice', 'helpful', 'thank', 'appreciate', 'great', 'excellent', 'happy'],
  very_positive: ['amazing', 'wonderful', 'fantastic', 'best', 'love', 'outstanding', 'brilliant', 'perfect']
}

/**
 * Classify a ticket based on subject and description
 */
export async function classifyTicket(
  subject: string,
  description: string
): Promise<ClassificationResult> {
  const text = `${subject} ${description}`.toLowerCase()
  const words = text.split(/\s+/)

  // Category classification
  let bestCategory = 'general_inquiry'
  let bestCategoryScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.split(' ').length // Multi-word matches score higher
      }
    }
    if (score > bestCategoryScore) {
      bestCategoryScore = score
      bestCategory = category
    }
  }

  // Priority classification
  let bestPriority = 'medium'
  let bestPriorityScore = 0

  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1
      }
    }
    if (score > bestPriorityScore) {
      bestPriorityScore = score
      bestPriority = priority
    }
  }

  // Extract suggested tags
  const suggestedTags: string[] = []
  const tagPatterns = [
    { pattern: /loan\s*id[:\s]*([A-Z0-9]+)/i, tag: 'has_loan_id' },
    { pattern: /application[:\s]*([A-Z0-9]+)/i, tag: 'has_application_id' },
    { pattern: /\d{10}/, tag: 'has_phone' },
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, tag: 'has_email' },
    { pattern: /pan[:\s]*[A-Z]{5}\d{4}[A-Z]/i, tag: 'has_pan' },
    { pattern: /aadhaar|aadhar/i, tag: 'mentions_aadhaar' }
  ]

  for (const { pattern, tag } of tagPatterns) {
    if (pattern.test(text)) {
      suggestedTags.push(tag)
    }
  }

  // Add category as tag
  suggestedTags.push(bestCategory)

  // Detect language (simple detection)
  const hindiPattern = /[\u0900-\u097F]/
  const language = hindiPattern.test(text) ? 'hi' : 'en'

  return {
    category: bestCategory,
    category_confidence: Math.min(0.95, 0.5 + bestCategoryScore * 0.1),
    priority: bestPriority,
    priority_confidence: Math.min(0.95, 0.5 + bestPriorityScore * 0.15),
    suggested_tags: suggestedTags,
    language
  }
}

/**
 * Analyze sentiment of text
 */
export function analyzeSentiment(text: string): SentimentResult {
  const lowerText = text.toLowerCase()
  const words = lowerText.split(/\s+/)

  let sentimentScore = 0
  const matchedKeywords: string[] = []

  // Check sentiment keywords
  for (const keyword of SENTIMENT_KEYWORDS.very_negative) {
    if (lowerText.includes(keyword)) {
      sentimentScore -= 2
      matchedKeywords.push(keyword)
    }
  }
  for (const keyword of SENTIMENT_KEYWORDS.negative) {
    if (lowerText.includes(keyword)) {
      sentimentScore -= 1
      matchedKeywords.push(keyword)
    }
  }
  for (const keyword of SENTIMENT_KEYWORDS.positive) {
    if (lowerText.includes(keyword)) {
      sentimentScore += 1
      matchedKeywords.push(keyword)
    }
  }
  for (const keyword of SENTIMENT_KEYWORDS.very_positive) {
    if (lowerText.includes(keyword)) {
      sentimentScore += 2
      matchedKeywords.push(keyword)
    }
  }

  // Determine sentiment category
  let score: SentimentScore
  if (sentimentScore <= -3) score = 'very_negative'
  else if (sentimentScore < 0) score = 'negative'
  else if (sentimentScore === 0) score = 'neutral'
  else if (sentimentScore <= 2) score = 'positive'
  else score = 'very_positive'

  // Calculate emotion scores
  const frustrationKeywords = ['frustrated', 'angry', 'upset', 'annoyed', 'irritated', 'fed up']
  const confusionKeywords = ['confused', 'dont understand', 'unclear', 'what', 'how', 'why']
  const urgencyKeywords = ['urgent', 'asap', 'immediately', 'now', 'quickly', 'fast']

  const frustration = frustrationKeywords.filter(k => lowerText.includes(k)).length / frustrationKeywords.length
  const confusion = confusionKeywords.filter(k => lowerText.includes(k)).length / confusionKeywords.length
  const urgency = urgencyKeywords.filter(k => lowerText.includes(k)).length / urgencyKeywords.length
  const satisfaction = score === 'positive' || score === 'very_positive' ? 0.7 : 0.2

  return {
    score,
    confidence: Math.min(0.95, 0.5 + matchedKeywords.length * 0.1),
    emotions: {
      frustration: Math.min(1, frustration * 2),
      satisfaction,
      confusion: Math.min(1, confusion * 2),
      urgency: Math.min(1, urgency * 2)
    },
    keywords: matchedKeywords.slice(0, 10)
  }
}

/**
 * Get response suggestions for a ticket
 */
export async function getResponseSuggestions(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  subject: string,
  description: string,
  category: string
): Promise<ResponseSuggestion[]> {
  const supabase = await createClient()
  const suggestions: ResponseSuggestion[] = []
  const text = `${subject} ${description}`.toLowerCase()

  // Get canned responses matching category
  const { data: cannedResponses } = await supabase
    .from('canned_responses')
    .select('*')
    .eq('is_active', true)
    .order('usage_count', { ascending: false })

  if (cannedResponses) {
    for (const response of cannedResponses) {
      // Calculate relevance score
      let relevance = 0

      // Check category match
      if (response.category === category) {
        relevance += 0.3
      }

      // Check tag overlap
      const tags = response.tags || []
      for (const tag of tags) {
        if (text.includes(tag.toLowerCase())) {
          relevance += 0.1
        }
      }

      // Check content keyword match
      const contentWords = response.content.toLowerCase().split(/\s+/)
      const textWords = new Set(text.split(/\s+/))
      const overlap = contentWords.filter(w => textWords.has(w)).length
      relevance += Math.min(0.3, overlap * 0.02)

      if (relevance > 0.2) {
        suggestions.push({
          id: response.id,
          type: 'canned',
          content: response.content,
          confidence: Math.min(0.95, relevance + 0.3),
          source: response.name
        })
      }
    }
  }

  // Get relevant KB articles
  const { data: articles } = await supabase
    .from('kb_articles')
    .select('id, title, excerpt, content')
    .eq('status', 'published')
    .or(`visibility.eq.public,visibility.eq.internal`)

  if (articles) {
    for (const article of articles) {
      const articleText = `${article.title} ${article.excerpt || ''} ${article.content}`.toLowerCase()

      // Calculate relevance
      const textWords = text.split(/\s+/).filter(w => w.length > 3)
      const matches = textWords.filter(w => articleText.includes(w)).length

      if (matches >= 2) {
        const relevance = Math.min(0.9, matches * 0.1)
        suggestions.push({
          id: `article_${article.id}`,
          type: 'article',
          content: article.excerpt || article.title,
          confidence: relevance,
          source: article.title,
          article_id: article.id
        })
      }
    }
  }

  // Sort by confidence and return top suggestions
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}

/**
 * Find similar tickets
 */
export async function findSimilarTickets(
  subject: string,
  description: string,
  category: string,
  excludeTicketId?: string
): Promise<SimilarTicket[]> {
  const supabase = await createClient()
  const similarTickets: SimilarTicket[] = []
  const text = `${subject} ${description}`.toLowerCase()
  const textWords = new Set(text.split(/\s+/).filter(w => w.length > 3))

  // Search in all ticket tables
  const sources: ('EMPLOYEE' | 'CUSTOMER' | 'PARTNER')[] = ['EMPLOYEE', 'CUSTOMER', 'PARTNER']

  for (const source of sources) {
    const tableName = source === 'EMPLOYEE' ? 'employee_support_tickets' :
                      source === 'CUSTOMER' ? 'customer_support_tickets' :
                      'partner_support_tickets'

    const { data: tickets } = await supabase
      .from(tableName)
      .select('id, ticket_number, subject, description, status, resolution_notes, category')
      .eq('category', category)
      .in('status', ['resolved', 'closed'])
      .neq('id', excludeTicketId || '')
      .limit(50)

    if (tickets) {
      for (const ticket of tickets) {
        const ticketText = `${ticket.subject} ${ticket.description || ''}`.toLowerCase()
        const ticketWords = ticketText.split(/\s+/).filter(w => w.length > 3)

        // Calculate Jaccard similarity
        const intersection = ticketWords.filter(w => textWords.has(w)).length
        const union = new Set([...textWords, ...ticketWords]).size
        const similarity = union > 0 ? intersection / union : 0

        if (similarity > 0.15) {
          similarTickets.push({
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            similarity_score: similarity,
            status: ticket.status,
            resolution: ticket.resolution_notes,
            source
          })
        }
      }
    }
  }

  return similarTickets
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 5)
}

/**
 * Get comprehensive ticket insights
 */
export async function getTicketInsights(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  subject: string,
  description: string
): Promise<TicketInsights> {
  // Classify ticket
  const classification = await classifyTicket(subject, description)

  // Analyze sentiment
  const sentiment = analyzeSentiment(`${subject} ${description}`)

  // Get response suggestions
  const suggested_responses = await getResponseSuggestions(
    ticketId,
    ticketSource,
    subject,
    description,
    classification.category
  )

  // Find similar tickets
  const similar_tickets = await findSimilarTickets(
    subject,
    description,
    classification.category,
    ticketId
  )

  // Get recommended articles
  const supabase = await createClient()
  const { data: articles } = await supabase
    .from('kb_articles')
    .select('id, title')
    .eq('status', 'published')
    .eq('category_id', classification.category)
    .limit(3)

  const recommended_articles = (articles || []).map(a => ({
    id: a.id,
    title: a.title,
    relevance: 0.7
  }))

  // Detect urgency indicators
  const urgency_indicators: string[] = []
  const text = `${subject} ${description}`.toLowerCase()

  if (text.includes('legal') || text.includes('court') || text.includes('notice')) {
    urgency_indicators.push('Legal/compliance mention detected')
  }
  if (text.includes('fraud') || text.includes('scam') || text.includes('hack')) {
    urgency_indicators.push('Security concern detected')
  }
  if (sentiment.emotions.frustration > 0.7) {
    urgency_indicators.push('High customer frustration')
  }
  if (sentiment.emotions.urgency > 0.5) {
    urgency_indicators.push('Customer expressing urgency')
  }
  if (classification.priority === 'urgent') {
    urgency_indicators.push('Urgent priority keywords detected')
  }

  // Detect risk factors
  const risk_factors: string[] = []
  if (sentiment.score === 'very_negative') {
    risk_factors.push('High churn risk - Very negative sentiment')
  }
  if (text.includes('cancel') || text.includes('close account')) {
    risk_factors.push('Customer considering leaving')
  }
  if (text.includes('competitor') || text.includes('switch')) {
    risk_factors.push('Competitor mention detected')
  }
  if (text.includes('social media') || text.includes('twitter') || text.includes('facebook')) {
    risk_factors.push('Social media escalation risk')
  }

  // Estimate resolution time based on similar tickets
  let estimated_resolution_time_hours = 8 // Default

  if (similar_tickets.length > 0) {
    // This would ideally look at actual resolution times of similar tickets
    switch (classification.priority) {
      case 'urgent': estimated_resolution_time_hours = 2; break
      case 'high': estimated_resolution_time_hours = 4; break
      case 'medium': estimated_resolution_time_hours = 8; break
      case 'low': estimated_resolution_time_hours = 24; break
    }
  }

  return {
    classification,
    sentiment,
    urgency_indicators,
    suggested_responses,
    similar_tickets,
    recommended_articles,
    estimated_resolution_time_hours,
    risk_factors
  }
}

/**
 * Auto-tag a ticket based on content
 */
export async function autoTagTicket(
  subject: string,
  description: string
): Promise<string[]> {
  const text = `${subject} ${description}`.toLowerCase()
  const tags: string[] = []

  // Check for specific patterns
  const patterns: { pattern: RegExp; tag: string }[] = [
    { pattern: /loan\s*id|application\s*id|ref/i, tag: 'has_reference' },
    { pattern: /screenshot|attached|attachment/i, tag: 'has_attachment' },
    { pattern: /call\s*back|callback/i, tag: 'callback_requested' },
    { pattern: /refund|reversal/i, tag: 'refund_request' },
    { pattern: /not\s*working|error|bug|issue/i, tag: 'technical' },
    { pattern: /emi|payment|due/i, tag: 'payment_related' },
    { pattern: /document|kyc|verification/i, tag: 'documentation' },
    { pattern: /urgent|asap|immediately/i, tag: 'urgent' },
    { pattern: /feedback|suggestion/i, tag: 'feedback' },
    { pattern: /complaint|unhappy|disappointed/i, tag: 'complaint' }
  ]

  for (const { pattern, tag } of patterns) {
    if (pattern.test(text)) {
      tags.push(tag)
    }
  }

  return [...new Set(tags)]
}

/**
 * Detect trends in tickets
 */
export async function detectTrends(
  days: number = 7
): Promise<{
  rising_categories: { category: string; growth_rate: number }[]
  common_keywords: { keyword: string; count: number }[]
  sentiment_trend: { date: string; avg_sentiment: number }[]
  volume_trend: { date: string; count: number }[]
}> {
  const supabase = await createClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const rising_categories: { category: string; growth_rate: number }[] = []
  const keywordCounts: Record<string, number> = {}
  const sentimentByDate: Record<string, { total: number; count: number }> = {}
  const volumeByDate: Record<string, number> = {}

  const sources = ['employee_support_tickets', 'customer_support_tickets', 'partner_support_tickets']

  for (const tableName of sources) {
    const { data: tickets } = await supabase
      .from(tableName)
      .select('subject, description, category, created_at')
      .gte('created_at', startDate.toISOString())

    if (tickets) {
      for (const ticket of tickets) {
        const date = ticket.created_at.split('T')[0]

        // Volume tracking
        volumeByDate[date] = (volumeByDate[date] || 0) + 1

        // Keyword extraction
        const text = `${ticket.subject} ${ticket.description || ''}`.toLowerCase()
        const words = text.split(/\s+/).filter(w => w.length > 4)
        for (const word of words) {
          keywordCounts[word] = (keywordCounts[word] || 0) + 1
        }

        // Sentiment tracking
        const sentiment = analyzeSentiment(text)
        const sentimentValue = sentiment.score === 'very_negative' ? -2 :
                              sentiment.score === 'negative' ? -1 :
                              sentiment.score === 'neutral' ? 0 :
                              sentiment.score === 'positive' ? 1 : 2

        if (!sentimentByDate[date]) {
          sentimentByDate[date] = { total: 0, count: 0 }
        }
        sentimentByDate[date].total += sentimentValue
        sentimentByDate[date].count += 1
      }
    }
  }

  // Format results
  const common_keywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }))

  const sentiment_trend = Object.entries(sentimentByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, { total, count }]) => ({
      date,
      avg_sentiment: count > 0 ? total / count : 0
    }))

  const volume_trend = Object.entries(volumeByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  return {
    rising_categories,
    common_keywords,
    sentiment_trend,
    volume_trend
  }
}

export default {
  classifyTicket,
  analyzeSentiment,
  getResponseSuggestions,
  findSimilarTickets,
  getTicketInsights,
  autoTagTicket,
  detectTrends
}
