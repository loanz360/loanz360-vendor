import { parseBody } from '@/lib/utils/parse-body'

/**
 * WorkDrive Share Approval Workflow API
 * GET - Get pending share requests
 * POST - Create a share request (for external shares)
 * PUT - Approve or reject a share request
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin, isSuperAdmin, logAudit } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ShareRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired'

interface ShareRequest {
  id: string
  file_id?: string
  folder_id?: string
  share_type: 'public' | 'internal' | 'external'
  shared_with_emails?: string[]
  requested_by: string
  requested_by_name?: string
  reason?: string
  expires_at?: string
  status: ShareRequestStatus
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  created_at: string
  file_name?: string
  folder_name?: string
}

/**
 * GET /api/workdrive/shares/approval
 * Get share requests (pending for admin, own requests for users)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as ShareRequestStatus | null
    const showAll = searchParams.get('all') === 'true'

    const isUserAdmin = await isAdmin(user.id) || await isSuperAdmin(user.id)

    let query = supabase
      .from('workdrive_share_requests')
      .select(`
        id,
        file_id,
        folder_id,
        share_type,
        shared_with_emails,
        requested_by,
        reason,
        expires_at,
        status,
        reviewed_by,
        reviewed_at,
        review_notes,
        created_at,
        requester:profiles!workdrive_share_requests_requested_by_fkey(full_name, email),
        reviewer:profiles!workdrive_share_requests_reviewed_by_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })

    // Filter by status if specified
    if (status) {
      query = query.eq('status', status)
    }

    // Admins see all requests, users see only their own
    if (!isUserAdmin || !showAll) {
      query = query.eq('requested_by', user.id)
    }

    const { data: requests, error: requestsError } = await query

    if (requestsError) {
      apiLogger.error('Error fetching share requests', requestsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 })
    }

    // Get file and folder names
    const fileIds = requests?.filter(r => r.file_id).map(r => r.file_id) || []
    const folderIds = requests?.filter(r => r.folder_id).map(r => r.folder_id) || []

    const [{ data: files }, { data: folders }] = await Promise.all([
      fileIds.length > 0
        ? supabase.from('workdrive_files').select('id, name').in('id', fileIds)
        : Promise.resolve({ data: [] }),
      folderIds.length > 0
        ? supabase.from('workdrive_folders').select('id, name').in('id', folderIds)
        : Promise.resolve({ data: [] }),
    ])

    const fileMap = new Map(files?.map(f => [f.id, f.name]) || [])
    const folderMap = new Map(folders?.map(f => [f.id, f.name]) || [])

    const formattedRequests: ShareRequest[] = (requests || []).map((r: typeof requests[number]) => ({
      id: r.id,
      file_id: r.file_id,
      folder_id: r.folder_id,
      share_type: r.share_type,
      shared_with_emails: r.shared_with_emails,
      requested_by: r.requested_by,
      requested_by_name: r.requester?.full_name || r.requester?.email || 'Unknown',
      reason: r.reason,
      expires_at: r.expires_at,
      status: r.status,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
      review_notes: r.review_notes,
      created_at: r.created_at,
      file_name: r.file_id ? fileMap.get(r.file_id) : undefined,
      folder_name: r.folder_id ? folderMap.get(r.folder_id) : undefined,
    }))

    // Get counts by status for admin dashboard
    let statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
    }

    if (isUserAdmin) {
      const { data: counts } = await supabase
        .from('workdrive_share_requests')
        .select('status')

      counts?.forEach((c: { status: string }) => {
        if (statusCounts.hasOwnProperty(c.status)) {
          statusCounts[c.status as ShareRequestStatus]++
        }
      })
    }

    return NextResponse.json({
      requests: formattedRequests,
      statusCounts,
      isAdmin: isUserAdmin,
    })
  } catch (error) {
    apiLogger.error('Get share requests error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/workdrive/shares/approval
 * Create a new share request
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      fileId,
      folderId,
      shareType,
      sharedWithEmails,
      reason,
      expiresInDays,
    } = body

    if (!fileId && !folderId) {
      return NextResponse.json({ success: false, error: 'File ID or Folder ID is required' }, { status: 400 })
    }

    if (!shareType || !['public', 'internal', 'external'].includes(shareType)) {
      return NextResponse.json({ success: false, error: 'Valid share type is required' }, { status: 400 })
    }

    // Check if share type requires approval
    const { data: settings } = await supabase
      .from('workdrive_admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['require_approval_external', 'require_approval_public'])

    const requireApprovalExternal = settings?.find(s => s.setting_key === 'require_approval_external')?.setting_value !== 'false'
    const requireApprovalPublic = settings?.find(s => s.setting_key === 'require_approval_public')?.setting_value !== 'false'

    const needsApproval =
      (shareType === 'external' && requireApprovalExternal) ||
      (shareType === 'public' && requireApprovalPublic)

    // If approval not required, create the share directly
    if (!needsApproval) {
      // Auto-approve for internal shares or when approval not required
      const shareResponse = await createShareDirectly({
        fileId,
        folderId,
        shareType,
        sharedWithEmails,
        expiresInDays,
        userId: user.id,
      })

      if (!shareResponse.success) {
        return NextResponse.json({ success: false, error: shareResponse.error }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Share created successfully',
        share: shareResponse.share,
        requiresApproval: false,
      })
    }

    // Create approval request
    let expiresAt: string | null = null
    if (expiresInDays) {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + expiresInDays)
      expiresAt = expiry.toISOString()
    }

    const { data: shareRequest, error: createError } = await supabase
      .from('workdrive_share_requests')
      .insert({
        file_id: fileId || null,
        folder_id: folderId || null,
        share_type: shareType,
        shared_with_emails: sharedWithEmails || [],
        requested_by: user.id,
        reason: reason || '',
        expires_at: expiresAt,
        status: 'pending',
      })
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating share request', createError)
      return NextResponse.json({ success: false, error: 'Failed to create share request' }, { status: 500 })
    }

    // Get file/folder name for notification
    const resourceName = fileId
      ? (await supabase.from('workdrive_files').select('name').eq('id', fileId).maybeSingle()).data?.name
      : (await supabase.from('workdrive_folders').select('name').eq('id', folderId).maybeSingle()).data?.name

    // Get user name
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    // Notify admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .or('role.eq.SUPER_ADMIN,role.eq.ADMIN')

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'share_approval_request',
        title: 'Share Approval Required',
        message: `${userProfile?.full_name || userProfile?.email || 'A user'} requested to share "${resourceName}" as ${shareType}`,
        metadata: {
          share_request_id: shareRequest.id,
          file_id: fileId,
          folder_id: folderId,
          share_type: shareType,
          requested_by: user.id,
        },
        is_read: false,
      }))

      await supabase.from('notifications').insert(notifications)
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'share' as any,
      resourceType: fileId ? 'file' : 'folder',
      resourceId: fileId || folderId!,
      resourceName,
      details: {
        action_type: 'share_request_created',
        share_type: shareType,
        status: 'pending',
        request_id: shareRequest.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Share request submitted for approval',
      request: shareRequest,
      requiresApproval: true,
    })
  } catch (error) {
    apiLogger.error('Create share request error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/workdrive/shares/approval
 * Approve or reject a share request
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can approve/reject
    const isUserAdmin = await isAdmin(user.id) || await isSuperAdmin(user.id)
    if (!isUserAdmin) {
      return NextResponse.json({ success: false, error: 'Only administrators can approve share requests' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { requestId, action, reviewNotes } = body

    if (!requestId) {
      return NextResponse.json({ success: false, error: 'Request ID is required' }, { status: 400 })
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Valid action (approve/reject) is required' }, { status: 400 })
    }

    // Get the share request
    const { data: shareRequest, error: fetchError } = await supabase
      .from('workdrive_share_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .maybeSingle()

    if (fetchError || !shareRequest) {
      return NextResponse.json({ success: false, error: 'Share request not found or already processed' }, { status: 404 })
    }

    const newStatus: ShareRequestStatus = action === 'approve' ? 'approved' : 'rejected'

    // Update request status
    const { error: updateError } = await supabase
      .from('workdrive_share_requests')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
      })
      .eq('id', requestId)

    if (updateError) {
      apiLogger.error('Error updating share request', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 })
    }

    let shareResult = null

    // If approved, create the actual share
    if (action === 'approve') {
      const createResult = await createShareDirectly({
        fileId: shareRequest.file_id,
        folderId: shareRequest.folder_id,
        shareType: shareRequest.share_type,
        sharedWithEmails: shareRequest.shared_with_emails,
        expiresAt: shareRequest.expires_at,
        userId: shareRequest.requested_by,
      })

      if (!createResult.success) {
        // Rollback the status update
        await supabase
          .from('workdrive_share_requests')
          .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
          .eq('id', requestId)

        return NextResponse.json({ success: false, error: createResult.error }, { status: 500 })
      }

      shareResult = createResult.share
    }

    // Get resource name for notification
    const resourceName = shareRequest.file_id
      ? (await supabase.from('workdrive_files').select('name').eq('id', shareRequest.file_id).maybeSingle()).data?.name
      : (await supabase.from('workdrive_folders').select('name').eq('id', shareRequest.folder_id).maybeSingle()).data?.name

    // Notify the requester
    await supabase.from('notifications').insert({
      user_id: shareRequest.requested_by,
      type: 'share_approval_result',
      title: `Share Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
      message: `Your request to share "${resourceName}" has been ${action === 'approve' ? 'approved' : 'rejected'}${reviewNotes ? `: ${reviewNotes}` : ''}`,
      metadata: {
        share_request_id: requestId,
        file_id: shareRequest.file_id,
        folder_id: shareRequest.folder_id,
        status: newStatus,
        share_url: shareResult?.share_url,
      },
      is_read: false,
    })

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'share' as any,
      resourceType: shareRequest.file_id ? 'file' : 'folder',
      resourceId: shareRequest.file_id || shareRequest.folder_id,
      resourceName,
      details: {
        action_type: `share_request_${action}d`,
        share_type: shareRequest.share_type,
        request_id: requestId,
        review_notes: reviewNotes,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Share request ${action}d`,
      status: newStatus,
      share: shareResult,
    })
  } catch (error) {
    apiLogger.error('Update share request error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to create a share directly
async function createShareDirectly(params: {
  fileId?: string
  folderId?: string
  shareType: string
  sharedWithEmails?: string[]
  expiresInDays?: number
  expiresAt?: string
  userId: string
}): Promise<{ success: boolean; share?: Record<string, unknown>; error?: string }> {
  try {
    // Generate share token
    const shareToken = generateShareToken()
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/workdrive/share/${shareToken}`

    let expiresAt = params.expiresAt
    if (!expiresAt && params.expiresInDays) {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + params.expiresInDays)
      expiresAt = expiry.toISOString()
    }

    const { data: share, error } = await supabase
      .from('workdrive_shares')
      .insert({
        file_id: params.fileId || null,
        folder_id: params.folderId || null,
        share_type: params.shareType,
        share_token: shareToken,
        share_url: shareUrl,
        shared_with_emails: params.sharedWithEmails || [],
        shared_by: params.userId,
        expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .maybeSingle()

    if (error) {
      return { success: false, error: 'Internal server error' }
    }

    return { success: true, share }
  } catch (error) {
    return { success: false, error: 'Failed to create share' }
  }
}

function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
