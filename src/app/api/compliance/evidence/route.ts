import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

/**
 * GET /api/compliance/evidence
 * List evidence files
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const evidenceType = searchParams.get('evidenceType')
    const policyId = searchParams.get('policyId')
    const violationId = searchParams.get('violationId')

    let query = supabase
      .from('evidence_vault')
      .select('*')
      .order('uploaded_at', { ascending: false })

    if (evidenceType) query = query.eq('evidence_type', evidenceType)
    if (policyId) query = query.eq('policy_id', policyId)
    if (violationId) query = query.eq('violation_id', violationId)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      evidence: data || [],
    })
  } catch (error) {
    return handleApiError(error, 'fetch evidence')
  }
}

/**
 * POST /api/compliance/evidence
 * Upload evidence file
 * Note: Actual file upload would use multipart/form-data and S3/Azure storage
 * This is a simplified version that stores metadata
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      evidenceType: z.string().optional(),

      fileName: z.string().optional(),

      fileType: z.string().optional(),

      fileSize: z.string().optional(),

      fileHash: z.string().optional(),

      storagePath: z.string().optional(),

      description: z.string().optional(),

      tags: z.array(z.unknown()).optional(),

      auditLogId: z.string().uuid().optional(),

      policyId: z.string().uuid().optional(),

      violationId: z.string().uuid().optional(),

      uploadedBy: z.string().optional(),

      sensitivityLevel: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      evidenceType,
      fileName,
      fileType,
      fileSize,
      fileHash,
      storagePath,
      description,
      tags,
      auditLogId,
      policyId,
      violationId,
      uploadedBy,
      sensitivityLevel,
    } = body

    if (!evidenceType || !fileName || !fileHash || !storagePath) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Calculate retention date (7 years from now)
    const retentionUntil = new Date()
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 7)

    const { data, error } = await supabase
      .from('evidence_vault')
      .insert({
        evidence_type: evidenceType,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_hash: fileHash,
        storage_path: storagePath,
        description,
        tags: tags || [],
        audit_log_id: auditLogId,
        policy_id: policyId,
        violation_id: violationId,
        uploaded_by: uploadedBy,
        sensitivity_level: sensitivityLevel || 'confidential',
        retention_until: retentionUntil.toISOString().split('T')[0],
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      evidence: data,
    })
  } catch (error) {
    return handleApiError(error, 'upload evidence')
  }
}
