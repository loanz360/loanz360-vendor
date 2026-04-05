export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePresignedUrl, generateS3Key, getS3BucketName, getS3Region } from '@/lib/aws/s3-client'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/upload/presigned
 *
 * Generate a presigned URL for direct S3 upload of customer documents.
 * Supports: PAN, Aadhaar, address proofs, profile photos
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

    // Parse request body
    const body = await request.json()
    const { fileName, fileType, uploadType } = body

    if (!fileName || !fileType) {
      return NextResponse.json(
        { success: false, error: 'fileName and fileType are required' },
        { status: 400 }
      )
    }

    // Validate file type based on upload type
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
    if (!allowedTypes.includes(fileType)) {
      const typeDesc = uploadType === 'profile_photo'
        ? 'Only JPG, PNG, and WebP are allowed'
        : 'Only JPG, PNG, WebP, and PDF are allowed'
      return NextResponse.json(
        { success: false, error: `Invalid file type. ${typeDesc}` },
        { status: 400 }
      )
    }

    // Generate S3 key
    const s3Key = generateS3Key({
      type: 'customer_document',
      customerId: user.id,
      documentType,
      fileName,
    })

    // Generate presigned URL for PUT operation (upload)
    const presignedResult = await generatePresignedUrl({
      key: s3Key,
      operation: 'put',
      expiresIn: 300, // 5 minutes for upload
    })

    if (!presignedResult.success || !presignedResult.url) {
      apiLogger.error('Failed to generate presigned URL', presignedResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to generate upload URL' },
        { status: 500 }
      )
    }

    // Generate the final public URL (after upload completes)
    const bucket = getS3BucketName()
    const region = getS3Region()
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`

    return NextResponse.json({
      success: true,
      presignedUrl: presignedResult.url,
      publicUrl,
      s3Key,
      expiresAt: presignedResult.expiresAt,
      contentType: fileType,
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/upload/presigned', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
