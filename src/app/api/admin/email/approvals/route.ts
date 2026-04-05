export const dynamic = 'force-dynamic'

/**
 * Email Approval Requests API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getApprovalWorkflowService } from '@/lib/email/workflows';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/email/approvals
 * List approval requests
 * Query params:
 *   - status: filter by status (pending, approved, denied, etc.)
 *   - type: 'pending_for_me' | 'my_requests' | 'all'
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired' | null;
    const type = searchParams.get('type') || 'all';

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workflowService = getApprovalWorkflowService();
    let requests;

    switch (type) {
      case 'pending_for_me':
        requests = await workflowService.getPendingApprovalsForUser(user.id);
        break;

      case 'my_requests':
        requests = await workflowService.getRequestsByRequester(user.id, status || undefined);
        break;

      case 'all': {
        // Check admin role for viewing all
        const { data: userData } = await supabase
          .from('user')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!userData || !['super_admin', 'admin', 'email_admin'].includes(userData.role)) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        if (status === 'pending') {
          requests = await workflowService.getAllPendingRequests();
        } else {
          // Get all requests with optional status filter
          const { data } = await supabase
            .from('email_approval_requests')
            .select('*, email_approval_workflows(*)')
            .order('submitted_at', { ascending: false });

          requests = (data || []).filter(r => !status || r.status === status);
        }
        break;
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid type parameter' }, { status: 400 });
    }

    return NextResponse.json({ requests });
  } catch (error) {
    apiLogger.error('[Approvals API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/approvals
 * Submit a new approval request
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.requestType || !body.requestData) {
      return NextResponse.json(
        { error: 'Missing required fields: requestType, requestData' },
        { status: 400 }
      );
    }

    const workflowService = getApprovalWorkflowService();
    const result = await workflowService.submitRequest(
      {
        requestType: body.requestType,
        requestData: body.requestData,
        targetAccountId: body.targetAccountId,
        requesterNotes: body.requesterNotes,
      },
      user.id
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        requestId: result.requestId,
        requiresApproval: result.requiresApproval,
        message: result.requiresApproval
          ? 'Request submitted for approval'
          : 'Request processed automatically (no approval required)',
      },
      { status: 201 }
    );
  } catch (error) {
    apiLogger.error('[Approvals API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to submit approval request' },
      { status: 500 }
    );
  }
}
