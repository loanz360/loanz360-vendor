export const dynamic = 'force-dynamic'

/**
 * WorkDrive Favorites API
 * GET - List favorites
 * POST - Add to favorites
 * DELETE - Remove from favorites
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getFavorites, addToFavorites, removeFromFavorites, formatFileSize } from '@/lib/workdrive'
import { ResourceType, ROLE_QUOTA_DEFAULTS } from '@/types/workdrive'
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
 * GET /api/workdrive/favorites
 * List favorites
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

    const result = await getFavorites(user.id)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Get storage info from quota
    const quotaInfo = await getUserQuotaInfo(user.id)

    return NextResponse.json({
      success: true,
      favorites: result.favorites,
      files: result.favorites, // Alias for frontend compatibility
      storageUsed: quotaInfo.storageUsed,
      storageLimit: quotaInfo.storageLimit,
    })
  } catch (error) {
    apiLogger.error('Get favorites error', error)
    return NextResponse.json(
      { error: 'Failed to get favorites' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workdrive/favorites
 * Add to favorites
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    // Support both old format (file_id) and new format (resource_type/resource_id)
    let resource_type = body.resource_type as ResourceType
    let resource_id = body.resource_id as string

    // Backwards compatibility: if file_id is provided, map it
    if (!resource_type && body.file_id) {
      resource_type = 'file'
      resource_id = body.file_id
    }

    if (!resource_type || !resource_id) {
      return NextResponse.json(
        { error: 'resource_type and resource_id are required' },
        { status: 400 }
      )
    }

    const result = await addToFavorites(user.id, resource_type, resource_id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to add to favorites' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Add favorite error', error)
    return NextResponse.json(
      { error: 'Failed to add to favorites' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workdrive/favorites
 * Remove from favorites
 */
export async function DELETE(request: NextRequest) {
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
    let resourceType = searchParams.get('resource_type') as ResourceType
    let resourceId = searchParams.get('resource_id')

    // Fallback: try reading from request body for backwards compatibility
    if (!resourceType || !resourceId) {
      try {
        const body = await request.json()
        if (!resourceType && body.resource_type) resourceType = body.resource_type as ResourceType
        if (!resourceId && body.resource_id) resourceId = body.resource_id
        // Backwards compat with file_id
        if (!resourceType && body.file_id) {
          resourceType = 'file' as ResourceType
          resourceId = body.file_id
        }
      } catch {
        // Body might not be JSON or might be empty - that's ok
      }
    }

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: 'resource_type and resource_id are required' },
        { status: 400 }
      )
    }

    const result = await removeFromFavorites(user.id, resourceType, resourceId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to remove from favorites' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Remove favorite error', error)
    return NextResponse.json(
      { error: 'Failed to remove from favorites' },
      { status: 500 }
    )
  }
}
