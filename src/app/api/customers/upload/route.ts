
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadToS3, generateS3Key, getS3BucketName, getS3Region } from '@/lib/aws/s3-client'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/upload
 *
 * General file upload endpoint for customer documents.
 * Uses AWS S3 for storage.
 * Supports:
 * - Profile photos
 * - PAN card documents
 * - Aadhaar card documents
 * - Address proof documents
 */
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
    const uploadType = formData.get('type') as string || 'document'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Determine allowed types based on upload type
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const pdfType = ['application/pdf']
    let allowedTypes: string[]
    let documentType: string

    switch (uploadType) {
      case 'profile_photo':
        allowedTypes = imageTypes
        documentType = 'profile'
        break
      case 'pan_document':
        allowedTypes = [...imageTypes, ...pdfType]
        documentType = 'pan'
        break
      case 'aadhaar_document':
        allowedTypes = [...imageTypes, ...pdfType]
        documentType = 'aadhaar'
        break
      case 'address_proof_current':
        allowedTypes = [...imageTypes, ...pdfType]
        documentType = 'address-current'
        break
      case 'address_proof_permanent':
        allowedTypes = [...imageTypes, ...pdfType]
        documentType = 'address-permanent'
        break
      default:
        allowedTypes = [...imageTypes, ...pdfType]
        documentType = 'document'
    }

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      const typeDesc = uploadType === 'profile_photo'
        ? 'Only JPG, PNG, and WebP are allowed'
        : 'Only JPG, PNG, WebP, and PDF are allowed'
      return NextResponse.json(
        { success: false, error: `Invalid file type. ${typeDesc}` },
        { status: 400 }
      )
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Generate S3 key
    const s3Key = generateS3Key({
      type: 'customer_document',
      customerId: user.id,
      documentType,
      fileName: file.name,
    })

    // Upload to AWS S3
    const uploadResult = await uploadToS3({
      key: s3Key,
      body: buffer,
      contentType: file.type,
      metadata: {
        userId: user.id,
        uploadType,
        originalName: file.name,
      },
    })

    if (!uploadResult.success) {
      apiLogger.error('Error uploading file to S3', uploadResult.error, 'userId:', user.id, 'type:', uploadType)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.s3Url,
      type: uploadType,
      fileName: s3Key,
      storage: 's3',
      bucket: getS3BucketName(),
      region: getS3Region(),
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/upload', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
