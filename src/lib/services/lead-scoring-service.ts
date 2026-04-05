import { createClient } from '@/lib/supabase/server'

/**
 * Lead Scoring Service
 * Rule-based lead scoring with configurable conditions
 * Automatically classifies leads by quality (hot, warm, cold)
 */

interface ScoringRule {
  id: string
  name: string
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'exists' | 'not_exists'
  value: string | number | string[]
  score: number
  is_active: boolean
}

interface ScoringResult {
  totalScore: number
  quality: 'hot' | 'warm' | 'cold'
  appliedRules: {
    ruleId: string
    ruleName: string
    score: number
    matched: boolean
  }[]
}

interface LeadData {
  id: string
  name?: string
  email?: string
  phone?: string
  location?: string
  loan_type?: string
  loan_amount?: number
  employment_type?: string
  monthly_income?: number
  collected_data?: Record<string, unknown>
  source?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

// Default scoring rules
const DEFAULT_RULES: ScoringRule[] = [
  // Contact info completeness
  { id: 'email_provided', name: 'Email Provided', field: 'email', operator: 'exists', value: '', score: 10, is_active: true },
  { id: 'phone_provided', name: 'Phone Provided', field: 'phone', operator: 'exists', value: '', score: 15, is_active: true },
  { id: 'name_provided', name: 'Name Provided', field: 'name', operator: 'exists', value: '', score: 5, is_active: true },

  // Loan amount scoring
  { id: 'high_loan_amount', name: 'High Loan Amount (>50L)', field: 'loan_amount', operator: 'greater_than', value: 5000000, score: 20, is_active: true },
  { id: 'medium_loan_amount', name: 'Medium Loan Amount (10-50L)', field: 'loan_amount', operator: 'greater_than', value: 1000000, score: 10, is_active: true },

  // Employment type scoring
  { id: 'salaried', name: 'Salaried Employee', field: 'employment_type', operator: 'equals', value: 'salaried', score: 15, is_active: true },
  { id: 'business_owner', name: 'Business Owner', field: 'employment_type', operator: 'equals', value: 'business', score: 12, is_active: true },
  { id: 'self_employed', name: 'Self Employed Professional', field: 'employment_type', operator: 'equals', value: 'self_employed', score: 10, is_active: true },

  // Income scoring
  { id: 'high_income', name: 'High Income (>1L/month)', field: 'monthly_income', operator: 'greater_than', value: 100000, score: 20, is_active: true },
  { id: 'medium_income', name: 'Medium Income (50K-1L/month)', field: 'monthly_income', operator: 'greater_than', value: 50000, score: 10, is_active: true },

  // Source scoring
  { id: 'google_ads', name: 'Google Ads Lead', field: 'utm_source', operator: 'equals', value: 'google', score: 15, is_active: true },
  { id: 'referral', name: 'Referral Lead', field: 'source', operator: 'equals', value: 'referral', score: 20, is_active: true },
  { id: 'organic', name: 'Organic Lead', field: 'utm_medium', operator: 'equals', value: 'organic', score: 12, is_active: true },

  // Loan type scoring
  { id: 'home_loan', name: 'Home Loan Interest', field: 'loan_type', operator: 'equals', value: 'home_loan', score: 15, is_active: true },
  { id: 'lap_loan', name: 'LAP Interest', field: 'loan_type', operator: 'equals', value: 'lap', score: 18, is_active: true },
  { id: 'business_loan', name: 'Business Loan Interest', field: 'loan_type', operator: 'equals', value: 'business_loan', score: 12, is_active: true },
]

// Quality thresholds
const QUALITY_THRESHOLDS = {
  hot: 60,  // Score >= 60 = hot lead
  warm: 30, // Score >= 30 = warm lead
  cold: 0   // Score < 30 = cold lead
}

export class LeadScoringService {
  /**
   * Get scoring rules for a chatbot
   */
  static async getRules(chatbotId?: string): Promise<ScoringRule[]> {
    try {
      const supabase = await createClient()

      if (chatbotId) {
        const { data: customRules } = await supabase
          .from('lead_scoring_rules')
          .select('*')
          .eq('chatbot_id', chatbotId)
          .eq('is_active', true)
          .order('score', { ascending: false })

        if (customRules && customRules.length > 0) {
          return customRules
        }
      }

      // Return default rules if no custom rules
      return DEFAULT_RULES.filter(r => r.is_active)
    } catch (error) {
      console.error('Error fetching scoring rules:', error)
      return DEFAULT_RULES.filter(r => r.is_active)
    }
  }

  /**
   * Evaluate a single rule against lead data
   */
  static evaluateRule(rule: ScoringRule, leadData: LeadData): boolean {
    // Get the field value from lead data or collected_data
    let fieldValue: unknown = leadData[rule.field as keyof LeadData]

    // Check in collected_data if not found in top level
    if (fieldValue === undefined && leadData.collected_data) {
      fieldValue = leadData.collected_data[rule.field]
    }

    switch (rule.operator) {
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== ''

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null || fieldValue === ''

      case 'equals':
        if (typeof fieldValue === 'string') {
          return fieldValue.toLowerCase() === String(rule.value).toLowerCase()
        }
        return fieldValue === rule.value

      case 'not_equals':
        if (typeof fieldValue === 'string') {
          return fieldValue.toLowerCase() !== String(rule.value).toLowerCase()
        }
        return fieldValue !== rule.value

      case 'contains':
        if (typeof fieldValue === 'string') {
          return fieldValue.toLowerCase().includes(String(rule.value).toLowerCase())
        }
        return false

      case 'not_contains':
        if (typeof fieldValue === 'string') {
          return !fieldValue.toLowerCase().includes(String(rule.value).toLowerCase())
        }
        return true

      case 'greater_than':
        const numValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue))
        const ruleNumValue = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value))
        return !isNaN(numValue) && !isNaN(ruleNumValue) && numValue > ruleNumValue

      case 'less_than':
        const numVal = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue))
        const ruleNumVal = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value))
        return !isNaN(numVal) && !isNaN(ruleNumVal) && numVal < ruleNumVal

      case 'in':
        if (Array.isArray(rule.value)) {
          const strValue = String(fieldValue).toLowerCase()
          return rule.value.some(v => String(v).toLowerCase() === strValue)
        }
        return false

      case 'not_in':
        if (Array.isArray(rule.value)) {
          const strValue = String(fieldValue).toLowerCase()
          return !rule.value.some(v => String(v).toLowerCase() === strValue)
        }
        return true

      default:
        return false
    }
  }

  /**
   * Determine quality classification based on score
   */
  static getQuality(score: number): 'hot' | 'warm' | 'cold' {
    if (score >= QUALITY_THRESHOLDS.hot) return 'hot'
    if (score >= QUALITY_THRESHOLDS.warm) return 'warm'
    return 'cold'
  }

  /**
   * Score a lead based on rules
   */
  static async scoreLead(
    leadData: LeadData,
    chatbotId?: string
  ): Promise<ScoringResult> {
    const rules = await this.getRules(chatbotId)
    const appliedRules: ScoringResult['appliedRules'] = []
    let totalScore = 0

    for (const rule of rules) {
      const matched = this.evaluateRule(rule, leadData)
      appliedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        score: rule.score,
        matched
      })

      if (matched) {
        totalScore += rule.score
      }
    }

    return {
      totalScore,
      quality: this.getQuality(totalScore),
      appliedRules
    }
  }

  /**
   * Score and update a lead in the database
   */
  static async scoreAndUpdateLead(
    leadId: string,
    chatbotId?: string
  ): Promise<{ success: boolean; result?: ScoringResult; error?: string }> {
    try {
      const supabase = await createClient()

      // Get lead data
      const { data: lead, error: leadError } = await supabase
        .from('online_leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle()

      if (leadError || !lead) {
        return { success: false, error: 'Lead not found' }
      }

      // Score the lead
      const result = await this.scoreLead(lead, chatbotId || lead.chatbot_id)

      // Update lead with score
      const { error: updateError } = await supabase
        .from('online_leads')
        .update({
          lead_score: result.totalScore,
          lead_quality: result.quality,
          scoring_details: result.appliedRules,
          scored_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (updateError) {
        console.error('Error updating lead score:', updateError)
        return { success: false, error: 'Failed to update lead score' }
      }

      return { success: true, result }
    } catch (error) {
      console.error('Lead scoring error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scoring failed'
      }
    }
  }

  /**
   * Batch score multiple leads
   */
  static async batchScoreLeads(
    leadIds: string[],
    chatbotId?: string
  ): Promise<{ success: boolean; scored: number; errors: string[] }> {
    const errors: string[] = []
    let scored = 0

    for (const leadId of leadIds) {
      const result = await this.scoreAndUpdateLead(leadId, chatbotId)
      if (result.success) {
        scored++
      } else {
        errors.push(`Lead ${leadId}: ${result.error}`)
      }
    }

    return {
      success: errors.length === 0,
      scored,
      errors
    }
  }

  /**
   * Create or update a scoring rule
   */
  static async upsertRule(
    rule: Omit<ScoringRule, 'id'> & { id?: string },
    chatbotId: string
  ): Promise<{ success: boolean; ruleId?: string; error?: string }> {
    try {
      const supabase = await createClient()

      const ruleData = {
        ...rule,
        chatbot_id: chatbotId,
        updated_at: new Date().toISOString()
      }

      if (rule.id) {
        // Update existing rule
        const { error } = await supabase
          .from('lead_scoring_rules')
          .update(ruleData)
          .eq('id', rule.id)
          .eq('chatbot_id', chatbotId)

        if (error) throw error
        return { success: true, ruleId: rule.id }
      } else {
        // Create new rule
        const { data, error } = await supabase
          .from('lead_scoring_rules')
          .insert({
            ...ruleData,
            created_at: new Date().toISOString()
          })
          .select('id')
          .maybeSingle()

        if (error) throw error
        return { success: true, ruleId: data.id }
      }
    } catch (error) {
      console.error('Rule upsert error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save rule'
      }
    }
  }

  /**
   * Delete a scoring rule
   */
  static async deleteRule(
    ruleId: string,
    chatbotId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('lead_scoring_rules')
        .delete()
        .eq('id', ruleId)
        .eq('chatbot_id', chatbotId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Rule delete error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete rule'
      }
    }
  }

  /**
   * Get scoring statistics for a chatbot
   */
  static async getScoringStats(chatbotId: string): Promise<{
    success: boolean
    stats?: {
      totalLeads: number
      scoredLeads: number
      avgScore: number
      byQuality: { hot: number; warm: number; cold: number }
      topRules: { ruleName: string; matchCount: number }[]
    }
    error?: string
  }> {
    try {
      const supabase = await createClient()

      // Get all leads for this chatbot
      const { data: leads } = await supabase
        .from('online_leads')
        .select('id, lead_score, lead_quality, scoring_details')
        .eq('chatbot_id', chatbotId)

      if (!leads) {
        return { success: true, stats: { totalLeads: 0, scoredLeads: 0, avgScore: 0, byQuality: { hot: 0, warm: 0, cold: 0 }, topRules: [] } }
      }

      const scoredLeads = leads.filter(l => l.lead_score !== null)
      const avgScore = scoredLeads.length > 0
        ? scoredLeads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / scoredLeads.length
        : 0

      const byQuality = {
        hot: leads.filter(l => l.lead_quality === 'hot').length,
        warm: leads.filter(l => l.lead_quality === 'warm').length,
        cold: leads.filter(l => l.lead_quality === 'cold').length
      }

      // Count rule matches
      const ruleCounts: Record<string, number> = {}
      scoredLeads.forEach(lead => {
        const details = lead.scoring_details as ScoringResult['appliedRules'] | null
        details?.forEach(rule => {
          if (rule.matched) {
            ruleCounts[rule.ruleName] = (ruleCounts[rule.ruleName] || 0) + 1
          }
        })
      })

      const topRules = Object.entries(ruleCounts)
        .map(([ruleName, matchCount]) => ({ ruleName, matchCount }))
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, 5)

      return {
        success: true,
        stats: {
          totalLeads: leads.length,
          scoredLeads: scoredLeads.length,
          avgScore: Math.round(avgScore * 10) / 10,
          byQuality,
          topRules
        }
      }
    } catch (error) {
      console.error('Scoring stats error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats'
      }
    }
  }

  /**
   * Get default rules (for UI display)
   */
  static getDefaultRules(): ScoringRule[] {
    return DEFAULT_RULES
  }

  /**
   * Get quality thresholds
   */
  static getQualityThresholds() {
    return QUALITY_THRESHOLDS
  }
}

export default LeadScoringService
