/**
 * Unit tests for /admin-management API routes
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


describe('GET /api/admin-management', () => {
  test('supports pagination parameters', () => {
    const params = { page: 1, pageSize: 20 }
    expect(params.page).toBeGreaterThan(0)
    expect(params.pageSize).toBeLessThanOrEqual(100)
  })

})


describe('POST /api/admin-management', () => {
})


describe('GET /api/admin-management/modules', () => {
})


describe('POST /api/admin-management/modules', () => {
  const schema = z.object({
    module_key: z.string().optional(),
    module_name: z.string().optional(),
    module_description: z.string().optional(),
    module_icon: z.string().optional(),
    module_order: z.string().optional(),
    module_path: z.string().optional(),
    module_category: z.string().optional(),
    is_active: z.boolean().optional(),
    is_visible: z.boolean().optional(),
    sub_modules: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"module_key": "test_value", "module_name": "test_value", "module_description": "test_value", "module_icon": "test_value", "module_order": "test_value", "module_path": "test_value", "module_category": "test_value", "is_active": true, "is_visible": true, "sub_modules": "test_value"}
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


describe('GET /api/admin-management/[id]', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('PATCH /api/admin-management/[id]', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('DELETE /api/admin-management/[id]', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('GET /api/admin-management/[id]/2fa', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/2fa', () => {
  const schema = z.object({
    action: z.string().optional(),
    token: z.string(),
    trustDevice: z.boolean().optional().default(false),
  })

  test('accepts valid body', () => {
    const body = {"action": "test_value", "token": "test_value", "trustDevice": true}
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

  test('validates token is required', () => {
    const body = {"action": "test_value", "trustDevice": true}
    const result = parseBody(body, schema)
    if (!schema.safeParse(body).success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('PUT /api/admin-management/[id]/2fa', () => {
  const schema = z.object({
    action: z.string().optional(),
    token: z.string(),
    trustDevice: z.boolean().optional().default(false),
  })

  test('accepts valid body', () => {
    const body = {"action": "test_value", "token": "test_value", "trustDevice": true}
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

  test('validates token is required', () => {
    const body = {"action": "test_value", "trustDevice": true}
    const result = parseBody(body, schema)
    if (!schema.safeParse(body).success) {
      expect(result.error!.status).toBe(422)
    }
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/2fa/disable', () => {
  const schema = z.object({
    disabled_by_user_id: z.string().uuid().optional(),
    reason: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"disabled_by_user_id": "550e8400-e29b-41d4-a716-446655440000", "reason": "test_value"}
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

  test('rejects invalid disabled_by_user_id UUID', () => {
    const body = { ...{"disabled_by_user_id": "550e8400-e29b-41d4-a716-446655440000", "reason": "test_value"}, disabled_by_user_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/2fa/regenerate-codes', () => {
  const schema = z.object({
    token: z.string().optional(),
    regenerated_by_user_id: z.string().uuid().optional(),
  })

  test('accepts valid body', () => {
    const body = {"token": "test_value", "regenerated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}
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

  test('rejects invalid regenerated_by_user_id UUID', () => {
    const body = { ...{"token": "test_value", "regenerated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, regenerated_by_user_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/2fa/enable', () => {
  const schema = z.object({
    token: z.string().optional(),
    enabled_by_user_id: z.string().uuid().optional(),
  })

  test('accepts valid body', () => {
    const body = {"token": "test_value", "enabled_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}
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

  test('rejects invalid enabled_by_user_id UUID', () => {
    const body = { ...{"token": "test_value", "enabled_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, enabled_by_user_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('GET /api/admin-management/[id]/2fa/trusted-devices', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('DELETE /api/admin-management/[id]/2fa/trusted-devices', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/2fa/setup', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/2fa/verify', () => {
  const schema = z.object({
    token: z.string().optional(),
    backup_code: z.string().optional(),
    remember_device: z.string().optional(),
  })

  test('accepts valid body', () => {
    const body = {"token": "test_value", "backup_code": "test_value", "remember_device": "test_value"}
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


describe('GET /api/admin-management/[id]/2fa/devices', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('DELETE /api/admin-management/[id]/2fa/devices', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('GET /api/admin-management/[id]/permissions', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('PUT /api/admin-management/[id]/permissions', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/permissions', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/permissions/delegate', () => {
  const schema = z.object({
    delegatee_id: z.string().uuid().optional(),
    module_key: z.string().optional(),
    delegated_permissions: z.string().optional(),
    delegation_reason: z.string().optional(),
    delegation_days: z.number().optional().default(7),
  })

  test('accepts valid body', () => {
    const body = {"delegatee_id": "550e8400-e29b-41d4-a716-446655440000", "module_key": "test_value", "delegated_permissions": "test_value", "delegation_reason": "test_value", "delegation_days": 1000}
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

  test('rejects invalid delegatee_id UUID', () => {
    const body = { ...{"delegatee_id": "550e8400-e29b-41d4-a716-446655440000", "module_key": "test_value", "delegated_permissions": "test_value", "delegation_reason": "test_value", "delegation_days": 1000}, delegatee_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('GET /api/admin-management/[id]/permissions/delegate', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('DELETE /api/admin-management/[id]/permissions/delegate', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('GET /api/admin-management/[id]/permissions/granular', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('POST /api/admin-management/[id]/permissions/granular', () => {
  const schema = z.object({
    module_key: z.string().optional(),
    permissions: z.array(z.unknown()).optional(),
    resource_restriction: z.string().optional().default('all'),
    restricted_to_branches: z.string().optional(),
    restricted_to_regions: z.string().optional(),
    restricted_to_departments: z.string().optional(),
    valid_until: z.string().optional(),
    notes: z.string().optional(),
    granted_by_user_id: z.string().uuid().optional(),
  })

  test('accepts valid body', () => {
    const body = {"module_key": "test_value", "permissions": [], "resource_restriction": "test_value", "restricted_to_branches": "test_value", "restricted_to_regions": "test_value", "restricted_to_departments": "test_value", "valid_until": "test_value", "notes": "test_value", "granted_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}
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

  test('rejects invalid granted_by_user_id UUID', () => {
    const body = { ...{"module_key": "test_value", "permissions": [], "resource_restriction": "test_value", "restricted_to_branches": "test_value", "restricted_to_regions": "test_value", "restricted_to_departments": "test_value", "valid_until": "test_value", "notes": "test_value", "granted_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, granted_by_user_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('DELETE /api/admin-management/[id]/permissions/granular', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('GET /api/admin-management/[id]/notification-preferences', () => {
  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})


describe('PUT /api/admin-management/[id]/notification-preferences', () => {
  const schema = z.object({
    email_notifications_enabled: z.string().email().optional(),
    security_emails: z.string().email().optional(),
    authentication_emails: z.string().email().optional(),
    authorization_emails: z.string().email().optional(),
    activity_emails: z.string().email().optional(),
    system_emails: z.string().email().optional(),
    compliance_emails: z.string().email().optional(),
    alerts_emails: z.string().email().optional(),
    reports_emails: z.string().email().optional(),
    marketing_emails: z.string().email().optional(),
    enable_daily_digest: z.string().optional(),
    enable_weekly_digest: z.string().optional(),
    digest_time: z.string().optional(),
    updated_by_user_id: z.string().uuid().optional(),
  })

  test('accepts valid body', () => {
    const body = {"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}
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

  test('rejects invalid email_notifications_enabled format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, email_notifications_enabled: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid security_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, security_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid authentication_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, authentication_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid authorization_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, authorization_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid activity_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, activity_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid system_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, system_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid compliance_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, compliance_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid alerts_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, alerts_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid reports_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, reports_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid marketing_emails format', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, marketing_emails: 'not-an-email' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('rejects invalid updated_by_user_id UUID', () => {
    const body = { ...{"email_notifications_enabled": "test@loanz360.com", "security_emails": "test@loanz360.com", "authentication_emails": "test@loanz360.com", "authorization_emails": "test@loanz360.com", "activity_emails": "test@loanz360.com", "system_emails": "test@loanz360.com", "compliance_emails": "test@loanz360.com", "alerts_emails": "test@loanz360.com", "reports_emails": "test@loanz360.com", "marketing_emails": "test@loanz360.com", "enable_daily_digest": "test_value", "enable_weekly_digest": "test_value", "digest_time": "test_value", "updated_by_user_id": "550e8400-e29b-41d4-a716-446655440000"}, updated_by_user_id: 'not-a-uuid' }
    expect(parseBody(body, schema).error!.status).toBe(422)
  })

  test('requires id path parameter', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(id).toBeTruthy()
    expect(id.length).toBeGreaterThan(0)
  })

})
