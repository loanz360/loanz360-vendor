export const dynamic = 'force-dynamic'

/**
 * ULAP Rate History API
 * View historical interest rate changes for audit trail
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch rate history with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bankId = searchParams.get('bank_id')
    const subcategoryId = searchParams.get('subcategory_id')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('ulap_rate_history')
      .select(`
        *,
        ulap_banks (
          id,
          name,
          short_code,
          logo_url,
          type
        ),
        ulap_loan_subcategories (
          id,
          name,
          slug,
          category_id,
          ulap_loan_categories (
            id,
            name,
            slug
          )
        )
      `)
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (bankId) {
      query = query.eq('bank_id', bankId)
    }

    if (subcategoryId) {
      query = query.eq('subcategory_id', subcategoryId)
    }

    const { data: history, error } = await query

    if (error) {
      apiLogger.error('Error fetching rate history', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch rate history' }, { status: 500 })
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('ulap_rate_history')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      history,
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (totalCount || 0)
      }
    })
  } catch (error) {
    apiLogger.error('Rate History API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
