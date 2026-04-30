
/**
 * Single Email Account Management API
 * Super Admin only - Get, update, delete individual email account
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import type { UpdateEmailAccountRequest } from '@/types/email';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/accounts/[id] - Get single account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const adminSupabase = createSupabaseAdmin();

    const { data: account, error } = await adminSupabase
      .from('email_accounts')
      .select(`
        *,
        user:users!email_accounts_user_id_fkey (
          id,
          email,
          raw_user_meta_data
        ),
        employee:employee_profile!email_accounts_employee_profile_id_fkey (
          id,
          role,
          subrole,
          department,
          designation,
          employee_id
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Get quota usage for last 30 days
    const { data: quotaUsage } = await adminSupabase
      .from('email_quota_usage')
      .select('*')
      .eq('email_account_id', id)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    // Get recent activity
    const { data: recentActivity } = await adminSupabase
      .from('email_activity_logs')
      .select('*')
      .eq('email_account_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      data: {
        ...account,
        personal_email: account.user?.email || '',
        full_name: account.user?.raw_user_meta_data?.full_name || '',
        avatar_url: account.user?.raw_user_meta_data?.avatar_url || null,
        employee_role: account.employee?.role || 'EMPLOYEE',
        employee_subrole: account.employee?.subrole || null,
        department: account.employee?.department || null,
        designation: account.employee?.designation || null,
        emp_code: account.employee?.employee_id || null,
        quota_usage: quotaUsage || [],
        recent_activity: recentActivity || [],
      },
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/accounts/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/email/accounts/[id] - Update account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body: UpdateEmailAccountRequest = await request.json();
    const adminSupabase = createSupabaseAdmin();

    // Get existing account
    const { data: existingAccount, error: fetchError } = await adminSupabase
      .from('email_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Allowed fields
    if (body.display_name !== undefined) updateData.display_name = body.display_name;
    if (body.storage_quota_mb !== undefined) updateData.storage_quota_mb = body.storage_quota_mb;
    if (body.daily_send_limit !== undefined) updateData.daily_send_limit = body.daily_send_limit;

    // Status change
    if (body.status !== undefined && body.status !== existingAccount.status) {
      updateData.status = body.status;

      if (body.status === 'suspended') {
        updateData.suspended_at = new Date().toISOString();
        updateData.suspended_by = user.id;
        updateData.suspension_reason = body.suspension_reason || 'Suspended by admin';
      } else if (body.status === 'active' && existingAccount.status === 'suspended') {
        updateData.suspended_at = null;
        updateData.suspended_by = null;
        updateData.suspension_reason = null;
      }
    }

    // Auto-reply settings
    if (body.auto_reply_enabled !== undefined) updateData.auto_reply_enabled = body.auto_reply_enabled;
    if (body.auto_reply_message !== undefined) updateData.auto_reply_message = body.auto_reply_message;
    if (body.auto_reply_start_date !== undefined) updateData.auto_reply_start_date = body.auto_reply_start_date;
    if (body.auto_reply_end_date !== undefined) updateData.auto_reply_end_date = body.auto_reply_end_date;

    // Update account
    const { data: updatedAccount, error: updateError } = await adminSupabase
      .from('email_accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating email account', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update account' },
        { status: 500 }
      );
    }

    // Log activity
    await adminSupabase.from('email_activity_logs').insert({
      email_account_id: id,
      user_id: user.id,
      action: 'settings_changed',
      details: {
        changed_by: user.id,
        changes: updateData,
        previous_status: existingAccount.status,
        new_status: updatedAccount.status,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAccount,
      message: 'Account updated successfully',
    });
  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/email/accounts/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/email/accounts/[id] - Delete account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const adminSupabase = createSupabaseAdmin();

    // Get account before deleting (for logging)
    const { data: account, error: fetchError } = await adminSupabase
      .from('email_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Option 1: Soft delete (set status to 'disabled')
    const softDelete = request.nextUrl.searchParams.get('soft') !== 'false';

    if (softDelete) {
      const { error: updateError } = await adminSupabase
        .from('email_accounts')
        .update({
          status: 'disabled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        apiLogger.error('Error disabling email account', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to disable account' },
          { status: 500 }
        );
      }
    } else {
      // Hard delete
      const { error: deleteError } = await adminSupabase
        .from('email_accounts')
        .delete()
        .eq('id', id);

      if (deleteError) {
        apiLogger.error('Error deleting email account', deleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to delete account' },
          { status: 500 }
        );
      }
    }

    // Log activity
    await adminSupabase.from('email_activity_logs').insert({
      user_id: user.id,
      action: softDelete ? 'account_suspended' : 'deleted',
      details: {
        deleted_by: user.id,
        email_address: account.email_address,
        soft_delete: softDelete,
      },
    });

    return NextResponse.json({
      success: true,
      message: softDelete ? 'Account disabled successfully' : 'Account deleted successfully',
    });
  } catch (error) {
    apiLogger.error('Error in DELETE /api/admin/email/accounts/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
