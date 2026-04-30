
/**
 * WorkDrive Admin User Quota API
 * PUT - Update user quota
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { updateUserQuota, isAdmin } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ userId: string }>
}

/**
 * PUT /api/workdrive/admin/users/[userId]/quota
 * Update user storage quota
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params

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

    const body = await request.json()
    const { storage_limit_bytes, storage_limit_gb, reason } = body

    // Calculate bytes from GB if provided
    const limitBytes = storage_limit_bytes || (storage_limit_gb * 1024 * 1024 * 1024)

    if (!limitBytes || limitBytes < 0) {
      return NextResponse.json(
        { error: 'Valid storage limit is required' },
        { status: 400 }
      )
    }

    const result = await updateUserQuota({
      userId,
      newLimitBytes: limitBytes,
      updatedBy: user.id,
      reason,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update quota' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Update user quota error', error)
    return NextResponse.json(
      { error: 'Failed to update quota' },
      { status: 500 }
    )
  }
}
