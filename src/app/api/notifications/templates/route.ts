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

  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    return { isValid: false }
  }

  // Verify admin is active
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
 * GET /api/notifications/templates
 * Get all notification templates
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // First check for Super Admin session
    const superAdminCheck = await checkSuperAdminSession(request)
    let isSuperAdmin = superAdminCheck.isValid
    let isHR = false

    // If not a Super Admin, check regular user authentication
    if (!isSuperAdmin) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      // Check if user is Super Admin or HR
      const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      isSuperAdmin = employee?.role === 'super_admin'
      isHR = employee?.role === 'hr' || employee?.role === 'HR'
    }

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin and HR can access templates' },
        { status: 403 }
      )
    }

    // Use admin client for queries
    const supabaseAdmin = createSupabaseAdmin()
    const { data: templates, error } = await supabaseAdmin
      .from('notification_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    apiLogger.error('Error fetching templates', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications/templates
 * Create a new notification template
 */
export async function POST(request: NextRequest) {
  try {
    // First check for Super Admin session
    const superAdminCheck = await checkSuperAdminSession(request)
    let isSuperAdmin = superAdminCheck.isValid
    let isHR = false
    let userId: string | null = superAdminCheck.adminId || null
    let userName: string | null = superAdminCheck.adminName || null

    // If not a Super Admin, check regular user authentication
    if (!isSuperAdmin) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      userId = user.id

      // Check if user is Super Admin or HR
      const { data: employee } = await supabase
        .from('employees')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle()

      isSuperAdmin = employee?.role === 'super_admin'
      isHR = employee?.role === 'hr' || employee?.role === 'HR'
      userName = employee?.full_name || null
    }

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin and HR can create templates' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      description,
      title,
      message,
      notification_type,
      priority,
      target_category
    } = body

    // Validate required fields
    if (!name || !title || !message) {
      return NextResponse.json(
        { error: 'Name, title, and message are required' },
        { status: 400 }
      )
    }

    // Use admin client for insert
    const supabaseAdmin = createSupabaseAdmin()
    const { data: template, error } = await supabaseAdmin
      .from('notification_templates')
      .insert({
        name,
        description,
        title,
        message,
        notification_type: notification_type || 'announcement',
        priority: priority || 'normal',
        target_category,
        created_by: userId,
        created_by_name: userName || 'Super Admin'
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error creating template', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
