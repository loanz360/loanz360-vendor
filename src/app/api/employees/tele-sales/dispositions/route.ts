
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get disposition options
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
      .from('ts_disposition_config')
      .select('*')
      .order('display_order', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: dispositions, error } = await query

    if (error) throw error

    // Group by category
    const byCategory: Record<string, any[]> = {}
    dispositions?.forEach(d => {
      if (!byCategory[d.category]) {
        byCategory[d.category] = []
      }
      byCategory[d.category].push(d)
    })

    return NextResponse.json({
      success: true,
      data: {
        dispositions: dispositions || [],
        by_category: byCategory
      }
    })
  } catch (error) {
    apiLogger.error('Get dispositions error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dispositions' },
      { status: 500 }
    )
  }
}
