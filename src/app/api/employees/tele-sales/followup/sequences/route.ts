
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get available follow-up sequences
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const category = searchParams.get('category')
    const activeOnly = searchParams.get('active') !== 'false'

    let query = supabase
      .from('ts_followup_sequences')
      .select('*')
      .order('priority', { ascending: false })
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: sequences, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: sequences || []
    })
  } catch (error) {
    apiLogger.error('Get sequences error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sequences' },
      { status: 500 }
    )
  }
}
