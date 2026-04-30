import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { soc2Service } from '@/lib/compliance/soc2-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/compliance/soc2/vendors
 * Get all vendor risk assessments
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const vendors = await soc2Service.getVendorAssessments()

    return NextResponse.json({
      success: true,
      data: {
        vendors,
        count: vendors.length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/compliance/soc2/vendors', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * POST /api/compliance/soc2/vendors
 * Conduct a new vendor risk assessment
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      vendor_name: z.string().optional(),

      vendor_type: z.string().optional(),

      services_provided: z.string().optional(),

      data_access_level: z.string().optional(),

      has_soc2_report: z.string().optional(),

      has_iso27001: z.string().optional(),

      security_questionnaire_completed: z.string().optional(),

      assessment_notes: z.string().optional(),

      assessed_by: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      vendor_name,
      vendor_type,
      services_provided,
      data_access_level,
      has_soc2_report,
      has_iso27001,
      security_questionnaire_completed,
      assessment_notes,
      assessed_by
    } = body

    if (!vendor_name || !vendor_type || !services_provided) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: vendor_name, vendor_type, services_provided'
      }, { status: 400 })
    }

    const result = await soc2Service.assessVendor({
      vendor_name,
      vendor_type,
      services_provided,
      data_access_level: data_access_level || 'none',
      has_soc2_report: has_soc2_report || false,
      has_iso27001: has_iso27001 || false,
      security_questionnaire_completed: security_questionnaire_completed || false,
      assessment_notes,
      assessed_by
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        vendor_id: result.vendorId,
        risk_score: result.riskScore
      },
      message: 'Vendor assessment completed successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/compliance/soc2/vendors', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
