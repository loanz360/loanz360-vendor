
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CPEAnalyticsData, CPEAnalyticsResponse } from '@/lib/types/cpe-performance.types'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/performance/cpe/analytics
 * Returns live analytics data for Channel Partner Executive
 * Shows performance metrics based on recruited partners only
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Step 1: Authenticate user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Step 2: Verify user is Channel Partner Executive
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
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    if (subRole !== 'CHANNEL_PARTNER_EXECUTIVE') {
      return NextResponse.json(
        { success: false, error: 'Access denied. This endpoint is for Channel Partner Executives only.' },
        { status: 403 }
      )
    }

    // Step 3: Get current month and year
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentYear = now.getFullYear()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    // Step 4: Fetch all recruited partners (active only)
    const { data: recruitedPartners, error: partnersError } = await supabase
      .from('partners')
      .select('*')
      .eq('added_by', user.id)
      .eq('is_active', true)

    if (partnersError) {
      apiLogger.error('Error fetching recruited partners', partnersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch recruited partners' },
        { status: 500 }
      )
    }

    const totalActivePartners = recruitedPartners?.length || 0

    // Step 5: Partner type distribution
    const baCount = recruitedPartners?.filter(p => ['BA', 'BUSINESS_ASSOCIATE'].includes(p.partner_type)).length || 0
    const bpCount = recruitedPartners?.filter(p => ['BP', 'BUSINESS_PARTNER'].includes(p.partner_type)).length || 0
    const cpCount = recruitedPartners?.filter(p => ['CP', 'CHANNEL_PARTNER'].includes(p.partner_type)).length || 0

    // Step 6: Partners recruited this month
    const partnersRecruitedThisMonth = recruitedPartners?.filter(p => {
      if (!p.joining_date) return false
      const joiningMonth = new Date(p.joining_date).toISOString().slice(0, 7)
      return joiningMonth === currentMonth
    }).length || 0

    // Step 7: Aggregate performance metrics from all recruited partners
    const totalLeadsGenerated = recruitedPartners?.reduce((sum, p) => sum + (p.total_leads || 0), 0) || 0
    const totalLeadsSanctioned = recruitedPartners?.reduce((sum, p) => sum + (p.leads_sanctioned || 0), 0) || 0
    const totalLeadsInProgress = recruitedPartners?.reduce((sum, p) => sum + (p.leads_in_progress || 0), 0) || 0
    const totalLeadsDropped = recruitedPartners?.reduce((sum, p) => sum + (p.leads_dropped || 0), 0) || 0
    const estimatedCommission = recruitedPartners?.reduce((sum, p) => sum + (p.estimated_payout || 0), 0) || 0
    const actualCommission = recruitedPartners?.reduce((sum, p) => sum + (p.actual_payout || 0), 0) || 0

    // Step 8: Fetch partner leads and calculate business volume
    const partnerIds = recruitedPartners?.map(p => p.id) || []

    let totalBusinessVolume = 0
    let sanctionedVolume = 0
    let disbursedVolume = 0
    let leadsDisbursed = 0

    if (partnerIds.length > 0) {
      // Fetch leads from recruited partners
      const { data: partnerLeads, error: leadsError } = await supabase
        .from('leads')
        .select('required_loan_amount, lead_status, converted_to_application_id')
        .in('partner_id', partnerIds)

      if (!leadsError && partnerLeads) {
        // Calculate total business volume from all leads
        totalBusinessVolume = partnerLeads.reduce((sum, lead) => {
          return sum + (lead.required_loan_amount || 0)
        }, 0)

        // Get application IDs that are converted
        const applicationIds = partnerLeads
          .filter(l => l.converted_to_application_id)
          .map(l => l.converted_to_application_id)
          .filter(Boolean)

        if (applicationIds.length > 0) {
          // Fetch loan applications to get sanctioned and disbursed amounts
          const { data: applications } = await supabase
            .from('loan_applications')
            .select('loan_amount, status')
            .in('id', applicationIds)

          if (applications) {
            // Calculate sanctioned volume (status = 'SANCTIONED' or 'DISBURSED')
            sanctionedVolume = applications
              .filter(app => ['SANCTIONED', 'DISBURSED', 'sanctioned', 'disbursed'].includes(app.status))
              .reduce((sum, app) => sum + (app.loan_amount || 0), 0)

            // Calculate disbursed volume
            const disbursedApps = applications.filter(app =>
              ['DISBURSED', 'disbursed'].includes(app.status)
            )
            disbursedVolume = disbursedApps.reduce((sum, app) => sum + (app.loan_amount || 0), 0)
            leadsDisbursed = disbursedApps.length
          }
        }
      }
    }

    // Step 9: Calculate average partner productivity
    const avgPartnerProductivity = totalActivePartners > 0
      ? Number((totalLeadsGenerated / totalActivePartners).toFixed(2))
      : 0

    // Step 10: Calculate conversion rates (using real data)
    const leadsConverted = totalLeadsSanctioned
    const conversionRate = totalLeadsGenerated > 0
      ? Number(((leadsConverted / totalLeadsGenerated) * 100).toFixed(2))
      : 0
    const sanctionRate = totalLeadsGenerated > 0
      ? Number(((totalLeadsSanctioned / totalLeadsGenerated) * 100).toFixed(2))
      : 0
    const disbursementRate = totalLeadsGenerated > 0
      ? Number(((leadsDisbursed / totalLeadsGenerated) * 100).toFixed(2))
      : 0

    // Step 11: Get top performing partners (Top 5 by total leads)
    // First, fetch leads for each partner to calculate business volume
    const partnerBusinessVolume = new Map()

    if (partnerIds.length > 0) {
      const { data: allPartnerLeads } = await supabase
        .from('leads')
        .select('partner_id, required_loan_amount')
        .in('partner_id', partnerIds)

      if (allPartnerLeads) {
        // Group leads by partner and sum business volume
        allPartnerLeads.forEach(lead => {
          const currentVolume = partnerBusinessVolume.get(lead.partner_id) || 0
          partnerBusinessVolume.set(lead.partner_id, currentVolume + (lead.required_loan_amount || 0))
        })
      }
    }

    const topPartners = (recruitedPartners || [])
      .map(p => ({
        partner_id: p.id,
        partner_code: p.partner_id || '',
        partner_name: p.full_name || '',
        partner_type: p.partner_type,
        total_leads: p.total_leads || 0,
        leads_sanctioned: p.leads_sanctioned || 0,
        business_volume: partnerBusinessVolume.get(p.id) || 0,
        conversion_rate: p.total_leads > 0
          ? Number(((p.leads_sanctioned / p.total_leads) * 100).toFixed(2))
          : 0
      }))
      .sort((a, b) => b.total_leads - a.total_leads)
      .slice(0, 5)

    // Step 12: Get recent recruitments (Last 10)
    const recentRecruitments = (recruitedPartners || [])
      .map(p => {
        const joiningDate = p.joining_date ? new Date(p.joining_date) : new Date()
        const daysActive = Math.floor((Date.now() - joiningDate.getTime()) / (1000 * 60 * 60 * 24))

        return {
          partner_id: p.id,
          partner_code: p.partner_id || '',
          partner_name: p.full_name || '',
          partner_type: p.partner_type,
          joining_date: p.joining_date || '',
          days_active: daysActive,
          total_leads: p.total_leads || 0
        }
      })
      .sort((a, b) => new Date(b.joining_date).getTime() - new Date(a.joining_date).getTime())
      .slice(0, 10)

    // Step 13: Performance trend (Last 30 days) - Fetch from daily metrics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    const { data: dailyMetrics } = await supabase
      .from('cpe_daily_metrics')
      .select('metric_date, total_leads_generated, leads_converted, total_loan_amount')
      .eq('user_id', user.id)
      .gte('metric_date', thirtyDaysAgoStr)
      .lte('metric_date', today)
      .order('metric_date', { ascending: true })

    // Create a map of dates to metrics
    const metricsMap = new Map()
    if (dailyMetrics) {
      dailyMetrics.forEach(m => {
        metricsMap.set(m.metric_date, {
          leads_generated: m.total_leads_generated || 0,
          leads_converted: m.leads_converted || 0,
          business_volume: m.total_loan_amount || 0
        })
      })
    }

    // Generate trend data for last 30 days
    const performanceTrend = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      const dateStr = date.toISOString().split('T')[0]
      const metrics = metricsMap.get(dateStr)

      return {
        date: dateStr,
        leads_generated: metrics?.leads_generated || 0,
        leads_converted: metrics?.leads_converted || 0,
        business_volume: metrics?.business_volume || 0
      }
    })

    // Step 14: Fetch targets for current month
    const { data: targets } = await supabase
      .from('cpe_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .eq('is_active', true)
      .maybeSingle()

    // Step 15: Calculate target achievement
    const targetAchievement = {
      partners_recruited: {
        current: partnersRecruitedThisMonth,
        target: targets?.target_partners_recruitment || 0,
        achievement_percentage: targets?.target_partners_recruitment
          ? Math.round((partnersRecruitedThisMonth / targets.target_partners_recruitment) * 100)
          : 0
      },
      leads_generated: {
        current: totalLeadsGenerated,
        target: targets?.target_total_leads || 0,
        achievement_percentage: targets?.target_total_leads
          ? Math.round((totalLeadsGenerated / targets.target_total_leads) * 100)
          : 0
      },
      business_volume: {
        current: totalBusinessVolume,
        target: targets?.target_loan_volume || 0,
        achievement_percentage: targets?.target_loan_volume
          ? Math.round((totalBusinessVolume / targets.target_loan_volume) * 100)
          : 0
      },
      commission: {
        current: estimatedCommission,
        target: targets?.target_commission || 0,
        achievement_percentage: targets?.target_commission
          ? Math.round((estimatedCommission / targets.target_commission) * 100)
          : 0
      }
    }

    // Step 16: Build response
    const analyticsData: CPEAnalyticsData = {
      overview: {
        total_active_partners: totalActivePartners,
        partners_recruited_this_month: partnersRecruitedThisMonth,
        total_leads_generated: totalLeadsGenerated,
        total_business_volume: totalBusinessVolume,
        estimated_commission: estimatedCommission,
        avg_partner_productivity: avgPartnerProductivity
      },
      partner_distribution: {
        ba_count: baCount,
        bp_count: bpCount,
        cp_count: cpCount
      },
      current_month_metrics: {
        leads_generated: totalLeadsGenerated,
        leads_converted: leadsConverted,
        leads_sanctioned: totalLeadsSanctioned,
        leads_disbursed: leadsDisbursed,
        conversion_rate: conversionRate,
        sanction_rate: sanctionRate,
        disbursement_rate: disbursementRate
      },
      top_partners: topPartners,
      recent_recruitments: recentRecruitments,
      performance_trend: performanceTrend,
      target_achievement: targetAchievement,
      last_updated: new Date().toISOString()
    }

    const response: CPEAnalyticsResponse = {
      success: true,
      data: analyticsData
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in CPE analytics endpoint', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
