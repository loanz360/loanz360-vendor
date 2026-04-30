/**
 * CAE Validation Engine
 * Validates and sanitizes data for credit appraisal processing
 * Supports configurable validation rules from database
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { CAERequest } from './types'

export type ValidationType = 'REQUIRED' | 'FORMAT' | 'RANGE' | 'PATTERN' | 'CUSTOM' | 'CROSS_FIELD'
export type FieldType = 'STRING' | 'NUMBER' | 'DATE' | 'EMAIL' | 'PHONE' | 'PAN' | 'AADHAR' | 'GSTIN' | 'PINCODE' | 'BOOLEAN'

export interface ValidationRule {
  id: string
  field: string
  fieldType: FieldType
  validationType: ValidationType
  required: boolean
  minValue?: number
  maxValue?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  patternMessage?: string
  customValidator?: string
  crossFieldRef?: string
  crossFieldOperator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  errorMessage: string
  severity: 'ERROR' | 'WARNING'
  isActive: boolean
  loanTypes?: string[]
  employmentTypes?: string[]
}

export interface ValidationError {
  field: string
  message: string
  severity: 'ERROR' | 'WARNING'
  value?: unknown; rule?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  sanitizedData?: CAERequest
  fieldResults: Record<string, { valid: boolean; errors: string[] }>
}

export interface SanitizationOptions {
  trimStrings: boolean
  normalizePhone: boolean
  normalizePAN: boolean
  normalizeAadhar: boolean
  normalizeEmail: boolean
  removeSpecialChars: boolean
  convertCurrency: boolean
}

const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  trimStrings: true,
  normalizePhone: true,
  normalizePAN: true,
  normalizeAadhar: true,
  normalizeEmail: true,
  removeSpecialChars: false,
  convertCurrency: true,
}

// Pre-built validation patterns
const PATTERNS = {
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAR: /^\d{12}$/,
  GSTIN: /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
  PHONE: /^[6-9]\d{9}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PINCODE: /^\d{6}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  ACCOUNT_NUMBER: /^\d{9,18}$/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
}

export class ValidationEngine {
  private supabase: SupabaseClient
  private rulesCache: Map<string, ValidationRule[]> = new Map()
  private cacheExpiry: number = 5 * 60 * 1000
  private lastCacheUpdate: number = 0

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Validate a CAE request
   */
  async validate(
    request: CAERequest,
    options: { sanitize?: boolean; loanType?: string; employmentType?: string } = {}
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []
    const fieldResults: Record<string, { valid: boolean; errors: string[] }> = {}

    // Sanitize if requested
    let data = request
    if (options.sanitize) {
      data = this.sanitize(request)
    }

    // Get applicable validation rules
    const rules = await this.getApplicableRules(
      options.loanType || request.loan_type,
      options.employmentType || request.employment_type
    )

    // Validate each rule
    for (const rule of rules) {
      const result = this.validateField(data, rule)

      if (!fieldResults[rule.field]) {
        fieldResults[rule.field] = { valid: true, errors: [] }
      }

      if (!result.valid) {
        fieldResults[rule.field].valid = false
        fieldResults[rule.field].errors.push(result.message)

        const error: ValidationError = {
          field: rule.field,
          message: result.message,
          severity: rule.severity,
          value: result.value,
          rule: rule.id,
        }

        if (rule.severity === 'ERROR') {
          errors.push(error)
        } else {
          warnings.push(error)
        }
      }
    }

    // Run built-in validations for required fields
    this.runBuiltInValidations(data, errors, warnings, fieldResults)

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedData: options.sanitize ? data : undefined,
      fieldResults,
    }
  }

  /**
   * Sanitize request data
   */
  sanitize(request: CAERequest, options: SanitizationOptions = DEFAULT_SANITIZATION_OPTIONS): CAERequest {
    const sanitized = { ...request }

    // Trim strings
    if (options.trimStrings) {
      if (sanitized.customer_name) sanitized.customer_name = sanitized.customer_name.trim()
      if (sanitized.customer_email) sanitized.customer_email = sanitized.customer_email.trim()
      if (sanitized.customer_address) sanitized.customer_address = sanitized.customer_address.trim()
      if (sanitized.employer_name) sanitized.employer_name = sanitized.employer_name.trim()
    }

    // Normalize phone
    if (options.normalizePhone && sanitized.customer_mobile) {
      sanitized.customer_mobile = this.normalizePhone(sanitized.customer_mobile)
    }

    // Normalize PAN
    if (options.normalizePAN && sanitized.customer_pan) {
      sanitized.customer_pan = this.normalizePAN(sanitized.customer_pan)
    }

    // Normalize Aadhar
    if (options.normalizeAadhar && sanitized.customer_aadhar) {
      sanitized.customer_aadhar = this.normalizeAadhar(sanitized.customer_aadhar)
    }

    // Normalize email
    if (options.normalizeEmail && sanitized.customer_email) {
      sanitized.customer_email = sanitized.customer_email.toLowerCase().trim()
    }

    // Convert currency strings to numbers
    if (options.convertCurrency) {
      if (typeof sanitized.loan_amount === 'string') {
        sanitized.loan_amount = this.parseCurrency(sanitized.loan_amount)
      }
      if (typeof sanitized.monthly_income === 'string') {
        sanitized.monthly_income = this.parseCurrency(sanitized.monthly_income as unknown)
      }
      if (typeof sanitized.existing_emis === 'string') {
        sanitized.existing_emis = this.parseCurrency(sanitized.existing_emis as unknown)
      }
    }

    // Sanitize co-applicants
    if (sanitized.co_applicants) {
      sanitized.co_applicants = sanitized.co_applicants.map((co) => ({
        ...co,
        name: options.trimStrings ? co.name?.trim() : co.name,
        mobile: options.normalizePhone && co.mobile ? this.normalizePhone(co.mobile) : co.mobile,
        pan: options.normalizePAN && co.pan ? this.normalizePAN(co.pan) : co.pan,
        aadhar: options.normalizeAadhar && co.aadhar ? this.normalizeAadhar(co.aadhar) : co.aadhar,
      }))
    }

    return sanitized
  }

  /**
   * Validate a single field
   */
  validateField(data: unknown, rule: ValidationRule): { valid: boolean; message: string; value?: unknown} {
    const value = this.getNestedValue(data, rule.field)

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      return { valid: false, message: rule.errorMessage || `${rule.field} is required`, value }
    }

    // Skip other validations if value is empty and not required
    if (value === undefined || value === null || value === '') {
      return { valid: true, message: '', value }
    }

    // Type-specific validation
    switch (rule.fieldType) {
      case 'NUMBER':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, message: `${rule.field} must be a valid number`, value }
        }
        if (rule.minValue !== undefined && value < rule.minValue) {
          return { valid: false, message: rule.errorMessage || `${rule.field} must be at least ${rule.minValue}`, value }
        }
        if (rule.maxValue !== undefined && value > rule.maxValue) {
          return { valid: false, message: rule.errorMessage || `${rule.field} must not exceed ${rule.maxValue}`, value }
        }
        break

      case 'STRING':
        if (typeof value !== 'string') {
          return { valid: false, message: `${rule.field} must be a string`, value }
        }
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          return { valid: false, message: rule.errorMessage || `${rule.field} must be at least ${rule.minLength} characters`, value }
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          return { valid: false, message: rule.errorMessage || `${rule.field} must not exceed ${rule.maxLength} characters`, value }
        }
        break

      case 'EMAIL':
        if (!PATTERNS.EMAIL.test(String(value))) {
          return { valid: false, message: rule.errorMessage || 'Invalid email format', value }
        }
        break

      case 'PHONE':
        const normalizedPhone = String(value).replace(/[^0-9]/g, '').slice(-10)
        if (!PATTERNS.PHONE.test(normalizedPhone)) {
          return { valid: false, message: rule.errorMessage || 'Invalid phone number', value }
        }
        break

      case 'PAN':
        const normalizedPAN = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (!PATTERNS.PAN.test(normalizedPAN)) {
          return { valid: false, message: rule.errorMessage || 'Invalid PAN format', value }
        }
        break

      case 'AADHAR':
        const normalizedAadhar = String(value).replace(/[^0-9]/g, '')
        if (!PATTERNS.AADHAR.test(normalizedAadhar)) {
          return { valid: false, message: rule.errorMessage || 'Invalid Aadhar format', value }
        }
        break

      case 'GSTIN':
        if (!PATTERNS.GSTIN.test(String(value))) {
          return { valid: false, message: rule.errorMessage || 'Invalid GSTIN format', value }
        }
        break

      case 'PINCODE':
        if (!PATTERNS.PINCODE.test(String(value))) {
          return { valid: false, message: rule.errorMessage || 'Invalid pincode', value }
        }
        break

      case 'DATE':
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          return { valid: false, message: rule.errorMessage || 'Invalid date format', value }
        }
        break
    }

    // Pattern validation
    if (rule.pattern) {
      try {
        const regex = new RegExp(rule.pattern)
        if (!regex.test(String(value))) {
          return { valid: false, message: rule.patternMessage || rule.errorMessage || 'Invalid format', value }
        }
      } catch {
        console.error(`Invalid regex pattern: ${rule.pattern}`)
      }
    }

    // Cross-field validation
    if (rule.crossFieldRef && rule.crossFieldOperator) {
      const refValue = this.getNestedValue(data, rule.crossFieldRef)
      if (refValue !== undefined && !this.compareCrossField(value, refValue, rule.crossFieldOperator)) {
        return { valid: false, message: rule.errorMessage, value }
      }
    }

    return { valid: true, message: '', value }
  }

  /**
   * Run built-in validations for critical fields
   */
  private runBuiltInValidations(
    data: CAERequest,
    errors: ValidationError[],
    warnings: ValidationError[],
    fieldResults: Record<string, { valid: boolean; errors: string[] }>
  ): void {
    // Customer name required
    if (!data.customer_name || data.customer_name.trim().length < 2) {
      this.addError(errors, fieldResults, 'customer_name', 'Customer name is required', 'ERROR')
    }

    // Mobile required and valid
    if (!data.customer_mobile) {
      this.addError(errors, fieldResults, 'customer_mobile', 'Mobile number is required', 'ERROR')
    } else {
      const phone = data.customer_mobile.replace(/[^0-9]/g, '').slice(-10)
      if (!PATTERNS.PHONE.test(phone)) {
        this.addError(errors, fieldResults, 'customer_mobile', 'Invalid mobile number', 'ERROR')
      }
    }

    // Loan amount validation
    if (!data.loan_amount || data.loan_amount <= 0) {
      this.addError(errors, fieldResults, 'loan_amount', 'Valid loan amount is required', 'ERROR')
    } else if (data.loan_amount < 10000) {
      this.addError(warnings, fieldResults, 'loan_amount', 'Loan amount is below minimum threshold', 'WARNING')
    }

    // Monthly income validation
    if (!data.monthly_income || data.monthly_income <= 0) {
      this.addError(errors, fieldResults, 'monthly_income', 'Valid monthly income is required', 'ERROR')
    }

    // Loan to income ratio check
    if (data.loan_amount && data.monthly_income) {
      const loanToIncomeRatio = data.loan_amount / (data.monthly_income * 12)
      if (loanToIncomeRatio > 10) {
        this.addError(warnings, fieldResults, 'loan_amount', 'Loan amount exceeds 10x annual income', 'WARNING')
      }
    }

    // PAN validation if provided
    if (data.customer_pan) {
      const pan = data.customer_pan.toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (!PATTERNS.PAN.test(pan)) {
        this.addError(errors, fieldResults, 'customer_pan', 'Invalid PAN format', 'ERROR')
      }
    }

    // Aadhar validation if provided
    if (data.customer_aadhar) {
      const aadhar = data.customer_aadhar.replace(/[^0-9]/g, '')
      if (!PATTERNS.AADHAR.test(aadhar)) {
        this.addError(errors, fieldResults, 'customer_aadhar', 'Invalid Aadhar format', 'ERROR')
      }
    }

    // Email validation if provided
    if (data.customer_email && !PATTERNS.EMAIL.test(data.customer_email)) {
      this.addError(warnings, fieldResults, 'customer_email', 'Invalid email format', 'WARNING')
    }

    // Pincode validation if provided
    if (data.customer_pincode && !PATTERNS.PINCODE.test(data.customer_pincode)) {
      this.addError(warnings, fieldResults, 'customer_pincode', 'Invalid pincode', 'WARNING')
    }

    // DOB validation - age check
    if (data.customer_dob) {
      const dob = new Date(data.customer_dob)
      const age = this.calculateAge(dob)
      if (age < 18) {
        this.addError(errors, fieldResults, 'customer_dob', 'Applicant must be at least 18 years old', 'ERROR')
      } else if (age > 70) {
        this.addError(warnings, fieldResults, 'customer_dob', 'Applicant age exceeds 70 years', 'WARNING')
      }
    }

    // Co-applicant validations
    if (data.co_applicants) {
      data.co_applicants.forEach((co, index) => {
        if (!co.name || co.name.trim().length < 2) {
          this.addError(
            errors,
            fieldResults,
            `co_applicants[${index}].name`,
            'Co-applicant name is required',
            'ERROR'
          )
        }
        if (co.pan && !PATTERNS.PAN.test(co.pan.toUpperCase().replace(/[^A-Z0-9]/g, ''))) {
          this.addError(
            warnings,
            fieldResults,
            `co_applicants[${index}].pan`,
            'Invalid co-applicant PAN',
            'WARNING'
          )
        }
      })
    }
  }

  private addError(
    list: ValidationError[],
    fieldResults: Record<string, { valid: boolean; errors: string[] }>,
    field: string,
    message: string,
    severity: 'ERROR' | 'WARNING'
  ): void {
    list.push({ field, message, severity })
    if (!fieldResults[field]) {
      fieldResults[field] = { valid: true, errors: [] }
    }
    if (severity === 'ERROR') {
      fieldResults[field].valid = false
    }
    fieldResults[field].errors.push(message)
  }

  private async getApplicableRules(loanType: string, employmentType: string): Promise<ValidationRule[]> {
    const cacheKey = `${loanType}_${employmentType}`

    if (this.rulesCache.has(cacheKey) && Date.now() - this.lastCacheUpdate < this.cacheExpiry) {
      return this.rulesCache.get(cacheKey)!
    }

    const { data: dbRules, error } = await this.supabase
      .from('cae_validation_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) {
      console.error('Failed to fetch validation rules:', error)
      return []
    }

    const rules: ValidationRule[] = (dbRules || [])
      .filter((rule) => {
        if (rule.loan_types && rule.loan_types.length > 0 && !rule.loan_types.includes(loanType)) {
          return false
        }
        if (rule.employment_types && rule.employment_types.length > 0 && !rule.employment_types.includes(employmentType)) {
          return false
        }
        return true
      })
      .map((rule) => this.transformDBRule(rule))

    this.rulesCache.set(cacheKey, rules)
    this.lastCacheUpdate = Date.now()

    return rules
  }

  private transformDBRule(dbRule: unknown): ValidationRule {
    return {
      id: dbRule.id,
      field: dbRule.field_name || dbRule.field,
      fieldType: (dbRule.field_type || 'STRING') as FieldType,
      validationType: (dbRule.validation_type || 'FORMAT') as ValidationType,
      required: dbRule.is_required || dbRule.required || false,
      minValue: dbRule.min_value,
      maxValue: dbRule.max_value,
      minLength: dbRule.min_length,
      maxLength: dbRule.max_length,
      pattern: dbRule.pattern,
      patternMessage: dbRule.pattern_message,
      customValidator: dbRule.custom_validator,
      crossFieldRef: dbRule.cross_field_ref,
      crossFieldOperator: dbRule.cross_field_operator,
      errorMessage: dbRule.error_message || `Validation failed for ${dbRule.field_name || dbRule.field}`,
      severity: (dbRule.severity || 'ERROR') as 'ERROR' | 'WARNING',
      isActive: dbRule.is_active,
      loanTypes: dbRule.loan_types,
      employmentTypes: dbRule.employment_types,
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      current = current[part]
    }
    return current
  }

  private compareCrossField(value: unknown, refValue: unknown, operator: string): boolean {
    switch (operator) {
      case 'eq': return value === refValue
      case 'neq': return value !== refValue
      case 'gt': return value > refValue
      case 'gte': return value >= refValue
      case 'lt': return value < refValue
      case 'lte': return value <= refValue
      default: return true
    }
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '').slice(-10)
  }

  private normalizePAN(pan: string): string {
    return pan.toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  private normalizeAadhar(aadhar: string): string {
    return aadhar.replace(/[^0-9]/g, '')
  }

  private parseCurrency(value: string): number {
    return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0
  }

  private calculateAge(dob: Date): number {
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }
    return age
  }

  clearCache(): void {
    this.rulesCache.clear()
    this.lastCacheUpdate = 0
  }
}

/**
 * Factory function to create validation engine
 */
export function createValidationEngine(supabase: SupabaseClient): ValidationEngine {
  return new ValidationEngine(supabase)
}
