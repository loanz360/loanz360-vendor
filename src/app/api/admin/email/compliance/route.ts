import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Email Compliance API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getComplianceService } from '@/lib/email/compliance';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/email/compliance
 * Get compliance data
 * Query params:
 *   - type: 'summary' | 'legal-holds' | 'retention-policies' | 'audit-log'
 *   - status: for legal holds
 *   - accountId: for holds/audit affecting specific account
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'summary';
    const status = searchParams.get('status') as 'active' | 'released' | 'expired' | null;
    const accountId = searchParams.get('accountId');

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

    if (!userData || !['super_admin', 'admin', 'email_admin', 'security_admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const complianceService = getComplianceService();

    switch (type) {
      case 'summary': {
        const summary = await complianceService.getComplianceSummary();
        return NextResponse.json({ summary });
      }

      case 'legal-holds': {
        const holds = await complianceService.getLegalHolds({
          status: status || undefined,
          accountId: accountId || undefined,
        });
        return NextResponse.json({ holds });
      }

      case 'retention-policies': {
        const policies = await complianceService.getRetentionPolicies({
          isActive: true,
        });
        return NextResponse.json({ policies });
      }

      case 'audit-log': {
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const { entries, total } = await complianceService.getAuditLog({
          entityId: accountId || undefined,
          limit,
          offset,
        });
        return NextResponse.json({ entries, total });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    apiLogger.error('[Compliance API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/compliance
 * Create compliance items
 * Body: { action: 'create-hold' | 'create-policy', ... }
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

    if (!userData || !['super_admin', 'admin', 'security_admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const bodySchema = z.object({


      action: z.string().optional(),


      matterName: z.string().optional(),


      holdType: z.string().optional(),


      custodianAccountIds: z.string().optional(),


      matterId: z.string().uuid().optional(),


      description: z.string().optional(),


      contentStartDate: z.string().optional(),


      contentEndDate: z.string().optional(),


      legalCounsel: z.string().optional(),


      internalNotes: z.string().optional(),


      holdId: z.string().uuid(),


      reason: z.string().optional(),


      policyName: z.string().optional(),


      retentionPeriodDays: z.string().optional(),


      retentionAction: z.string().optional(),


      scopeType: z.string().optional(),


      scopeIds: z.string().optional(),


      applyToFolders: z.string().optional(),


      excludeLabels: z.string().optional(),


      priority: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const { action } = body;

    const complianceService = getComplianceService();

    switch (action) {
      case 'create-hold': {
        if (!body.matterName || !body.holdType || !body.custodianAccountIds) {
          return NextResponse.json(
            { error: 'matterName, holdType, and custodianAccountIds are required' },
            { status: 400 }
          );
        }

        const result = await complianceService.createLegalHold({
          matterName: body.matterName,
          matterId: body.matterId,
          description: body.description,
          holdType: body.holdType,
          custodianAccountIds: body.custodianAccountIds,
          contentStartDate: body.contentStartDate ? new Date(body.contentStartDate) : undefined,
          contentEndDate: body.contentEndDate ? new Date(body.contentEndDate) : undefined,
          legalCounsel: body.legalCounsel,
          internalNotes: body.internalNotes,
        }, user.id);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json(
          { holdId: result.holdId, message: 'Legal hold created successfully' },
          { status: 201 }
        );
      }

      case 'release-hold': {
        if (!body.holdId) {
          return NextResponse.json({ success: false, error: 'holdId is required' }, { status: 400 });
        }

        const result = await complianceService.releaseLegalHold(
          body.holdId,
          user.id,
          body.reason
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json({ message: 'Legal hold released successfully' });
      }

      case 'create-policy': {
        if (!body.policyName || !body.retentionPeriodDays || !body.retentionAction) {
          return NextResponse.json(
            { error: 'policyName, retentionPeriodDays, and retentionAction are required' },
            { status: 400 }
          );
        }

        const result = await complianceService.createRetentionPolicy({
          policyName: body.policyName,
          description: body.description,
          scopeType: body.scopeType || 'organization',
          scopeIds: body.scopeIds,
          retentionPeriodDays: body.retentionPeriodDays,
          retentionAction: body.retentionAction,
          applyToFolders: body.applyToFolders,
          excludeLabels: body.excludeLabels,
          priority: body.priority,
        }, user.id);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json(
          { policyId: result.policyId, message: 'Retention policy created successfully' },
          { status: 201 }
        );
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    apiLogger.error('[Compliance API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to process compliance action' },
      { status: 500 }
    );
  }
}
