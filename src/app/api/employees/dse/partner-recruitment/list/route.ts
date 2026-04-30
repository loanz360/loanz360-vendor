import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'
import { buildSearchFilter } from '@/lib/utils/search-sanitizer'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const partnerType = searchParams.get('partner_type') || ''

    let query = supabase
      .from('partner_recruitment_invites')
      .select('*', { count: 'exact' })
      .eq('created_by_cpe', userId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (partnerType) {
      query = query.eq('partner_type_target', partnerType)
    }

    // Sanitized search filter — prevents PostgREST injection
    const searchFilter = buildSearchFilter(search, ['mobile_number', 'recipient_name', 'email'])
    if (searchFilter) {
      query = query.or(searchFilter)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: invitations, error: fetchError, count } = await query

    if (fetchError) {
      apiLogger.error('DSE partner recruitment list error', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch invitations', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    // Compute expiry status for each invitation
    const now = new Date()
    const enrichedInvitations = (invitations || []).map((inv: Record<string, unknown>) => {
      const expiresAt = inv.expires_at ? new Date(inv.expires_at as string) : null
      const isExpired = expiresAt ? expiresAt < now : false
      const daysRemaining = expiresAt
        ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null

      return {
        ...inv,
        is_expired: isExpired,
        days_remaining: daysRemaining,
        display_status: isExpired && inv.status !== 'COMPLETED' ? 'EXPIRED' : inv.status,
      }
    })

    return NextResponse.json({
      success: true,
      data: enrichedInvitations,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('DSE partner recruitment list error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
