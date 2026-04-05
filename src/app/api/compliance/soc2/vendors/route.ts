export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { soc2Service } from '@/lib/compliance/soc2-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/compliance/soc2/vendors
 * Get all vendor risk assessments
 */
export async function GET(request: NextRequest) {
  try {
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
    const body = await request.json()
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
