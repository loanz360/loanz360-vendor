
/**
 * WorkDrive Admin Storage API
 * GET - Get storage overview with comprehensive analytics
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStorageOverview, isAdmin } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/workdrive/admin/storage
 * Get organization-wide storage overview
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const result = await getStorageOverview()

    if (!result.stats) {
      // Return default empty stats instead of error for empty database
      return NextResponse.json({
        totalStorage: 2 * 1024 * 1024 * 1024 * 1024, // 2TB default
        usedStorage: 0,
        totalFiles: 0,
        totalUsers: 0,
        activeShares: 0,
        topUsers: [],
        storageByDepartment: [],
        recentActivity: [],
        byFileType: [],
        growthTrend: [],
        largestFiles: [],
        recentUploads: [],
      })
    }

    // Get additional data for comprehensive dashboard
    const { data: activeSharesData } = await supabase
      .from('workdrive_shares')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    const { data: usersData, count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    // Get top users by storage
    const { data: quotasData } = await supabase
      .from('workdrive_storage_quotas')
      .select('entity_id, storage_used_bytes, storage_limit_bytes, file_count')
      .eq('entity_type', 'user')
      .order('storage_used_bytes', { ascending: false })
      .limit(10)

    // Get user details for top users
    const topUserIds = quotasData?.map(q => q.entity_id) || []
    const { data: topUserProfiles } = topUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', topUserIds)
      : { data: [] }

    const topUsers = quotasData?.map(quota => {
      const profile = topUserProfiles?.find(p => p.id === quota.entity_id)
      return {
        userId: quota.entity_id,
        userName: profile?.full_name || profile?.email || 'Unknown User',
        usedStorage: quota.storage_used_bytes || 0,
        quota: quota.storage_limit_bytes || 10 * 1024 * 1024 * 1024, // 10GB default
        fileCount: quota.file_count || 0,
      }
    }) || []

    // Get recent activity from audit logs
    const { data: recentActivityData } = await supabase
      .from('workdrive_audit_logs')
      .select('action, user_id, resource_name, created_at')
      .in('action', ['upload', 'download', 'delete', 'share'])
      .order('created_at', { ascending: false })
      .limit(20)

    // Get user names for activity
    const activityUserIds = [...new Set(recentActivityData?.map(a => a.user_id) || [])]
    const { data: activityUserProfiles } = activityUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', activityUserIds)
      : { data: [] }

    const recentActivity = recentActivityData?.map(activity => {
      const profile = activityUserProfiles?.find(p => p.id === activity.user_id)
      return {
        action: activity.action,
        userName: profile?.full_name || profile?.email || 'Unknown User',
        fileName: activity.resource_name || 'Unknown File',
        timestamp: activity.created_at,
      }
    }) || []

    // Transform storage by department
    const storageByDepartment = result.stats.by_department?.map(dept => ({
      department: dept.department || 'Unknown',
      usedStorage: dept.size || 0,
      userCount: dept.users || 0,
    })) || []

    // Transform response to match frontend expected format
    return NextResponse.json({
      totalStorage: result.stats.total_storage_bytes || 2 * 1024 * 1024 * 1024 * 1024,
      usedStorage: result.stats.used_storage_bytes || 0,
      totalFiles: result.stats.total_files || 0,
      totalFolders: result.stats.total_folders || 0,
      totalUsers: totalUsers || 0,
      activeShares: activeSharesData?.length || 0,
      topUsers,
      storageByDepartment,
      recentActivity,
      byFileType: result.stats.by_file_type || [],
      growthTrend: result.stats.growth_trend || [],
      largestFiles: result.stats.largest_files || [],
      recentUploads: result.stats.recent_uploads || [],
      usagePercent: result.stats.usage_percent || 0,
      availableStorage: result.stats.available_storage_bytes || 0,
    })
  } catch (error) {
    apiLogger.error('Get storage overview error', error)
    // Return default stats on error instead of failing
    return NextResponse.json({
      totalStorage: 2 * 1024 * 1024 * 1024 * 1024,
      usedStorage: 0,
      totalFiles: 0,
      totalUsers: 0,
      activeShares: 0,
      topUsers: [],
      storageByDepartment: [],
      recentActivity: [],
      byFileType: [],
      growthTrend: [],
      largestFiles: [],
      recentUploads: [],
    })
  }
}
