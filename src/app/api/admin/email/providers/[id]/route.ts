import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Provider Management API - Single Provider Operations
 * Super Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEmailProviderService } from '@/lib/email/providers';
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/email/providers/[id] - Get single provider
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify user is authenticated and is super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const providerService = getEmailProviderService();
    const provider = await providerService.getProviderById(id);

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      );
    }

    // Mask sensitive data
    return NextResponse.json({
      success: true,
      data: {
        ...provider,
        apiKey: provider.apiKey ? '***encrypted***' : undefined,
        apiSecret: provider.apiSecret ? '***encrypted***' : undefined,
        smtpPassword: provider.smtpPassword ? '***encrypted***' : undefined,
        oauthClientSecret: provider.oauthClientSecret ? '***encrypted***' : undefined,
      },
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/providers/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/email/providers/[id] - Update provider
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify user is authenticated and is super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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


      action: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const providerService = getEmailProviderService();

    const result = await providerService.updateProvider(id, body, user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Provider updated successfully',
    });
  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/email/providers/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/email/providers/[id] - Delete provider
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify user is authenticated and is super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const providerService = getEmailProviderService();
    const result = await providerService.deleteProvider(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Provider deleted successfully',
    });
  } catch (error) {
    apiLogger.error('Error in DELETE /api/admin/email/providers/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/email/providers/[id] - Special operations
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify user is authenticated and is super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const bodySchema2 = z.object({


      action: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2;
    const { action } = body;

    const providerService = getEmailProviderService();

    switch (action) {
      case 'set_primary': {
        const result = await providerService.setPrimaryProvider(id);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          message: 'Provider set as primary',
        });
      }

      case 'verify': {
        const result = await providerService.verifyProvider(id);
        return NextResponse.json({
          success: result.success,
          message: result.success ? 'Provider verified successfully' : result.error,
          error: result.error,
        });
      }

      case 'health_check': {
        const result = await providerService.checkProviderHealth(id);
        return NextResponse.json({
          success: result.healthy,
          data: result,
        });
      }

      case 'toggle_active': {
        const provider = await providerService.getProviderById(id);
        if (!provider) {
          return NextResponse.json(
            { success: false, error: 'Provider not found' },
            { status: 404 }
          );
        }

        const result = await providerService.updateProvider(id, {
          isActive: !provider.isActive,
        });

        return NextResponse.json({
          success: result.success,
          message: provider.isActive ? 'Provider deactivated' : 'Provider activated',
          error: result.error,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    apiLogger.error('Error in PATCH /api/admin/email/providers/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
