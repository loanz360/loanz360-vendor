import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * Verify user is TeleSales
 */
async function verifyTeleSalesUser(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  const isTeleSales = profile?.subrole?.toUpperCase().replace(/[\s-]/g, '_') === 'TELE_SALES'

  if (!isTeleSales) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', userId)
      .maybeSingle()

    const normalizedSubRole = userProfile?.sub_role?.toUpperCase().replace(/[\s-]/g, '_')
    return normalizedSubRole === 'TELE_SALES'
  }

  return true
}

/**
 * GET /api/employees/tele-sales/schedule/scripts
 * Retrieves call scripts for the TeleSales executive
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

    if (!(await verifyTeleSalesUser(supabase, user.id))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. TeleSales executives only.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const scriptType = searchParams.get('script_type')
    const loanType = searchParams.get('loan_type')

    let query = supabase
      .from('ts_call_scripts')
      .select('*')
      .eq('is_active', true)

    // Apply filters
    if (scriptType) {
      query = query.eq('script_type', scriptType)
    }
    if (loanType) {
      query = query.or(`loan_type.eq.${loanType},loan_type.is.null`)
    }

    // Order by usage count (most popular first)
    query = query.order('usage_count', { ascending: false })

    const { data: scripts, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: scripts || []
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching call scripts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/tele-sales/schedule/scripts/[id]/use
 * Increments usage count when a script is used
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyTeleSalesUser(supabase, user.id))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. TeleSales executives only.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { script_id } = body

    if (!script_id) {
      return NextResponse.json(
        { success: false, error: 'script_id is required' },
        { status: 400 }
      )
    }

    // Increment usage count
    const { error } = await supabase.rpc('increment_script_usage', {
      p_script_id: script_id
    })

    // If RPC doesn't exist, do it manually
    if (error && error.code === 'PGRST202') {
      const { data: script } = await supabase
        .from('ts_call_scripts')
        .select('usage_count')
        .eq('id', script_id)
        .maybeSingle()

      if (script) {
        await supabase
          .from('ts_call_scripts')
          .update({ usage_count: (script.usage_count || 0) + 1 })
          .eq('id', script_id)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Script usage recorded'
    })

  } catch (error: unknown) {
    apiLogger.error('Error recording script usage', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
