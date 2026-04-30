import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * CAE Document Processing API
 * Process uploaded documents with OCR and verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDocumentIntelligenceService } from '@/lib/cae/document-intelligence'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const bodySchema = z.object({

      document_id: z.string().uuid().optional(),

      lead_id: z.string().uuid().optional(),

      appraisal_id: z.string().uuid().optional(),

      document_category_code: z.string().optional(),

      file_url: z.string().optional(),

      file_type: z.string().optional(),

      file_size: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { document_id, lead_id, appraisal_id, document_category_code, file_url, file_type, file_size } = body

    if (!document_id || !lead_id || !document_category_code) {
      return NextResponse.json(
        { success: false, error: 'document_id, lead_id, and document_category_code are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const documentService = createDocumentIntelligenceService(supabase)

    const result = await documentService.processDocument({
      document_id,
      lead_id,
      appraisal_id: appraisal_id || '',
      document_category_code,
      file_url: file_url || '',
      file_type: file_type || 'pdf',
      file_size: file_size || 0,
    })

    return NextResponse.json({
      success: result.success,
      data: result,
    })
  } catch (error: unknown) {
    apiLogger.error('Document processing error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const appraisalId = searchParams.get('appraisal_id')

    const supabase = await createClient()
    const documentService = createDocumentIntelligenceService(supabase)

    const stats = await documentService.getProcessingStats(appraisalId || undefined)

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error: unknown) {
    apiLogger.error('Get processing stats error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
