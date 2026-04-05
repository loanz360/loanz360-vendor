export const dynamic = 'force-dynamic'

/**
 * WorkDrive File Distribution API
 * For distributing files organization-wide or to specific departments
 * GET - Get distribution history/campaigns
 * POST - Create a new distribution
 * DELETE - Cancel a distribution
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin, isAdmin, logAudit } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type DistributionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
type DistributionScope = 'organization' | 'department' | 'role' | 'selected_users'

interface Distribution {
  id: string
  file_id?: string
  folder_id?: string
  scope: DistributionScope
  target_departments?: string[]
  target_roles?: string[]
  target_users?: string[]
  message?: string
  notify_users: boolean
  require_acknowledgment: boolean
  due_date?: string
  status: DistributionStatus
  created_by: string
  created_at: string
  completed_at?: string
  total_recipients: number
  acknowledged_count: number
}

/**
 * GET /api/workdrive/distribution
 * Get distribution history
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
    const type = searchParams.get('type') // 'sent' or 'received'

    const isUserAdmin = await isAdmin(user.id) || await isSuperAdmin(user.id)

    if (type === 'received' || !isUserAdmin) {
      // Get distributions received by this user
      const { data: receivedDistributions, error } = await supabase
        .from('workdrive_distribution_recipients')
        .select(`
          id,
          distribution_id,
          acknowledged,
          acknowledged_at,
          viewed_at,
          distribution:workdrive_distributions(
            id,
            file_id,
            folder_id,
            scope,
            message,
            require_acknowledgment,
            due_date,
            status,
            created_by,
            created_at,
            file:workdrive_files!workdrive_distributions_file_id_fkey(id, name, file_type, file_size_bytes),
            folder:workdrive_folders!workdrive_distributions_folder_id_fkey(id, name),
            creator:profiles!workdrive_distributions_created_by_fkey(full_name, email)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        apiLogger.error('Error fetching received distributions', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch distributions' }, { status: 500 })
      }

      return NextResponse.json({
        distributions: receivedDistributions || [],
        type: 'received',
      })
    }

    // Get distributions created by admins
    const { data: sentDistributions, error } = await supabase
      .from('workdrive_distributions')
      .select(`
        id,
        file_id,
        folder_id,
        scope,
        target_departments,
        target_roles,
        target_users,
        message,
        notify_users,
        require_acknowledgment,
        due_date,
        status,
        created_by,
        created_at,
        completed_at,
        total_recipients,
        acknowledged_count,
        file:workdrive_files!workdrive_distributions_file_id_fkey(id, name, file_type, file_size_bytes),
        folder:workdrive_folders!workdrive_distributions_folder_id_fkey(id, name),
        creator:profiles!workdrive_distributions_created_by_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      apiLogger.error('Error fetching sent distributions', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch distributions' }, { status: 500 })
    }

    return NextResponse.json({
      distributions: sentDistributions || [],
      type: 'sent',
    })
  } catch (error) {
    apiLogger.error('Get distributions error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/workdrive/distribution
 * Create a new file distribution
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

    // Only admins can distribute files
    const isUserAdmin = await isAdmin(user.id) || await isSuperAdmin(user.id)
    if (!isUserAdmin) {
      return NextResponse.json({ success: false, error: 'Only administrators can distribute files' }, { status: 403 })
    }

    const body = await request.json()
    const {
      fileId,
      folderId,
      scope,
      targetDepartments,
      targetRoles,
      targetUsers,
      message,
      notifyUsers = true,
      requireAcknowledgment = false,
      dueDate,
    } = body

    if (!fileId && !folderId) {
      return NextResponse.json({ success: false, error: 'File ID or Folder ID is required' }, { status: 400 })
    }

    if (!scope || !['organization', 'department', 'role', 'selected_users'].includes(scope)) {
      return NextResponse.json({ success: false, error: 'Valid scope is required' }, { status: 400 })
    }

    // Get recipients based on scope
    let recipientIds: string[] = []

    if (scope === 'organization') {
      // All active users
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true)

      recipientIds = users?.map(u => u.id) || []
    } else if (scope === 'department' && targetDepartments?.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .in('department', targetDepartments)
        .eq('is_active', true)

      recipientIds = users?.map(u => u.id) || []
    } else if (scope === 'role' && targetRoles?.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .in('role', targetRoles)
        .eq('is_active', true)

      recipientIds = users?.map(u => u.id) || []
    } else if (scope === 'selected_users' && targetUsers?.length > 0) {
      recipientIds = targetUsers
    }

    // Remove the creator from recipients
    recipientIds = recipientIds.filter(id => id !== user.id)

    if (recipientIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No recipients found for the selected scope' }, { status: 400 })
    }

    // Create distribution record
    const { data: distribution, error: distError } = await supabase
      .from('workdrive_distributions')
      .insert({
        file_id: fileId || null,
        folder_id: folderId || null,
        scope,
        target_departments: targetDepartments || [],
        target_roles: targetRoles || [],
        target_users: targetUsers || [],
        message: message || '',
        notify_users: notifyUsers,
        require_acknowledgment: requireAcknowledgment,
        due_date: dueDate || null,
        status: 'in_progress',
        created_by: user.id,
        total_recipients: recipientIds.length,
        acknowledged_count: 0,
      })
      .select()
      .maybeSingle()

    if (distError) {
      apiLogger.error('Error creating distribution', distError)
      return NextResponse.json({ success: false, error: 'Failed to create distribution' }, { status: 500 })
    }

    // Create recipient records
    const recipientRecords = recipientIds.map(recipientId => ({
      distribution_id: distribution.id,
      user_id: recipientId,
      acknowledged: false,
    }))

    const { error: recipientError } = await supabase
      .from('workdrive_distribution_recipients')
      .insert(recipientRecords)

    if (recipientError) {
      apiLogger.error('Error creating recipients', recipientError)
      // Rollback distribution
      await supabase.from('workdrive_distributions').delete().eq('id', distribution.id)
      return NextResponse.json({ success: false, error: 'Failed to add recipients' }, { status: 500 })
    }

    // Get file/folder name for notification
    const resourceName = fileId
      ? (await supabase.from('workdrive_files').select('name').eq('id', fileId).maybeSingle()).data?.name
      : (await supabase.from('workdrive_folders').select('name').eq('id', folderId).maybeSingle()).data?.name

    // Get creator name
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    // Send notifications if enabled
    if (notifyUsers) {
      const notifications = recipientIds.map(recipientId => ({
        user_id: recipientId,
        type: 'file_distribution',
        title: 'New File Shared With You',
        message: `${creatorProfile?.full_name || 'An administrator'} shared "${resourceName}" with you${message ? `: ${message}` : ''}`,
        metadata: {
          distribution_id: distribution.id,
          file_id: fileId,
          folder_id: folderId,
          require_acknowledgment: requireAcknowledgment,
          due_date: dueDate,
        },
        is_read: false,
      }))

      await supabase.from('notifications').insert(notifications)
    }

    // Update distribution status to completed
    await supabase
      .from('workdrive_distributions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', distribution.id)

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'share' as any,
      resourceType: fileId ? 'file' : 'folder',
      resourceId: fileId || folderId!,
      resourceName,
      details: {
        action_type: 'distribution_created',
        scope,
        recipient_count: recipientIds.length,
        require_acknowledgment: requireAcknowledgment,
      },
    })

    return NextResponse.json({
      success: true,
      message: `File distributed to ${recipientIds.length} user${recipientIds.length > 1 ? 's' : ''}`,
      distribution: {
        ...distribution,
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    apiLogger.error('Create distribution error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/workdrive/distribution
 * Acknowledge a distribution
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

    const body = await request.json()
    const { distributionId, action } = body

    if (!distributionId) {
      return NextResponse.json({ success: false, error: 'Distribution ID is required' }, { status: 400 })
    }

    if (action === 'acknowledge') {
      // Update recipient acknowledgment
      const { error: updateError } = await supabase
        .from('workdrive_distribution_recipients')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('distribution_id', distributionId)
        .eq('user_id', user.id)

      if (updateError) {
        apiLogger.error('Error acknowledging distribution', updateError)
        return NextResponse.json({ success: false, error: 'Failed to acknowledge' }, { status: 500 })
      }

      // Update acknowledged count in distribution
      await supabase.rpc('increment_distribution_acknowledged', {
        dist_id: distributionId,
      })

      return NextResponse.json({
        success: true,
        message: 'Distribution acknowledged',
      })
    } else if (action === 'view') {
      // Mark as viewed
      await supabase
        .from('workdrive_distribution_recipients')
        .update({
          viewed_at: new Date().toISOString(),
        })
        .eq('distribution_id', distributionId)
        .eq('user_id', user.id)
        .is('viewed_at', null)

      return NextResponse.json({
        success: true,
        message: 'Distribution marked as viewed',
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Update distribution error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/workdrive/distribution?id=xxx
 * Cancel a distribution (admin only)
 */
export async function DELETE(request: NextRequest) {
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

    const isUserAdmin = await isAdmin(user.id) || await isSuperAdmin(user.id)
    if (!isUserAdmin) {
      return NextResponse.json({ success: false, error: 'Only administrators can cancel distributions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const distributionId = searchParams.get('id')

    if (!distributionId) {
      return NextResponse.json({ success: false, error: 'Distribution ID is required' }, { status: 400 })
    }

    // Update distribution status
    const { error: updateError } = await supabase
      .from('workdrive_distributions')
      .update({
        status: 'cancelled',
      })
      .eq('id', distributionId)

    if (updateError) {
      apiLogger.error('Error cancelling distribution', updateError)
      return NextResponse.json({ success: false, error: 'Failed to cancel distribution' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Distribution cancelled',
    })
  } catch (error) {
    apiLogger.error('Cancel distribution error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
