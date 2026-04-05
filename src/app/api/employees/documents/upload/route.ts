export const dynamic = 'force-dynamic'

/**
 * API Route: Upload Employee Documents
 *
 * Handles file uploads for employee-related documents:
 * - Leave request attachments
 * - Regularization request attachments
 * - Other employee documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadFile, validateFile, FILE_TYPE_CONFIGS } from '@/lib/utils/storage-helper'
import { securityLogger } from '@/lib/security-logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
    if (rateLimitResponse) return rateLimitResponse
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      securityLogger.logSecurityEvent({
        level: 'warn',
        event: 'UNAUTHORIZED_FILE_UPLOAD_ATTEMPT',
        details: { error: authError?.message || 'No user session' }
      } as never)

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentType = formData.get('documentType') as string || 'general'
    const relatedId = formData.get('relatedId') as string || null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateFile(
      file,
      FILE_TYPE_CONFIGS.all.types,
      FILE_TYPE_CONFIGS.all.maxSizeMB
    )

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    // Files are organized by user ID: {userId}/{timestamp}_{filename}
    const uploadResult = await uploadFile(file, {
      bucket: 'employee-documents',
      folder: user.id, // Store in user's folder
      fileName: file.name
    })

    if (!uploadResult.success) {
      securityLogger.logSecurityEvent({
        level: 'error',
        event: 'FILE_UPLOAD_FAILED',
        details: {
          userId: user.id,
          error: uploadResult.error,
          fileName: file.name,
          fileSize: file.size
        }
      } as never)

      return NextResponse.json(
        { error: uploadResult.error || 'Upload failed' },
        { status: 500 }
      )
    }

    // Log successful upload
    securityLogger.logSecurityEvent({
      level: 'info',
      event: 'FILE_UPLOADED',
      details: {
        userId: user.id,
        fileName: file.name,
        fileSize: file.size,
        filePath: uploadResult.path,
        documentType,
        relatedId
      }
    } as never)

    // Return success response
    return NextResponse.json({
      success: true,
      file: {
        path: uploadResult.path,
        url: uploadResult.url,
        name: file.name,
        size: file.size,
        type: file.type
      }
    })

  } catch (error) {
    apiLogger.error('[Upload API] Unexpected error', error)
    logApiError(error as Error, request, { action: 'post' })

    securityLogger.logSecurityEvent({
      level: 'error',
      event: 'FILE_UPLOAD_ERROR',
      details: {
        error: 'Internal server error'
      }
    } as never)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
