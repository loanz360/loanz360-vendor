import { parseBody } from '@/lib/utils/parse-body'

/**
 * WorkDrive Admin Departments API
 * GET - Get department storage statistics
 * POST - Create/Update department quota
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin, formatFileSize } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/workdrive/admin/departments
 * Get all departments with storage statistics
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

    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Get unique departments from profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, department')
      .not('department', 'is', null)

    if (profilesError) {
      apiLogger.error('Error fetching profiles', profilesError)
    }

    // Group users by department
    const departmentUsers: Record<string, string[]> = {}
    profilesData?.forEach(profile => {
      const dept = profile.department || 'Unassigned'
      if (!departmentUsers[dept]) departmentUsers[dept] = []
      departmentUsers[dept].push(profile.id)
    })

    // Get department quotas
    const { data: quotasData } = await supabase
      .from('workdrive_storage_quotas')
      .select('*')
      .eq('entity_type', 'department')

    const quotasByDept: Record<string, any> = {}
    quotasData?.forEach(quota => {
      quotasByDept[quota.entity_id] = quota
    })

    // Calculate storage usage per department
    const departments = await Promise.all(
      Object.entries(departmentUsers).map(async ([deptName, userIds]) => {
        // Get total storage used by department users
        const { data: filesData } = await supabase
          .from('workdrive_files')
          .select('file_size_bytes')
          .in('created_by', userIds)
          .eq('is_deleted', false)

        const totalUsed = filesData?.reduce((sum, file) => sum + (file.file_size_bytes || 0), 0) || 0
        const fileCount = filesData?.length || 0

        // Get department quota if exists
        const quota = quotasByDept[deptName]
        const storageLimit = quota?.storage_limit_bytes || 10 * 1024 * 1024 * 1024 // 10GB default

        return {
          name: deptName,
          userCount: userIds.length,
          storageUsed: totalUsed,
          storageUsedFormatted: formatFileSize(totalUsed),
          storageLimit,
          storageLimitFormatted: formatFileSize(storageLimit),
          storageAvailable: Math.max(0, storageLimit - totalUsed),
          usagePercent: storageLimit > 0 ? Math.min(100, (totalUsed / storageLimit) * 100) : 0,
          fileCount,
          hasQuota: !!quota,
          quotaId: quota?.id,
          alertThreshold: quota?.alert_threshold_percent || 80,
        }
      })
    )

    // Sort by usage (highest first)
    departments.sort((a, b) => b.storageUsed - a.storageUsed)

    // Calculate totals
    const totalUsed = departments.reduce((sum, d) => sum + d.storageUsed, 0)
    const totalLimit = departments.reduce((sum, d) => sum + d.storageLimit, 0)
    const totalFiles = departments.reduce((sum, d) => sum + d.fileCount, 0)
    const totalUsers = departments.reduce((sum, d) => sum + d.userCount, 0)

    return NextResponse.json({
      departments,
      summary: {
        totalDepartments: departments.length,
        totalUsers,
        totalFiles,
        totalUsed,
        totalUsedFormatted: formatFileSize(totalUsed),
        totalLimit,
        totalLimitFormatted: formatFileSize(totalLimit),
        overallUsagePercent: totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0,
      },
    })
  } catch (error) {
    apiLogger.error('Get departments error', error)
    return NextResponse.json({ success: false, error: 'Failed to get departments' }, { status: 500 })
  }
}

/**
 * POST /api/workdrive/admin/departments
 * Create or update department quota
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

    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { departmentName, storageLimitGB, alertThreshold } = body

    if (!departmentName) {
      return NextResponse.json({ success: false, error: 'Department name is required' }, { status: 400 })
    }

    const storageLimitBytes = (storageLimitGB || 10) * 1024 * 1024 * 1024

    // Check if quota exists
    const { data: existingQuota } = await supabase
      .from('workdrive_storage_quotas')
      .select('*')
      .eq('entity_type', 'department')
      .eq('entity_id', departmentName)
      .maybeSingle()

    let result
    if (existingQuota) {
      // Update existing
      const { data, error } = await supabase
        .from('workdrive_storage_quotas')
        .update({
          storage_limit_bytes: storageLimitBytes,
          alert_threshold_percent: alertThreshold || 80,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingQuota.id)
        .select()
        .maybeSingle()

      if (error) throw error
      result = data
    } else {
      // Create new
      const { data, error } = await supabase
        .from('workdrive_storage_quotas')
        .insert({
          entity_type: 'department',
          entity_id: departmentName,
          storage_limit_bytes: storageLimitBytes,
          storage_used_bytes: 0,
          file_count: 0,
          alert_threshold_percent: alertThreshold || 80,
        })
        .select()
        .maybeSingle()

      if (error) throw error
      result = data
    }

    return NextResponse.json({
      success: true,
      quota: {
        ...result,
        storageLimitFormatted: formatFileSize(result.storage_limit_bytes),
      },
    })
  } catch (error) {
    apiLogger.error('Update department quota error', error)
    return NextResponse.json({ success: false, error: 'Failed to update department quota' }, { status: 500 })
  }
}
