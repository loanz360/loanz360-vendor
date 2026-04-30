import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Admin Settings API
 * Super Admin only - Manage email system settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import type { EmailAdminSettings, UpdateEmailSettingsRequest } from '@/types/email';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/settings - Get all email settings
export async function GET() {
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

    const adminSupabase = createSupabaseAdmin();

    const { data: settings, error } = await adminSupabase
      .from('email_admin_settings')
      .select('*')
      .order('category', { ascending: true })
      .order('setting_key', { ascending: true });

    if (error) {
      apiLogger.error('Error fetching settings', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    // Transform to key-value object
    const settingsObject: Record<string, unknown> = {};
    const settingsMetadata: Record<string, { description: string; type: string; category: string; editable: boolean }> = {};

    for (const setting of settings) {
      settingsObject[setting.setting_key] = setting.setting_value;
      settingsMetadata[setting.setting_key] = {
        description: setting.description,
        type: setting.setting_type,
        category: setting.category,
        editable: setting.is_editable,
      };
    }

    return NextResponse.json({
      success: true,
      data: settingsObject as EmailAdminSettings,
      metadata: settingsMetadata,
      raw: settings,
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/settings', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/email/settings - Update email settings
export async function PUT(request: NextRequest) {
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

    const body: UpdateEmailSettingsRequest = await request.json();
    const adminSupabase = createSupabaseAdmin();

    // Get current settings to check which are editable
    const { data: currentSettings } = await adminSupabase
      .from('email_admin_settings')
      .select('setting_key, is_editable, setting_type');

    const editableKeys = new Set(
      currentSettings?.filter(s => s.is_editable).map(s => s.setting_key) || []
    );
    const settingTypes = new Map(
      currentSettings?.map(s => [s.setting_key, s.setting_type]) || []
    );

    const updates: { key: string; value: unknown }[] = [];
    const errors: { key: string; error: string }[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (!editableKeys.has(key)) {
        errors.push({ key, error: 'Setting is not editable' });
        continue;
      }

      // Validate type
      const expectedType = settingTypes.get(key);
      if (!validateSettingValue(value, expectedType || 'string')) {
        errors.push({ key, error: `Invalid value type. Expected ${expectedType}` });
        continue;
      }

      updates.push({ key, value });
    }

    // Apply updates
    for (const update of updates) {
      const { error: updateError } = await adminSupabase
        .from('email_admin_settings')
        .update({
          setting_value: update.value,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', update.key);

      if (updateError) {
        errors.push({ key: update.key, error: updateError.message });
      }
    }

    // Get updated settings
    const { data: updatedSettings } = await adminSupabase
      .from('email_admin_settings')
      .select('*');

    const settingsObject: Record<string, unknown> = {};
    for (const setting of updatedSettings || []) {
      settingsObject[setting.setting_key] = setting.setting_value;
    }

    return NextResponse.json({
      success: errors.length === 0,
      data: settingsObject,
      updated: updates.map(u => u.key),
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0
        ? `${updates.length} setting(s) updated successfully`
        : `${updates.length} updated, ${errors.length} failed`,
    });
  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/email/settings', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email/settings/reset - Reset settings to defaults
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


      keys: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const keysToReset = body.keys as string[] | undefined;

    // Default values for all settings
    const defaults: Record<string, unknown> = {
      email_format: 'firstname.lastname',
      default_daily_limit: 500,
      default_storage_quota_mb: 5120,
      max_attachment_size_mb: 25,
      max_total_attachments_mb: 50,
      max_recipients: 50,
      allowed_attachment_types: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'csv', 'zip', 'rar'],
      blocked_attachment_types: ['exe', 'bat', 'sh', 'cmd', 'ps1', 'vbs', 'js', 'dll', 'sys', 'msi', 'scr'],
      allow_external_emails: true,
      external_email_warning: true,
      require_signature: true,
      signature_position: 'bottom',
      signature_separator: '--',
      auto_bcc_admin: false,
      admin_bcc_email: '',
      retention_days: 365,
      spam_filter_enabled: true,
      virus_scan_enabled: true,
      audit_log_retention_days: 730,
      auto_reply_max_days: 30,
      email_recall_enabled: false,
      read_receipt_enabled: true,
      schedule_send_enabled: true,
      undo_send_seconds: 10,
      default_font_family: 'Arial, sans-serif',
      default_font_size: 14,
    };

    const adminSupabase = createSupabaseAdmin();
    const resetKeys = keysToReset || Object.keys(defaults);
    const resetResults: string[] = [];

    for (const key of resetKeys) {
      if (defaults[key] !== undefined) {
        const { error } = await adminSupabase
          .from('email_admin_settings')
          .update({
            setting_value: defaults[key],
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', key)
          .eq('is_editable', true);

        if (!error) {
          resetResults.push(key);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { reset: resetResults },
      message: `${resetResults.length} setting(s) reset to defaults`,
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/admin/email/settings/reset', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to validate setting value type
function validateSettingValue(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'json':
      return typeof value === 'object' && value !== null;
    default:
      return true;
  }
}
