
/**
 * WorkDrive Trash Restore API
 * POST - Restore file from trash
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { restoreFile } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ fileId: string }>
}

/**
 * POST /api/workdrive/trash/[fileId]/restore
 * Restore file from trash
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params

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

    const result = await restoreFile(user.id, fileId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to restore file' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Restore file error', error)
    return NextResponse.json(
      { error: 'Failed to restore file' },
      { status: 500 }
    )
  }
}
