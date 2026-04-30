
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/recruitment/tracking
 *
 * Get recruitment tracking data with funnel metrics
 * Query params:
 *   - status: Filter by status (SENT, CLICKED, OPENED, FILLED, COMPLETED)
 *   - partnerType: Filter by partner type (BUSINESS_ASSOCIATE, BUSINESS_PARTNER, CHANNEL_PARTNER)
 *   - dateFrom: Start date (YYYY-MM-DD)
 *   - dateTo: End date (YYYY-MM-DD)
 *   - limit: Number of records (default: 50)
 *   - offset: Pagination offset (default: 0)
 *
 * Returns:
 *   - List of recruitment invites with tracking status
 *   - Funnel metrics (sent, clicked, opened, filled, completed counts)
 *   - Conversion rates
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a Channel Partner Executive
    const isCPE = await verifyCPERole(supabase, user)

    if (!isCPE) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Channel Partner Executive role required.' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const partnerType = searchParams.get('partnerType')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('partner_recruitment_invites')
      .select('*', { count: 'exact' })
      .eq('created_by_cpe', user.id)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (partnerType) {
      query = query.eq('partner_type', partnerType)
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      const dateToEnd = new Date(dateTo)
      dateToEnd.setHours(23, 59, 59, 999)
      query = query.lte('created_at', dateToEnd.toISOString())
    }

    // Execute query with pagination
    const { data: invites, error: invitesError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (invitesError) {
      apiLogger.error('Error fetching recruitment tracking', invitesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch recruitment tracking data' },
        { status: 500 }
      )
    }

    // Get funnel metrics (all-time for this CPE)
    const { data: funnelData, error: funnelError } = await supabase
      .from('partner_recruitment_invites')
      .select('status')
      .eq('created_by_cpe', user.id)

    if (funnelError) {
      apiLogger.error('Error fetching funnel metrics', funnelError)
    }

    // Calculate funnel metrics
    const funnelMetrics = {
      sent: 0,
      clicked: 0,
      opened: 0,
      filled: 0,
      completed: 0,
      expired: 0,
    }

    funnelData?.forEach((invite) => {
      const status = invite.status
      funnelMetrics.sent++
      if (status === 'CLICKED' || status === 'OPENED' || status === 'FILLED' || status === 'COMPLETED') {
        funnelMetrics.clicked++
      }
      if (status === 'OPENED' || status === 'FILLED' || status === 'COMPLETED') {
        funnelMetrics.opened++
      }
      if (status === 'FILLED' || status === 'COMPLETED') {
        funnelMetrics.filled++
      }
      if (status === 'COMPLETED') {
        funnelMetrics.completed++
      }
      if (status === 'EXPIRED') {
        funnelMetrics.expired++
      }
    })

    // Calculate conversion rates
    const conversionRates = {
      clickRate: funnelMetrics.sent > 0 ? (funnelMetrics.clicked / funnelMetrics.sent) * 100 : 0,
      openRate: funnelMetrics.clicked > 0 ? (funnelMetrics.opened / funnelMetrics.clicked) * 100 : 0,
      fillRate: funnelMetrics.opened > 0 ? (funnelMetrics.filled / funnelMetrics.opened) * 100 : 0,
      completionRate: funnelMetrics.filled > 0 ? (funnelMetrics.completed / funnelMetrics.filled) * 100 : 0,
      overallConversionRate: funnelMetrics.sent > 0 ? (funnelMetrics.completed / funnelMetrics.sent) * 100 : 0,
    }

    // Format invites for response
    const formattedInvites = invites?.map((invite) => ({
      id: invite.id,
      recipientName: invite.recipient_name,
      mobileNumber: invite.mobile_number,
      email: invite.email,
      partnerType: invite.partner_type,
      status: invite.status,
      channel: invite.channel,
      shortCode: invite.short_code,
      shortLink: invite.short_link,
      createdAt: invite.created_at,
      sentAt: invite.sent_at,
      clickedAt: invite.clicked_at,
      openedAt: invite.opened_at,
      filledAt: invite.filled_at,
      completedAt: invite.completed_at,
      expiresAt: invite.expires_at,
      isActive: invite.is_active,
      isExpired: new Date(invite.expires_at) < new Date(),
      // Calculated fields
      daysSinceCreated: Math.floor((new Date().getTime() - new Date(invite.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      daysUntilExpiry: Math.ceil((new Date(invite.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    }))

    const response = {
      success: true,
      data: {
        invites: formattedInvites,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
        },
        funnelMetrics,
        conversionRates: {
          clickRate: parseFloat(conversionRates.clickRate.toFixed(2)),
          openRate: parseFloat(conversionRates.openRate.toFixed(2)),
          fillRate: parseFloat(conversionRates.fillRate.toFixed(2)),
          completionRate: parseFloat(conversionRates.completionRate.toFixed(2)),
          overallConversionRate: parseFloat(conversionRates.overallConversionRate.toFixed(2)),
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in recruitment tracking API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
