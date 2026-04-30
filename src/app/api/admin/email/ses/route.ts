import { parseBody } from '@/lib/utils/parse-body'
/**
 * Amazon SES Configuration & Management API
 * Admin endpoints for managing SES settings, templates, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { initializeSESService } from '@/lib/email/ses-service';
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email/ses
 * Get SES configuration status and account information
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if SES is configured
    const isConfigured = !!(
      process.env.AWS_SES_ACCESS_KEY_ID ||
      process.env.AWS_ACCESS_KEY_ID
    ) && !!(
      process.env.AWS_SES_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY
    );

    if (!isConfigured) {
      return NextResponse.json({
        configured: false,
        message: 'SES is not configured. Please set AWS credentials.',
        requiredEnvVars: [
          'AWS_SES_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID',
          'AWS_SES_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY',
          'AWS_SES_REGION or AWS_REGION',
          'AWS_SES_FROM_EMAIL',
        ],
      });
    }

    // Initialize SES service
    const sesService = await initializeSESService();

    // Get account status
    const accountStatus = await sesService.getAccountStatus();
    const healthCheck = await sesService.healthCheck();

    // Get templates
    const templates = await sesService.listTemplates();

    // Get configuration sets
    const configurationSets = await sesService.listConfigurationSets();

    return NextResponse.json({
      configured: true,
      status: healthCheck.status,
      healthy: healthCheck.healthy,
      account: accountStatus,
      templates: templates,
      configurationSets: configurationSets,
      configuration: {
        region: process.env.AWS_SES_REGION || process.env.AWS_REGION,
        fromEmail: process.env.AWS_SES_FROM_EMAIL,
        fromName: process.env.AWS_SES_FROM_NAME,
        configurationSet: process.env.AWS_SES_CONFIGURATION_SET,
      },
    });
  } catch (error: unknown) {
    apiLogger.error('[SES Admin] Error getting status', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/ses
 * Test SES connection or send test email
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr;
    const { action, ...params } = body;

    const sesService = await initializeSESService();

    switch (action) {
      case 'test_connection':
        const healthCheck = await sesService.healthCheck();
        return NextResponse.json({
          success: healthCheck.healthy,
          status: healthCheck.status,
          message: healthCheck.message,
          latencyMs: healthCheck.latencyMs,
        });

      case 'send_test_email':
        if (!params.to) {
          return NextResponse.json(
            { error: 'Missing recipient email' },
            { status: 400 }
          );
        }

        const result = await sesService.sendEmail({
          to: params.to,
          subject: 'SES Test Email - Loanz360',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Amazon SES Test Email</h2>
              <p>This is a test email sent from Loanz360 using Amazon SES.</p>
              <p>If you received this email, your SES integration is working correctly.</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">
                Sent at: ${new Date().toISOString()}<br>
                From: Loanz360 Email System
              </p>
            </div>
          `,
          text: `Amazon SES Test Email\n\nThis is a test email sent from Loanz360 using Amazon SES.\nIf you received this email, your SES integration is working correctly.\n\nSent at: ${new Date().toISOString()}`,
          tags: ['test', 'ses-verification'],
        });

        return NextResponse.json({
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });

      case 'get_quota':
        const accountStatus = await sesService.getAccountStatus();
        return NextResponse.json({
          success: true,
          quota: accountStatus?.sendQuota,
          sendingEnabled: accountStatus?.sendingEnabled,
          productionAccess: accountStatus?.productionAccessEnabled,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    apiLogger.error('[SES Admin] Error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
