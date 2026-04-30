import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { generateComplianceReport } from '@/lib/compliance/compliance-service'

/**
 * GET /api/compliance/reports
 * List available compliance reports
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const framework = searchParams.get('framework')
    const reportType = searchParams.get('reportType')
    const status = searchParams.get('status')

    let query = supabase
      .from('compliance_reports')
      .select('*')
      .order('generated_at', { ascending: false })

    if (framework) query = query.eq('framework', framework)
    if (reportType) query = query.eq('report_type', reportType)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      reports: data || [],
    })
  } catch (error) {
    return handleApiError(error, 'fetch reports')
  }
}

/**
 * POST /api/compliance/reports
 * Generate new compliance report
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      reportType: z.string().optional(),

      framework: z.string().optional(),

      periodStart: z.string().optional(),

      periodEnd: z.string().optional(),

      exportFormat: z.string().optional(),

      includeEvidence: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { reportType, framework, periodStart, periodEnd, exportFormat, includeEvidence } = body

    if (!reportType || !periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const reportId = await generateComplianceReport({
      reportType,
      framework,
      periodStart,
      periodEnd,
      exportFormat,
      includeEvidence,
    })

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate report' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reportId,
      message: 'Report generation started. Check status for completion.',
    })
  } catch (error) {
    return handleApiError(error, 'generate report')
  }
}
