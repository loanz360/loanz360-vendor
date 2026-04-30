import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Quota API Routes
 * Manage quota policies and usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getQuotaService } from '@/lib/email/quota';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/email/quota
 * Get quota information
 * Query params:
 *   - type: 'policies' | 'usage' | 'statistics' | 'near-quota'
 *   - accountId: for specific account usage
 *   - threshold: for near-quota (default 80)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'statistics';
    const accountId = searchParams.get('accountId');
    const threshold = parseInt(searchParams.get('threshold') || '80');

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const quotaService = getQuotaService();

    switch (type) {
      case 'policies': {
        const policies = await quotaService.getPolicies();
        return NextResponse.json({ policies });
      }

      case 'usage': {
        if (accountId) {
          const usage = await quotaService.getQuotaUsage(accountId);
          return NextResponse.json({ usage });
        }
        const { accounts, total } = await quotaService.getAllQuotaUsage();
        return NextResponse.json({ accounts, total });
      }

      case 'near-quota': {
        const accounts = await quotaService.getAccountsNearQuota(threshold);
        return NextResponse.json({ accounts });
      }

      case 'statistics':
      default: {
        const statistics = await quotaService.getQuotaStatistics();
        return NextResponse.json({ statistics });
      }
    }
  } catch (error) {
    apiLogger.error('[Quota API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch quota information' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/quota
 * Create a new quota policy
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: userData } = await supabase
      .from('user')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['super_admin', 'admin', 'email_admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const bodySchema = z.object({


      accountId: z.string().uuid(),


      policyId: z.string().uuid().optional(),


      storageQuotaMb: z.string().optional(),


      dailySendLimit: z.string().optional(),


      name: z.string(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;

    if (!body.name) {
      return NextResponse.json({ success: false, error: 'Policy name is required' }, { status: 400 });
    }

    const quotaService = getQuotaService();
    const result = await quotaService.createPolicy(body, user.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { policyId: result.policyId, message: 'Policy created successfully' },
      { status: 201 }
    );
  } catch (error) {
    apiLogger.error('[Quota API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to create policy' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/email/quota
 * Update account quota or assign policy
 * Body: { accountId, storageQuotaMb?, dailySendLimit?, policyId? }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: userData } = await supabase
      .from('user')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['super_admin', 'admin', 'email_admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const bodySchema2 = z.object({


      storageQuotaMb: z.string().optional(),


      dailySendLimit: z.string().optional(),


      policyId: z.string().optional(),


      accountId: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2;
    const { accountId, policyId, storageQuotaMb, dailySendLimit } = body;

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Account ID is required' }, { status: 400 });
    }

    const quotaService = getQuotaService();

    if (policyId) {
      // Assign policy to account
      const result = await quotaService.assignPolicyToAccount(accountId, policyId, user.id);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ message: 'Policy assigned successfully' });
    }

    // Update individual quota
    const result = await quotaService.updateAccountQuota(
      accountId,
      { storageQuotaMb, dailySendLimit },
      user.id
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: 'Quota updated successfully' });
  } catch (error) {
    apiLogger.error('[Quota API] PUT error', error);
    return NextResponse.json(
      { error: 'Failed to update quota' },
      { status: 500 }
    );
  }
}
