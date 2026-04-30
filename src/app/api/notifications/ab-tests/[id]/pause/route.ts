
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

async function checkSuperAdminSession(request: NextRequest): Promise<{ isValid: boolean; adminId?: string }> {
  const superAdminSession = request.cookies.get('super_admin_session')?.value
  if (!superAdminSession) return { isValid: false }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: session, error } = await supabaseAdmin
    .from('super_admin_sessions')
    .select('super_admin_id, expires_at')
    .eq('session_id', superAdminSession)
    .maybeSingle()

  if (error || !session || new Date(session.expires_at) < new Date()) return { isValid: false }

  const { data: admin } = await supabaseAdmin
    .from('super_admins')
    .select('id, is_active, is_locked')
    .eq('id', session.super_admin_id)
    .maybeSingle()

  if (!admin || !admin.is_active || admin.is_locked) return { isValid: false }
  return { isValid: true, adminId: admin.id }
}

async function authenticateSuperAdmin(request: NextRequest): Promise<{
  authorized: boolean
  adminId?: string
  errorResponse?: NextResponse
}> {
  const superAdminCheck = await checkSuperAdminSession(request)
  if (superAdminCheck.isValid) {
    return { authorized: true, adminId: superAdminCheck.adminId }
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
    .select('id')
    .eq('id', user.id)
    .eq('is_active', true)
    .eq('is_locked', false)
    .maybeSingle()

  if (admin) return { authorized: true, adminId: admin.id }

  return {
    authorized: false,
    errorResponse: NextResponse.json(
      { success: false, error: 'Forbidden', message: 'Only Super Admins can manage A/B tests' },
      { status: 403 }
    ),
  }
}

/**
 * POST /api/notifications/ab-tests/[id]/pause
 * Pause a running A/B test
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await authenticateSuperAdmin(request)
    if (!auth.authorized) return auth.errorResponse!

    const { id } = await params

    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid test ID' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

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

    if (existing.status !== 'running') {
      return NextResponse.json(
        { success: false, error: `Cannot pause a test with status "${existing.status}". Only running tests can be paused.` },
        { status: 409 }
      )
    }

    const { data: test, error } = await supabaseAdmin
      .from('notification_ab_tests')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      test,
      message: 'A/B test paused successfully',
    })
  } catch (error) {
    apiLogger.error('Error pausing A/B test', error)
    logApiError(error as Error, request, { action: 'pause_ab_test' })
    return NextResponse.json(
      { success: false, error: 'Failed to pause A/B test' },
      { status: 500 }
    )
  }
}
