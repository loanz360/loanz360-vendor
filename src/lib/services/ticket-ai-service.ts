import { createClient } from '@supabase/supabase-js'

// ============================================================================
// AI-POWERED TICKET SERVICE
// Enterprise AI features for ticket management
// Phase 4: Fortune 500 Features
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// TYPES
// ============================================================================

export interface TicketClassification {
  category: string
  subcategory?: string
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical'
  department: string
  confidence: number
  suggestedTags: string[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated'
  urgencyIndicators: string[]
}

export interface SuggestedResponse {
  id: string
  content: string
  relevanceScore: number
  source: 'template' | 'knowledge_base' | 'similar_ticket' | 'ai_generated'
  metadata?: {
    templateId?: string
    articleId?: string
    similarTicketId?: string
  }
}

export interface TicketSummary {
  summary: string
  keyPoints: string[]
  actionItems: string[]
  customerSentiment: string
  resolutionStatus: string
}

export interface SimilarTicket {
  id: string
  ticket_number: string
  subject: string
  similarity_score: number
  resolution?: string
  resolved_at?: string
}

export interface AgentSuggestion {
  type: 'escalate' | 'transfer' | 'close' | 'request_info' | 'apply_template'
  reason: string
  confidence: number
  action?: {
    department?: string
    template_id?: string
    status?: string
  }
}

// ============================================================================
// AI SERVICE CLASS
// ============================================================================

export class TicketAIService {
  private embeddingsCache: Map<string, number[]> = new Map()
  private classificationCache: Map<string, TicketClassification> = new Map()

  // ============================================================================
  // TICKET CLASSIFICATION
  // ============================================================================

  /**
   * Classify a ticket based on its content
   */
  async classifyTicket(
    subject: string,
    description: string,
    ticketSource: 'employee' | 'customer' | 'partner'
  ): Promise<TicketClassification> {
    const cacheKey = `${subject}:${description.substring(0, 100)}`

    if (this.classificationCache.has(cacheKey)) {
      return this.classificationCache.get(cacheKey)!
    }

    const content = `${subject}\n\n${description}`.toLowerCase()

    // Rule-based classification with keyword matching
    const classification = this.performRuleBasedClassification(content, ticketSource)

    // Detect sentiment
    classification.sentiment = this.detectSentiment(content)

    // Detect urgency indicators
    classification.urgencyIndicators = this.detectUrgencyIndicators(content)

    // Adjust priority based on sentiment and urgency
    classification.priority = this.adjustPriority(
      classification.priority,
      classification.sentiment,
      classification.urgencyIndicators
    )

    // Cache the result
    this.classificationCache.set(cacheKey, classification)

    return classification
  }

  /**
   * Rule-based classification using keywords
   */
  private performRuleBasedClassification(
    content: string,
    ticketSource: 'employee' | 'customer' | 'partner'
  ): TicketClassification {
    // Category detection rules
    const categoryRules: Record<string, { keywords: string[]; department: string; basePriority: string }> = {
      // Employee categories
      payroll: {
        keywords: ['salary', 'payroll', 'payment', 'wage', 'overtime', 'deduction', 'payslip', 'compensation'],
        department: 'finance',
        basePriority: 'high'
      },
      leave: {
        keywords: ['leave', 'vacation', 'holiday', 'time off', 'pto', 'sick leave', 'maternity', 'paternity'],
        department: 'hr',
        basePriority: 'medium'
      },
      benefits: {
        keywords: ['insurance', 'benefit', 'medical', 'health', 'dental', 'retirement', '401k', 'pension'],
        department: 'hr',
        basePriority: 'medium'
      },
      it_support: {
        keywords: ['login', 'password', 'access', 'computer', 'laptop', 'software', 'system', 'error', 'bug', 'crash'],
        department: 'it',
        basePriority: 'high'
      },
      hr: {
        keywords: ['hr', 'human resource', 'policy', 'harassment', 'complaint', 'grievance', 'performance', 'review'],
        department: 'hr',
        basePriority: 'medium'
      },
      // Customer categories
      loan: {
        keywords: ['loan', 'emi', 'interest', 'disbursement', 'sanction', 'processing', 'application', 'approval'],
        department: 'operations',
        basePriority: 'high'
      },
      billing: {
        keywords: ['bill', 'invoice', 'charge', 'payment', 'receipt', 'transaction', 'refund'],
        department: 'finance',
        basePriority: 'high'
      },
      account: {
        keywords: ['account', 'profile', 'kyc', 'document', 'verify', 'update', 'details'],
        department: 'customer_service',
        basePriority: 'medium'
      },
      complaint: {
        keywords: ['complaint', 'issue', 'problem', 'unhappy', 'dissatisfied', 'poor service', 'escalate'],
        department: 'customer_service',
        basePriority: 'urgent'
      },
      // Partner categories
      commission: {
        keywords: ['commission', 'payout', 'earning', 'incentive', 'bonus', 'payment'],
        department: 'finance',
        basePriority: 'high'
      },
      onboarding: {
        keywords: ['onboard', 'registration', 'activation', 'setup', 'getting started', 'new partner'],
        department: 'partner_success',
        basePriority: 'high'
      },
      training: {
        keywords: ['training', 'learn', 'course', 'certification', 'webinar', 'workshop'],
        department: 'partner_success',
        basePriority: 'low'
      },
      compliance: {
        keywords: ['compliance', 'regulation', 'audit', 'legal', 'policy', 'agreement', 'contract'],
        department: 'compliance',
        basePriority: 'high'
      }
    }

    let bestMatch = {
      category: 'general',
      department: this.getDefaultDepartment(ticketSource),
      score: 0,
      priority: 'medium' as const
    }

    for (const [category, rules] of Object.entries(categoryRules)) {
      const matchCount = rules.keywords.filter(kw => content.includes(kw)).length
      const score = matchCount / rules.keywords.length

      if (score > bestMatch.score) {
        bestMatch = {
          category,
          department: rules.department,
          score,
          priority: rules.basePriority as any
        }
      }
    }

    // Extract tags from content
    const suggestedTags = this.extractTags(content)

    return {
      category: bestMatch.category,
      priority: bestMatch.priority,
      department: bestMatch.department,
      confidence: Math.min(bestMatch.score * 1.5, 0.95),
      suggestedTags,
      sentiment: 'neutral',
      urgencyIndicators: []
    }
  }

  /**
   * Detect sentiment from content
   */
  private detectSentiment(content: string): 'positive' | 'neutral' | 'negative' | 'frustrated' {
    const positiveWords = ['thank', 'appreciate', 'great', 'excellent', 'happy', 'satisfied', 'pleased', 'wonderful']
    const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'disappointed', 'unhappy', 'issue', 'problem']
    const frustratedWords = ['frustrated', 'angry', 'furious', 'unacceptable', 'ridiculous', 'worst', 'never', 'always fails']

    const positiveScore = positiveWords.filter(w => content.includes(w)).length
    const negativeScore = negativeWords.filter(w => content.includes(w)).length
    const frustratedScore = frustratedWords.filter(w => content.includes(w)).length

    if (frustratedScore >= 2) return 'frustrated'
    if (negativeScore > positiveScore + 1) return 'negative'
    if (positiveScore > negativeScore + 1) return 'positive'
    return 'neutral'
  }

  /**
   * Detect urgency indicators
   */
  private detectUrgencyIndicators(content: string): string[] {
    const urgencyPatterns = [
      { pattern: /urgent|asap|immediately|emergency/i, indicator: 'Urgency keywords detected' },
      { pattern: /deadline|due date|by today|by tomorrow/i, indicator: 'Time-sensitive deadline mentioned' },
      { pattern: /blocked|cannot work|unable to|stuck/i, indicator: 'User blocked from working' },
      { pattern: /customer waiting|client waiting|customer complaint/i, indicator: 'External stakeholder impacted' },
      { pattern: /production|live system|critical system/i, indicator: 'Production system affected' },
      { pattern: /data loss|security|breach|hack/i, indicator: 'Security/data concern' },
      { pattern: /legal|compliance|regulatory|audit/i, indicator: 'Legal/compliance matter' },
      { pattern: /executive|ceo|cfo|management/i, indicator: 'Executive involvement' }
    ]

    return urgencyPatterns
      .filter(p => p.pattern.test(content))
      .map(p => p.indicator)
  }

  /**
   * Adjust priority based on sentiment and urgency
   */
  private adjustPriority(
    basePriority: string,
    sentiment: string,
    urgencyIndicators: string[]
  ): 'low' | 'medium' | 'high' | 'urgent' | 'critical' {
    const priorityLevels = ['low', 'medium', 'high', 'urgent', 'critical']
    let currentIndex = priorityLevels.indexOf(basePriority)

    // Increase priority for frustrated sentiment
    if (sentiment === 'frustrated') currentIndex = Math.min(currentIndex + 2, 4)
    else if (sentiment === 'negative') currentIndex = Math.min(currentIndex + 1, 4)

    // Increase priority based on urgency indicators
    if (urgencyIndicators.length >= 3) currentIndex = Math.min(currentIndex + 2, 4)
    else if (urgencyIndicators.length >= 1) currentIndex = Math.min(currentIndex + 1, 4)

    return priorityLevels[currentIndex] as any
  }

  /**
   * Extract relevant tags from content
   */
  private extractTags(content: string): string[] {
    const tagPatterns = [
      { pattern: /login|password|authentication/i, tag: 'access-issue' },
      { pattern: /slow|performance|timeout/i, tag: 'performance' },
      { pattern: /error|bug|crash/i, tag: 'technical-issue' },
      { pattern: /refund|reversal/i, tag: 'refund' },
      { pattern: /urgent|asap/i, tag: 'urgent' },
      { pattern: /escalat/i, tag: 'escalation' },
      { pattern: /new feature|enhancement|suggestion/i, tag: 'feature-request' },
      { pattern: /documentation|guide|how to/i, tag: 'documentation' }
    ]

    return [...new Set(
      tagPatterns
        .filter(p => p.pattern.test(content))
        .map(p => p.tag)
    )]
  }

  /**
   * Get default department for ticket source
   */
  private getDefaultDepartment(ticketSource: 'employee' | 'customer' | 'partner'): string {
    switch (ticketSource) {
      case 'employee': return 'hr'
      case 'customer': return 'customer_service'
      case 'partner': return 'partner_success'
      default: return 'operations'
    }
  }

  // ============================================================================
  // RESPONSE SUGGESTIONS
  // ============================================================================

  /**
   * Get suggested responses for a ticket
   */
  async getSuggestedResponses(
    ticketId: string,
    ticketSource: 'employee' | 'customer' | 'partner',
    category: string,
    subject: string,
    latestMessage?: string
  ): Promise<SuggestedResponse[]> {
    const suggestions: SuggestedResponse[] = []

    // 1. Get matching canned responses
    const cannedResponses = await this.getMatchingCannedResponses(category, subject, ticketSource)
    suggestions.push(...cannedResponses)

    // 2. Get similar resolved tickets
    const similarTickets = await this.findSimilarResolvedTickets(subject, ticketSource)
    for (const ticket of similarTickets.slice(0, 2)) {
      if (ticket.resolution) {
        suggestions.push({
          id: `similar-${ticket.id}`,
          content: ticket.resolution,
          relevanceScore: ticket.similarity_score,
          source: 'similar_ticket',
          metadata: { similarTicketId: ticket.id }
        })
      }
    }

    // 3. Generate AI response if needed
    if (suggestions.length < 3 && latestMessage) {
      const aiResponse = this.generateContextualResponse(category, latestMessage)
      if (aiResponse) {
        suggestions.push({
          id: 'ai-generated',
          content: aiResponse,
          relevanceScore: 0.7,
          source: 'ai_generated'
        })
      }
    }

    // Sort by relevance and return top suggestions
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5)
  }

  /**
   * Get matching canned responses
   */
  private async getMatchingCannedResponses(
    category: string,
    subject: string,
    ticketSource: string
  ): Promise<SuggestedResponse[]> {
    try {
      const { data: responses } = await supabase
        .from('canned_responses')
        .select('*')
        .or(`category.eq.${category},category.is.null`)
        .eq('is_active', true)
        .limit(5)

      if (!responses?.length) return []

      return responses.map(r => ({
        id: `canned-${r.id}`,
        content: r.content,
        relevanceScore: r.category === category ? 0.9 : 0.6,
        source: 'template' as const,
        metadata: { templateId: r.id }
      }))
    } catch {
      return []
    }
  }

  /**
   * Generate contextual response based on category
   */
  private generateContextualResponse(category: string, message: string): string | null {
    const templates: Record<string, string> = {
      payroll: `Thank you for reaching out about your payroll concern. I understand how important timely and accurate payments are. Let me look into this for you right away.\n\nCould you please provide:\n1. The specific pay period in question\n2. The discrepancy amount (if applicable)\n3. Your employee ID\n\nI'll work to resolve this as quickly as possible.`,

      it_support: `Thank you for reporting this technical issue. I'll help you resolve this as quickly as possible.\n\nTo better assist you, please provide:\n1. The exact error message (if any)\n2. Steps to reproduce the issue\n3. Your browser/device information\n\nIn the meantime, you can try:\n- Clearing your browser cache\n- Using an incognito/private window\n- Trying a different browser`,

      loan: `Thank you for contacting us about your loan. I understand the importance of this matter and will assist you promptly.\n\nTo help you better, please confirm:\n1. Your loan application/account number\n2. The specific concern or question\n\nI'm here to ensure your loan process goes smoothly.`,

      billing: `Thank you for reaching out regarding your billing concern. I apologize for any inconvenience this may have caused.\n\nTo investigate this matter, please provide:\n1. Transaction reference number\n2. Date of the transaction\n3. Amount in question\n\nI'll review this and get back to you with a resolution.`,

      complaint: `I sincerely apologize for the experience you've had. Your feedback is extremely valuable to us, and I want to assure you that we take this matter seriously.\n\nI'm personally looking into this issue and will ensure it receives the attention it deserves. Could you please provide any additional details that might help us understand and resolve this situation?\n\nThank you for bringing this to our attention.`,

      commission: `Thank you for reaching out about your commission. I understand the importance of timely and accurate payouts.\n\nTo assist you, please provide:\n1. The period in question\n2. Expected vs received amount\n3. Any specific transactions you're inquiring about\n\nI'll review your account and provide a detailed breakdown.`
    }

    return templates[category] || null
  }

  // ============================================================================
  // SIMILAR TICKET DETECTION
  // ============================================================================

  /**
   * Find similar resolved tickets
   */
  async findSimilarResolvedTickets(
    subject: string,
    ticketSource: 'employee' | 'customer' | 'partner',
    limit: number = 5
  ): Promise<SimilarTicket[]> {
    const tableName = ticketSource === 'employee'
      ? 'support_tickets'
      : ticketSource === 'customer'
      ? 'customer_support_tickets'
      : 'partner_support_tickets'

    try {
      // Simple keyword-based similarity search
      const keywords = subject.toLowerCase().split(' ')
        .filter(w => w.length > 3)
        .slice(0, 5)

      if (keywords.length === 0) return []

      const searchPattern = keywords.join(' | ')

      const { data: tickets } = await supabase
        .from(tableName)
        .select('id, ticket_number, subject, resolution_notes, resolved_at')
        .textSearch('subject', searchPattern)
        .in('status', ['resolved', 'closed'])
        .not('resolution_notes', 'is', null)
        .limit(limit)

      if (!tickets?.length) return []

      return tickets.map(t => ({
        id: t.id,
        ticket_number: t.ticket_number,
        subject: t.subject,
        similarity_score: this.calculateSimpleSimilarity(subject, t.subject),
        resolution: t.resolution_notes,
        resolved_at: t.resolved_at
      })).sort((a, b) => b.similarity_score - a.similarity_score)
    } catch {
      return []
    }
  }

  /**
   * Calculate simple text similarity
   */
  private calculateSimpleSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2))
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2))

    const intersection = [...words1].filter(w => words2.has(w)).length
    const union = new Set([...words1, ...words2]).size

    return union > 0 ? intersection / union : 0
  }

  // ============================================================================
  // TICKET SUMMARIZATION
  // ============================================================================

  /**
   * Generate ticket summary
   */
  async summarizeTicket(
    ticketId: string,
    ticketSource: 'employee' | 'customer' | 'partner'
  ): Promise<TicketSummary> {
    const tableName = ticketSource === 'employee'
      ? 'support_tickets'
      : ticketSource === 'customer'
      ? 'customer_support_tickets'
      : 'partner_support_tickets'

    const messageTable = ticketSource === 'employee'
      ? 'support_ticket_messages'
      : ticketSource === 'customer'
      ? 'customer_support_messages'
      : 'partner_support_messages'

    // Get ticket and messages
    const { data: ticket } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    const { data: messages } = await supabase
      .from(messageTable)
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at')

    if (!ticket) {
      return {
        summary: 'Unable to generate summary - ticket not found',
        keyPoints: [],
        actionItems: [],
        customerSentiment: 'unknown',
        resolutionStatus: 'unknown'
      }
    }

    // Extract key points from messages
    const keyPoints = this.extractKeyPoints(messages || [])

    // Extract action items
    const actionItems = this.extractActionItems(messages || [])

    // Determine overall sentiment
    const allContent = [ticket.description, ...((messages || []).map(m => m.content))].join(' ')
    const sentiment = this.detectSentiment(allContent.toLowerCase())

    // Determine resolution status
    const resolutionStatus = this.determineResolutionStatus(ticket, messages || [])

    // Generate summary
    const summary = this.generateSummary(ticket, messages || [], keyPoints)

    return {
      summary,
      keyPoints,
      actionItems,
      customerSentiment: sentiment,
      resolutionStatus
    }
  }

  /**
   * Extract key points from messages
   */
  private extractKeyPoints(messages: any[]): string[] {
    const keyPoints: string[] = []

    for (const msg of messages) {
      const content = msg.content || ''

      // Look for explicit questions
      const questions = content.match(/[^.!?]*\?/g)
      if (questions) {
        keyPoints.push(...questions.map((q: string) => q.trim()).slice(0, 2))
      }

      // Look for issue descriptions
      if (/issue|problem|error|not working/i.test(content)) {
        const sentences = content.split(/[.!]/).filter((s: string) =>
          /issue|problem|error|not working/i.test(s)
        )
        keyPoints.push(...sentences.slice(0, 1))
      }
    }

    return [...new Set(keyPoints)].slice(0, 5)
  }

  /**
   * Extract action items from messages
   */
  private extractActionItems(messages: any[]): string[] {
    const actionItems: string[] = []

    for (const msg of messages) {
      if (msg.sender_type === 'support' || msg.sender_type === 'agent') {
        const content = msg.content || ''

        // Look for action-oriented language
        const actionPatterns = [
          /please ([\w\s]+)/gi,
          /you (need to|should|must|can) ([\w\s]+)/gi,
          /we will ([\w\s]+)/gi,
          /i('ll| will) ([\w\s]+)/gi
        ]

        for (const pattern of actionPatterns) {
          const matches = content.match(pattern)
          if (matches) {
            actionItems.push(...matches.slice(0, 2))
          }
        }
      }
    }

    return [...new Set(actionItems)].slice(0, 5)
  }

  /**
   * Determine resolution status
   */
  private determineResolutionStatus(ticket: any, messages: any[]): string {
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return ticket.resolution_notes ? 'Resolved with notes' : 'Resolved'
    }

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) return 'Awaiting response'

    if (lastMessage.sender_type === 'customer' || lastMessage.sender_type === 'employee') {
      return 'Customer response pending review'
    }

    return 'Awaiting customer response'
  }

  /**
   * Generate summary text
   */
  private generateSummary(ticket: any, messages: any[], keyPoints: string[]): string {
    const messageCount = messages.length
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    let summary = `Ticket ${ticket.ticket_number} regarding "${ticket.subject}" was created ${daysSinceCreation} day(s) ago. `
    summary += `Current status: ${ticket.status.replace(/_/g, ' ')}. `
    summary += `${messageCount} message(s) exchanged. `

    if (keyPoints.length > 0) {
      summary += `Main concern: ${keyPoints[0]}`
    }

    return summary
  }

  // ============================================================================
  // AGENT SUGGESTIONS
  // ============================================================================

  /**
   * Get AI suggestions for agent actions
   */
  async getAgentSuggestions(
    ticketId: string,
    ticketSource: 'employee' | 'customer' | 'partner'
  ): Promise<AgentSuggestion[]> {
    const summary = await this.summarizeTicket(ticketId, ticketSource)
    const suggestions: AgentSuggestion[] = []

    // Check if escalation is needed
    if (summary.customerSentiment === 'frustrated') {
      suggestions.push({
        type: 'escalate',
        reason: 'Customer appears frustrated - consider escalation',
        confidence: 0.8,
        action: { department: 'management' }
      })
    }

    // Check if more info is needed
    if (summary.keyPoints.some(p => p.includes('?'))) {
      suggestions.push({
        type: 'request_info',
        reason: 'Pending questions from customer need to be addressed',
        confidence: 0.9
      })
    }

    // Check if ticket can be closed
    if (summary.resolutionStatus.includes('Resolved')) {
      suggestions.push({
        type: 'close',
        reason: 'Ticket appears to be resolved - consider closing',
        confidence: 0.85,
        action: { status: 'closed' }
      })
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

let ticketAIService: TicketAIService | null = null

export function getTicketAIService(): TicketAIService {
  if (!ticketAIService) {
    ticketAIService = new TicketAIService()
  }
  return ticketAIService
}

// Helper functions
export async function classifyTicket(
  subject: string,
  description: string,
  ticketSource: 'employee' | 'customer' | 'partner'
) {
  return getTicketAIService().classifyTicket(subject, description, ticketSource)
}

export async function getSuggestedResponses(
  ticketId: string,
  ticketSource: 'employee' | 'customer' | 'partner',
  category: string,
  subject: string,
  latestMessage?: string
) {
  return getTicketAIService().getSuggestedResponses(
    ticketId, ticketSource, category, subject, latestMessage
  )
}

export async function findSimilarTickets(
  subject: string,
  ticketSource: 'employee' | 'customer' | 'partner'
) {
  return getTicketAIService().findSimilarResolvedTickets(subject, ticketSource)
}

export async function summarizeTicket(
  ticketId: string,
  ticketSource: 'employee' | 'customer' | 'partner'
) {
  return getTicketAIService().summarizeTicket(ticketId, ticketSource)
}

export async function getAgentSuggestions(
  ticketId: string,
  ticketSource: 'employee' | 'customer' | 'partner'
) {
  return getTicketAIService().getAgentSuggestions(ticketId, ticketSource)
}
