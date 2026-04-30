import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/cpe/history
 * Returns historical performance data for the last 6 months
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // First try employee_profile table (primary source for employees)
    let subRole: string | null = null
    let fullName: string | null = null

    const { data: employeeProfile } = await supabase
      .from('employee_profile')
      .select('subrole, first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (employeeProfile) {
      subRole = employeeProfile.subrole
      fullName = `${employeeProfile.first_name} ${employeeProfile.last_name}`
    } else {
      // Fallback to users table
      const { data: userData } = await supabase
        .from('users')
        .select('sub_role, full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (userData) {
        subRole = userData.sub_role
        fullName = userData.full_name
      }
    }

    // Also check user metadata as final fallback
    if (!subRole) {
      subRole = user.user_metadata?.sub_role || user.app_metadata?.sub_role
    }

    if (!subRole) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 })
    }

    if (subRole !== 'CHANNEL_PARTNER_EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Channel Partner Executives only.' },
        { status: 403 }
      )
    }

    const { data: summaries, error: summariesError } = await supabase
      .from('cpe_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6)

    if (summariesError) {
      apiLogger.error('Error fetching monthly summaries', summariesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch performance history' }, { status: 500 })
    }

    // Fetch all recruited partners for breakdown
    const { data: recruitedPartners, error: partnersError } = await supabase
      .from('partners')
      .select('*')
      .eq('added_by', user.id)
      .order('joining_date', { ascending: false })

    if (partnersError) {
      apiLogger.error('Error fetching recruited partners', partnersError)
    }

    // Build partner breakdown
    const partnerBreakdown = (recruitedPartners || []).map(p => {
      const joiningDate = p.joining_date ? new Date(p.joining_date) : new Date()
      const daysActive = Math.floor((Date.now() - joiningDate.getTime()) / (1000 * 60 * 60 * 24))
      const avgLeadsPerDay = daysActive > 0 ? Number(((p.total_leads || 0) / daysActive).toFixed(2)) : 0
      const isRecentlyActive = p.last_login_at
        ? (Date.now() - new Date(p.last_login_at).getTime()) < (7 * 24 * 60 * 60 * 1000)
        : false

      return {
        partner_id: p.id,
        partner_code: p.partner_id || '',
        partner_name: p.full_name || '',
        partner_type: p.partner_type,
        city: p.city || '',
        state: p.state || '',
        joining_date: p.joining_date || '',
        days_active: daysActive,
        total_leads: p.total_leads || 0,
        leads_sanctioned: p.leads_sanctioned || 0,
        estimated_payout: p.estimated_payout || 0,
        actual_payout: p.actual_payout || 0,
        avg_leads_per_day: avgLeadsPerDay,
        is_active: p.is_active || false,
        is_recently_active: isRecentlyActive,
        last_login_at: p.last_login_at
      }
    })

    const formattedHistory = (summaries || []).map((s: any) => ({
      month: s.month,
      year: s.year,
      period: new Date(s.year, s.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      overallScore: s.performance_score || 0,
      grade: s.performance_grade || 'N/A',
      rank: s.company_rank || 0,
      totalEmployees: s.total_employees || 0,
      percentile: s.percentile || 0,
      targetAchievement: s.target_achievement_percentage || 0,
      partnersRecruited: s.partners_recruited || 0,
      baRecruited: s.ba_recruited || 0,
      bpRecruited: s.bp_recruited || 0,
      cpRecruited: s.cp_recruited || 0,
      highlights: [
        `Partners Recruited: ${s.partners_recruited || 0}`,
        `Total Leads: ${s.total_leads_generated || 0}`,
        `Leads Sanctioned: ${s.leads_sanctioned || 0}`,
        `Conversion Rate: ${(s.conversion_rate || 0).toFixed(1)}%`,
      ],
      metrics: {
        totalPartnerRevenue: s.total_partner_revenue || 0,
        totalPartnersOnboarded: s.total_partners_onboarded || 0,
        totalActivePartners: s.total_active_partners || 0,
        totalPartnerLeadsGenerated: s.total_partner_leads_generated || s.total_leads_generated || 0,
        totalPartnerLeadsConverted: s.total_partner_leads_converted || s.leads_converted || 0,
        leadsSanctioned: s.leads_sanctioned || 0,
        leadsDisbursed: s.leads_disbursed || 0,
        partnerConversionRate: s.partner_conversion_rate || s.conversion_rate || 0,
        sanctionRate: s.sanction_rate || 0,
        disbursementRate: s.disbursement_rate || 0,
        partnerNetworkSize: s.partner_network_size || 0,
        averagePartnerEngagementScore: s.average_partner_engagement_score || 0,
        totalCommissionEarned: s.total_commission_earned || s.actual_commission || 0,
        estimatedCommission: s.estimated_commission || 0,
        totalBusinessVolume: s.total_loan_volume || 0,
        sanctionedVolume: s.sanctioned_volume || 0,
        disbursedVolume: s.disbursed_volume || 0,
      },
    }))

    return NextResponse.json({
      userId: user.id,
      userName: fullName || user.email?.split('@')[0] || 'User',
      history: formattedHistory,
      partnerBreakdown: partnerBreakdown,
      totalPartnersRecruited: recruitedPartners?.length || 0,
      activePartnersCount: recruitedPartners?.filter(p => p.is_active).length || 0,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in CPE history API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
