export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * Helper to check Super Admin session from cookie
 */
async function checkSuperAdminSession(request: NextRequest): Promise<{ isValid: boolean; adminId?: string; adminName?: string }> {
  const superAdminSession = request.cookies.get('super_admin_session')?.value
  if (!superAdminSession) {
    return { isValid: false }
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: session, error } = await supabaseAdmin
    .from('super_admin_sessions')
    .select('super_admin_id, expires_at')
    .eq('session_id', superAdminSession)
    .maybeSingle()

  if (error || !session) {
    return { isValid: false }
  }

  if (new Date(session.expires_at) < new Date()) {
    return { isValid: false }
  }

  const { data: admin } = await supabaseAdmin
    .from('super_admins')
    .select('id, full_name, is_active, is_locked')
    .eq('id', session.super_admin_id)
    .maybeSingle()

  if (!admin || !admin.is_active || admin.is_locked) {
    return { isValid: false }
  }

  return { isValid: true, adminId: admin.id, adminName: admin.full_name }
}

async function authenticateSuperAdmin(request: NextRequest): Promise<{
  authorized: boolean
  adminId?: string
  adminName?: string
  errorResponse?: NextResponse
}> {
  const superAdminCheck = await checkSuperAdminSession(request)
  if (superAdminCheck.isValid) {
    return { authorized: true, adminId: superAdminCheck.adminId, adminName: superAdminCheck.adminName }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: admin } = await supabaseAdmin
    .from('super_admins')
    .select('id, full_name')
    .eq('id', user.id)
    .eq('is_active', true)
    .eq('is_locked', false)
    .maybeSingle()

  if (admin) {
    return { authorized: true, adminId: admin.id, adminName: admin.full_name }
  }

  return {
    authorized: false,
    errorResponse: NextResponse.json(
      { success: false, error: 'Forbidden', message: 'Only Super Admins can manage A/B tests' },
      { status: 403 }
    ),
  }
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/**
 * GET /api/notifications/ab-tests/[id]
 * Get a single A/B test by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await authenticateSuperAdmin(request)
    if (!auth.authorized) return auth.errorResponse!

    const { id } = await params

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid test ID' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()
    const { data: test, error } = await supabaseAdmin
      .from('notification_ab_tests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error

    if (!test) {
      return NextResponse.json(
        { success: false, error: 'A/B test not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, test })
  } catch (error) {
    apiLogger.error('Error fetching A/B test', error)
    logApiError(error as Error, request, { action: 'get_ab_test' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch A/B test' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications/ab-tests/[id]
 * Update an A/B test (only draft tests can be fully updated)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await authenticateSuperAdmin(request)
    if (!auth.authorized) return auth.errorResponse!

    const { id } = await params

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid test ID' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Fetch existing test
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('notification_ab_tests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'A/B test not found' },
        { status: 404 }
      )
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Only draft tests can be updated. Pause or stop the test first.' },
        { status: 409 }
      )
    }

    const body = await request.json()
    const { name, description, notification_type, sample_size_percent, confidence_level, variants } = body

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Test name cannot be empty' },
          { status: 400 }
        )
      }
      if (name.trim().length > 200) {
        return NextResponse.json(
          { success: false, error: 'Test name must be 200 characters or less' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    if (notification_type !== undefined) {
      if (!['email', 'sms', 'push'].includes(notification_type)) {
        return NextResponse.json(
          { success: false, error: 'Invalid notification type' },
          { status: 400 }
        )
      }
      updateData.notification_type = notification_type
    }

    if (sample_size_percent !== undefined) {
      updateData.sample_size_percent = Math.min(50, Math.max(5, sample_size_percent))
    }

    if (confidence_level !== undefined) {
      updateData.confidence_level = [90, 95, 99].includes(confidence_level) ? confidence_level : 95
    }

    if (variants !== undefined) {
      if (!Array.isArray(variants) || variants.length < 2 || variants.length > 4) {
        return NextResponse.json(
          { success: false, error: 'Must provide between 2 and 4 variants' },
          { status: 400 }
        )
      }

      for (const variant of variants) {
        if (!variant.content || typeof variant.content !== 'string' || variant.content.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: `Variant "${variant.name || 'Unknown'}" must have content` },
            { status: 400 }
          )
        }
      }

      const controlCount = variants.filter((v: { is_control?: boolean }) => v.is_control).length
      if (controlCount !== 1) {
        return NextResponse.json(
          { success: false, error: 'Exactly one variant must be marked as control' },
          { status: 400 }
        )
      }

      updateData.variants = variants.map((v: { id?: string; name?: string; subject?: string; content: string; is_control?: boolean }, index: number) => ({
        id: v.id || crypto.randomUUID(),
        name: v.name || `Variant ${String.fromCharCode(65 + index)}`,
        subject: v.subject || '',
        content: v.content.trim(),
        is_control: !!v.is_control,
        sent_count: 0,
        open_count: 0,
        click_count: 0,
        conversion_count: 0,
        open_rate: 0,
        click_rate: 0,
        conversion_rate: 0,
      }))
    }

    const { data: test, error } = await supabaseAdmin
      .from('notification_ab_tests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, test, message: 'A/B test updated successfully' })
  } catch (error) {
    apiLogger.error('Error updating A/B test', error)
    logApiError(error as Error, request, { action: 'update_ab_test' })
    return NextResponse.json(
      { success: false, error: 'Failed to update A/B test' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/ab-tests/[id]
 * Delete an A/B test (only draft or completed tests)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await authenticateSuperAdmin(request)
    if (!auth.authorized) return auth.errorResponse!

    const { id } = await params

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid test ID' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Fetch existing test to check status
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('notification_ab_tests')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'A/B test not found' },
        { status: 404 }
      )
    }

    if (existing.status === 'running') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete a running test. Pause it first.' },
        { status: 409 }
      )
    }

    const { error } = await supabaseAdmin
      .from('notification_ab_tests')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'A/B test deleted successfully' })
  } catch (error) {
    apiLogger.error('Error deleting A/B test', error)
    logApiError(error as Error, request, { action: 'delete_ab_test' })
    return NextResponse.json(
      { success: false, error: 'Failed to delete A/B test' },
      { status: 500 }
    )
  }
}
