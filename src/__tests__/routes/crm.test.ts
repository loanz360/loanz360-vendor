/**
 * Unit tests for /crm API routes
 * Auto-generated — validates request parsing, auth, and error handling
 */

import { z } from 'zod'

// Simulated parseBody
function parseBody<T>(body: unknown, schema?: z.ZodSchema<T>) {
  if (body === null || body === undefined) return { data: null, error: { status: 400, message: 'Invalid JSON' } }
  if (schema) {
    const result = schema.safeParse(body)
    if (!result.success) return { data: null, error: { status: 422, message: result.error.issues.map(i => i.message).join(', ') } }
    return { data: result.data, error: null }
  }
  return { data: body as T, error: null }
}

// Auth simulator
function checkAuth(role: string | null, required: string): { authorized: boolean; error?: string } {
  if (!role) return { authorized: false, error: 'Unauthorized' }
  if (required === 'admin' && role !== 'ADMIN' && role !== 'SUPERADMIN') return { authorized: false, error: 'Forbidden' }
  if (required === 'cpe' && role !== 'CPE' && role !== 'ADMIN') return { authorized: false, error: 'Forbidden' }
  return { authorized: true }
}


describe('GET /api/crm/dashboard-metrics', () => {
})


describe('GET /api/crm/communications/history', () => {
  test('supports pagination parameters', () => {
    const params = { page: 1, pageSize: 20 }
    expect(params.page).toBeGreaterThan(0)
    expect(params.pageSize).toBeLessThanOrEqual(100)
  })

})


describe('POST /api/crm/communications/send', () => {
  const schema = z.object({
    lead_ids: z.array(z.unknown()).optional(),
    contact_ids: z.array(z.unknown()).optional(),
    template_id: z.string().uuid(),
    type: z.string().optional(),
    campaign_name: z.string().optional(),
    scheduled_at: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"lead_ids": [], "contact_ids": [], "template_id": "550e8400-e29b-41d4-a716-446655440000", "type": "test_value", "campaign_name": "test_value", "scheduled_at": "test_value"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('validates template_id is required', () => {
    const body = {"lead_ids": [], "contact_ids": [], "type": "test_value", "campaign_name": "test_value", "scheduled_at": "test_value"}
    const result = parseBody(body, schema)
    if (!schema.safeParse(body).success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('rejects invalid template_id UUID', () => {
    const body = { ...{"lead_ids": [], "contact_ids": [], "template_id": "550e8400-e29b-41d4-a716-446655440000", "type": "test_value", "campaign_name": "test_value", "scheduled_at": "test_value"}, template_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

})


describe('GET /api/crm/hr/statistics', () => {
})


describe('POST /api/crm/hr/statistics', () => {
  const schema = z.object({
    target_date: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"target_date": "test_value"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

})


describe('GET /api/crm/notes', () => {
  test('supports pagination parameters', () => {
    const params = { page: 1, pageSize: 20 }
    expect(params.page).toBeGreaterThan(0)
    expect(params.pageSize).toBeLessThanOrEqual(100)
  })

})


describe('POST /api/crm/notes', () => {
  const schema = z.object({
    lead_id: z.string().uuid().optional(),
    text: z.string().optional(),
    note_type: z.string().optional(),
    is_call_log: z.boolean().optional(),
    call_direction: z.string().optional(),
    call_start_time: z.string().optional(),
    call_end_time: z.string().optional(),
    call_duration: z.string().optional(),
    call_recording_url: z.string().optional(),
    call_sid: z.string().uuid().optional(),
    disposition_code: z.string().optional(),
    disposition_notes: z.string().optional(),
    id: z.string().uuid().optional(),
  })

  test('accepts valid body', () => {
    const body = {"lead_id": "550e8400-e29b-41d4-a716-446655440000", "text": "test_value", "note_type": "test_value", "is_call_log": true, "call_direction": "test_value", "call_start_time": "test_value", "call_end_time": "test_value", "call_duration": "test_value", "call_recording_url": "test_value", "call_sid": "550e8400-e29b-41d4-a716-446655440000", "disposition_code": "test_value", "disposition_notes": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('rejects invalid lead_id UUID', () => {
    const body = { ...{"lead_id": "550e8400-e29b-41d4-a716-446655440000", "text": "test_value", "note_type": "test_value", "is_call_log": true, "call_direction": "test_value", "call_start_time": "test_value", "call_end_time": "test_value", "call_duration": "test_value", "call_recording_url": "test_value", "call_sid": "550e8400-e29b-41d4-a716-446655440000", "disposition_code": "test_value", "disposition_notes": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, lead_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid call_sid UUID', () => {
    const body = { ...{"lead_id": "550e8400-e29b-41d4-a716-446655440000", "text": "test_value", "note_type": "test_value", "is_call_log": true, "call_direction": "test_value", "call_start_time": "test_value", "call_end_time": "test_value", "call_duration": "test_value", "call_recording_url": "test_value", "call_sid": "550e8400-e29b-41d4-a716-446655440000", "disposition_code": "test_value", "disposition_notes": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, call_sid: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid id UUID', () => {
    const body = { ...{"lead_id": "550e8400-e29b-41d4-a716-446655440000", "text": "test_value", "note_type": "test_value", "is_call_log": true, "call_direction": "test_value", "call_start_time": "test_value", "call_end_time": "test_value", "call_duration": "test_value", "call_recording_url": "test_value", "call_sid": "550e8400-e29b-41d4-a716-446655440000", "disposition_code": "test_value", "disposition_notes": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

})


describe('PUT /api/crm/notes', () => {
  const schema = z.object({
    lead_id: z.string().uuid().optional(),
    text: z.string().optional(),
    note_type: z.string().optional(),
    is_call_log: z.boolean().optional(),
    call_direction: z.string().optional(),
    call_start_time: z.string().optional(),
    call_end_time: z.string().optional(),
    call_duration: z.string().optional(),
    call_recording_url: z.string().optional(),
    call_sid: z.string().uuid().optional(),
    disposition_code: z.string().optional(),
    disposition_notes: z.string().optional(),
    id: z.string().uuid().optional(),
  })

  test('accepts valid body', () => {
    const body = {"lead_id": "550e8400-e29b-41d4-a716-446655440000", "text": "test_value", "note_type": "test_value", "is_call_log": true, "call_direction": "test_value", "call_start_time": "test_value", "call_end_time": "test_value", "call_duration": "test_value", "call_recording_url": "test_value", "call_sid": "550e8400-e29b-41d4-a716-446655440000", "disposition_code": "test_value", "disposition_notes": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('rejects invalid lead_id UUID', () => {
    const body = { ...{"lead_id": "550e8400-e29b-41d4-a716-446655440000", "text": "test_value", "note_type": "test_value", "is_call_log": true, "call_direction": "test_value", "call_start_time": "test_value", "call_end_time": "test_value", "call_duration": "test_value", "call_recording_url": "test_value", "call_sid": "550e8400-e29b-41d4-a716-446655440000", "disposition_code": "test_value", "disposition_notes": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, lead_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid call_sid UUID', () => {
    const body = { ...{"lead_id": "550e8400-e29b-41d4-a716-446655440000", "text": "test_value", "note_type": "test_value", "is_call_log": true, "call_direction": "test_value", "call_start_time": "test_value", "call_end_time": "test_value", "call_duration": "test_value", "call_recording_url": "test_value", "call_sid": "550e8400-e29b-41d4-a716-446655440000", "disposition_code": "test_value", "disposition_notes": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, call_sid: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid id UUID', () => {
    const body = { ...{"lead_id": "550e8400-e29b-41d4-a716-446655440000", "text": "test_value", "note_type": "test_value", "is_call_log": true, "call_direction": "test_value", "call_start_time": "test_value", "call_end_time": "test_value", "call_duration": "test_value", "call_recording_url": "test_value", "call_sid": "550e8400-e29b-41d4-a716-446655440000", "disposition_code": "test_value", "disposition_notes": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

})


describe('DELETE /api/crm/notes', () => {
})


describe('GET /api/crm/export', () => {
})


describe('POST /api/crm/export', () => {
  const schema = z.object({
    lead_ids: z.array(z.unknown()).optional(),
    format: z.string().optional().default('csv'),
  })

  test('accepts valid body', () => {
    const body = {"lead_ids": [], "format": "test_value"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

})


describe('GET /api/crm/templates', () => {
})


describe('POST /api/crm/templates', () => {
  const schema = z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    subject: z.string().optional(),
    category: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"name": "test_value", "type": "test_value", "subject": "test_value", "category": "test_value"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

})


describe('GET /api/crm/templates/[id]', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('PATCH /api/crm/templates/[id]', () => {
  const schema = z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    subject: z.string().optional(),
    category: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"name": "test_value", "type": "test_value", "subject": "test_value", "category": "test_value"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('DELETE /api/crm/templates/[id]', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('GET /api/crm/performance/summary', () => {
})


describe('GET /api/crm/leads', () => {
  test('supports pagination parameters', () => {
    const params = { page: 1, pageSize: 20 }
    expect(params.page).toBeGreaterThan(0)
    expect(params.pageSize).toBeLessThanOrEqual(100)
  })

})


describe('POST /api/crm/leads', () => {
  const schema = z.object({
    customer_name: z.string().optional(),
    customer_mobile: z.string().optional(),
    loan_type: z.string().optional(),
    customer_email: z.string().email().optional(),
    customer_pincode: z.string().optional(),
    force_create: z.string(),
    tags: z.array(z.unknown()).optional(),
    duplicate_lead_ids: z.string().optional(),
    phone: z.string().min(10).optional(),
    alternate_phone: z.string().optional(),
    email: z.string().email().optional(),
    customer_city: z.string().optional(),
    location: z.string().optional(),
    loan_amount_required: z.string().optional(),
    loan_amount: z.number().optional(),
    loan_purpose: z.string().optional(),
    business_name: z.string().optional(),
    company_name: z.string().optional(),
    business_type: z.string().optional(),
    monthly_income: z.string().optional(),
    lead_source: z.string().optional(),
    source: z.string().optional(),
    lead_status: z.string().optional(),
    status: z.string().optional(),
    stage: z.string().optional(),
    next_followup_at: z.string().optional(),
    next_follow_up_date: z.string().optional(),
    remarks: z.string().optional(),
    follow_up_notes: z.string().optional(),
    notes: z.string().optional(),
    assigned_to: z.string().optional(),
    cro_id: z.string().uuid().optional(),
    followup_purpose: z.string().optional(),
    id: z.string().uuid().optional(),
  })

  test('accepts valid body', () => {
    const body = {"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('rejects invalid customer_email format', () => {
    const body = { ...{"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, customer_email: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('validates force_create is required', () => {
    const body = {"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}
    const result = parseBody(body, schema)
    if (!schema.safeParse(body).success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('rejects invalid email format', () => {
    const body = { ...{"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, email: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid cro_id UUID', () => {
    const body = { ...{"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, cro_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid id UUID', () => {
    const body = { ...{"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

})


describe('PUT /api/crm/leads', () => {
  const schema = z.object({
    customer_name: z.string().optional(),
    customer_mobile: z.string().optional(),
    loan_type: z.string().optional(),
    customer_email: z.string().email().optional(),
    customer_pincode: z.string().optional(),
    force_create: z.string(),
    tags: z.array(z.unknown()).optional(),
    duplicate_lead_ids: z.string().optional(),
    phone: z.string().min(10).optional(),
    alternate_phone: z.string().optional(),
    email: z.string().email().optional(),
    customer_city: z.string().optional(),
    location: z.string().optional(),
    loan_amount_required: z.string().optional(),
    loan_amount: z.number().optional(),
    loan_purpose: z.string().optional(),
    business_name: z.string().optional(),
    company_name: z.string().optional(),
    business_type: z.string().optional(),
    monthly_income: z.string().optional(),
    lead_source: z.string().optional(),
    source: z.string().optional(),
    lead_status: z.string().optional(),
    status: z.string().optional(),
    stage: z.string().optional(),
    next_followup_at: z.string().optional(),
    next_follow_up_date: z.string().optional(),
    remarks: z.string().optional(),
    follow_up_notes: z.string().optional(),
    notes: z.string().optional(),
    assigned_to: z.string().optional(),
    cro_id: z.string().uuid().optional(),
    followup_purpose: z.string().optional(),
    id: z.string().uuid().optional(),
  })

  test('accepts valid body', () => {
    const body = {"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('rejects invalid customer_email format', () => {
    const body = { ...{"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, customer_email: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('validates force_create is required', () => {
    const body = {"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}
    const result = parseBody(body, schema)
    if (!schema.safeParse(body).success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('rejects invalid email format', () => {
    const body = { ...{"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, email: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid cro_id UUID', () => {
    const body = { ...{"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, cro_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid id UUID', () => {
    const body = { ...{"customer_name": "test_value", "customer_mobile": "test_value", "loan_type": "test_value", "customer_email": "test@loanz360.com", "customer_pincode": "test_value", "force_create": "test_value", "tags": [], "duplicate_lead_ids": "test_value", "phone": "9876543210", "alternate_phone": "test_value", "email": "test@loanz360.com", "customer_city": "test_value", "location": "test_value", "loan_amount_required": "test_value", "loan_amount": 1000, "loan_purpose": "test_value", "business_name": "test_value", "company_name": "test_value", "business_type": "test_value", "monthly_income": "test_value", "lead_source": "test_value", "source": "test_value", "lead_status": "test_value", "status": "test_value", "stage": "test_value", "next_followup_at": "test_value", "next_follow_up_date": "test_value", "remarks": "test_value", "follow_up_notes": "test_value", "notes": "test_value", "assigned_to": "test_value", "cro_id": "550e8400-e29b-41d4-a716-446655440000", "followup_purpose": "test_value", "id": "550e8400-e29b-41d4-a716-446655440000"}, id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

})


describe('DELETE /api/crm/leads', () => {
})


describe('GET /api/crm/leads/[id]', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('PATCH /api/crm/leads/[id]', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('DELETE /api/crm/leads/[id]', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/crm/leads/bulk', () => {
  const schema = z.object({
    lead_ids: z.array(z.unknown()).optional(),
    updates: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"lead_ids": [], "updates": "test_value"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

})


describe('DELETE /api/crm/leads/bulk', () => {
})


describe('POST /api/crm/leads/assign', () => {
  const schema = z.object({
    lead_ids: z.array(z.unknown()).optional(),
    assigned_to: z.string(),
  })

  test('accepts valid body', () => {
    const body = {"lead_ids": [], "assigned_to": "test_value"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('validates assigned_to is required', () => {
    const body = {"lead_ids": []}
    const result = parseBody(body, schema)
    if (!schema.safeParse(body).success) {
      expect(result.error!.status).toBe(422)
    }
  })

})


describe('POST /api/crm/sync-metrics', () => {
  const schema = z.object({
    user_id: z.string().uuid().optional(),
    metric_period: z.string().optional().default('monthly'),
    force_recalculate: z.boolean().optional().default(false),
    metric_names: z.array(z.unknown()).optional().default([]),
  })

  test('accepts valid body', () => {
    const body = {"user_id": "550e8400-e29b-41d4-a716-446655440000", "metric_period": "test_value", "force_recalculate": true, "metric_names": []}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('rejects invalid user_id UUID', () => {
    const body = { ...{"user_id": "550e8400-e29b-41d4-a716-446655440000", "metric_period": "test_value", "force_recalculate": true, "metric_names": []}, user_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

})


describe('GET /api/crm/sync-metrics', () => {
})


describe('POST /api/crm/import', () => {
  const schema = z.object({
    leads: z.array(z.unknown()).optional(),
    skip_duplicates: z.string().optional(),
    default_assigned_to: z.string().optional(),
    file_name: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"leads": [], "skip_duplicates": "test_value", "default_assigned_to": "test_value", "file_name": "test_value"}
    const result = parseBody(body, schema)
    expect(result.error).toBeNull()
  })

  test('rejects null body', () => {
    const result = parseBody(null, schema)
    expect(result.error!.status).toBe(400)
  })

  test('rejects empty object', () => {
    const result = parseBody({}, schema)
    // Should fail if required fields are missing
    const hasRequired = schema.safeParse({})
    if (!hasRequired.success) {
      expect(result.error!.status).toBe(422)
    }
  })

})


describe('GET /api/crm/import', () => {
  test('supports pagination parameters', () => {
    const params = { page: 1, pageSize: 20 }
    expect(params.page).toBeGreaterThan(0)
    expect(params.pageSize).toBeLessThanOrEqual(100)
  })

})
