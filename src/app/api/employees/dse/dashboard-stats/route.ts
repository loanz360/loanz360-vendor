import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'


/**
 * GET - DSE-specific dashboard stats
 *
 * FIX: Column name corrections:
 *   - invited_by → created_by_cpe (partner_recruitment_invites)
 *   - partner_user_id → partner_id (partner_leads uses partners.id, not user_id)
 *   - loan_amount → required_loan_amount (partner_leads column)
 * FIX: Proper TypeScript interfaces instead of `any`
 */

interface PartnerRecord {
  id: string
  partner_type: string
  is_active: boolean
}

interface InviteRecord {
  id: string
}

interface LeadRecord {
  id: string
  lead_stage: string
  estimated_value: number | null
  created_at: string
}

interface PartnerLeadRecord {
  id: string
  lead_status: string
  required_loan_amount: number | null
  created_at: string
}

interface RecentPartner {
  id: string
  full_name: string | null
  partner_type: string
  created_at: string
}

interface CustomerLink {
  id: string
  status: string
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    // Run all queries in parallel for performance
    const [
      partnersResult,
      pendingInvitesResult,
      myLeadsResult,
      partnerLeadsResult,
      recentPartnersResult,
      customerLinksResult,
    ] = await Promise.all([
      // Total partners recruited by this DSE
      supabase
        .from('partners')
        .select('id, partner_type, is_active', { count: 'exact' })
        .eq('recruited_by_cpe', userId),

      // FIX: Use correct column name `created_by_cpe` (not `invited_by`)
      supabase
        .from('partner_recruitment_invites')
        .select('id', { count: 'exact' })
        .eq('created_by_cpe', userId)
        .in('status', ['SENT', 'PENDING']),

      // My direct leads summary
      supabase
        .from('dse_leads')
        .select('id, lead_stage, estimated_value, created_at', { count: 'exact' })
        .eq('dse_user_id', userId)
        .eq('is_deleted', false),

      // FIX: Partner leads — use partners.id (not user_id) to match partner_leads.partner_id
      (async () => {
        const { data: partners } = await supabase
          .from('partners')
          .select('id')
          .eq('recruited_by_cpe', userId)

        if (!partners || partners.length === 0) return { count: 0, data: [] }

        const partnerIds = partners.map((p: { id: string }) => p.id)

        // FIX: Use `partner_id` (not `partner_user_id`) and `required_loan_amount` (not `loan_amount`)
        return supabase
          .from('partner_leads')
          .select('id, lead_status, required_loan_amount, created_at', { count: 'exact' })
          .in('partner_id', partnerIds)
      })(),

      // Recent partner registrations (last 5)
      supabase
        .from('partners')
        .select('id, full_name, partner_type, created_at')
        .eq('recruited_by_cpe', userId)
        .order('created_at', { ascending: false })
        .limit(5),

      // Customer links stats
      supabase
        .from('dse_customer_links')
        .select('id, status', { count: 'exact' })
        .eq('dse_user_id', userId),
    ])

    // Process partner stats
    const partners = (partnersResult.data || []) as PartnerRecord[]
    const activePartners = partners.filter(p => p.is_active).length
    const partnersByType = partners.reduce<Record<string, number>>((acc, p) => {
      acc[p.partner_type] = (acc[p.partner_type] || 0) + 1
      return acc
    }, {})

    // Process my leads stats
    const now = new Date()
    const myLeads = (myLeadsResult.data || []) as LeadRecord[]
    const myLeadsWon = myLeads.filter(l => l.lead_stage === 'Won')
    const myLeadsTotalValue = myLeadsWon.reduce((sum, l) => sum + (l.estimated_value || 0), 0)
    const myLeadsThisMonth = myLeads.filter(l => {
      const d = new Date(l.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    // Process partner leads stats
    const partnerLeads = (partnerLeadsResult.data || []) as PartnerLeadRecord[]
    const partnerLeadsThisMonth = partnerLeads.filter(l => {
      const d = new Date(l.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    // Customer links
    const customerLinks = (customerLinksResult.data || []) as CustomerLink[]
    const linksClicked = customerLinks.filter(l =>
      l.status === 'CLICKED' || l.status === 'OPENED' || l.status === 'SUBMITTED'
    ).length

    return NextResponse.json({
      success: true,
      data: {
        partnerRecruitment: {
          totalRecruited: partnersResult.count || 0,
          activePartners,
          pendingInvitations: pendingInvitesResult.count || 0,
          byType: partnersByType,
        },
        myLeads: {
          total: myLeadsResult.count || 0,
          won: myLeadsWon.length,
          totalValue: myLeadsTotalValue,
          thisMonth: myLeadsThisMonth.length,
          conversionRate: myLeads.length > 0
            ? Math.round((myLeadsWon.length / myLeads.length) * 100)
            : 0,
        },
        partnerLeads: {
          total: partnerLeadsResult.count || 0,
          thisMonth: partnerLeadsThisMonth.length,
        },
        customerLinks: {
          total: customerLinksResult.count || 0,
          clicked: linksClicked,
        },
        recentPartners: (recentPartnersResult.data || []) as RecentPartner[],
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching DSE dashboard stats', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
