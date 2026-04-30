
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/crm/sync-metrics
 *
 * Manually sync CRM metrics to incentive allocations.
 * This is useful for testing, recovery, or when auto-sync is disabled.
 *
 * Request Body:
 * - user_id: UUID (optional - defaults to all users if admin)
 * - metric_period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' (default: 'monthly')
 * - force_recalculate: boolean (default: false)
 * - metric_names: string[] (optional - specific metrics to sync)
 *
 * Admin-only endpoint
 */
export async function POST(request: NextRequest) {
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

    // Check if user is admin
    const { data: currentUserData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = currentUserData?.role === 'admin' || currentUserData?.role === 'super_admin';

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      user_id,
      metric_period = 'monthly',
      force_recalculate = false,
      metric_names = [],
    } = body;

    // Get target users
    let targetUsers: string[] = [];

    if (user_id) {
      targetUsers = [user_id];
    } else {
      // Get all employees with active allocations
      const { data: allocations } = await supabase
        .from('incentive_allocations')
        .select('user_id')
        .in('status', ['eligible', 'in_progress', 'achieved']);

      targetUsers = [...new Set(allocations?.map((a) => a.user_id) || [])];
    }

    // Track sync results
    const syncResults = {
      total_users: targetUsers.length,
      users_synced: 0,
      metrics_updated: [] as string[],
      allocations_updated: 0,
      errors: [] as any[],
    };

    // Sync each user
    for (const userId of targetUsers) {
      try {
        // Get user's CRM metrics
        const { data: metrics, error: metricsError } = await supabase
          .from('crm_incentive_metrics')
          .select('*')
          .eq('user_id', userId)
          .eq('metric_period', metric_period)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (metricsError) {
          syncResults.errors.push({
            user_id: userId,
            error: 'No metrics found',
            });
          continue;
        }

        // Get all active allocations with CRM mapping for this user
        const { data: allocations, error: allocationsError } = await supabase
          .from('incentive_allocations')
          .select(`
            *,
            incentive:incentives (
              id,
              incentive_crm_mapping (
                crm_metric,
                auto_update_enabled,
                aggregation_method
              )
            )
          `)
          .eq('user_id', userId)
          .in('status', ['eligible', 'in_progress', 'achieved']);

        if (allocationsError || !allocations) {
          syncResults.errors.push({
            user_id: userId,
            error: 'Failed to fetch allocations',
            details: allocationsError?.message,
          });
          continue;
        }

        // Sync each allocation
        for (const allocation of allocations) {
          const crmMapping = allocation.incentive?.incentive_crm_mapping?.[0];

          if (!crmMapping || !crmMapping.auto_update_enabled) {
            continue; // Skip if no CRM mapping or auto-update disabled
          }

          const metricName = crmMapping.crm_metric;

          // Skip if specific metrics requested and this isn't one of them
          if (metric_names.length > 0 && !metric_names.includes(metricName)) {
            continue;
          }

          // Get metric value from crm_incentive_metrics
          const metricValue = (metrics as any)[metricName] || 0;

          // Calculate new progress
          const newProgress = allocation.target_value > 0
            ? Math.min(200, (metricValue / allocation.target_value) * 100)
            : 0;

          // Update allocation if value changed or force_recalculate
          if (force_recalculate || allocation.current_value !== metricValue) {
            const { error: updateError } = await supabase
              .from('incentive_allocations')
              .update({
                current_value: metricValue,
                progress_percentage: newProgress,
                updated_at: new Date().toISOString(),
                status:
                  newProgress >= 100
                    ? 'achieved'
                    : newProgress > 0
                    ? 'in_progress'
                    : allocation.status,
              })
              .eq('id', allocation.id);

            if (!updateError) {
              syncResults.allocations_updated++;

              if (!syncResults.metrics_updated.includes(metricName)) {
                syncResults.metrics_updated.push(metricName);
              }

              // Log the sync event
              await supabase.from('crm_incentive_events').insert({
                event_type: 'manual_sync',
                event_source: 'api',
                event_source_id: null,
                user_id: userId,
                incentive_id: allocation.incentive_id,
                allocation_id: allocation.id,
                metric_name: metricName,
                old_value: allocation.current_value,
                new_value: metricValue,
                delta: metricValue - allocation.current_value,
                old_progress_percentage: allocation.progress_percentage,
                new_progress_percentage: newProgress,
              });
            } else {
              syncResults.errors.push({
                user_id: userId,
                allocation_id: allocation.id,
                error: 'Failed to update allocation',
                });
            }
          }
        }

        syncResults.users_synced++;

      } catch (error: unknown) {
        syncResults.errors.push({
          user_id: userId,
          error: 'Exception during sync',
          });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Sync completed',
        results: syncResults,
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    apiLogger.error('Error in /api/crm/sync-metrics', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crm/sync-metrics
 *
 * Get sync status and statistics
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

    // Check if user is admin
    const { data: currentUserData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = currentUserData?.role === 'admin' || currentUserData?.role === 'super_admin';

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get sync statistics
    const { data: totalMetrics, count: totalMetricsCount } = await supabase
      .from('crm_incentive_metrics')
      .select('*', { count: 'exact', head: true });

    const { data: totalAllocations, count: totalAllocationsCount } = await supabase
      .from('incentive_allocations')
      .select('*', { count: 'exact', head: true })
      .in('status', ['eligible', 'in_progress', 'achieved']);

    const { data: crmMappings, count: crmMappingsCount } = await supabase
      .from('incentive_crm_mapping')
      .select('*', { count: 'exact', head: true })
      .eq('auto_update_enabled', true);

    const { data: recentEvents } = await supabase
      .from('crm_incentive_events')
      .select('event_type, created_at')
      .order('event_timestamp', { ascending: false })
      .limit(10);

    const { data: manualSyncs } = await supabase
      .from('crm_incentive_events')
      .select('*', { count: 'exact' })
      .eq('event_type', 'manual_sync')
      .gte('event_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return NextResponse.json({
      statistics: {
        total_metrics_records: totalMetricsCount || 0,
        total_active_allocations: totalAllocationsCount || 0,
        total_crm_mappings: crmMappingsCount || 0,
        manual_syncs_last_24h: manualSyncs?.length || 0,
      },
      recent_events: recentEvents || [],
    });

  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/crm/sync-metrics', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
