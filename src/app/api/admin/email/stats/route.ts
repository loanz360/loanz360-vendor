import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Statistics API
 * Super Admin only - Get email usage statistics and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import type { EmailAdminDashboardStats, EmailActivityChartData } from '@/types/email';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/stats - Get email statistics
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const adminSupabase = createSupabaseAdmin();

    // Get dashboard stats
    const { data: accountStats } = await adminSupabase
      .from('email_accounts')
      .select('status, storage_used_mb, storage_quota_mb, emails_sent_today');

    const dashboardStats: EmailAdminDashboardStats = {
      total_accounts: accountStats?.length || 0,
      active_accounts: accountStats?.filter(a => a.status === 'active').length || 0,
      pending_accounts: accountStats?.filter(a => a.status === 'pending').length || 0,
      suspended_accounts: accountStats?.filter(a => a.status === 'suspended').length || 0,
      total_storage_used_mb: accountStats?.reduce((sum, a) => sum + (a.storage_used_mb || 0), 0) || 0,
      total_storage_quota_mb: accountStats?.reduce((sum, a) => sum + (a.storage_quota_mb || 0), 0) || 0,
      emails_sent_today: accountStats?.reduce((sum, a) => sum + (a.emails_sent_today || 0), 0) || 0,
      avg_emails_per_user_today: accountStats?.length
        ? Math.round(
            accountStats.reduce((sum, a) => sum + (a.emails_sent_today || 0), 0) /
            accountStats.filter(a => a.status === 'active').length
          )
        : 0,
    };

    // Get activity chart data for last N days
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data: quotaUsage } = await adminSupabase
      .from('email_quota_usage')
      .select('date, emails_sent, emails_received')
      .gte('date', startDateStr)
      .order('date', { ascending: true });

    // Aggregate by date
    const activityByDate = new Map<string, { sent: number; received: number }>();

    for (const usage of quotaUsage || []) {
      const existing = activityByDate.get(usage.date) || { sent: 0, received: 0 };
      activityByDate.set(usage.date, {
        sent: existing.sent + (usage.emails_sent || 0),
        received: existing.received + (usage.emails_received || 0),
      });
    }

    // Fill in missing dates
    const chartData: EmailActivityChartData[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const data = activityByDate.get(dateStr) || { sent: 0, received: 0 };
      chartData.push({
        date: dateStr,
        sent: data.sent,
        received: data.received,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get top senders
    const { data: topSenders } = await adminSupabase
      .from('email_accounts')
      .select('id, email_address, display_name, emails_sent_today')
      .eq('status', 'active')
      .order('emails_sent_today', { ascending: false })
      .limit(10);

    // Get accounts near quota limit
    const { data: nearQuotaAccounts } = await adminSupabase
      .from('email_accounts')
      .select('id, email_address, display_name, daily_send_limit, emails_sent_today')
      .eq('status', 'active')
      .gt('emails_sent_today', 0);

    const nearQuota = nearQuotaAccounts?.filter(
      a => (a.emails_sent_today / a.daily_send_limit) >= 0.8
    ) || [];

    // Get recent activity summary
    const { data: recentActivity } = await adminSupabase
      .from('email_activity_logs')
      .select('action')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const activitySummary: Record<string, number> = {};
    for (const activity of recentActivity || []) {
      activitySummary[activity.action] = (activitySummary[activity.action] || 0) + 1;
    }

    // Get storage distribution
    const storageRanges = [
      { label: '0-25%', min: 0, max: 0.25, count: 0 },
      { label: '25-50%', min: 0.25, max: 0.5, count: 0 },
      { label: '50-75%', min: 0.5, max: 0.75, count: 0 },
      { label: '75-90%', min: 0.75, max: 0.9, count: 0 },
      { label: '90-100%', min: 0.9, max: 1, count: 0 },
    ];

    for (const account of accountStats || []) {
      if (account.storage_quota_mb > 0) {
        const usage = account.storage_used_mb / account.storage_quota_mb;
        const range = storageRanges.find(r => usage >= r.min && usage < r.max);
        if (range) range.count++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        dashboard: dashboardStats,
        activity_chart: chartData,
        top_senders: topSenders || [],
        near_quota: nearQuota,
        activity_summary_24h: activitySummary,
        storage_distribution: storageRanges,
        period_days: days,
      },
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/stats', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email/stats/export - Export statistics
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      );
    }

    const bodySchema = z.object({


      format: z.string().optional().default('json'),


      type: z.string().optional().default('accounts'),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const { format = 'json', type = 'accounts' } = body;

    const adminSupabase = createSupabaseAdmin();

    let exportData: Record<string, unknown>[] = [];

    switch (type) {
      case 'accounts':
        const { data: accounts } = await adminSupabase
          .from('email_accounts')
          .select(`
            email_address,
            display_name,
            status,
            storage_quota_mb,
            storage_used_mb,
            daily_send_limit,
            emails_sent_today,
            created_at,
            last_sync_at
          `)
          .order('created_at', { ascending: false });
        exportData = accounts || [];
        break;

      case 'usage':
        const { data: usage } = await adminSupabase
          .from('email_quota_usage')
          .select(`
            date,
            emails_sent,
            emails_received,
            attachments_sent,
            total_sent_size_bytes,
            email_account:email_accounts (email_address)
          `)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false });
        exportData = (usage || []).map((u: Record<string, unknown>) => ({
          ...u,
          email_address: (u.email_account as Record<string, unknown>)?.email_address,
        }));
        break;

      case 'activity':
        const { data: activity } = await adminSupabase
          .from('email_activity_logs')
          .select(`
            action,
            subject,
            from_address,
            created_at,
            email_account:email_accounts (email_address)
          `)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1000);
        exportData = (activity || []).map((a: Record<string, unknown>) => ({
          ...a,
          email_address: (a.email_account as Record<string, unknown>)?.email_address,
        }));
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export type' },
          { status: 400 }
        );
    }

    if (format === 'csv') {
      // Convert to CSV
      if (exportData.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No data to export' },
          { status: 404 }
        );
      }

      const headers = Object.keys(exportData[0]);
      const csvRows = [
        headers.join(','),
        ...exportData.map(row =>
          headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val);
          }).join(',')
        ),
      ];

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="email_${type}_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: exportData,
      count: exportData.length,
      type,
      exported_at: new Date().toISOString(),
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/admin/email/stats/export', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
