
import { NextRequest, NextResponse } from 'next/server'
import { soc2Service } from '@/lib/compliance/soc2-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/compliance/soc2/testing
 * Get all control test results
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const control_id = searchParams.get('control_id')

    const filters: any = {}
    if (control_id) filters.control_id = control_id

    const tests = await soc2Service.getControlTests(filters)

    return NextResponse.json({
      success: true,
      data: {
        tests,
        count: tests.length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/compliance/soc2/testing', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * POST /api/compliance/soc2/testing
 * Record a new control test
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      control_id,
      test_date,
      test_result,
      evidence_collected,
      issues_identified,
      remediation_actions,
      tested_by
    } = body

    if (!control_id || !test_result) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: control_id, test_result'
      }, { status: 400 })
    }

    const result = await soc2Service.recordControlTest({
      control_id,
      test_date: test_date || new Date().toISOString(),
      test_result,
      evidence_collected,
      issues_identified,
      remediation_actions,
      tested_by
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Control test recorded successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/compliance/soc2/testing', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
