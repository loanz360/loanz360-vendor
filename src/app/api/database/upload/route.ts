import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseFile, generateDedupeKey, validateContact } from '@/lib/parsers/fileParser'
import { v4 as uuidv4 } from 'uuid'
import { validateUploadedFile, ALLOWED_UPLOAD_TYPES } from '@/lib/security/file-validation'
import { logger } from '@/lib/utils/logger'
import { handleApiError, createSuccessResponse, throwAppError } from '@/lib/errors/error-handler'
import { ErrorCode } from '@/lib/errors/error-codes'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
  if (rateLimitResponse) return rateLimitResponse

  const requestId = request.headers.get('x-request-id') || undefined

  try {
    const supabase = await createClient()

    // SECURITY FIX CRITICAL-02: Check authentication and authorization BEFORE processing file
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is SUPER_ADMIN
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized file upload attempt', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/database/upload'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      throwAppError(ErrorCode.VAL_MISSING_FIELD, { field: 'file' })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throwAppError(ErrorCode.FILE_TOO_LARGE)
    }

    // Allowed types for data import
    const allowedTypes = [...ALLOWED_UPLOAD_TYPES.DATA_IMPORT, 'application/pdf']

    // Convert file to buffer for validation
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // SECURITY: Validate file content (magic bytes + malware scan)
    const validation = await validateUploadedFile(buffer, file.name, file.type, allowedTypes)

    if (!validation.valid) {
      logger.warn('File upload rejected', {
        filename: file.name,
        reason: validation.reason,
        claimedType: file.type,
        requestId,
      })

      // Determine appropriate error code
      const errorCode = validation.reason?.includes('malicious')
        ? ErrorCode.FILE_MALICIOUS
        : validation.reason?.includes('type')
        ? ErrorCode.FILE_INVALID_TYPE
        : ErrorCode.FILE_INVALID_CONTENT

      throwAppError(errorCode, { reason: validation.reason })
    }

    // Upload file to Supabase Storage
    const fileId = uuidv4()
    const fileExt = file.name.split('.').pop()
    const storagePath = `uploads/${fileId}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('database-files')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      logger.error('Storage upload error', { error: uploadError, requestId })
      throwAppError(ErrorCode.FILE_UPLOAD_FAILED)
    }

    // Parse file to extract contacts
    let parsedContacts
    try {
      parsedContacts = await parseFile(buffer, file.name)
    } catch (parseError) {
      logger.error('File parsing error', { error: parseError, requestId })
      throwAppError(ErrorCode.FILE_INVALID_CONTENT, { parseError: 'Unable to parse file content' })
    }

    // Filter and validate contacts
    const validContacts = parsedContacts.filter(contact => validateContact(contact))

    if (validContacts.length === 0) {
      throwAppError(ErrorCode.VAL_INVALID_INPUT, { reason: 'No valid contacts found in file' })
    }

    // Insert file metadata
    const { data: fileRecord, error: fileInsertError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        status: 'COMPLETED',
        uploaded_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (fileInsertError) {
      logger.error('File record insert error', { error: fileInsertError, requestId })
      throwAppError(ErrorCode.DB_QUERY_ERROR)
    }

    // Prepare contacts for insertion
    const contactsToInsert = validContacts.map(contact => ({
      id: uuidv4(),
      full_name: contact.full_name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      location: contact.location,
      source_file_id: fileId,
      dedupe_key: generateDedupeKey(contact),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    // Insert contacts (with deduplication)
    const { data: insertedContacts, error: contactsError } = await supabase
      .from('contacts')
      .upsert(contactsToInsert, {
        onConflict: 'dedupe_key',
        ignoreDuplicates: true
      })
      .select()

    if (contactsError) {
      logger.error('Contacts insert error', { error: contactsError, requestId })
      throwAppError(ErrorCode.DB_QUERY_ERROR)
    }

    const recordsCount = insertedContacts?.length || validContacts.length

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'FILE_UPLOAD',
      entity_type: 'FILE',
      entity_id: fileId,
      details: {
        file_name: file.name,
        records_count: recordsCount
      }
    })

    return createSuccessResponse(
      {
        fileId,
        fileName: file.name,
        recordsCount,
      },
      {
        message: `Successfully uploaded and processed ${recordsCount} contacts`,
        requestId,
      }
    )
  } catch (error) {
    return handleApiError(error, {
      endpoint: '/api/database/upload',
      method: 'POST',
      requestId,
    })
  }
}
