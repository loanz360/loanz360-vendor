/**
 * AWS S3 Client Configuration
 * Enterprise-grade S3 integration for document storage
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// S3 Configuration
const S3_CONFIG = {
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
}

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'loanz360-documents'

// Initialize S3 Client
const s3Client = new S3Client(S3_CONFIG)

/**
 * S3 Client Singleton
 */
export function getS3Client(): S3Client {
  return s3Client
}

/**
 * Get S3 Bucket Name
 */
export function getS3BucketName(): string {
  return BUCKET_NAME
}

/**
 * Get S3 Region
 */
export function getS3Region(): string {
  return S3_CONFIG.region
}

/**
 * Upload file to S3
 */
export async function uploadToS3(params: {
  key: string
  body: Buffer | Uint8Array | string
  contentType: string
  metadata?: Record<string, string>
  tags?: Record<string, string>
}): Promise<{
  success: boolean
  s3Key: string
  s3Url: string
  bucket: string
  region: string
  error?: string
}> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: params.metadata,
      Tagging: params.tags
        ? Object.entries(params.tags)
            .map(([k, v]) => `${k}=${v}`)
            .join('&')
        : undefined,
      ServerSideEncryption: 'AES256', // Encrypt at rest
    })

    await s3Client.send(command)

    const s3Url = `https://${BUCKET_NAME}.s3.${S3_CONFIG.region}.amazonaws.com/${params.key}`

    return {
      success: true,
      s3Key: params.key,
      s3Url,
      bucket: BUCKET_NAME,
      region: S3_CONFIG.region,
    }
  } catch (error) {
    console.error('S3 Upload Error:', error)
    return {
      success: false,
      s3Key: params.key,
      s3Url: '',
      bucket: BUCKET_NAME,
      region: S3_CONFIG.region,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get file from S3
 */
export async function getFromS3(key: string): Promise<{
  success: boolean
  data?: Buffer
  contentType?: string
  metadata?: Record<string, string>
  error?: string
}> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(command)

    // Convert stream to buffer
    const stream = response.Body as any
    const chunks: Uint8Array[] = []

    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    const buffer = Buffer.concat(chunks)

    return {
      success: true,
      data: buffer,
      contentType: response.ContentType,
      metadata: response.Metadata,
    }
  } catch (error) {
    console.error('S3 Get Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(key: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)

    return { success: true }
  } catch (error) {
    console.error('S3 Delete Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if file exists in S3
 */
export async function fileExistsInS3(key: string): Promise<{
  exists: boolean
  size?: number
  lastModified?: Date
  error?: string
}> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(command)

    return {
      exists: true,
      size: response.ContentLength,
      lastModified: response.LastModified,
    }
  } catch (error: unknown) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return { exists: false }
    }

    console.error('S3 Head Error:', error)
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * List files in S3 with prefix
 */
export async function listS3Files(params: {
  prefix: string
  maxKeys?: number
  continuationToken?: string
}): Promise<{
  success: boolean
  files?: Array<{
    key: string
    size: number
    lastModified: Date
  }>
  isTruncated?: boolean
  nextContinuationToken?: string
  error?: string
}> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: params.prefix,
      MaxKeys: params.maxKeys || 1000,
      ContinuationToken: params.continuationToken,
    })

    const response = await s3Client.send(command)

    const files = (response.Contents || []).map((item) => ({
      key: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
    }))

    return {
      success: true,
      files,
      isTruncated: response.IsTruncated,
      nextContinuationToken: response.NextContinuationToken,
    }
  } catch (error) {
    console.error('S3 List Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate presigned URL for temporary access
 */
export async function generatePresignedUrl(params: {
  key: string
  expiresIn?: number // seconds (default: 1 hour)
  operation?: 'get' | 'put'
}): Promise<{
  success: boolean
  url?: string
  expiresAt?: Date
  error?: string
}> {
  try {
    const expiresIn = params.expiresIn || 3600 // 1 hour default

    const command =
      params.operation === 'put'
        ? new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: params.key,
          })
        : new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: params.key,
          })

    const url = await getSignedUrl(s3Client, command, { expiresIn })

    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    return {
      success: true,
      url,
      expiresAt,
    }
  } catch (error) {
    console.error('S3 Presigned URL Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Copy file within S3
 */
export async function copyS3File(params: {
  sourceKey: string
  destinationKey: string
  metadata?: Record<string, string>
}): Promise<{
  success: boolean
  newKey?: string
  error?: string
}> {
  try {
    const command = new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${params.sourceKey}`,
      Key: params.destinationKey,
      Metadata: params.metadata,
      MetadataDirective: params.metadata ? 'REPLACE' : 'COPY',
    })

    await s3Client.send(command)

    return {
      success: true,
      newKey: params.destinationKey,
    }
  } catch (error) {
    console.error('S3 Copy Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate S3 key for document
 */
export function generateS3Key(params: {
  type: 'lead_document' | 'customer_profile' | 'customer_document' | 'customer_entity_document' | 'thumbnail'
  leadId?: string
  customerId?: string
  profileId?: string
  entityType?: string
  documentType?: string
  fileName: string
}): string {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const sanitizedFileName = params.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')

  if (params.type === 'lead_document') {
    return `leads/${params.leadId}/documents/${params.documentType}/${timestamp}-${randomStr}-${sanitizedFileName}`
  } else if (params.type === 'customer_profile') {
    return `customers/${params.customerId}/profile/${timestamp}-${randomStr}-${sanitizedFileName}`
  } else if (params.type === 'customer_document') {
    // For customer KYC documents (PAN, Aadhaar, address proofs)
    return `customers/${params.customerId}/documents/${params.documentType}/${timestamp}-${randomStr}-${sanitizedFileName}`
  } else if (params.type === 'customer_entity_document') {
    // For customer entity profile documents (GST certificate, partnership deed, etc.)
    return `customers/${params.customerId}/entities/${params.profileId}/${params.entityType}/${params.documentType}/${timestamp}-${randomStr}-${sanitizedFileName}`
  } else if (params.type === 'thumbnail') {
    return `thumbnails/${params.leadId || params.customerId}/${timestamp}-${randomStr}-thumb-${sanitizedFileName}`
  }

  return `uploads/${timestamp}-${randomStr}-${sanitizedFileName}`
}

export default s3Client
