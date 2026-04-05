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

    // Verify user is Super Admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    // Fetch contacts for this data point
    const { data: contacts, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('data_point_id', params.id)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching contacts', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: contacts || [] })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
