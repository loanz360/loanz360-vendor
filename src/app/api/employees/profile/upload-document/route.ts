export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const DOCUMENT_TYPES = [
  'present_address_proof',
  'permanent_address_proof',
  'pan_card',
  'aadhaar_card',
  'cancelled_cheque'
] as const

type DocumentType = typeof DOCUMENT_TYPES[number]

const DOCUMENT_TYPE_MAP: Record<DocumentType, string> = {
  present_address_proof: 'present_address_proof_url',
  permanent_address_proof: 'permanent_address_proof_url',
  pan_card: 'pan_card_copy_url',
  aadhaar_card: 'aadhaar_card_copy_url',
  cancelled_cheque: 'cancelled_cheque_url'
}

/**
 * Verify employee authentication
 */
async function verifyEmployee(request: NextRequest): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return { authorized: false, error: 'Unauthorized - No authentication token' }
  }

  const sessionData = verifySessionToken(authToken)
  if (!sessionData) {
    return { authorized: false, error: 'Unauthorized - Invalid or expired token' }
  }

  const [tokenBlacklisted, sessionRevoked] = await Promise.all([
    isTokenBlacklisted(authToken),
    isSessionRevoked(sessionData.sessionId)
  ])

  if (tokenBlacklisted || sessionRevoked) {
    return { authorized: false, error: 'Unauthorized - Session invalidated' }
  }

  // Allow both EMPLOYEE and HR roles to access employee self-service features
  const roleUpper = sessionData.role?.toUpperCase()
  if (roleUpper !== 'EMPLOYEE' && roleUpper !== 'HR') {
    return { authorized: false, error: 'Forbidden - Employee access required' }
  }

  return { authorized: true, userId: sessionData.userId }
}

/**
 * POST /api/employees/profile/upload-document
 * Upload a document (address proof, PAN, Aadhaar, cheque) to Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyEmployee(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentType = formData.get('documentType') as string | null

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!documentType || !DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      return NextResponse.json(
        { success: false, error: `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    // Validate file MIME type on server side
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPG, PNG, WebP, PDF' },
        { status: 400 }
      )
    }

    // Additional server-side MIME validation: check magic bytes for common types
    const arrayBufferForCheck = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBufferForCheck)
    const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 // %PDF
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    const isWebP = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50

    if (!isPDF && !isJPEG && !isPNG && !isWebP) {
      return NextResponse.json(
        { success: false, error: 'File content does not match an allowed type (JPG, PNG, WebP, PDF)' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Generate unique filename with path traversal protection
    const rawExt = file.name.split('.').pop() || ''
    // Sanitize extension: only allow alphanumeric characters
    const fileExt = rawExt.replace(/[^a-zA-Z0-9]/g, '')
    const timestamp = Date.now()
    // Sanitize userId to prevent path traversal (strip ../ and special chars)
    const safeUserId = (auth.userId || '').replace(/[^a-zA-Z0-9_-]/g, '')
    const safeDocType = (documentType as string).replace(/[^a-zA-Z0-9_-]/g, '')
    const fileName = `${safeUserId}/${safeDocType}-${timestamp}.${fileExt}`

    // Convert to Buffer (reuse the already-read arrayBuffer from MIME check)
    const buffer = Buffer.from(arrayBufferForCheck)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      logger.error('Error uploading document to storage', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload document' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(fileName)

    const documentUrl = urlData.publicUrl

    // Update profiles table with document URL
    const columnName = DOCUMENT_TYPE_MAP[documentType as DocumentType]
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        [columnName]: documentUrl,
        last_updated_by: auth.userId,
        last_updated_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', auth.userId)

    if (updateError) {
      // Rollback: Delete uploaded file
      await supabase.storage
        .from('employee-documents')
        .remove([fileName])

      logger.error('Error updating profile with document URL', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to save document reference' },
        { status: 500 }
      )
    }

    logger.info('Document uploaded successfully', {
      userId: auth.userId,
      documentType,
      fileName
    })

    return NextResponse.json({
      success: true,
      url: documentUrl,
      documentType,
      fileName: file.name
    })
  } catch (error) {
    logger.error('Error in POST /api/employees/profile/upload-document', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/profile/upload-document
 * Delete a document from Supabase Storage
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyEmployee(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const documentType = searchParams.get('documentType')

    if (!documentType || !DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      return NextResponse.json(
        { success: false, error: `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Get current document URL from database
    const columnName = DOCUMENT_TYPE_MAP[documentType as DocumentType]
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select(columnName)
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (fetchError) {
      logger.error('Error fetching profile', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    const documentUrl = profile?.[columnName]
    if (!documentUrl) {
      return NextResponse.json(
        { success: false, error: 'No document found to delete' },
        { status: 404 }
      )
    }

    // Extract file path from URL
    const urlParts = documentUrl.split('/employee-documents/')
    if (urlParts.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Invalid document URL format' },
        { status: 400 }
      )
    }
    const filePath = urlParts[1]

    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('employee-documents')
      .remove([filePath])

    if (deleteError) {
      logger.error('Error deleting document from storage', deleteError)
      // Continue anyway to clear the database reference
    }

    // Update database to remove URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        [columnName]: null,
        last_updated_by: auth.userId,
        last_updated_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', auth.userId)

    if (updateError) {
      logger.error('Error updating profile to remove document URL', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to remove document reference' },
        { status: 500 }
      )
    }

    logger.info('Document deleted successfully', {
      userId: auth.userId,
      documentType
    })

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    logger.error('Error in DELETE /api/employees/profile/upload-document', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
