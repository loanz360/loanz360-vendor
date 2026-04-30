import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    // Fetch all invitations for this DSE
    const { data: invitations, error: fetchError } = await supabase
      .from('partner_recruitment_invites')
      .select('id, status, partner_type_target, created_at, expires_at, click_count')
      .eq('created_by_cpe', userId)

    if (fetchError) {
      apiLogger.error('DSE recruitment stats error', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch stats', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    const now = new Date()
    const allInvites = invitations || []

    // Calculate invitation stats
    const totalSent = allInvites.length
    const registered = allInvites.filter((i: Record<string, unknown>) => i.status === 'COMPLETED').length
    const pending = allInvites.filter((i: Record<string, unknown>) => {
      const notCompleted = i.status !== 'COMPLETED' && i.status !== 'EXPIRED'
      const notExpired = i.expires_at ? new Date(i.expires_at as string) > now : true
      return notCompleted && notExpired
    }).length
    const expired = allInvites.filter((i: Record<string, unknown>) => {
      if (i.status === 'EXPIRED') return true
      if (i.status === 'COMPLETED') return false
      return i.expires_at ? new Date(i.expires_at as string) <= now : false
    }).length
    const clicked = allInvites.filter((i: Record<string, unknown>) =>
      i.status === 'CLICKED' || i.status === 'OPENED' || ((i.click_count as number) || 0) > 0
    ).length

    // Breakdown by partner type
    const byType: Record<string, { sent: number; registered: number; pending: number }> = {
      BUSINESS_ASSOCIATE: { sent: 0, registered: 0, pending: 0 },
      BUSINESS_PARTNER: { sent: 0, registered: 0, pending: 0 },
      CHANNEL_PARTNER: { sent: 0, registered: 0, pending: 0 },
    }

    allInvites.forEach((i: Record<string, unknown>) => {
      const type = (i.partner_type_target as string) || 'BUSINESS_ASSOCIATE'
      if (type in byType) {
        const t = byType[type]
        t.sent++
        if (i.status === 'COMPLETED') {
          t.registered++
        } else {
          const notExpired = i.expires_at ? new Date(i.expires_at as string) > now : true
          if (notExpired) t.pending++
        }
      }
    })

    // This month stats
    const thisMonth = allInvites.filter((i: Record<string, unknown>) => {
      const created = new Date(i.created_at as string)
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
    })

    // Count recruited partners from partners table
    const [totalPartnersResult, activePartnersResult] = await Promise.all([
      supabase
        .from('partners')
        .select('id', { count: 'exact', head: true })
        .eq('recruited_by_cpe', userId),
      supabase
        .from('partners')
        .select('id', { count: 'exact', head: true })
        .eq('recruited_by_cpe', userId)
        .eq('is_active', true),
    ])

    // Recruitment funnel: invited → clicked → registered
    const funnel = {
      invited: totalSent,
      clicked,
      registered,
      click_rate: totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0,
      conversion_rate: totalSent > 0 ? Math.round((registered / totalSent) * 100) : 0,
      click_to_register_rate: clicked > 0 ? Math.round((registered / clicked) * 100) : 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        invitations: {
          total_sent: totalSent,
          registered,
          pending,
          expired,
          clicked,
          conversion_rate: totalSent > 0 ? Math.round((registered / totalSent) * 100) : 0,
        },
        by_partner_type: byType,
        this_month: {
          sent: thisMonth.length,
          registered: thisMonth.filter((i: Record<string, unknown>) => i.status === 'COMPLETED').length,
        },
        partners: {
          total: totalPartnersResult.count || 0,
          active: activePartnersResult.count || 0,
        },
        funnel,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('DSE recruitment stats error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
