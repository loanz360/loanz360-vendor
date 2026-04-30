import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * Helper function to verify Digital Sales access
 */
async function verifyDigitalSalesAccess(supabase: unknown, userId: string) {
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile?.subrole?.toUpperCase() === 'DIGITAL_SALES') {
    return true
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  return userProfile?.sub_role?.toUpperCase() === 'DIGITAL_SALES'
}

/**
 * GET /api/employees/digital-sales/schedule/leads
 * Retrieves online leads assigned to the Digital Sales executive
 * Used for lead selection in meetings and tasks
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyDigitalSalesAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied.' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const lead_stage = searchParams.get('lead_stage')

    // Build query - fetch leads assigned to this user
    let query = supabase
      .from('online_leads')
      .select(`
        id,
        customer_name,
        mobile,
        email,
        lead_stage,
        loan_type,
        loan_amount,
        city,
        created_at
      `)
      .eq('assigned_to', user.id)
      .eq('is_deleted', false)

    // Apply search filter
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Apply lead stage filter
    if (lead_stage) {
      query = query.eq('lead_stage', lead_stage)
    }

    // Order by most recent first
    query = query.order('created_at', { ascending: false }).limit(limit)

    const { data: leads, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        leads: leads || []
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching Digital Sales leads', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
