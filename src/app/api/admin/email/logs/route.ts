import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Activity Logs API
 * Super Admin only - View email activity audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/logs - Get email activity logs
export async function GET(request: NextRequest) {
  try {
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action');
    const accountId = searchParams.get('account_id');
    const userId = searchParams.get('user_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');

    const adminSupabase = createSupabaseAdmin();

    // Build query
    let query = adminSupabase
      .from('email_activity_logs')
      .select(`
        *,
        email_account:email_accounts (
          id,
          email_address,
          display_name
        ),
        actor:users!email_activity_logs_user_id_fkey (
          id,
          email,
          raw_user_meta_data
        )
      `, { count: 'exact' });

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }

    if (accountId) {
      query = query.eq('email_account_id', accountId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,from_address.ilike.%${search}%`);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: logs, error, count } = await query;

    if (error) {
      apiLogger.error('Error fetching logs', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch logs' },
        { status: 500 }
      );
    }

    // Transform data
    const transformedLogs = logs.map((log: Record<string, unknown>) => ({
      ...log,
      email_address: (log.email_account as Record<string, unknown>)?.email_address || null,
      account_display_name: (log.email_account as Record<string, unknown>)?.display_name || null,
      actor_email: (log.actor as Record<string, unknown>)?.email || null,
      actor_name: ((log.actor as Record<string, unknown>)?.raw_user_meta_data as Record<string, unknown>)?.full_name || null,
    }));

    return NextResponse.json({
      success: true,
      data: transformedLogs,
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/logs', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/admin/email/logs/actions - Get available action types
export async function POST(request: NextRequest) {
  try {
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

    const bodySchema = z.object({


      action: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const action = body.action;

    if (action === 'get_action_types') {
      // Return all possible action types
      const actionTypes = [
        { value: 'sent', label: 'Email Sent', category: 'email' },
        { value: 'received', label: 'Email Received', category: 'email' },
        { value: 'read', label: 'Email Read', category: 'email' },
        { value: 'unread', label: 'Marked Unread', category: 'email' },
        { value: 'deleted', label: 'Email Deleted', category: 'email' },
        { value: 'restored', label: 'Email Restored', category: 'email' },
        { value: 'forwarded', label: 'Email Forwarded', category: 'email' },
        { value: 'replied', label: 'Email Replied', category: 'email' },
        { value: 'starred', label: 'Email Starred', category: 'email' },
        { value: 'unstarred', label: 'Email Unstarred', category: 'email' },
        { value: 'archived', label: 'Email Archived', category: 'email' },
        { value: 'spam_marked', label: 'Marked as Spam', category: 'email' },
        { value: 'attachment_download', label: 'Attachment Downloaded', category: 'attachment' },
        { value: 'attachment_upload', label: 'Attachment Uploaded', category: 'attachment' },
        { value: 'draft_saved', label: 'Draft Saved', category: 'draft' },
        { value: 'draft_deleted', label: 'Draft Deleted', category: 'draft' },
        { value: 'account_created', label: 'Account Created', category: 'account' },
        { value: 'account_suspended', label: 'Account Suspended', category: 'account' },
        { value: 'account_activated', label: 'Account Activated', category: 'account' },
        { value: 'password_reset', label: 'Password Reset', category: 'account' },
        { value: 'settings_changed', label: 'Settings Changed', category: 'settings' },
        { value: 'login', label: 'Login', category: 'auth' },
        { value: 'logout', label: 'Logout', category: 'auth' },
      ];

      return NextResponse.json({
        success: true,
        data: actionTypes,
      });
    }

    if (action === 'get_summary') {
      // Get summary statistics
      const adminSupabase = createSupabaseAdmin();

      const { data: summary } = await adminSupabase
        .from('email_activity_logs')
        .select('action')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const actionCounts: Record<string, number> = {};
      for (const log of summary || []) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      }

      return NextResponse.json({
        success: true,
        data: {
          last_24h: summary?.length || 0,
          by_action: actionCounts,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    apiLogger.error('Error in POST /api/admin/email/logs', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
