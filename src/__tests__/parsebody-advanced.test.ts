/**
 * Advanced tests for parseBody with Zod schema validation
 * Tests the integration between parseBody and per-route schemas
 */

import {{ z }} from 'zod'

// Simulated parseBody
function parseBody<T>(
  body: unknown,
  schema?: z.ZodSchema<T>
): {{ data: T | null; error: {{ status: number; details?: unknown }} | null }} {{
  if (body === null || body === undefined) {{
    return {{ data: null, error: {{ status: 400 }} }}
  }}

  if (schema) {{
    const result = schema.safeParse(body)
    if (!result.success) {{
      return {{
        data: null,
        error: {{
          status: 422,
          details: result.error.issues.map(i => ({{ field: i.path.join('.'), message: i.message }})),
        }},
      }}
    }}
    return {{ data: result.data, error: null }}
  }}

  return {{ data: body as T, error: null }}
}}

// Sample route schemas
const recruitmentSchema = z.object({{
  mobile: z.string().min(10),
  partnerType: z.enum(['BUSINESS_ASSOCIATE', 'CHANNEL_PARTNER', 'DSA']),
  name: z.string().min(1),
  email: z.string().email().optional(),
  channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL']).optional().default('WHATSAPP'),
}})

const bulkAssignSchema = z.object({{
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  assignTo: z.string().uuid(),
  reason: z.string().optional(),
}})

const dateRangeSchema = z.object({{
  startDate: z.string().regex(/^\d{{4}}-\d{{2}}-\d{{2}}$/),
  endDate: z.string().regex(/^\d{{4}}-\d{{2}}-\d{{2}}$/),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
}})

// Tests
describe('parseBody with recruitment schema', () => {{
  test('validates complete recruitment data', () => {{
    const body = {{
      mobile: '9876543210',
      partnerType: 'BUSINESS_ASSOCIATE',
      name: 'Priya Sharma',
      email: 'priya@example.com',
    }}
    const result = parseBody(body, recruitmentSchema)
    expect(result.error).toBeNull()
    expect(result.data!.channel).toBe('WHATSAPP') // default
  }})

  test('rejects invalid partner type', () => {{
    const body = {{ mobile: '9876543210', partnerType: 'INVALID', name: 'Test' }}
    const result = parseBody(body, recruitmentSchema)
    expect(result.error!.status).toBe(422)
  }})

  test('rejects short mobile', () => {{
    const body = {{ mobile: '123', partnerType: 'DSA', name: 'Test' }}
    expect(parseBody(body, recruitmentSchema).error!.status).toBe(422)
  }})
}})

describe('parseBody with bulk assign schema', () => {{
  test('accepts valid bulk assignment', () => {{
    const body = {{
      leadIds: ['550e8400-e29b-41d4-a716-446655440000'],
      assignTo: '550e8400-e29b-41d4-a716-446655440001',
    }}
    expect(parseBody(body, bulkAssignSchema).error).toBeNull()
  }})

  test('rejects empty leadIds', () => {{
    const body = {{ leadIds: [], assignTo: '550e8400-e29b-41d4-a716-446655440001' }}
    expect(parseBody(body, bulkAssignSchema).error!.status).toBe(422)
  }})

  test('rejects over 100 leads', () => {{
    const body = {{
      leadIds: Array.from({{ length: 101 }}, () => '550e8400-e29b-41d4-a716-446655440000'),
      assignTo: '550e8400-e29b-41d4-a716-446655440001',
    }}
    expect(parseBody(body, bulkAssignSchema).error!.status).toBe(422)
  }})

  test('rejects non-UUID leadIds', () => {{
    const body = {{ leadIds: ['not-a-uuid'], assignTo: '550e8400-e29b-41d4-a716-446655440001' }}
    expect(parseBody(body, bulkAssignSchema).error!.status).toBe(422)
  }})
}})

describe('parseBody with date range schema', () => {{
  test('accepts valid date range', () => {{
    const body = {{ startDate: '2025-01-01', endDate: '2025-03-31' }}
    const result = parseBody(body, dateRangeSchema)
    expect(result.error).toBeNull()
    expect(result.data!.groupBy).toBe('day')
  }})

  test('rejects invalid date format', () => {{
    const body = {{ startDate: '01/01/2025', endDate: '03/31/2025' }}
    expect(parseBody(body, dateRangeSchema).error!.status).toBe(422)
  }})

  test('accepts custom groupBy', () => {{
    const body = {{ startDate: '2025-01-01', endDate: '2025-12-31', groupBy: 'month' }}
    const result = parseBody(body, dateRangeSchema)
    expect(result.data!.groupBy).toBe('month')
  }})
}})

describe('parseBody without schema', () => {{
  test('passes through raw body', () => {{
    const body = {{ anything: 'goes', nested: {{ deep: true }} }}
    const result = parseBody(body)
    expect(result.error).toBeNull()
    expect((result.data as Record<string, unknown>).anything).toBe('goes')
  }})

  test('rejects null body', () => {{
    expect(parseBody(null).error!.status).toBe(400)
  }})

  test('rejects undefined body', () => {{
    expect(parseBody(undefined).error!.status).toBe(400)
  }})
}})
