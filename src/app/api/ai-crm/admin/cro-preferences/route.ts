import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


/**
 * CRO PREFERENCES Management
 *
 * Only HR and Admin can update CRO preferences
 * CROs can view their own preferences but cannot edit
 *
 * GET /api/ai-crm/admin/cro-preferences?cro_id={id}
 * PUT /api/ai-crm/admin/cro-preferences
 * Body: {
 *   cro_id: string
 *   loan_type_preferences: string[]
 *   preferred_locations: string[]
 * }
 */

// GET - Fetch CRO preferences
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get cro_id from query params
    const { searchParams } = new URL(request.url)
    const cro_id = searchParams.get('cro_id')

    if (!cro_id) {
      return NextResponse.json(
        { success: false, error: 'cro_id query parameter is required' },
        { status: 400 }
      )
    }

    // Fetch preferences
    const { data: preferences, error: fetchError } = await supabase
      .from('cro_preferences')
      .select('*')
      .eq('user_id', cro_id)
      .maybeSingle()

    if (fetchError) {
      // If no preferences exist, return empty defaults
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          data: {
            user_id: cro_id,
            loan_type_preferences: [],
            preferred_locations: [],
          },
        })
      }

      apiLogger.error('Error fetching preferences', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: preferences,
    })
  } catch (error) {
    apiLogger.error('Error in get cro-preferences API', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// PUT - Update CRO preferences (HR/Admin only)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is Super Admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Only Super Admin can update CRO preferences' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { cro_id, loan_type_preferences, preferred_locations } = body

    // Validate inputs
    if (!cro_id) {
      return NextResponse.json(
        { success: false, error: 'cro_id is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(loan_type_preferences) || !Array.isArray(preferred_locations)) {
      return NextResponse.json(
        {
          success: false,
          error: 'loan_type_preferences and preferred_locations must be arrays',
        },
        { status: 400 }
      )
    }

    // Verify CRO exists
    const { data: croUser, error: croError } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', cro_id)
      .maybeSingle()

    if (croError || !croUser) {
      return NextResponse.json(
        { success: false, error: 'CRO user not found' },
        { status: 404 }
      )
    }

    if (croUser.sub_role !== 'CRO') {
      return NextResponse.json(
        { success: false, error: 'User is not a CRO' },
        { status: 400 }
      )
    }

    // Upsert preferences (update if exists, insert if not)
    const { data: preferences, error: upsertError } = await supabase
      .from('cro_preferences')
      .upsert(
        {
          user_id: cro_id,
          loan_type_preferences,
          preferred_locations,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .maybeSingle()

    if (upsertError) {
      apiLogger.error('Error updating preferences', upsertError)
      return NextResponse.json(
        { success: false, error: 'Failed to update preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: preferences,
      message: `Preferences updated for CRO: ${croUser.full_name}`,
    })
  } catch (error) {
    apiLogger.error('Error in update cro-preferences API', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
