import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * WorkDrive Shares API
 * GET - List shares
 * POST - Create share
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createShare, checkPermission } from '@/lib/workdrive'
import { ShareType } from '@/types/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/workdrive/shares
 * List shares created by user
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('file_id')
    const folderId = searchParams.get('folder_id')

    let query = supabase
      .from('workdrive_shares')
      .select('*')
      .eq('shared_by', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (fileId) {
      query = query.eq('file_id', fileId)
    }
    if (folderId) {
      query = query.eq('folder_id', folderId)
    }

    const { data: shares, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      shares: shares || [],
    })
  } catch (error) {
    apiLogger.error('Get shares error', error)
    return NextResponse.json(
      { error: 'Failed to get shares' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workdrive/shares
 * Create a share
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    const bodySchema = z.object({


      file_id: z.string().uuid().optional(),


      folder_id: z.string().uuid().optional(),


      share_type: z.string().optional(),


      password: z.string().optional(),


      expires_in_days: z.string().optional(),


      max_downloads: z.string().optional(),


      max_views: z.string().optional(),


      allow_download: z.string().optional(),


      watermark_enabled: z.string().optional(),


      notify_on_access: z.string().optional(),


      shared_with_emails: z.string().email().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      file_id,
      folder_id,
      share_type,
      password,
      expires_in_days,
      max_downloads,
      max_views,
      allow_download,
      watermark_enabled,
      notify_on_access,
      shared_with_emails,
    } = body

    if (!file_id && !folder_id) {
      return NextResponse.json(
        { error: 'file_id or folder_id is required' },
        { status: 400 }
      )
    }

    // Check permission
    const resourceType = file_id ? 'file' : 'folder'
    const resourceId = file_id || folder_id
    const permission = await checkPermission({
      userId: user.id,
      resourceType,
      resourceId,
    })

    if (!permission.can_share) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    const result = await createShare(user.id, {
      file_id,
      folder_id,
      share_type: share_type as ShareType || 'link',
      password,
      expires_in_days,
      max_downloads,
      max_views,
      allow_download,
      watermark_enabled,
      notify_on_access,
      shared_with_emails,
    })

    if (!result.share) {
      return NextResponse.json(
        { error: result.error || 'Failed to create share' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      share: result.share,
    })
  } catch (error) {
    apiLogger.error('Create share error', error)
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    )
  }
}
