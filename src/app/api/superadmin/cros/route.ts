import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const updateCroSchema = z.object({
  croId: z.string().uuid(),
  skillLevel: z.enum(['junior', 'mid', 'senior', 'star', 'champion']).optional(),
  maxDailyContacts: z.number().int().min(1).max(500).optional(),
  maxActiveLeads: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
  isOnLeave: z.boolean().optional(),
  leaveUntil: z.string().datetime().nullable().optional(),
})

/**
 * GET /api/superadmin/cros
 * List all CROs with their categories and performance metrics
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: userRole } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .in('role', ['SUPER_ADMIN', 'ADMIN'])
      .maybeSingle()

    if (!userRole) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const skillLevel = searchParams.get('skill_level') || ''
    const activeOnly = searchParams.get('active_only') === 'true'

    // Fetch CROs from employee_profile
    let query = supabase
      .from('employee_profile')
      .select('user_id, first_name, last_name, phone, email, designation, status, profile_picture_url, location')
      .eq('subrole', 'CRO')
      .order('first_name', { ascending: true })

    if (activeOnly) {
      query = query.eq('status', 'ACTIVE')
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data: croProfiles, error: profilesError } = await query

    if (profilesError) {
      apiLogger.error('Error fetching CRO profiles:', profilesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch CROs' }, { status: 500 })
    }

    if (!croProfiles || croProfiles.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Fetch categories for all CROs
    const croIds = croProfiles.map(p => p.user_id)
    const { data: categories } = await supabase
      .from('cro_categories')
      .select('*')
      .in('cro_id', croIds)

    const categoryMap = new Map(
      (categories || []).map(c => [c.cro_id, c])
    )

    // Filter by skill level if specified
    let result = croProfiles.map(profile => ({
      ...profile,
      categories: categoryMap.get(profile.user_id) || null,
    }))

    if (skillLevel) {
      result = result.filter(r => r.categories?.skill_level === skillLevel)
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        total: result.length,
        activeCount: result.filter(r => r.status === 'ACTIVE').length,
        onLeaveCount: result.filter(r => r.categories?.is_on_leave).length,
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching CROs:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/superadmin/cros
 * Update a CRO's categories/status (admin only)
 */
export async function PUT(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .in('role', ['SUPER_ADMIN', 'ADMIN'])
      .maybeSingle()

    if (!userRole) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateCroSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const { croId, ...updates } = parsed.data
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (updates.skillLevel !== undefined) updateData.skill_level = updates.skillLevel
    if (updates.maxDailyContacts !== undefined) updateData.max_daily_contacts = updates.maxDailyContacts
    if (updates.maxActiveLeads !== undefined) updateData.max_active_leads = updates.maxActiveLeads
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.isOnLeave !== undefined) updateData.is_on_leave = updates.isOnLeave
    if (updates.leaveUntil !== undefined) updateData.leave_until = updates.leaveUntil

    const { data: updated, error: upsertError } = await supabase
      .from('cro_categories')
      .upsert({
        cro_id: croId,
        ...updateData,
      }, { onConflict: 'cro_id' })
      .select()
      .maybeSingle()

    if (upsertError) {
      apiLogger.error('Error updating CRO categories:', upsertError)
      return NextResponse.json({ success: false, error: 'Failed to update CRO' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'CRO categories updated',
    })
  } catch (error) {
    apiLogger.error('Error updating CRO:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
