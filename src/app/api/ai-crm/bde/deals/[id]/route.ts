import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }


    // Fetch deal
    const { data: deal, error } = await supabase
      .from('crm_deals')
      .select('*')
      .eq('id', params.id)
      .eq('bde_id', user.id)
      .maybeSingle()

    if (error) {
      apiLogger.error('Error fetching deal', error)
      return NextResponse.json(
        { success: false, message: 'Deal not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: deal })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
