import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Provider Configuration API
 * Super Admin only - Manage email provider settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import type { EmailProviderConfig, EmailProviderConfigInput } from '@/types/email';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/config - Get current email configuration
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

    // Check if user is super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      );
    }

    // Get active email configuration
    const adminSupabase = createSupabaseAdmin();
    const { data: config, error } = await adminSupabase
      .from('email_provider_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      apiLogger.error('Error fetching email config', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch configuration' },
        { status: 500 }
      );
    }

    // Remove sensitive fields before returning
    if (config) {
      delete config.api_client_secret_encrypted;
      delete config.api_refresh_token_encrypted;
      delete config.api_access_token_encrypted;
    }

    return NextResponse.json({
      success: true,
      data: config || null,
      configured: !!config,
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/config', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email/config - Create or update email configuration
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

    const body: EmailProviderConfigInput = await request.json();

    // Validate required fields
    if (!body.provider || !body.domain) {
      return NextResponse.json(
        { success: false, error: 'Provider and domain are required' },
        { status: 400 }
      );
    }

    const adminSupabase = createSupabaseAdmin();

    // Check if config already exists
    const { data: existingConfig } = await adminSupabase
      .from('email_provider_config')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    const configData = {
      provider: body.provider,
      domain: body.domain.toLowerCase(),
      api_client_id: body.api_client_id || null,
      imap_host: body.imap_host || getDefaultIMAPHost(body.provider),
      imap_port: body.imap_port || 993,
      imap_use_ssl: body.imap_use_ssl ?? true,
      smtp_host: body.smtp_host || getDefaultSMTPHost(body.provider),
      smtp_port: body.smtp_port || 465,
      smtp_use_ssl: body.smtp_use_ssl ?? true,
      daily_send_limit_per_user: body.daily_send_limit_per_user || 500,
      max_attachment_size_mb: body.max_attachment_size_mb || 25,
      max_recipients_per_email: body.max_recipients_per_email || 50,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (existingConfig) {
      // Update existing config
      const { data, error } = await adminSupabase
        .from('email_provider_config')
        .update(configData)
        .eq('id', existingConfig.id)
        .select()
        .maybeSingle();

      if (error) {
        apiLogger.error('Error updating email config', error);
        return NextResponse.json(
          { success: false, error: 'Failed to update configuration' },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Create new config
      const { data, error } = await adminSupabase
        .from('email_provider_config')
        .insert({
          ...configData,
          created_by: user.id,
          is_active: true,
          setup_completed: false,
          verification_status: 'pending',
        })
        .select()
        .maybeSingle();

      if (error) {
        apiLogger.error('Error creating email config', error);
        return NextResponse.json(
          { success: false, error: 'Failed to create configuration' },
          { status: 500 }
        );
      }
      result = data;
    }

    // Remove sensitive fields
    delete result.api_client_secret_encrypted;
    delete result.api_refresh_token_encrypted;
    delete result.api_access_token_encrypted;

    return NextResponse.json({
      success: true,
      data: result,
      message: existingConfig ? 'Configuration updated' : 'Configuration created',
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/admin/email/config', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/email/config - Update specific settings
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

    const bodySchema = z.object({


      provider: z.string().optional(),


      domain: z.string().optional(),


      api_client_id: z.string().uuid().optional(),


      imap_host: z.string().optional(),


      imap_port: z.string().optional(),


      imap_use_ssl: z.string().optional(),


      smtp_host: z.string().optional(),


      smtp_port: z.string().optional(),


      smtp_use_ssl: z.string().optional(),


      daily_send_limit_per_user: z.string().optional(),


      max_attachment_size_mb: z.string().optional(),


      max_recipients_per_email: z.string().email().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const adminSupabase = createSupabaseAdmin();

    // Get existing config
    const { data: existingConfig, error: fetchError } = await adminSupabase
      .from('email_provider_config')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError || !existingConfig) {
      return NextResponse.json(
        { success: false, error: 'No configuration found to update' },
        { status: 404 }
      );
    }

    // Only allow certain fields to be updated
    const allowedFields = [
      'domain', 'imap_host', 'imap_port', 'imap_use_ssl',
      'smtp_host', 'smtp_port', 'smtp_use_ssl',
      'daily_send_limit_per_user', 'max_attachment_size_mb',
      'max_recipients_per_email', 'max_total_attachments_mb',
    ];

    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await adminSupabase
      .from('email_provider_config')
      .update(updateData)
      .eq('id', existingConfig.id)
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error updating email config', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update configuration' },
        { status: 500 }
      );
    }

    // Remove sensitive fields
    delete data.api_client_secret_encrypted;
    delete data.api_refresh_token_encrypted;
    delete data.api_access_token_encrypted;

    return NextResponse.json({
      success: true,
      data,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/email/config', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getDefaultIMAPHost(provider: string): string {
  const hosts: Record<string, string> = {
    zoho: 'imap.zoho.com',
    google: 'imap.gmail.com',
    microsoft: 'outlook.office365.com',
    hostinger: 'imap.hostinger.com',
  };
  return hosts[provider] || 'imap.zoho.com';
}

function getDefaultSMTPHost(provider: string): string {
  const hosts: Record<string, string> = {
    zoho: 'smtp.zoho.com',
    google: 'smtp.gmail.com',
    microsoft: 'smtp.office365.com',
    hostinger: 'smtp.hostinger.com',
  };
  return hosts[provider] || 'smtp.zoho.com';
}
