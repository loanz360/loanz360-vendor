
/**
 * WorkDrive File Operations API
 * GET - Get file details
 * PUT - Update file (rename)
 * DELETE - Delete file
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getFile,
  renameFile,
  deleteFile,
  trackFileAccess,
  logAudit,
} from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ fileId: string }>
}

/**
 * GET /api/workdrive/files/[fileId]
 * Get file details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const result = await getFile(fileId)

    if (!result.file) {
      return NextResponse.json(
        { error: result.error || 'File not found' },
        { status: 404 }
      )
    }

    // Track file access
    await trackFileAccess(user.id, fileId, 'view')

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'view',
      resourceType: 'file',
      resourceId: fileId,
      resourceName: result.file.name,
    })

    return NextResponse.json({
      success: true,
      file: result.file,
    })
  } catch (error) {
    apiLogger.error('Get file error', error)
    return NextResponse.json(
      { error: 'Failed to get file' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/workdrive/files/[fileId]
 * Update file (rename)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const result = await renameFile(user.id, fileId, name)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to rename file' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Update file error', error)
    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workdrive/files/[fileId]
 * Delete file
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Check if permanent delete is requested
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    const result = await deleteFile(user.id, fileId, permanent)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete file' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Delete file error', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}
