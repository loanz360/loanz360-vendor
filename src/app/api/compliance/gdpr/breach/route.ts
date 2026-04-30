
import { NextRequest, NextResponse } from 'next/server'
import { gdprService } from '@/lib/compliance/gdpr-service'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * GET /api/compliance/gdpr/breach
 * Get all data breach incidents
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const incidents = await gdprService.getDataBreaches()

    return NextResponse.json({
      success: true,
      data: {
        incidents,
        count: incidents.length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/compliance/gdpr/breach', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * POST /api/compliance/gdpr/breach
 * Report a new data breach incident (Article 33/34 - 72-hour notification)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const {
      incident_type,
      severity,
      affected_records,
      affected_data_types,
      description,
      discovery_date,
      containment_status,
      remediation_steps,
      dpa_notified,
      individuals_notified,
      reported_by
    } = body

    if (!incident_type || !severity || !description) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: incident_type, severity, description'
      }, { status: 400 })
    }

    const result = await gdprService.reportDataBreach({
      incident_type,
      severity,
      affected_records,
      affected_data_types,
      description,
      discovery_date: discovery_date || new Date().toISOString(),
      containment_status: containment_status || 'investigating',
      remediation_steps,
      dpa_notified: dpa_notified || false,
      individuals_notified: individuals_notified || false,
      reported_by
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
        incident_id: result.incident_id
      },
      message: 'Data breach reported successfully. DPA notification required within 72 hours.'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/compliance/gdpr/breach', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
