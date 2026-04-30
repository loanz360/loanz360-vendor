import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Provider Management API
 * Super Admin only - Manage email provider credentials and configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { getEmailProviderService } from '@/lib/email/providers';
import type { EmailProviderType } from '@/lib/email/providers';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/providers - List all providers
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

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') !== 'false';

    const providerService = getEmailProviderService();
    const providers = await providerService.getProviders(activeOnly);

    // Get available provider definitions
    const definitions = providerService.getAvailableProviders();

    // Mask sensitive data before returning
    const maskedProviders = providers.map(p => ({
      ...p,
      apiKey: p.apiKey ? '***encrypted***' : undefined,
      apiSecret: p.apiSecret ? '***encrypted***' : undefined,
      smtpPassword: p.smtpPassword ? '***encrypted***' : undefined,
      oauthClientSecret: p.oauthClientSecret ? '***encrypted***' : undefined,
      oauthAccessToken: p.oauthAccessToken ? '***encrypted***' : undefined,
      oauthRefreshToken: p.oauthRefreshToken ? '***encrypted***' : undefined,
      webhookSecret: p.webhookSecret ? '***encrypted***' : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: maskedProviders,
      definitions,
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/providers', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email/providers - Create a new provider
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


      providerName: z.string(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;

    // Validate required fields
    if (!body.providerName) {
      return NextResponse.json(
        { success: false, error: 'Provider name is required' },
        { status: 400 }
      );
    }

    const providerService = getEmailProviderService();
    const result = await providerService.createProvider(body, user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.provider,
        apiKey: result.provider?.apiKey ? '***encrypted***' : undefined,
        apiSecret: result.provider?.apiSecret ? '***encrypted***' : undefined,
        smtpPassword: result.provider?.smtpPassword ? '***encrypted***' : undefined,
      },
      message: 'Provider created successfully',
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/admin/email/providers', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
