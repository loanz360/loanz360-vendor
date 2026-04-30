import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * WorkDrive Quota API
 * GET - Get user's storage quota information
 * POST - Pre-check if file upload would exceed quota
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatFileSize } from '@/lib/workdrive'
import { ROLE_QUOTA_DEFAULTS } from '@/types/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserQuotaInfo(userId: string) {
  const { data: quota } = await supabase
    .from('workdrive_storage_quotas')
    .select('*')
    .eq('entity_type', 'user')
    .eq('entity_id', userId)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  const roleKey = profile?.sub_role?.toUpperCase().replace(/ /g, '_') || profile?.role
  const defaultQuota = ROLE_QUOTA_DEFAULTS[roleKey || 'CUSTOMER'] || ROLE_QUOTA_DEFAULTS.CUSTOMER

  const storageLimit = quota?.storage_limit_bytes ?? defaultQuota
  const storageUsed = quota?.storage_used_bytes ?? 0

  return {
    storageUsed,
    storageLimit,
    storageAvailable: storageLimit > 0 ? Math.max(0, storageLimit - storageUsed) : -1,
    fileCount: quota?.file_count || 0,
    isUnlimited: storageLimit < 0,
    usagePercent: storageLimit > 0 ? Math.min(100, (storageUsed / storageLimit) * 100) : 0,
    alertThreshold: quota?.alert_threshold_percent || 80,
  }
}

/**
 * GET /api/workdrive/quota
 * Get user's storage quota information
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const quotaInfo = await getUserQuotaInfo(user.id)

    // Get admin settings for context
    const { data: maxSizeSetting } = await supabase
      .from('workdrive_admin_settings')
      .select('setting_value')
      .eq('setting_key', 'max_file_size_mb')
      .maybeSingle()

    const maxFileSizeMB = parseInt(maxSizeSetting?.setting_value || '15')

    // Determine alert level
    let alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded' = 'normal'
    if (quotaInfo.usagePercent >= 100) alertLevel = 'exceeded'
    else if (quotaInfo.usagePercent >= 90) alertLevel = 'critical'
    else if (quotaInfo.usagePercent >= quotaInfo.alertThreshold) alertLevel = 'warning'

    return NextResponse.json({
      used: quotaInfo.storageUsed,
      limit: quotaInfo.storageLimit,
      available: quotaInfo.storageAvailable,
      fileCount: quotaInfo.fileCount,
      isUnlimited: quotaInfo.isUnlimited,
      usagePercent: quotaInfo.usagePercent,
      alertLevel,
      alertThreshold: quotaInfo.alertThreshold,
      usedFormatted: formatFileSize(quotaInfo.storageUsed),
      limitFormatted: quotaInfo.isUnlimited ? 'Unlimited' : formatFileSize(quotaInfo.storageLimit),
      availableFormatted: quotaInfo.isUnlimited ? 'Unlimited' : formatFileSize(quotaInfo.storageAvailable),
      maxFileSizeMB,
      maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
    })
  } catch (error) {
    apiLogger.error('Get quota error', error)
    return NextResponse.json({ success: false, error: 'Failed to get quota' }, { status: 500 })
  }
}

/**
 * POST /api/workdrive/quota
 * Pre-check if file upload(s) would exceed quota
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      fileSize: z.string().optional(),


      fileSizes: z.array(z.unknown()).optional(),


      fileName: z.string().optional(),


      fileNames: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { fileSize, fileSizes, fileName, fileNames } = body

    // Support both single file and multiple files
    const totalSize = fileSizes
      ? (fileSizes as number[]).reduce((sum, size) => sum + size, 0)
      : (fileSize as number) || 0

    const quotaInfo = await getUserQuotaInfo(user.id)

    // Get admin settings
    const { data: maxSizeSetting } = await supabase
      .from('workdrive_admin_settings')
      .select('setting_value')
      .eq('setting_key', 'max_file_size_mb')
      .maybeSingle()

    const { data: blockedExtSetting } = await supabase
      .from('workdrive_admin_settings')
      .select('setting_value')
      .eq('setting_key', 'blocked_file_extensions')
      .maybeSingle()

    const maxFileSizeMB = parseInt(maxSizeSetting?.setting_value || '15')
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024

    let blockedExtensions: string[] = []
    try {
      blockedExtensions = JSON.parse(blockedExtSetting?.setting_value || '[]')
    } catch {}

    const errors: string[] = []
    const warnings: string[] = []

    // Check quota
    if (!quotaInfo.isUnlimited && totalSize > quotaInfo.storageAvailable) {
      errors.push(`Insufficient storage space. Need ${formatFileSize(totalSize)} but only ${formatFileSize(quotaInfo.storageAvailable)} available.`)
    }

    // Check individual file sizes
    if (fileSizes) {
      const names = fileNames || []
      fileSizes.forEach((size: number, idx: number) => {
        if (size > maxFileSizeBytes) {
          errors.push(`${names[idx] || `File ${idx + 1}`} exceeds maximum size of ${maxFileSizeMB}MB`)
        }
      })
    } else if (fileSize && fileSize > maxFileSizeBytes) {
      errors.push(`File exceeds maximum size of ${maxFileSizeMB}MB`)
    }

    // Check file extensions
    const allNames = fileNames || (fileName ? [fileName] : [])
    allNames.forEach((name: string) => {
      const ext = name.split('.').pop()?.toLowerCase()
      if (ext && blockedExtensions.includes(ext)) {
        errors.push(`File type .${ext} is not allowed`)
      }
    })

    // Calculate post-upload usage
    const projectedUsage = quotaInfo.storageUsed + totalSize
    const projectedPercent = quotaInfo.storageLimit > 0
      ? Math.min(100, (projectedUsage / quotaInfo.storageLimit) * 100)
      : 0

    // Warnings
    if (projectedPercent >= 90 && projectedPercent < 100) {
      warnings.push(`Upload will bring storage to ${projectedPercent.toFixed(1)}% capacity`)
    }
    if (projectedPercent >= quotaInfo.alertThreshold && projectedPercent < 90) {
      warnings.push(`Upload will exceed ${quotaInfo.alertThreshold}% alert threshold`)
    }

    return NextResponse.json({
      canUpload: errors.length === 0,
      errors,
      warnings,
      totalSize,
      totalSizeFormatted: formatFileSize(totalSize),
      currentUsage: {
        used: quotaInfo.storageUsed,
        limit: quotaInfo.storageLimit,
        available: quotaInfo.storageAvailable,
        percent: quotaInfo.usagePercent,
      },
      projectedUsage: {
        used: projectedUsage,
        percent: projectedPercent,
        remaining: Math.max(0, quotaInfo.storageLimit - projectedUsage),
      },
    })
  } catch (error) {
    apiLogger.error('Check quota error', error)
    return NextResponse.json({ success: false, error: 'Failed to check quota' }, { status: 500 })
  }
}
