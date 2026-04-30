/**
 * CAE Business Rules Execution Engine
 * Evaluates configurable business rules for credit decisions
 * Supports eligibility, risk, pricing, and compliance rules
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { CAERequest, CAEResult, RiskGrade, CAEBusinessRule } from './types'

export type RuleType = 'ELIGIBILITY' | 'RISK' | 'PRICING' | 'COMPLIANCE' | 'SCORING'
export type RuleOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'between' | 'contains' | 'regex'
export type RuleAction = 'APPROVE' | 'REJECT' | 'REFER' | 'ADD_CONDITION' | 'ADJUST_AMOUNT' | 'ADJUST_RATE' | 'FLAG' | 'ALERT'

export interface RuleCondition {
  field: string
  operator: RuleOperator
  value: unknown  valueEnd?: any // For 'between' operator
}

export interface RuleActionConfig {
  action: RuleAction
  value?: unknown  message?: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface BusinessRule {
  id: string
  name: string
  description?: string
  type: RuleType
  priority: number
  isActive: boolean
  loanTypes?: string[]
  employmentTypes?: string[]
  conditions: RuleCondition[]
  conditionLogic?: 'AND' | 'OR'
  actions: RuleActionConfig[]
  metadata?: Record<string, unknown>
}

export interface RuleEvaluationResult {
  ruleId: string
  ruleName: string
  ruleType: RuleType
  matched: boolean
  actions: RuleActionConfig[]
  evaluationTime: number
}

export interface RulesEngineResult {
  passed: boolean
  decision: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REFER' | 'REJECT'
  evaluatedRules: RuleEvaluationResult[]
  matchedRules: RuleEvaluationResult[]
  conditions: string[]
  flags: Array<{ code: string; severity: string; message: string }>
  alerts: Array<{ type: string; message: string }>
  adjustments: {
    amountMultiplier?: number
    rateAdjustment?: number
    tenureAdjustment?: number
  }
  executionTime: number
}

export interface RuleContext {
  request: CAERequest
  result?: CAEResult
  additionalData?: Record<string, unknown>
}

export class RulesEngine {
  private supabase: SupabaseClient
  private rulesCache: Map<string, BusinessRule[]> = new Map()
  private cacheExpiry: number = 5 * 60 * 1000 // 5 minutes
  private lastCacheUpdate: number = 0

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Evaluate all applicable rules for a given context
   */
  async evaluateRules(context: RuleContext): Promise<RulesEngineResult> {
    const startTime = Date.now()
    const results: RuleEvaluationResult[] = []
    const conditions: string[] = []
    const flags: Array<{ code: string; severity: string; message: string }> = []
    const alerts: Array<{ type: string; message: string }> = []
    const adjustments: RulesEngineResult['adjustments'] = {}

    let decision: RulesEngineResult['decision'] = 'APPROVE'
    let passed = true

    try {
      // Get applicable rules
      const rules = await this.getApplicableRules(context.request.loan_type, context.request.employment_type)

      // Sort by priority (lower number = higher priority)
      const sortedRules = [...rules].sort((a, b) => a.priority - b.priority)

      // Evaluate each rule
      for (const rule of sortedRules) {
        const evalStart = Date.now()
        const matched = this.evaluateConditions(rule, context)

        const evalResult: RuleEvaluationResult = {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.type,
          matched,
          actions: matched ? rule.actions : [],
          evaluationTime: Date.now() - evalStart,
        }

        results.push(evalResult)

        // Process actions if rule matched
        if (matched) {
          for (const action of rule.actions) {
            switch (action.action) {
              case 'REJECT':
                decision = 'REJECT'
                passed = false
                if (action.message) {
                  conditions.push(action.message)
                }
                break

              case 'REFER':
                if (decision !== 'REJECT') {
                  decision = 'REFER'
                }
                if (action.message) {
                  conditions.push(action.message)
                }
                break

              case 'ADD_CONDITION':
                if (decision === 'APPROVE') {
                  decision = 'APPROVE_WITH_CONDITIONS'
                }
                if (action.message) {
                  conditions.push(action.message)
                }
                break

              case 'ADJUST_AMOUNT':
                if (typeof action.value === 'number') {
                  adjustments.amountMultiplier = (adjustments.amountMultiplier || 1) * action.value
                }
                break

              case 'ADJUST_RATE':
                if (typeof action.value === 'number') {
                  adjustments.rateAdjustment = (adjustments.rateAdjustment || 0) + action.value
                }
                break

              case 'FLAG':
                flags.push({
                  code: action.value || rule.name.toUpperCase().replace(/\s+/g, '_'),
                  severity: action.severity || 'MEDIUM',
                  message: action.message || rule.name,
                })
                break

              case 'ALERT':
                alerts.push({
                  type: action.severity || 'INFO',
                  message: action.message || rule.name,
                })
                break

              case 'APPROVE':
                // Explicit approve - doesn't override rejections
                break
            }
          }

          // Short-circuit on hard rejection
          if (decision === 'REJECT' && rule.type === 'ELIGIBILITY') {
            break
          }
        }
      }

      return {
        passed,
        decision,
        evaluatedRules: results,
        matchedRules: results.filter((r) => r.matched),
        conditions: [...new Set(conditions)], // Deduplicate
        flags,
        alerts,
        adjustments,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('Rules engine error:', error)
      return {
        passed: false,
        decision: 'REFER',
        evaluatedRules: results,
        matchedRules: results.filter((r) => r.matched),
        conditions: ['Rules engine error - manual review required'],
        flags: [{ code: 'RULES_ENGINE_ERROR', severity: 'HIGH', message: 'Failed to evaluate all rules' }],
        alerts: [{ type: 'RISK', message: 'Rules evaluation incomplete' }],
        adjustments,
        executionTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Evaluate a specific rule type only
   */
  async evaluateRuleType(context: RuleContext, ruleType: RuleType): Promise<RulesEngineResult> {
    const allRules = await this.getApplicableRules(context.request.loan_type, context.request.employment_type)
    const filteredRules = allRules.filter((r) => r.type === ruleType)

    // Create a temporary cache key for filtered rules
    const tempKey = `${ruleType}_${context.request.loan_type}_${context.request.employment_type}`
    this.rulesCache.set(tempKey, filteredRules)

    const result = await this.evaluateRules(context)

    // Clean up temp cache
    this.rulesCache.delete(tempKey)

    return result
  }

  /**
   * Get all applicable rules for a loan type and employment type
   */
  private async getApplicableRules(loanType: string, employmentType: string): Promise<BusinessRule[]> {
    const cacheKey = `${loanType}_${employmentType}`

    // Check cache
    if (this.rulesCache.has(cacheKey) && Date.now() - this.lastCacheUpdate < this.cacheExpiry) {
      return this.rulesCache.get(cacheKey)!
    }

    // Fetch from database
    const { data: dbRules, error } = await this.supabase
      .from('cae_business_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) {
      console.error('Failed to fetch business rules:', error)
      return []
    }

    // Transform database rules to engine format
    const rules: BusinessRule[] = (dbRules || [])
      .filter((rule) => {
        // Filter by loan type if specified
        if (rule.loan_type && rule.loan_type !== 'ALL' && rule.loan_type !== loanType) {
          return false
        }
        // Filter by employment type if specified
        if (rule.employment_type && rule.employment_type !== 'ALL' && rule.employment_type !== employmentType) {
          return false
        }
        return true
      })
      .map((rule) => this.transformDBRule(rule))

    // Update cache
    this.rulesCache.set(cacheKey, rules)
    this.lastCacheUpdate = Date.now()

    return rules
  }

  /**
   * Transform database rule format to engine format
   */
  private transformDBRule(dbRule: unknown): BusinessRule {
    return {
      id: dbRule.id,
      name: dbRule.rule_name,
      description: dbRule.description,
      type: dbRule.rule_type as RuleType,
      priority: dbRule.priority || 100,
      isActive: dbRule.is_active,
      loanTypes: dbRule.loan_type ? [dbRule.loan_type] : undefined,
      employmentTypes: dbRule.employment_type ? [dbRule.employment_type] : undefined,
      conditions: this.parseConditions(dbRule.conditions),
      conditionLogic: dbRule.condition_logic || 'AND',
      actions: this.parseActions(dbRule.actions),
      metadata: dbRule.metadata,
    }
  }

  /**
   * Parse conditions from database JSON
   */
  private parseConditions(conditions: unknown): RuleCondition[] {
    if (!conditions) return []
    if (Array.isArray(conditions)) {
      return conditions.map((c) => ({
        field: c.field || c.parameter,
        operator: (c.operator || 'eq') as RuleOperator,
        value: c.value,
        valueEnd: c.valueEnd || c.value_end,
      }))
    }
    // Handle object format from seed data
    if (typeof conditions === 'object') {
      return Object.entries(conditions).map(([key, value]) => {
        if (typeof value === 'object' && value !== null && 'min' in value) {
          return {
            field: key,
            operator: 'gte' as RuleOperator,
            value: (value as unknown).min,
          }
        }
        if (typeof value === 'object' && value !== null && 'max' in value) {
          return {
            field: key,
            operator: 'lte' as RuleOperator,
            value: (value as unknown).max,
          }
        }
        return {
          field: key,
          operator: 'eq' as RuleOperator,
          value,
        }
      })
    }
    return []
  }

  /**
   * Parse actions from database JSON
   */
  private parseActions(actions: unknown): RuleActionConfig[] {
    if (!actions) return []
    if (Array.isArray(actions)) {
      return actions.map((a) => ({
        action: (a.action || 'FLAG') as RuleAction,
        value: a.value,
        message: a.message,
        severity: a.severity,
      }))
    }
    // Handle object format from seed data
    if (typeof actions === 'object') {
      const result: RuleActionConfig[] = []
      if (actions.approve === false || actions.reject === true) {
        result.push({ action: 'REJECT', message: actions.message || 'Rule condition not met' })
      }
      if (actions.refer === true) {
        result.push({ action: 'REFER', message: actions.message })
      }
      if (actions.condition) {
        result.push({ action: 'ADD_CONDITION', message: actions.condition })
      }
      if (actions.amount_multiplier) {
        result.push({ action: 'ADJUST_AMOUNT', value: actions.amount_multiplier })
      }
      if (actions.rate_adjustment) {
        result.push({ action: 'ADJUST_RATE', value: actions.rate_adjustment })
      }
      if (actions.flag) {
        result.push({ action: 'FLAG', value: actions.flag, severity: actions.severity })
      }
      return result
    }
    return []
  }

  /**
   * Evaluate conditions against context
   */
  private evaluateConditions(rule: BusinessRule, context: RuleContext): boolean {
    if (rule.conditions.length === 0) {
      return true // No conditions = always matches
    }

    const logic = rule.conditionLogic || 'AND'
    const results = rule.conditions.map((condition) => this.evaluateCondition(condition, context))

    if (logic === 'AND') {
      return results.every((r) => r)
    } else {
      return results.some((r) => r)
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: RuleCondition, context: RuleContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, context)

    if (fieldValue === undefined || fieldValue === null) {
      return false // Missing field = condition not met
    }

    const { operator, value, valueEnd } = condition

    switch (operator) {
      case 'eq':
        return fieldValue === value

      case 'neq':
        return fieldValue !== value

      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > value

      case 'gte':
        return typeof fieldValue === 'number' && fieldValue >= value

      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < value

      case 'lte':
        return typeof fieldValue === 'number' && fieldValue <= value

      case 'in':
        return Array.isArray(value) && value.includes(fieldValue)

      case 'nin':
        return Array.isArray(value) && !value.includes(fieldValue)

      case 'between':
        return typeof fieldValue === 'number' && fieldValue >= value && fieldValue <= (valueEnd || value)

      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(String(value).toLowerCase())

      case 'regex':
        try {
          return new RegExp(value).test(String(fieldValue))
        } catch {
          return false
        }

      default:
        return false
    }
  }

  /**
   * Get field value from context using dot notation
   */
  private getFieldValue(field: string, context: RuleContext): unknown {
    // Handle special computed fields
    const computedValue = this.getComputedFieldValue(field, context)
    if (computedValue !== undefined) {
      return computedValue
    }

    // Try request fields
    let value = this.getNestedValue(context.request, field)
    if (value !== undefined) return value

    // Try result fields
    if (context.result) {
      value = this.getNestedValue(context.result, field)
      if (value !== undefined) return value
    }

    // Try additional data
    if (context.additionalData) {
      value = this.getNestedValue(context.additionalData, field)
      if (value !== undefined) return value
    }

    return undefined
  }

  /**
   * Get nested value using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }
      current = current[part]
    }

    return current
  }

  /**
   * Compute special field values
   */
  private getComputedFieldValue(field: string, context: RuleContext): unknown {
    const request = context.request
    const result = context.result

    switch (field) {
      case 'loan_to_income_ratio':
        return request.loan_amount / (request.monthly_income * 12)

      case 'emi_to_income_ratio':
        if (result?.emi_capacity) {
          const estimatedEmi = this.calculateEMI(request.loan_amount, 120, 10)
          return estimatedEmi / request.monthly_income
        }
        return (request.existing_emis || 0) / request.monthly_income

      case 'foir':
        return result?.foir || (request.existing_emis || 0) / request.monthly_income

      case 'dti':
        return result?.dti

      case 'credit_score':
        return result?.credit_score

      case 'risk_score':
        return result?.risk_score

      case 'age':
        if (request.customer_dob) {
          const dob = new Date(request.customer_dob)
          const today = new Date()
          let age = today.getFullYear() - dob.getFullYear()
          const monthDiff = today.getMonth() - dob.getMonth()
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--
          }
          return age
        }
        return undefined

      case 'has_pan':
        return !!request.customer_pan

      case 'has_aadhar':
        return !!request.customer_aadhar

      case 'has_email':
        return !!request.customer_email

      case 'co_applicant_count':
        return request.co_applicants?.length || 0

      case 'total_income':
        let total = request.monthly_income
        if (request.co_applicants) {
          for (const co of request.co_applicants) {
            if (co.income_considered && co.income) {
              total += co.income * (co.income_percentage / 100)
            }
          }
        }
        return total

      default:
        return undefined
    }
  }

  /**
   * Calculate EMI for a loan
   */
  private calculateEMI(principal: number, tenureMonths: number, annualRate: number): number {
    const monthlyRate = annualRate / 100 / 12
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  }

  /**
   * Clear rules cache
   */
  clearCache(): void {
    this.rulesCache.clear()
    this.lastCacheUpdate = 0
  }

  /**
   * Reload rules from database
   */
  async reloadRules(): Promise<void> {
    this.clearCache()
    // Pre-warm cache with common combinations
    await Promise.all([
      this.getApplicableRules('PERSONAL_LOAN', 'SALARIED'),
      this.getApplicableRules('HOME_LOAN', 'SALARIED'),
      this.getApplicableRules('PERSONAL_LOAN', 'SELF_EMPLOYED_BUSINESS'),
    ])
  }
}

/**
 * Factory function to create rules engine
 */
export function createRulesEngine(supabase: SupabaseClient): RulesEngine {
  return new RulesEngine(supabase)
}

/**
 * Pre-built rule templates for common scenarios
 */
export const RULE_TEMPLATES = {
  // Eligibility Rules
  MIN_CREDIT_SCORE: (minScore: number): Partial<BusinessRule> => ({
    name: `Minimum Credit Score ${minScore}`,
    type: 'ELIGIBILITY',
    conditions: [{ field: 'credit_score', operator: 'gte', value: minScore }],
    actions: [{ action: 'REJECT', message: `Credit score must be at least ${minScore}` }],
  }),

  MAX_FOIR: (maxFoir: number): Partial<BusinessRule> => ({
    name: `Maximum FOIR ${maxFoir * 100}%`,
    type: 'ELIGIBILITY',
    conditions: [{ field: 'foir', operator: 'lte', value: maxFoir }],
    actions: [{ action: 'REJECT', message: `FOIR must not exceed ${maxFoir * 100}%` }],
  }),

  AGE_RANGE: (minAge: number, maxAge: number): Partial<BusinessRule> => ({
    name: `Age Range ${minAge}-${maxAge}`,
    type: 'ELIGIBILITY',
    conditions: [{ field: 'age', operator: 'between', value: minAge, valueEnd: maxAge }],
    actions: [{ action: 'REJECT', message: `Applicant age must be between ${minAge} and ${maxAge} years` }],
  }),

  // Risk Rules
  HIGH_LOAN_TO_INCOME: (threshold: number): Partial<BusinessRule> => ({
    name: 'High Loan to Income Ratio',
    type: 'RISK',
    conditions: [{ field: 'loan_to_income_ratio', operator: 'gt', value: threshold }],
    actions: [
      { action: 'FLAG', value: 'HIGH_LOAN_TO_INCOME', severity: 'MEDIUM' as const, message: 'Loan amount exceeds recommended income multiple' },
      { action: 'REFER', message: 'Manual review required for high loan-to-income ratio' },
    ],
  }),

  LOW_CREDIT_SCORE_WARNING: (threshold: number): Partial<BusinessRule> => ({
    name: 'Low Credit Score Warning',
    type: 'RISK',
    conditions: [{ field: 'credit_score', operator: 'lt', value: threshold }],
    actions: [
      { action: 'FLAG', value: 'LOW_CREDIT_SCORE', severity: 'HIGH' as const, message: `Credit score below ${threshold}` },
      { action: 'ADJUST_RATE', value: 2.0 },
    ],
  }),

  // Pricing Rules
  PREMIUM_RATE_FOR_RISK: (riskGrade: RiskGrade, premium: number): Partial<BusinessRule> => ({
    name: `Premium Rate for Grade ${riskGrade}`,
    type: 'PRICING',
    conditions: [{ field: 'risk_grade', operator: 'eq', value: riskGrade }],
    actions: [{ action: 'ADJUST_RATE', value: premium }],
  }),

  // Compliance Rules
  REQUIRE_PAN: (): Partial<BusinessRule> => ({
    name: 'Require PAN Verification',
    type: 'COMPLIANCE',
    conditions: [{ field: 'has_pan', operator: 'eq', value: false }],
    actions: [{ action: 'ADD_CONDITION', message: 'PAN verification required before disbursement' }],
  }),

  REQUIRE_AADHAR: (): Partial<BusinessRule> => ({
    name: 'Require Aadhar Verification',
    type: 'COMPLIANCE',
    conditions: [{ field: 'has_aadhar', operator: 'eq', value: false }],
    actions: [{ action: 'ADD_CONDITION', message: 'Aadhar verification required before disbursement' }],
  }),
}
