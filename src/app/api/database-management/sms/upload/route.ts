
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth/check-auth'
import { unifiedUploadService } from '@/services/database/unifiedUploadService'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/database-management/sms/upload
 * Upload SMS contacts from file
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
    if (rateLimitResponse) return rateLimitResponse
// Check authentication
    const authResult = await checkAuth(['SUPER_ADMIN'])
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      )
    }

    // Get options from form data
    const folderId = formData.get('folder_id') as string | null
    const deduplicationStrategy = (formData.get('deduplication_strategy') as unknown) || 'skip'

    // Upload using unified service
    const result = await unifiedUploadService.uploadFile(file, {
      databaseType: 'sms',
      destinationFolder: folderId || undefined,
      deduplicationStrategy,
      source: 'file_upload',
      sourceReferenceId: authResult.user?.id,
      sourceReferenceType: 'super_admin'
    })

    return NextResponse.json(result, {
      status: result.success ? 200 : 500
    })
  } catch (error: unknown) {
    apiLogger.error('Error uploading SMS contacts', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
