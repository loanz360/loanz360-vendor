
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

/**
 * Authenticate the request as a Super Admin (cookie or auth user)
 */
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

  // Fallback: check regular user authentication
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

  // Check if user is a super admin via the super_admins table
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

/**
 * GET /api/notifications/ab-tests
 * List all A/B tests with optional filtering and pagination
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await authenticateSuperAdmin(request)
    if (!auth.authorized) return auth.errorResponse!

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const offset = (page - 1) * limit

    const supabaseAdmin = createSupabaseAdmin()

    let query = supabaseAdmin
      .from('notification_ab_tests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status && ['draft', 'running', 'completed', 'paused'].includes(status)) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: tests, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      tests: tests || [],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching A/B tests', error)
    logApiError(error as Error, request, { action: 'get_ab_tests' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch A/B tests' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications/ab-tests
 * Create a new A/B test
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await authenticateSuperAdmin(request)
    if (!auth.authorized) return auth.errorResponse!

    const body = await request.json()
    const { name, description, notification_type, sample_size_percent, confidence_level, variants } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Test name is required' },
        { status: 400 }
      )
    }

    if (name.trim().length > 200) {
      return NextResponse.json(
        { success: false, error: 'Test name must be 200 characters or less' },
        { status: 400 }
      )
    }

    if (!notification_type || !['email', 'sms', 'push'].includes(notification_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid notification type. Must be email, sms, or push' },
        { status: 400 }
      )
    }

    if (!Array.isArray(variants) || variants.length < 2 || variants.length > 4) {
      return NextResponse.json(
        { success: false, error: 'Must provide between 2 and 4 variants' },
        { status: 400 }
      )
    }

    // Validate each variant has content
    for (const variant of variants) {
      if (!variant.content || typeof variant.content !== 'string' || variant.content.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: `Variant "${variant.name || 'Unknown'}" must have content` },
          { status: 400 }
        )
      }
    }

    // Ensure exactly one control variant
    const controlCount = variants.filter((v: { is_control?: boolean }) => v.is_control).length
    if (controlCount !== 1) {
      return NextResponse.json(
        { success: false, error: 'Exactly one variant must be marked as control' },
        { status: 400 }
      )
    }

    const sampleSize = Math.min(50, Math.max(5, sample_size_percent || 20))
    const confidence = [90, 95, 99].includes(confidence_level) ? confidence_level : 95

    // Build variants with IDs and default metrics
    const processedVariants = variants.map((v: { name?: string; subject?: string; content: string; is_control?: boolean }, index: number) => ({
      id: crypto.randomUUID(),
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

    const supabaseAdmin = createSupabaseAdmin()
    const { data: test, error } = await supabaseAdmin
      .from('notification_ab_tests')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        notification_type,
        status: 'draft',
        variants: processedVariants,
        total_recipients: 0,
        sample_size_percent: sampleSize,
        confidence_level: confidence,
        created_by: auth.adminId,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { success: true, test, message: 'A/B test created successfully' },
      { status: 201 }
    )
  } catch (error) {
    apiLogger.error('Error creating A/B test', error)
    logApiError(error as Error, request, { action: 'create_ab_test' })
    return NextResponse.json(
      { success: false, error: 'Failed to create A/B test' },
      { status: 500 }
    )
  }
}
