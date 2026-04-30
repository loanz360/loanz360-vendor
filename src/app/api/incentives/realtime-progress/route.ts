
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/incentives/realtime-progress
 *
 * Returns real-time progress for a specific incentive allocation including:
 * - Current value and progress percentage
 * - Tier achievements (locked/unlocked)
 * - Time remaining
 * - Recent updates
 *
 * Query Parameters:
 * - allocation_id: UUID (required)
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
    const allocationId = searchParams.get('allocation_id');

    if (!allocationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: allocation_id' },
        { status: 400 }
      );
    }

    // Get allocation details
    const { data: allocation, error: allocationError } = await supabase
      .from('incentive_allocations')
      .select(`
        *,
        incentive:incentives (
          id,
          title,
          category,
          description,
          start_date,
          end_date,
          status
        )
      `)
      .eq('id', allocationId)
      .maybeSingle();

    if (allocationError || !allocation) {
      return NextResponse.json(
        { error: 'Allocation not found' },
        { status: 404 }
      );
    }

    // Check permission
    const { data: currentUserData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = currentUserData?.role === 'admin' || currentUserData?.role === 'super_admin';
    const canView = isAdmin || allocation.user_id === user.id;

    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden - You can only view your own allocations' },
        { status: 403 }
      );
    }

    // Get tier definitions
    const { data: tiers, error: tiersError } = await supabase
      .from('incentive_tiers')
      .select('*')
      .eq('incentive_id', allocation.incentive_id)
      .order('target_percentage', { ascending: true });

    if (tiersError) {
      apiLogger.error('Error fetching tiers', tiersError);
    }

    // Calculate tier achievements
    const tierAchievements = (tiers || []).map((tier) => {
      const thresholdValue = (allocation.target_value * tier.target_percentage) / 100;
      const achieved = allocation.current_value >= thresholdValue;
      const remainingToAchieve = Math.max(0, thresholdValue - allocation.current_value);

      return {
        tier: tier.tier_level,
        target_percentage: tier.target_percentage,
        threshold_value: thresholdValue,
        reward: tier.reward_amount,
        achieved,
        remaining_to_achieve: remainingToAchieve,
      };
    });

    // Determine current tier
    const currentTier = [...tierAchievements]
      .reverse()
      .find((t) => t.achieved);

    // Determine next tier
    const nextTier = tierAchievements.find((t) => !t.achieved);

    // Calculate time remaining
    const now = new Date();
    const endDate = new Date(allocation.incentive.end_date);
    const startDate = new Date(allocation.incentive.start_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(
      0,
      Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daysElapsed = totalDays - daysRemaining;
    const percentageTimeElapsed = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

    // Get CRM mapping to show which metric is being tracked
    const { data: crmMapping } = await supabase
      .from('incentive_crm_mapping')
      .select('*')
      .eq('incentive_id', allocation.incentive_id)
      .maybeSingle();

    // Get recent events for this allocation
    const { data: recentEvents } = await supabase
      .from('crm_incentive_events')
      .select('*')
      .eq('allocation_id', allocationId)
      .order('event_timestamp', { ascending: false })
      .limit(5);

    // Calculate estimated completion date (based on current pace)
    let estimatedCompletionDate: string | null = null;
    if (allocation.current_value > 0 && daysElapsed > 0) {
      const currentRate = allocation.current_value / daysElapsed;
      const remainingValue = allocation.target_value - allocation.current_value;
      const estimatedDaysToComplete = remainingValue / currentRate;
      const estimatedDate = new Date(now.getTime() + estimatedDaysToComplete * 24 * 60 * 60 * 1000);
      estimatedCompletionDate = estimatedDate.toISOString().split('T')[0];
    }

    // Calculate if on track
    const expectedProgress = percentageTimeElapsed;
    const actualProgress = allocation.progress_percentage;
    const onTrack = actualProgress >= expectedProgress;

    // Format response
    const response = {
      allocation_id: allocation.id,
      incentive_id: allocation.incentive_id,
      incentive_title: allocation.incentive.title,
      incentive_category: allocation.incentive.category,
      incentive_status: allocation.incentive.status,

      // Progress details
      target_value: allocation.target_value,
      current_value: allocation.current_value,
      progress_percentage: allocation.progress_percentage,
      status: allocation.status,

      // CRM integration
      crm_metric: crmMapping?.crm_metric || null,
      auto_update_enabled: crmMapping?.auto_update_enabled || false,
      update_frequency: crmMapping?.update_frequency || null,

      // Tier information
      current_tier: currentTier?.tier || null,
      current_tier_reward: currentTier?.reward || 0,
      next_tier: nextTier?.tier || null,
      next_tier_threshold: nextTier?.threshold_value || null,
      next_tier_reward: nextTier?.reward || null,
      remaining_to_next_tier: nextTier?.remaining_to_achieve || 0,
      tier_achievements: tierAchievements,

      // Time tracking
      start_date: allocation.incentive.start_date,
      end_date: allocation.incentive.end_date,
      days_total: totalDays,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      percentage_time_elapsed: Math.round(percentageTimeElapsed),
      on_track: onTrack,
      estimated_completion_date: estimatedCompletionDate,

      // Recent activity
      last_updated: allocation.updated_at,
      recent_events: (recentEvents || []).map((event) => ({
        type: event.event_type,
        metric_name: event.metric_name,
        old_value: event.old_value,
        new_value: event.new_value,
        delta: event.delta,
        old_progress: event.old_progress_percentage,
        new_progress: event.new_progress_percentage,
        tier_changed: event.tier_changed,
        old_tier: event.old_tier,
        new_tier: event.new_tier,
        timestamp: event.event_timestamp,
      })),
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: unknown) {
    apiLogger.error('Error in /api/incentives/realtime-progress', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
