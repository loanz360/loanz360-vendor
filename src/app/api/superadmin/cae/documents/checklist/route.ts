
/**
 * CAE Document Checklist API
 * Get document requirements and status for a lead/appraisal
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDocumentIntelligenceService } from '@/lib/cae/document-intelligence'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')
    const loanTypeCode = searchParams.get('loan_type_code')
    const employmentType = searchParams.get('employment_type') || 'SALARIED'

    if (!leadId || !loanTypeCode) {
      return NextResponse.json(
        { success: false, error: 'lead_id and loan_type_code are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const documentService = createDocumentIntelligenceService(supabase)

    const checklist = await documentService.getDocumentChecklist(
      leadId,
      loanTypeCode,
      employmentType
    )

    if (!checklist) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate document checklist' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: checklist,
    })
  } catch (error: unknown) {
    apiLogger.error('Document checklist error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
