import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
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

    const { reason } = await request.json()

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, message: 'Drop reason is required' },
        { status: 400 }
      )
    }

    // Update deal to dropped status
    const { error: updateError } = await supabase
      .from('crm_deals')
      .update({
        status: 'dropped',
        stage: 'dropped',
        drop_reason: reason.trim(),
        dropped_at: new Date().toISOString(),
        last_updated_by_bde_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('bde_id', user.id)

    if (updateError) {
      apiLogger.error('Error dropping deal', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to drop deal' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Deal marked as dropped',
    })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
