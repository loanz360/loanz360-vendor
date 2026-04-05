import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// POST: Log usage of canned response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ticket_id } = body

    if (!ticket_id) {
      return NextResponse.json({ success: false, error: 'ticket_id is required' }, { status: 400 })
    }

    // Log usage
    const { error } = await supabase
      .from('canned_response_usage_log')
      .insert({
        canned_response_id: id,
        ticket_id,
        used_by_employee_id: user.id
      })

    if (error) throw error

    // The trigger will automatically increment usage_count

    return NextResponse.json({ message: 'Usage logged successfully' })
  } catch (error: unknown) {
    apiLogger.error('Error logging canned response usage', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: 'Failed to log usage' },
      { status: 500 }
    )
  }
}
