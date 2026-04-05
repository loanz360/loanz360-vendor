export const dynamic = 'force-dynamic'

/**
 * Email Approval Workflows API Routes
 * Manage workflow definitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getApprovalWorkflowService } from '@/lib/email/workflows';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/email/workflows
 * List all approval workflows
 */
export async function GET(request: NextRequest) {
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

    const workflowService = getApprovalWorkflowService();
    const workflows = await workflowService.getActiveWorkflows();

    return NextResponse.json({ workflows });
  } catch (error) {
    apiLogger.error('[Workflows API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/workflows
 * Create a new workflow
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

    if (!userData || !['super_admin', 'admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.workflowName || !body.workflowType || !body.approvalChain) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowName, workflowType, approvalChain' },
        { status: 400 }
      );
    }

    const workflowService = getApprovalWorkflowService();
    const result = await workflowService.createWorkflow(
      {
        workflowName: body.workflowName,
        workflowType: body.workflowType,
        description: body.description,
        approvalChain: body.approvalChain,
        triggerConditions: body.triggerConditions,
        autoApproveTimeoutHours: body.autoApproveTimeoutHours,
        autoDenyTimeoutHours: body.autoDenyTimeoutHours,
      },
      user.id
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { workflowId: result.workflowId, message: 'Workflow created successfully' },
      { status: 201 }
    );
  } catch (error) {
    apiLogger.error('[Workflows API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}
