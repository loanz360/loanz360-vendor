export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { PolicySchema } from '@/lib/compliance/compliance-types'

/**
 * GET /api/compliance/policies
 * List compliance policies
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const framework = searchParams.get('framework')
    const category = searchParams.get('category')
    const isActive = searchParams.get('isActive')

    let query = supabase
      .from('compliance_policies')
      .select('*')
      .order('framework', { ascending: true })
      .order('category', { ascending: true })

    if (framework) query = query.eq('framework', framework)
    if (category) query = query.eq('category', category)
    if (isActive) query = query.eq('is_active', isActive === 'true')

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      policies: data || [],
    })
  } catch (error) {
    return handleApiError(error, 'fetch policies')
  }
}

/**
 * POST /api/compliance/policies
 * Create custom policy (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validated = PolicySchema.parse(body)

    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('compliance_policies')
      .insert({
        ...validated,
        owner_id: body.ownerId,
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      policy: data,
    })
  } catch (error) {
    return handleApiError(error, 'create policy')
  }
}

/**
 * PATCH /api/compliance/policies
 * Update policy enforcement
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { policyId, isEnforced, autoCheckEnabled } = body

    if (!policyId) {
      return NextResponse.json(
        { success: false, error: 'Policy ID required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    const updateData: any = {}
    if (isEnforced !== undefined) updateData.is_enforced = isEnforced
    if (autoCheckEnabled !== undefined) updateData.auto_check_enabled = autoCheckEnabled

    const { data, error } = await supabase
      .from('compliance_policies')
      .update(updateData)
      .eq('id', policyId)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      policy: data,
    })
  } catch (error) {
    return handleApiError(error, 'update policy')
  }
}
