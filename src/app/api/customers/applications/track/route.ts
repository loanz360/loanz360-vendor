/**
 * API Route: Customer Application Tracking
 * GET /api/customers/applications/track
 *
 * Allows customers to track their loan application status
 * by application ID or mobile number
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

interface TrackResponse {
  success: boolean
  application?: {
    id: string
    lead_number: string
    customer_name: string
    customer_mobile: string
    loan_type: string
    loan_amount: number
    lead_status: string
    cam_status: string
    assigned_bde_name: string | null
    created_at: string
    updated_at: string
  }
  error?: string
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Please provide an application ID or mobile number' } as TrackResponse,
        { status: 400 }
      )
    }

    // Build the query - search by lead_number or mobile number
    let dbQuery = supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        customer_name,
        customer_mobile,
        loan_type,
        required_loan_amount,
        lead_status,
        cam_status,
        assigned_bde_name,
        created_at,
        updated_at
      `)
      .or(`lead_id.eq.${query},customer_mobile.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    const { data: applications, error } = await dbQuery

    if (error) {
      apiLogger.error('Track application error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch application' } as TrackResponse,
        { status: 500 }
      )
    }

    if (!applications || applications.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No application found with this ID or mobile number' } as TrackResponse,
        { status: 404 }
      )
    }

    const app = applications[0]

    // Mask mobile number for privacy (show last 4 digits)
    const maskedMobile = app.customer_mobile
      ? `****${app.customer_mobile.slice(-4)}`
      : null

    return NextResponse.json({
      success: true,
      application: {
        id: app.id,
        lead_number: app.lead_id,
        customer_name: app.customer_name,
        customer_mobile: maskedMobile,
        loan_type: app.loan_type,
        loan_amount: app.required_loan_amount,
        lead_status: app.lead_status,
        cam_status: app.cam_status,
        assigned_bde_name: app.assigned_bde_name,
        created_at: app.created_at,
        updated_at: app.updated_at,
      },
    } as TrackResponse)
  } catch (error) {
    apiLogger.error('Track application error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as TrackResponse,
      { status: 500 }
    )
  }
}
