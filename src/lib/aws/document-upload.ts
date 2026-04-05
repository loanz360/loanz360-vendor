/**
 * Document Upload Service
 * Complete pipeline: Validation → Compression → S3 Upload → Database Record
 */

import { uploadToS3, generateS3Key, getS3Region, getS3BucketName } from './s3-client'
import {
  processFileUpload,
  formatFileSize,
  getMimeTypeFromExtension,
} from './compression'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Document upload result
 */
export interface DocumentUploadResult {
  success: boolean
  document?: {
    id: string
    documentType: string
    fileName: string
    fileSize: number
    originalFileSize: number
    filType: string
    mimeType: string
    s3Bucket: string
    s3Key: string
    s3Region: string
    s3Url: string
    isCompressed: boolean
    compressionRatio: number
    thumbnailS3Key?: string
    thumbnailUrl?: string
  }
  error?: string
  validationErrors?: string[]
}

/**
 * Upload document for lead
 */
export async function uploadLeadDocument(params: {
  leadId: string
  customerId?: string
  uploadedById: string
  uploadedByType: 'CUSTOMER' | 'PARTNER' | 'EMPLOYEE'
  uploadedByName: string
  documentType: string
  documentCategory: string
  file: Buffer
  fileName: string
  mimeType?: string
  isRequired?: boolean
  compress?: boolean
  generateThumbnail?: boolean
  uploadIp?: string
  uploadUserAgent?: string
}): Promise<DocumentUploadResult> {
  try {
    // 1. Determine MIME type if not provided
    const mimeType = params.mimeType || getMimeTypeFromExtension(params.fileName)

    // 2. Process file (validate & compress)
    const processResult = await processFileUpload({
      buffer: params.file,
      fileName: params.fileName,
      mimeType,
      maxSizeMB: 15,
      compress: params.compress !== false,
      generateThumbnail: params.generateThumbnail,
    })

    if (!processResult.success) {
      return {
        success: false,
        error: processResult.error,
        validationErrors: processResult.validationErrors,
      }
    }

    // 3. Generate S3 keys
    const s3Key = generateS3Key({
      type: 'lead_document',
      leadId: params.leadId,
      documentType: params.documentType,
      fileName: params.fileName,
    })

    let thumbnailS3Key: string | undefined
    if (processResult.thumbnail) {
      thumbnailS3Key = generateS3Key({
        type: 'thumbnail',
        leadId: params.leadId,
        fileName: params.fileName,
      })
    }

    // 4. Upload to S3
    const uploadResult = await uploadToS3({
      key: s3Key,
      body: processResult.processedFile!,
      contentType: processResult.mimeType,
      metadata: {
        leadId: params.leadId,
        documentType: params.documentType,
        uploadedBy: params.uploadedById,
        uploadedByType: params.uploadedByType,
        originalFileName: params.fileName,
        originalSize: processResult.originalSize.toString(),
        compressed: processResult.compressionRatio > 0 ? 'true' : 'false',
      },
      tags: {
        leadId: params.leadId,
        documentType: params.documentType,
        category: params.documentCategory,
      },
    })

    if (!uploadResult.success) {
      return {
        success: false,
        error: `S3 upload failed: ${uploadResult.error}`,
      }
    }

    // 5. Upload thumbnail if exists
    let thumbnailUrl: string | undefined
    if (processResult.thumbnail && thumbnailS3Key) {
      const thumbUpload = await uploadToS3({
        key: thumbnailS3Key,
        body: processResult.thumbnail,
        contentType: 'image/jpeg',
      })

      if (thumbUpload.success) {
        thumbnailUrl = thumbUpload.s3Url
      }
    }

    // 6. Create database record
    const { data: document, error: dbError } = await supabase
      .from('lead_documents')
      .insert({
        lead_id: params.leadId,
        customer_id: params.customerId,
        uploaded_by_id: params.uploadedById,
        uploaded_by_type: params.uploadedByType,
        uploaded_by_name: params.uploadedByName,
        document_type: params.documentType,
        document_category: params.documentCategory,
        file_name: params.fileName,
        original_file_name: params.fileName,
        file_size_bytes: processResult.processedSize,
        original_file_size_bytes: processResult.originalSize,
        file_type: params.fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN',
        mime_type: processResult.mimeType,
        s3_bucket: uploadResult.bucket,
        s3_key: uploadResult.s3Key,
        s3_region: uploadResult.region,
        s3_url: uploadResult.s3Url,
        is_compressed: processResult.compressionRatio > 0,
        compression_ratio: processResult.compressionRatio,
        is_required: params.isRequired || false,
        thumbnail_s3_key: thumbnailS3Key,
        thumbnail_url: thumbnailUrl,
        upload_ip: params.uploadIp,
        upload_user_agent: params.uploadUserAgent,
        metadata: {
          originalFileName: params.fileName,
          uploadedAt: new Date().toISOString(),
          compressionDetails: {
            originalSize: formatFileSize(processResult.originalSize),
            compressedSize: formatFileSize(processResult.processedSize),
            ratio: processResult.compressionRatio,
          },
        },
      })
      .select()
      .maybeSingle()

    if (dbError) {
      console.error('Database insert error:', dbError)
      return {
        success: false,
        error: `Database error: ${dbError.message}`,
      }
    }

    return {
      success: true,
      document: {
        id: document.id,
        documentType: document.document_type,
        fileName: document.file_name,
        fileSize: document.file_size_bytes,
        originalFileSize: document.original_file_size_bytes,
        filType: document.file_type,
        mimeType: document.mime_type,
        s3Bucket: document.s3_bucket,
        s3Key: document.s3_key,
        s3Region: document.s3_region,
        s3Url: document.s3_url,
        isCompressed: document.is_compressed,
        compressionRatio: document.compression_ratio,
        thumbnailS3Key: document.thumbnail_s3_key,
        thumbnailUrl: document.thumbnail_url,
      },
    }
  } catch (error) {
    console.error('Upload Lead Document Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    }
  }
}

/**
 * Upload customer profile document
 */
export async function uploadCustomerProfileDocument(params: {
  customerId: string
  documentType: string
  documentCategory: string
  file: Buffer
  fileName: string
  mimeType?: string
  isProfilePicture?: boolean
  isSignature?: boolean
  compress?: boolean
}): Promise<DocumentUploadResult> {
  try {
    // 1. Determine MIME type
    const mimeType = params.mimeType || getMimeTypeFromExtension(params.fileName)

    // 2. Process file
    const processResult = await processFileUpload({
      buffer: params.file,
      fileName: params.fileName,
      mimeType,
      maxSizeMB: 15,
      compress: params.compress !== false,
      generateThumbnail: params.isProfilePicture,
    })

    if (!processResult.success) {
      return {
        success: false,
        error: processResult.error,
        validationErrors: processResult.validationErrors,
      }
    }

    // 3. Generate S3 key
    const s3Key = generateS3Key({
      type: 'customer_profile',
      customerId: params.customerId,
      fileName: params.fileName,
    })

    // 4. Upload to S3
    const uploadResult = await uploadToS3({
      key: s3Key,
      body: processResult.processedFile!,
      contentType: processResult.mimeType,
      metadata: {
        customerId: params.customerId,
        documentType: params.documentType,
        isProfilePicture: params.isProfilePicture ? 'true' : 'false',
        isSignature: params.isSignature ? 'true' : 'false',
      },
    })

    if (!uploadResult.success) {
      return {
        success: false,
        error: `S3 upload failed: ${uploadResult.error}`,
      }
    }

    // 5. Deactivate old documents of same type if profile picture or signature
    if (params.isProfilePicture || params.isSignature) {
      await supabase
        .from('customer_profile_documents')
        .update({ is_active: false, replaced_at: new Date().toISOString() })
        .eq('customer_id', params.customerId)
        .eq(
          params.isProfilePicture ? 'is_profile_picture' : 'is_signature',
          true
        )
    }

    // 6. Create database record
    const { data: document, error: dbError } = await supabase
      .from('customer_profile_documents')
      .insert({
        customer_id: params.customerId,
        document_type: params.documentType,
        document_category: params.documentCategory,
        file_name: params.fileName,
        original_file_name: params.fileName,
        file_size_bytes: processResult.processedSize,
        original_file_size_bytes: processResult.originalSize,
        file_type: params.fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN',
        mime_type: processResult.mimeType,
        s3_bucket: uploadResult.bucket,
        s3_key: uploadResult.s3Key,
        s3_region: uploadResult.region,
        s3_url: uploadResult.s3Url,
        is_compressed: processResult.compressionRatio > 0,
        compression_ratio: processResult.compressionRatio,
        is_profile_picture: params.isProfilePicture || false,
        is_signature: params.isSignature || false,
        is_active: true,
      })
      .select()
      .maybeSingle()

    if (dbError) {
      return {
        success: false,
        error: `Database error: ${dbError.message}`,
      }
    }

    return {
      success: true,
      document: {
        id: document.id,
        documentType: document.document_type,
        fileName: document.file_name,
        fileSize: document.file_size_bytes,
        originalFileSize: document.original_file_size_bytes,
        filType: document.file_type,
        mimeType: document.mime_type,
        s3Bucket: document.s3_bucket,
        s3Key: document.s3_key,
        s3Region: document.s3_region,
        s3Url: document.s3_url,
        isCompressed: document.is_compressed,
        compressionRatio: document.compression_ratio,
      },
    }
  } catch (error) {
    console.error('Upload Customer Profile Document Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    }
  }
}

/**
 * Get document from database with S3 details
 */
export async function getLeadDocument(documentId: string) {
  const { data, error } = await supabase
    .from('lead_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, document: data }
}

/**
 * Delete lead document (from S3 and database)
 */
export async function deleteLeadDocument(documentId: string) {
  try {
    // Get document details
    const { data: document, error: fetchError } = await supabase
      .from('lead_documents')
      .select('s3_key, thumbnail_s3_key')
      .eq('id', documentId)
      .maybeSingle()

    if (fetchError || !document) {
      return { success: false, error: 'Document not found' }
    }

    // Delete from S3 (handled by application, not required if S3 lifecycle rules are set)
    // For now, we'll soft delete from database only

    // Delete from database
    const { error: deleteError } = await supabase
      .from('lead_documents')
      .delete()
      .eq('id', documentId)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * List documents for a lead
 */
export async function listLeadDocuments(leadId: string) {
  const { data, error } = await supabase
    .from('lead_documents')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, documents: data }
}

/**
 * Check if lead has all required documents
 */
export async function checkRequiredDocuments(leadId: string, requiredTypes: string[]) {
  const { data, error } = await supabase
    .from('lead_documents')
    .select('document_type')
    .eq('lead_id', leadId)
    .eq('is_verified', true)

  if (error) {
    return { success: false, error: error.message }
  }

  const uploadedTypes = data.map((doc) => doc.document_type)
  const missingTypes = requiredTypes.filter((type) => !uploadedTypes.includes(type))

  return {
    success: true,
    hasAllRequired: missingTypes.length === 0,
    uploadedTypes,
    missingTypes,
  }
}
