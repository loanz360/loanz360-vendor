// =====================================================
// FORM VALIDATION UTILITIES (Enhancement H4)
// Client-side validation for payroll forms
// =====================================================

import { isValidPAN, isValidAadhaar, isValidUAN, isValidBankAccount, isValidIFSC } from './payroll-utils'

/**
 * Validation rule type
 */
export type ValidationRule = {
  type: 'required' | 'email' | 'number' | 'min' | 'max' | 'pattern' | 'custom' | 'pan' | 'aadhaar' | 'uan' | 'bankAccount' | 'ifsc'
  value?: any
  message: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

/**
 * Validate a single field
 */
export function validateField(value: any, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return rule.message
        }
        break

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (value && !emailRegex.test(value)) {
          return rule.message
        }
        break

      case 'number':
        if (value && isNaN(Number(value))) {
          return rule.message
        }
        break

      case 'min':
        if (value && Number(value) < rule.value) {
          return rule.message
        }
        break

      case 'max':
        if (value && Number(value) > rule.value) {
          return rule.message
        }
        break

      case 'pattern':
        if (value && !new RegExp(rule.value).test(value)) {
          return rule.message
        }
        break

      case 'pan':
        if (value && !isValidPAN(value)) {
          return rule.message
        }
        break

      case 'aadhaar':
        if (value && !isValidAadhaar(value)) {
          return rule.message
        }
        break

      case 'uan':
        if (value && !isValidUAN(value)) {
          return rule.message
        }
        break

      case 'bankAccount':
        if (value && !isValidBankAccount(value)) {
          return rule.message
        }
        break

      case 'ifsc':
        if (value && !isValidIFSC(value)) {
          return rule.message
        }
        break

      case 'custom':
        if (rule.value && typeof rule.value === 'function') {
          const result = rule.value(value)
          if (!result) {
            return rule.message
          }
        }
        break
    }
  }

  return null
}

/**
 * Validate entire form
 */
export function validateForm(
  values: Record<string, any>,
  rules: Record<string, ValidationRule[]>
): ValidationResult {
  const errors: Record<string, string> = {}

  for (const field in rules) {
    const error = validateField(values[field], rules[field])
    if (error) {
      errors[field] = error
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Tax declaration validation rules
 */
export const TAX_DECLARATION_RULES: Record<string, ValidationRule[]> = {
  section_80c: [
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 0, message: 'Cannot be negative' },
    { type: 'max', value: 150000, message: 'Maximum limit is ₹1,50,000' }
  ],
  section_80d: [
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 0, message: 'Cannot be negative' },
    { type: 'max', value: 100000, message: 'Maximum limit is ₹1,00,000' }
  ],
  section_80e: [
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 0, message: 'Cannot be negative' }
  ],
  hra_exemption: [
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 0, message: 'Cannot be negative' }
  ]
}

/**
 * Loan request validation rules
 */
export const LOAN_REQUEST_RULES: Record<string, ValidationRule[]> = {
  loan_type: [
    { type: 'required', message: 'Please select a loan type' }
  ],
  loan_amount: [
    { type: 'required', message: 'Loan amount is required' },
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 5000, message: 'Minimum loan amount is ₹5,000' },
    { type: 'max', value: 500000, message: 'Maximum loan amount is ₹5,00,000' }
  ],
  interest_rate: [
    { type: 'required', message: 'Interest rate is required' },
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 0, message: 'Cannot be negative' },
    { type: 'max', value: 25, message: 'Interest rate cannot exceed 25%' }
  ],
  tenure_months: [
    { type: 'required', message: 'Tenure is required' },
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 1, message: 'Minimum tenure is 1 month' },
    { type: 'max', value: 60, message: 'Maximum tenure is 60 months' }
  ],
  requested_reason: [
    { type: 'required', message: 'Please provide a reason' },
    {
      type: 'custom',
      value: (value: string) => value && value.trim().length >= 10,
      message: 'Reason must be at least 10 characters'
    }
  ]
}

/**
 * Salary advance validation rules
 */
export const ADVANCE_REQUEST_RULES: Record<string, ValidationRule[]> = {
  advance_amount: [
    { type: 'required', message: 'Amount is required' },
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 1000, message: 'Minimum advance is ₹1,000' },
    { type: 'max', value: 50000, message: 'Maximum advance is ₹50,000' }
  ],
  requested_reason: [
    { type: 'required', message: 'Please provide a reason' },
    {
      type: 'custom',
      value: (value: string) => value && value.trim().length >= 10,
      message: 'Reason must be at least 10 characters'
    }
  ],
  urgency_level: [
    { type: 'required', message: 'Please select urgency level' }
  ]
}

/**
 * Reimbursement claim validation rules
 */
export const REIMBURSEMENT_RULES: Record<string, ValidationRule[]> = {
  category_id: [
    { type: 'required', message: 'Please select a category' }
  ],
  claim_amount: [
    { type: 'required', message: 'Claim amount is required' },
    { type: 'number', message: 'Must be a valid number' },
    { type: 'min', value: 100, message: 'Minimum claim is ₹100' }
  ],
  claim_description: [
    { type: 'required', message: 'Please provide description' },
    {
      type: 'custom',
      value: (value: string) => value && value.trim().length >= 20,
      message: 'Description must be at least 20 characters'
    }
  ],
  receipt_urls: [
    {
      type: 'custom',
      value: (value: string[]) => value && value.length > 0,
      message: 'Please upload at least one receipt'
    }
  ]
}

/**
 * Bank details validation rules
 */
export const BANK_DETAILS_RULES: Record<string, ValidationRule[]> = {
  bank_account_number: [
    { type: 'required', message: 'Account number is required' },
    { type: 'bankAccount', message: 'Invalid bank account number' }
  ],
  bank_name: [
    { type: 'required', message: 'Bank name is required' }
  ],
  bank_ifsc: [
    { type: 'required', message: 'IFSC code is required' },
    { type: 'ifsc', message: 'Invalid IFSC code format' }
  ]
}

/**
 * PAN validation rule
 */
export const PAN_RULES: ValidationRule[] = [
  { type: 'required', message: 'PAN number is required' },
  { type: 'pan', message: 'Invalid PAN format (e.g., ABCDE1234F)' }
]

/**
 * Helper function to check if form has errors
 */
export function hasErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0
}

/**
 * Helper function to get first error message
 */
export function getFirstError(errors: Record<string, string>): string | null {
  const keys = Object.keys(errors)
  return keys.length > 0 ? errors[keys[0]] : null
}
