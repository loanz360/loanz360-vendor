export const dynamic = 'force-dynamic'

/**
 * WorkDrive Recent Files API
 * GET - List recent files
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRecentFiles } from '@/lib/workdrive'
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

  return { storageUsed, storageLimit }
}

/**
 * GET /api/workdrive/recent
 * List recent files
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const result = await getRecentFiles(user.id, limit)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Get storage info
    const quotaInfo = await getUserQuotaInfo(user.id)

    return NextResponse.json({
      success: true,
      files: result.files,
      storageUsed: quotaInfo.storageUsed,
      storageLimit: quotaInfo.storageLimit,
    })
  } catch (error) {
    apiLogger.error('Get recent files error', error)
    return NextResponse.json(
      { error: 'Failed to get recent files' },
      { status: 500 }
    )
  }
}
