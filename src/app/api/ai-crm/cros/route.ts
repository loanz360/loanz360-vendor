import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify user is Super Admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all CRO users with their assigned contact counts
    const { data: cros, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'CRO')
      .order('full_name')

    if (error) {
      apiLogger.error('Error fetching CROs', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch CROs' },
        { status: 500 }
      )
    }

    // Get assigned contact counts for each CRO
    const crosWithCounts = await Promise.all(
      (cros || []).map(async (cro) => {
        const { count } = await supabase
          .from('crm_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to_cro', cro.id)

        return {
          ...cro,
          assigned_count: count || 0,
        }
      })
    )

    return NextResponse.json({ success: true, data: crosWithCounts })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
