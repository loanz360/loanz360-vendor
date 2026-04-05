export const dynamic = 'force-dynamic'

/**
 * WorkDrive Share Operations API
 * GET - Get share details
 * DELETE - Revoke share
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revokeShare } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ shareId: string }>
}

/**
 * GET /api/workdrive/shares/[shareId]
 * Get share details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { shareId } = await params

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

    const { data: share, error } = await supabase
      .from('workdrive_shares')
      .select('*')
      .eq('id', shareId)
      .maybeSingle()

    if (error || !share) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      share,
    })
  } catch (error) {
    apiLogger.error('Get share error', error)
    return NextResponse.json(
      { error: 'Failed to get share' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workdrive/shares/[shareId]
 * Revoke share
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { shareId } = await params

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

    const result = await revokeShare(user.id, shareId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to revoke share' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Revoke share error', error)
    return NextResponse.json(
      { error: 'Failed to revoke share' },
      { status: 500 }
    )
  }
}
