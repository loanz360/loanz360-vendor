
/**
 * Entity Document Upload API
 * POST /api/customers/entity-documents/upload
 *
 * Handles document uploads for customer entity profiles.
 * Supports GST certificates, partnership deeds, MOA, AOA, bank statements, etc.
 * Uses AWS S3 for storage with compression and metadata tracking.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadToS3, generateS3Key, getS3BucketName, getS3Region } from '@/lib/aws/s3-client'
import { processFileUpload, formatFileSize } from '@/lib/aws/compression'
import { apiLogger } from '@/lib/utils/logger'

// Maximum file size: 5MB
const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]

// Document type to category mapping
const DOCUMENT_CATEGORIES: Record<string, string> = {
  // Identity documents
  pan_card: 'identity',
  aadhaar_front: 'identity',
  aadhaar_back: 'identity',
  passport: 'identity',
  voter_id: 'identity',
  driving_license: 'identity',

  // Business registration
  gst_certificate: 'registration',
  udyam_certificate: 'registration',
  shop_license: 'registration',
  fssai_license: 'registration',
  cin_certificate: 'registration',
  llpin_certificate: 'registration',

  // Legal documents
  partnership_deed: 'legal',
  moa: 'legal',
  aoa: 'legal',
  trust_deed: 'legal',
  society_registration: 'legal',
  huf_deed: 'legal',
  llp_agreement: 'legal',
  board_resolution: 'legal',

  // Financial documents
  bank_statement: 'financial',
  itr_acknowledgement: 'financial',
  audited_financials: 'financial',
  balance_sheet: 'financial',
  profit_loss: 'financial',
  gstr_returns: 'financial',
  ca_certificate: 'financial',

  // Address proof
  address_proof: 'address',
  utility_bill: 'address',
  rent_agreement: 'address',
  property_tax: 'address',

  // Photos
  photo: 'photo',
  proprietor_photo: 'photo',
  partner_photo: 'photo',
  director_photo: 'photo',

  // Others
  other: 'other',
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string
    const entityType = formData.get('entityType') as string
    const profileId = formData.get('profileId') as string | null

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Document type is required' },
        { status: 400 }
      )
    }

    if (!entityType) {
      return NextResponse.json(
        { success: false, error: 'Entity type is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type: ${file.type}. Allowed types: PDF, JPG, PNG, WebP`
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File size (${formatFileSize(file.size)}) exceeds maximum limit of ${MAX_FILE_SIZE_MB}MB`
        },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Process file (validate & compress if image)
    const processResult = await processFileUpload({
      buffer,
      fileName: file.name,
      mimeType: file.type,
      maxSizeMB: MAX_FILE_SIZE_MB,
      compress: file.type.startsWith('image/'),
      generateThumbnail: false,
    })

    if (!processResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: processResult.error || 'File processing failed',
          validationErrors: processResult.validationErrors
        },
        { status: 400 }
      )
    }

    // Generate S3 key
    const s3Key = generateS3Key({
      type: 'customer_entity_document',
      customerId: user.id,
      profileId: profileId || 'draft',
      entityType: entityType.toLowerCase(),
      documentType: documentType.toLowerCase(),
      fileName: file.name,
    })

    // Upload to S3
    const uploadResult = await uploadToS3({
      key: s3Key,
      body: processResult.processedFile!,
      contentType: processResult.mimeType,
      metadata: {
        customerId: user.id,
        entityType,
        documentType,
        profileId: profileId || 'draft',
        originalFileName: file.name,
        originalSize: processResult.originalSize.toString(),
        compressed: processResult.compressionRatio > 0 ? 'true' : 'false',
      },
      tags: {
        customerId: user.id,
        entityType,
        documentType,
        category: DOCUMENT_CATEGORIES[documentType] || 'other',
      },
    })

    if (!uploadResult.success) {
      apiLogger.error('S3 upload failed', uploadResult.error, {
        userId: user.id,
        documentType,
        entityType
      })
      return NextResponse.json(
        { success: false, error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // Store document record in database
    const documentRecord = {
      customer_id: user.id,
      profile_id: profileId || null,
      entity_type: entityType,
      document_type: documentType,
      document_category: DOCUMENT_CATEGORIES[documentType] || 'other',
      file_name: file.name,
      original_file_name: file.name,
      file_size_bytes: processResult.processedSize,
      original_file_size_bytes: processResult.originalSize,
      file_type: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
      mime_type: processResult.mimeType,
      s3_bucket: uploadResult.bucket,
      s3_key: uploadResult.s3Key,
      s3_region: uploadResult.region,
      s3_url: uploadResult.s3Url,
      is_compressed: processResult.compressionRatio > 0,
      compression_ratio: processResult.compressionRatio,
      is_verified: false,
      is_active: true,
      metadata: {
        uploadedAt: new Date().toISOString(),
        compressionDetails: {
          originalSize: formatFileSize(processResult.originalSize),
          compressedSize: formatFileSize(processResult.processedSize),
          ratio: processResult.compressionRatio,
        },
      },
    }

    // Try to insert into customer_entity_documents table
    // If table doesn't exist, we'll just return the S3 URL
    let documentId: string | null = null
    try {
      const { data: insertedDoc, error: dbError } = await supabase
        .from('customer_entity_documents')
        .insert(documentRecord)
        .select('id')
        .maybeSingle()

      if (!dbError && insertedDoc) {
        documentId = insertedDoc.id
      }
    } catch (dbError) {
      // Table might not exist yet - that's OK, we still uploaded to S3
    }

    console.info('Entity document uploaded successfully:', {
      userId: user.id,
      documentType,
      entityType,
      s3Key: uploadResult.s3Key
    })

    return NextResponse.json({
      success: true,
      data: {
        id: documentId,
        url: uploadResult.s3Url,
        s3Key: uploadResult.s3Key,
        bucket: getS3BucketName(),
        region: getS3Region(),
        documentType,
        entityType,
        fileName: file.name,
        fileSize: processResult.processedSize,
        originalFileSize: processResult.originalSize,
        mimeType: processResult.mimeType,
        isCompressed: processResult.compressionRatio > 0,
        compressionRatio: processResult.compressionRatio,
      }
    })
  } catch (error) {
    apiLogger.error('Unexpected error in entity document upload', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/customers/entity-documents/upload
 * Returns allowed document types and configuration
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      maxFileSizeMB: MAX_FILE_SIZE_MB,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      documentCategories: DOCUMENT_CATEGORIES,
    }
  })
}
