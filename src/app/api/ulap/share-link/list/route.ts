export const dynamic = 'force-dynamic'

/**
 * API Route: ULAP Share Link - List
 * GET /api/ulap/share-link/list - List share links created by the user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const sourceUserId = searchParams.get('source_user_id')
    const sourceType = searchParams.get('source_type')

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Build query - only show links created by this user
    let query = supabase
      .from('ulap_short_links')
      .select('*')
      .eq('created_by_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    // Filter by source type if provided
    if (sourceType) {
      query = query.eq('source_type', sourceType)
    }

    const { data: links, error } = await query

    if (error) {
      apiLogger.error('Error fetching share links', error)

      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return NextResponse.json({ links: [] })
      }

      return NextResponse.json(
        { error: 'Failed to fetch share links' },
        { status: 500 }
      )
    }

    // Transform links - check if expired
    const transformedLinks = (links || []).map((link) => ({
      id: link.id,
      short_code: link.short_code,
      full_url: link.full_url,
      trace_token: link.trace_token,
      created_at: link.created_at,
      expires_at: link.expires_at,
      is_active: link.is_active && new Date(link.expires_at) > new Date(),
      is_expired: new Date(link.expires_at) <= new Date(),
      open_count: link.open_count || 0,
      conversion_count: link.conversion_count || 0,
      source_type: link.source_type,
      created_by_id: link.created_by_id,
      created_by_name: link.created_by_name,
      customer_name: link.customer_name,
      customer_mobile: link.customer_mobile,
      loan_type: link.loan_type,
    }))

    return NextResponse.json({ links: transformedLinks })
  } catch (error) {
    apiLogger.error('Error in share-link list API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
