export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    // Fetch leave balance with leave type details
    const { data: balances, error } = await supabase
      .from('leave_balance')
      .select(`
        *,
        leave_types (*)
      `)
      .eq('user_id', user.id)
      .eq('year', year)

    if (error) {
      throw error
    }

    // Calculate totals (guard against NaN from null/undefined values)
    const safeFloat = (val: string | number | null | undefined): number => parseFloat(String(val)) || 0
    const totals = {
      total_allocated: balances?.reduce((sum, b) => sum + safeFloat(b.total_allocated), 0) || 0,
      used: balances?.reduce((sum, b) => sum + safeFloat(b.used), 0) || 0,
      pending: balances?.reduce((sum, b) => sum + safeFloat(b.pending), 0) || 0,
      available: balances?.reduce((sum, b) => sum + safeFloat(b.available), 0) || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        balances: balances || [],
        totals
      }
    })

  } catch (error) {
    apiLogger.error('Fetch leave balance error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leave balance' },
      { status: 500 }
    )
  }
}
