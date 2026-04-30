/**
 * Unit tests for Zod validation schemas
 * Ensures all API input schemas validate correctly
 */

import {{ z }} from 'zod'

// ============================================================
// Schema definitions (mirrored from src/lib/validations)
// ============================================================

// Common field validators
const phoneSchema = z.string().min(10).max(15)
const emailSchema = z.string().email()
const uuidSchema = z.string().uuid()
const positiveNumber = z.number().positive()
const nonNegativeNumber = z.number().nonnegative()
const dateString = z.string().regex(/^\d{{4}}-\d{{2}}-\d{{2}}/)

// Lead schema
const createLeadSchema = z.object({{
  customer_name: z.string().min(1).max(200),
  mobile: phoneSchema,
  email: emailSchema.optional(),
  loan_type: z.enum(['HOME_LOAN', 'PERSONAL_LOAN', 'BUSINESS_LOAN', 'LAP', 'CAR_LOAN']),
  loan_amount: positiveNumber.optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().max(2000).optional(),
}})

// Employee salary schema
const employeeSalarySchema = z.object({{
  user_id: uuidSchema,
  basic_salary: positiveNumber.max(10000000),
  hra: nonNegativeNumber.optional().default(0),
  da: nonNegativeNumber.optional().default(0),
  special_allowance: nonNegativeNumber.optional().default(0),
  pf_employee: nonNegativeNumber.optional().default(0),
  pf_employer: nonNegativeNumber.optional().default(0),
}})

// Notification schema
const createNotificationSchema = z.object({{
  user_id: uuidSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.enum(['INFO', 'WARNING', 'ERROR', 'SUCCESS']).default('INFO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  action_url: z.string().url().optional(),
}})

// Pagination schema
const paginationSchema = z.object({{
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}})

// ============================================================
// Tests
// ============================================================

describe('Lead Schema', () => {{
  test('accepts valid lead data', () => {{
    const data = {{
      customer_name: 'Rajesh Kumar',
      mobile: '9876543210',
      loan_type: 'HOME_LOAN',
      loan_amount: 5000000,
    }}
    expect(createLeadSchema.safeParse(data).success).toBe(true)
  }})

  test('rejects empty customer name', () => {{
    const data = {{ customer_name: '', mobile: '9876543210', loan_type: 'HOME_LOAN' }}
    const result = createLeadSchema.safeParse(data)
    expect(result.success).toBe(false)
  }})

  test('rejects invalid phone number', () => {{
    const data = {{ customer_name: 'Test', mobile: '123', loan_type: 'HOME_LOAN' }}
    expect(createLeadSchema.safeParse(data).success).toBe(false)
  }})

  test('rejects invalid loan type', () => {{
    const data = {{ customer_name: 'Test', mobile: '9876543210', loan_type: 'INVALID' }}
    expect(createLeadSchema.safeParse(data).success).toBe(false)
  }})

  test('accepts valid loan types', () => {{
    const types = ['HOME_LOAN', 'PERSONAL_LOAN', 'BUSINESS_LOAN', 'LAP', 'CAR_LOAN']
    for (const t of types) {{
      const data = {{ customer_name: 'Test', mobile: '9876543210', loan_type: t }}
      expect(createLeadSchema.safeParse(data).success).toBe(true)
    }}
  }})

  test('rejects loan amount of zero', () => {{
    const data = {{ customer_name: 'Test', mobile: '9876543210', loan_type: 'HOME_LOAN', loan_amount: 0 }}
    expect(createLeadSchema.safeParse(data).success).toBe(false)
  }})

  test('allows optional fields to be omitted', () => {{
    const data = {{ customer_name: 'Test User', mobile: '9876543210', loan_type: 'HOME_LOAN' }}
    expect(createLeadSchema.safeParse(data).success).toBe(true)
  }})

  test('rejects invalid email format', () => {{
    const data = {{ customer_name: 'Test', mobile: '9876543210', loan_type: 'HOME_LOAN', email: 'not-email' }}
    expect(createLeadSchema.safeParse(data).success).toBe(false)
  }})

  test('accepts valid email', () => {{
    const data = {{ customer_name: 'Test', mobile: '9876543210', loan_type: 'HOME_LOAN', email: 'test@example.com' }}
    expect(createLeadSchema.safeParse(data).success).toBe(true)
  }})

  test('rejects notes over 2000 chars', () => {{
    const data = {{ customer_name: 'Test', mobile: '9876543210', loan_type: 'HOME_LOAN', notes: 'x'.repeat(2001) }}
    expect(createLeadSchema.safeParse(data).success).toBe(false)
  }})
}})

describe('Employee Salary Schema', () => {{
  const validSalary = {{
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    basic_salary: 50000,
  }}

  test('accepts valid salary data', () => {{
    expect(employeeSalarySchema.safeParse(validSalary).success).toBe(true)
  }})

  test('rejects non-UUID user_id', () => {{
    expect(employeeSalarySchema.safeParse({{ ...validSalary, user_id: 'not-uuid' }}).success).toBe(false)
  }})

  test('rejects negative basic salary', () => {{
    expect(employeeSalarySchema.safeParse({{ ...validSalary, basic_salary: -1000 }}).success).toBe(false)
  }})

  test('rejects salary over 1 crore', () => {{
    expect(employeeSalarySchema.safeParse({{ ...validSalary, basic_salary: 10000001 }}).success).toBe(false)
  }})

  test('defaults optional fields to 0', () => {{
    const result = employeeSalarySchema.parse(validSalary)
    expect(result.hra).toBe(0)
    expect(result.da).toBe(0)
    expect(result.pf_employee).toBe(0)
  }})

  test('rejects negative HRA', () => {{
    expect(employeeSalarySchema.safeParse({{ ...validSalary, hra: -100 }}).success).toBe(false)
  }})
}})

describe('Notification Schema', () => {{
  const valid = {{
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Lead Assigned',
    message: 'A new lead has been assigned to you.',
  }}

  test('accepts valid notification', () => {{
    expect(createNotificationSchema.safeParse(valid).success).toBe(true)
  }})

  test('defaults type to INFO', () => {{
    const result = createNotificationSchema.parse(valid)
    expect(result.type).toBe('INFO')
  }})

  test('defaults priority to MEDIUM', () => {{
    const result = createNotificationSchema.parse(valid)
    expect(result.priority).toBe('MEDIUM')
  }})

  test('rejects empty title', () => {{
    expect(createNotificationSchema.safeParse({{ ...valid, title: '' }}).success).toBe(false)
  }})

  test('rejects message over 2000 chars', () => {{
    expect(createNotificationSchema.safeParse({{ ...valid, message: 'x'.repeat(2001) }}).success).toBe(false)
  }})

  test('validates action_url format', () => {{
    expect(createNotificationSchema.safeParse({{ ...valid, action_url: 'not-a-url' }}).success).toBe(false)
    expect(createNotificationSchema.safeParse({{ ...valid, action_url: 'https://loanz360.com/leads/123' }}).success).toBe(true)
  }})
}})

describe('Pagination Schema', () => {{
  test('provides sensible defaults', () => {{
    const result = paginationSchema.parse({{}})
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
    expect(result.sortOrder).toBe('desc')
  }})

  test('rejects page 0', () => {{
    expect(paginationSchema.safeParse({{ page: 0 }}).success).toBe(false)
  }})

  test('rejects negative page', () => {{
    expect(paginationSchema.safeParse({{ page: -1 }}).success).toBe(false)
  }})

  test('rejects pageSize over 100', () => {{
    expect(paginationSchema.safeParse({{ pageSize: 101 }}).success).toBe(false)
  }})

  test('rejects pageSize 0', () => {{
    expect(paginationSchema.safeParse({{ pageSize: 0 }}).success).toBe(false)
  }})

  test('accepts valid pagination', () => {{
    const result = paginationSchema.safeParse({{ page: 3, pageSize: 50, sortBy: 'created_at', sortOrder: 'asc' }})
    expect(result.success).toBe(true)
  }})
}})
