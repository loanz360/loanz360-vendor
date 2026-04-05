export const dynamic = 'force-dynamic'

/**
 * Email Approval Request Single Item API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getApprovalWorkflowService } from '@/lib/email/workflows';
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/email/approvals/[id]
 * Get approval request by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdmin();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workflowService = getApprovalWorkflowService();
    const request_data = await workflowService.getRequestById(id);

    if (!request_data) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ request: request_data });
  } catch (error) {
    apiLogger.error('[Approval API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/approvals/[id]
 * Process approval (approve/deny/cancel)
 * Body: { action: 'approve' | 'deny' | 'cancel', notes?: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdmin();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notes } = body;

    if (!action || !['approve', 'deny', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, deny, or cancel' },
        { status: 400 }
      );
    }

    const workflowService = getApprovalWorkflowService();

    if (action === 'cancel') {
      const result = await workflowService.cancelRequest(id, user.id, notes);

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({ message: 'Request cancelled successfully' });
    }

    // Process approval or denial
    const result = await workflowService.processApproval({
      requestId: id,
      approverId: user.id,
      action: action as 'approve' | 'deny',
      notes,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: action === 'approve' ? 'Request approved' : 'Request denied',
      isComplete: result.isComplete,
      finalStatus: result.finalStatus,
    });
  } catch (error) {
    apiLogger.error('[Approval API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
