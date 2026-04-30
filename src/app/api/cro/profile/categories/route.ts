import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'


const updateCategoriesSchema = z.object({
  loanTypeExpertise: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  preferredCallTimes: z.string().max(100).optional(),
  specializationNotes: z.string().max(500).optional(),
  maxDailyContacts: z.number().int().min(1).max(500).optional(),
  maxActiveLeads: z.number().int().min(1).max(1000).optional(),
})

/**
 * GET /api/cro/profile/categories
 * Get the CRO's own category/skill profile
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const { data: categories } = await supabase
      .from('cro_categories')
      .select('*')
      .eq('cro_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: categories || null,
    })
  } catch (error) {
    apiLogger.error('Error fetching CRO categories:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/cro/profile/categories
 * Update the CRO's own category profile (limited fields)
 */
export async function PUT(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const parsed = updateCategoriesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const data = parsed.data
    const userId = user.id

    // Upsert categories
    const { data: updated, error: upsertError } = await supabase
      .from('cro_categories')
      .upsert({
        cro_id: userId,
        loan_type_expertise: data.loanTypeExpertise,
        locations: data.locations,
        languages: data.languages,
        preferred_call_times: data.preferredCallTimes,
        specialization_notes: data.specializationNotes,
        max_daily_contacts: data.maxDailyContacts,
        max_active_leads: data.maxActiveLeads,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'cro_id' })
      .select()
      .maybeSingle()

    if (upsertError) {
      apiLogger.error('Error updating CRO categories:', upsertError)
      return NextResponse.json({ success: false, error: 'Failed to update categories' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Categories updated successfully',
    })
  } catch (error) {
    apiLogger.error('Error updating CRO categories:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
