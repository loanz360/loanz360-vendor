export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/crm/performance/summary
 *
 * Returns comprehensive performance summary for an employee including:
 * - CRM metrics (leads, deals, calls, etc.)
 * - Incentive progress (current tier, next tier, etc.)
 * - Recent activity events
 *
 * Query Parameters:
 * - user_id: UUID (optional - defaults to current user)
 * - period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' (default: 'monthly')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const targetUserId = searchParams.get('user_id') || user.id;
    const period = searchParams.get('period') || 'monthly';

    // Check if user has permission to view this data
    const { data: currentUserData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = currentUserData?.role === 'admin' || currentUserData?.role === 'super_admin';
    const canViewOthers = isAdmin || user.id === targetUserId;

    if (!canViewOthers) {
      return NextResponse.json(
        { error: 'Forbidden - You can only view your own performance' },
        { status: 403 }
      );
    }

    // Calculate period dates
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (period) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        periodStart = new Date(now.getFullYear(), quarter * 3, 1);
        periodEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
        break;
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear() + 1, 0, 1);
        break;
      case 'monthly':
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
    }

    // Get CRM metrics
    const { data: crmMetrics, error: metricsError } = await supabase
      .from('crm_incentive_metrics')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('metric_period', period)
      .gte('period_start', periodStart.toISOString().split('T')[0])
      .lt('period_end', periodEnd.toISOString().split('T')[0])
      .maybeSingle();

    if (metricsError && metricsError.code !== 'PGRST116') {
      apiLogger.error('Error fetching CRM metrics', metricsError);
    }

    // Get employee profile to determine sub_role
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('sub_role, full_name')
      .eq('id', targetUserId)
      .maybeSingle();

    // Get active incentive allocations for this user
    const { data: allocations, error: allocationsError } = await supabase
      .from('incentive_allocations')
      .select(`
        *,
        incentive:incentives (
          id,
          title,
          category,
          start_date,
          end_date,
          status
        )
      `)
      .eq('user_id', targetUserId)
      .in('status', ['eligible', 'in_progress', 'achieved'])
      .order('created_at', { ascending: false });

    if (allocationsError) {
      apiLogger.error('Error fetching allocations', allocationsError);
    }

    // Get incentive progress details for each allocation
    const incentiveProgress = await Promise.all(
      (allocations || []).map(async (allocation) => {
        // Get tiers for this incentive
        const { data: tiers } = await supabase
          .from('incentive_tiers')
          .select('*')
          .eq('incentive_id', allocation.incentive_id)
          .order('target_percentage', { ascending: true });

        // Determine current and next tier
        const currentTier = tiers?.reverse().find(
          (tier) => allocation.progress_percentage >= tier.target_percentage
        );

        const nextTier = tiers
          ?.sort((a, b) => a.target_percentage - b.target_percentage)
          .find((tier) => allocation.progress_percentage < tier.target_percentage);

        // Calculate days remaining
        const endDate = new Date(allocation.incentive.end_date);
        const daysRemaining = Math.max(
          0,
          Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        // Calculate projected earnings (current tier + potential next tier)
        let projectedEarnings = currentTier?.reward_amount || 0;

        return {
          allocation_id: allocation.id,
          incentive_id: allocation.incentive_id,
          title: allocation.incentive.title,
          target_value: allocation.target_value,
          current_value: allocation.current_value,
          progress_percentage: allocation.progress_percentage,
          current_tier: currentTier?.tier_level || null,
          current_tier_reward: currentTier?.reward_amount || 0,
          next_tier: nextTier?.tier_level || null,
          next_tier_requirement: nextTier
            ? (allocation.target_value * nextTier.target_percentage) / 100
            : null,
          remaining_to_next_tier: nextTier
            ? (allocation.target_value * nextTier.target_percentage) / 100 - allocation.current_value
            : null,
          projected_earnings: projectedEarnings,
          days_remaining: daysRemaining,
          start_date: allocation.incentive.start_date,
          end_date: allocation.incentive.end_date,
          all_tiers: tiers,
        };
      })
    );

    // Get recent CRM events
    const { data: recentEvents } = await supabase
      .from('crm_incentive_events')
      .select('*')
      .eq('user_id', targetUserId)
      .order('event_timestamp', { ascending: false })
      .limit(10);

    // Format response
    const response = {
      user_id: targetUserId,
      user_name: profile?.full_name || 'Unknown',
      sub_role: profile?.sub_role || 'Unknown',
      period,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      crm_metrics: {
        // CRO metrics
        leads_assigned: crmMetrics?.leads_assigned || 0,
        leads_created: crmMetrics?.leads_created || 0,
        leads_contacted: crmMetrics?.leads_contacted || 0,
        leads_converted: crmMetrics?.leads_converted || 0,
        calls_made: crmMetrics?.calls_made || 0,
        positive_calls: crmMetrics?.positive_calls || 0,
        average_call_sentiment: crmMetrics?.average_call_sentiment || 0,
        conversion_rate: crmMetrics?.conversion_rate || 0,

        // BDE metrics
        deals_assigned: crmMetrics?.deals_assigned || 0,
        deals_in_progress: crmMetrics?.deals_in_progress || 0,
        deals_won: crmMetrics?.deals_won || 0,
        deals_lost: crmMetrics?.deals_lost || 0,
        total_loan_amount: crmMetrics?.total_loan_amount || 0,
        disbursed_amount: crmMetrics?.disbursed_amount || 0,
        revenue_generated: crmMetrics?.revenue_generated || 0,

        // Channel Partner metrics
        partners_recruited: crmMetrics?.partners_recruited || 0,
        partner_leads_generated: crmMetrics?.partner_leads_generated || 0,
        partner_leads_converted: crmMetrics?.partner_leads_converted || 0,
        partner_revenue: crmMetrics?.partner_revenue || 0,

        // Direct Sales metrics
        direct_customer_acquisitions: crmMetrics?.direct_customer_acquisitions || 0,
        field_visits: crmMetrics?.field_visits || 0,
        direct_revenue: crmMetrics?.direct_revenue || 0,

        last_updated_at: crmMetrics?.last_updated_at || null,
      },
      incentive_progress: incentiveProgress,
      recent_events: (recentEvents || []).map((event) => ({
        type: event.event_type,
        description: `${event.metric_name}: ${event.old_value} → ${event.new_value}`,
        metric_name: event.metric_name,
        delta: event.delta,
        tier_changed: event.tier_changed,
        old_tier: event.old_tier,
        new_tier: event.new_tier,
        timestamp: event.event_timestamp,
      })),
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: unknown) {
    apiLogger.error('Error in /api/crm/performance/summary', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
