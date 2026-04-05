import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'

export const dynamic = 'force-dynamic'

/**
 * GET /api/employees/dse/partner-recruitment/follow-up-reminders
 * Returns invitations that need follow-up action from the DSE.
 *
 * Categories:
 * - overdue_3d: Sent 3+ days ago, not clicked, not expired
 * - overdue_7d: Sent 7+ days ago, not clicked, not expired
 * - clicked_no_register: Clicked but not completed (warm leads)
 * - expiring_soon: Expires within 7 days
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    // Fetch all non-completed, non-expired invitations
    const { data: invitations, error } = await supabase
      .from('partner_recruitment_invites')
      .select('id, mobile_number, recipient_name, partner_type_target, status, click_count, created_at, expires_at, reminder_count, last_reminder_at')
      .eq('created_by_cpe', userId)
      .not('status', 'eq', 'COMPLETED')
      .order('created_at', { ascending: true })

    if (error) {
      apiLogger.error('DSE follow-up reminders error', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 })
    }

    const now = new Date()
    const DAY_MS = 1000 * 60 * 60 * 24

    const overdue3d: typeof invitations = []
    const overdue7d: typeof invitations = []
    const clickedNoRegister: typeof invitations = []
    const expiringSoon: typeof invitations = []

    for (const inv of invitations || []) {
      const expiresAt = inv.expires_at ? new Date(inv.expires_at) : null
      const isExpired = expiresAt ? expiresAt < now : false
      if (isExpired) continue

      const daysSinceSent = (now.getTime() - new Date(inv.created_at).getTime()) / DAY_MS
      const daysUntilExpiry = expiresAt ? (expiresAt.getTime() - now.getTime()) / DAY_MS : null

      // Clicked but not registered — warm lead
      if ((inv.status === 'CLICKED' || inv.status === 'OPENED') && inv.click_count > 0) {
        clickedNoRegister.push(inv)
        continue
      }

      // Expiring soon (within 7 days)
      if (daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        expiringSoon.push(inv)
        continue
      }

      // Overdue follow-ups
      if (daysSinceSent >= 7 && (inv.status === 'SENT' || inv.status === 'PENDING')) {
        overdue7d.push(inv)
      } else if (daysSinceSent >= 3 && (inv.status === 'SENT' || inv.status === 'PENDING')) {
        overdue3d.push(inv)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        overdue_3d: overdue3d,
        overdue_7d: overdue7d,
        clicked_no_register: clickedNoRegister,
        expiring_soon: expiringSoon,
        totals: {
          needs_attention: overdue3d.length + overdue7d.length + clickedNoRegister.length + expiringSoon.length,
          overdue_3d: overdue3d.length,
          overdue_7d: overdue7d.length,
          clicked_no_register: clickedNoRegister.length,
          expiring_soon: expiringSoon.length,
        },
      },
    })
  } catch (error: unknown) {
    apiLogger.error('DSE follow-up reminders error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
