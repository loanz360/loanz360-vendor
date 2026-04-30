import { NextRequest } from 'next/server'
import {
  validateRequest,
  validateQueryParams,
  CreateIncentiveSchema,
  UpdateIncentiveSchema,
  CreateClaimSchema,
  sanitizeString,
} from '../incentive-validations'

describe('Incentive Validations', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = 'Hello <script>alert("xss")</script> World'
      const result = sanitizeString(input)
      expect(result).toBe('Hello  World')
      expect(result).not.toContain('<script>')
    })

    it('should remove javascript: protocol', () => {
      const input = 'Click javascript:alert("xss")'
      const result = sanitizeString(input)
      expect(result).not.toContain('javascript:')
    })

    it('should remove event handlers', () => {
      const input = 'text with onclick="evil()" handler'
      const result = sanitizeString(input)
      expect(result).not.toContain('onclick=')
    })

    it('should handle null and undefined', () => {
      expect(sanitizeString(null)).toBe('')
      expect(sanitizeString(undefined)).toBe('')
    })

    it('should trim whitespace', () => {
      const input = '  trimmed  '
      const result = sanitizeString(input)
      expect(result).toBe('trimmed')
    })
  })

  describe('CreateIncentiveSchema', () => {
    const validIncentive = {
      incentive_title: 'Q1 Sales Incentive',
      incentive_description: 'Earn bonuses for exceeding sales targets',
      incentive_type: 'sales' as const,
      start_date: '2025-01-01T00:00:00Z',
      end_date: '2025-03-31T23:59:59Z',
      target_category: 'employee' as const,
      target_all_employees: false,
      target_subroles: ['cro-uuid-1', 'cro-uuid-2'],
      performance_criteria: {
        type: 'sales_target' as const,
        target_value: 1000000,
        achievement_threshold: 80,
      },
      reward_amount: 50000,
      reward_currency: 'INR' as const,
      status: 'draft' as const,
      display_order: 1,
      notify_on_launch: true,
      notify_before_expiry_days: 7,
    }

    it('should validate correct incentive data', () => {
      const result = CreateIncentiveSchema.safeParse(validIncentive)
      expect(result.success).toBe(true)
    })

    it('should require incentive_title', () => {
      const { incentive_title, ...invalid } = validIncentive
      const result = CreateIncentiveSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate title length', () => {
      const invalid = {
        ...validIncentive,
        incentive_title: 'ab', // Too short (min 3)
      }
      const result = CreateIncentiveSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate end_date is after start_date', () => {
      const invalid = {
        ...validIncentive,
        start_date: '2025-03-31T00:00:00Z',
        end_date: '2025-01-01T00:00:00Z', // Before start
      }
      const result = CreateIncentiveSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate incentive_type enum', () => {
      const invalid = {
        ...validIncentive,
        incentive_type: 'invalid_type',
      }
      const result = CreateIncentiveSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate reward_amount is positive', () => {
      const invalid = {
        ...validIncentive,
        reward_amount: -1000,
      }
      const result = CreateIncentiveSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should require target_subroles when target_all_employees is false', () => {
      const invalid = {
        ...validIncentive,
        target_all_employees: false,
        target_subroles: [], // Empty array
      }
      const result = CreateIncentiveSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should allow empty target_subroles when target_all_employees is true', () => {
      const valid = {
        ...validIncentive,
        target_all_employees: true,
        target_subroles: [],
      }
      const result = CreateIncentiveSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should validate performance_criteria structure', () => {
      const invalidCriteria = {
        ...validIncentive,
        performance_criteria: {
          type: 'sales_target',
          // Missing target_value
        },
      }
      const result = CreateIncentiveSchema.safeParse(invalidCriteria)
      expect(result.success).toBe(false)
    })

    it('should validate achievement_threshold range (0-100)', () => {
      const invalid = {
        ...validIncentive,
        performance_criteria: {
          type: 'sales_target' as const,
          target_value: 1000000,
          achievement_threshold: 150, // > 100
        },
      }
      const result = CreateIncentiveSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateIncentiveSchema', () => {
    it('should allow partial updates', () => {
      const partial = {
        incentive_title: 'Updated Title',
      }
      const result = UpdateIncentiveSchema.safeParse(partial)
      expect(result.success).toBe(true)
    })

    it('should validate fields when provided', () => {
      const invalid = {
        incentive_title: 'ab', // Too short
      }
      const result = UpdateIncentiveSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should allow status update', () => {
      const valid = {
        status: 'active' as const,
      }
      const result = UpdateIncentiveSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('CreateClaimSchema', () => {
    const validClaim = {
      allocation_id: '123e4567-e89b-12d3-a456-426614174000',
      claimed_amount: 50000,
      payment_method: 'bank_transfer' as const,
    }

    it('should validate correct claim data', () => {
      const result = CreateClaimSchema.safeParse(validClaim)
      expect(result.success).toBe(true)
    })

    it('should require allocation_id', () => {
      const { allocation_id, ...invalid } = validClaim
      const result = CreateClaimSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate allocation_id is UUID', () => {
      const invalid = {
        ...validClaim,
        allocation_id: 'not-a-uuid',
      }
      const result = CreateClaimSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate claimed_amount is positive', () => {
      const invalid = {
        ...validClaim,
        claimed_amount: -100,
      }
      const result = CreateClaimSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate payment_method enum', () => {
      const invalid = {
        ...validClaim,
        payment_method: 'invalid_method',
      }
      const result = CreateClaimSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('validateRequest', () => {
    it('should validate request body successfully', async () => {
      const validBody = {
        allocation_id: '123e4567-e89b-12d3-a456-426614174000',
        claimed_amount: 50000,
      }

      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validBody),
      }) as unknown as NextRequest

      const result = await validateRequest(request, CreateClaimSchema)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(expect.objectContaining(validBody))
    })

    it('should return validation errors for invalid data', async () => {
      const invalidBody = {
        claimed_amount: -100, // Invalid: negative
      }

      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidBody),
      }) as unknown as NextRequest

      const result = await validateRequest(request, CreateClaimSchema)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
      expect(result.details).toBeTruthy()
    })

    it('should handle JSON parse errors', async () => {
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json {',
      }) as unknown as NextRequest

      const result = await validateRequest(request, CreateClaimSchema)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid JSON')
    })
  })

  describe('validateQueryParams', () => {
    it('should validate query params successfully', () => {
      const searchParams = new URLSearchParams({
        page: '1',
        limit: '20',
        status: 'active',
      })

      const Schema = {
        safeParse: jest.fn((data) => ({
          success: true,
          data,
        })),
      }

      const result = validateQueryParams(searchParams, Schema as unknown)

      expect(result.success).toBe(true)
    })

    it('should return validation errors for invalid params', () => {
      const searchParams = new URLSearchParams({
        page: 'invalid',
      })

      const Schema = {
        safeParse: jest.fn(() => ({
          success: false,
          error: {
            format: () => ({ page: { _errors: ['Invalid number'] } }),
          },
        })),
      }

      const result = validateQueryParams(searchParams, Schema as unknown)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })
})
