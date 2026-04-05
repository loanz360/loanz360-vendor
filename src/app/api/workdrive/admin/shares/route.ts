export const dynamic = 'force-dynamic'

/**
 * WorkDrive Admin Shares API
 * GET - Get all active shares
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAllActiveShares, isAdmin } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/workdrive/admin/shares
 * Get all active shares
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

    // Check if user is admin
    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const shareType = searchParams.get('share_type') as 'link' | 'email' | 'internal' | undefined
    const userId = searchParams.get('user_id')

    const result = await getAllActiveShares({
      page,
      limit,
      shareType,
      userId: userId || undefined,
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      shares: result.shares,
      total: result.total,
      page,
      limit,
    })
  } catch (error) {
    apiLogger.error('Get all shares error', error)
    return NextResponse.json(
      { error: 'Failed to get shares' },
      { status: 500 }
    )
  }
}
