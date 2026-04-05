export const dynamic = 'force-dynamic'

// =====================================================
// EMPLOYEE MY SALARY API (Security Fix - C2)
// GET: Fetch current user's salary structure only
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch ONLY current user's salary (RLS policy enforces this)
    const { data: salaryData, error: salaryError } = await supabase
      .from('employee_salary')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)

    if (salaryError) {
      apiLogger.error('Salary fetch error', salaryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch salary' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: salaryData || []
    })
  } catch (error) {
    apiLogger.error('My Salary GET Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
