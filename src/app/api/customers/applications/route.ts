/**
 * API Route: Customer Applications List
 * GET /api/customers/applications
 *
 * Fetches loan applications for the authenticated customer with dual visibility:
 * 1. Applications where customer is the applicant (by mobile match or user_id)
 * 2. Applications where customer is the referrer (referred leads)
 *
 * IMPORTANT: CAM (Credit Appraisal Memo) Access Control
 * - cam_status is exposed for tracking purposes (e.g., "PROCESSING", "COMPLETED")
 * - Actual CAM content is NEVER exposed to customers
 * - CAM data is only accessible to Super Admin and assigned BDEs via /api/cae/cam/*
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


interface Application {
  id: string
  lead_number: string
  customer_name: string
  loan_type: string
  loan_amount: number
  lead_status: string
  cam_status: string
  assigned_bde_name: string | null
  created_at: string
  updated_at: string
  visibility_type: 'APPLICANT' | 'REFERRER' // Indicates if user is applicant or referrer
}

interface ApplicationsResponse {
  success: boolean
  applications?: Application[]
  count?: number
  error?: string
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApplicationsResponse,
        { status: 401 }
      )
    }

    // Get customer profile to find their mobile number and ID
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id, mobile_number')
      .eq('user_id', user.id)
      .maybeSingle()

    const userMobile = profile?.mobile_number || null
    const customerId = profile?.id || null

    // 1. Fetch applications where customer is the APPLICANT
    let applicantQuery = supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        customer_name,
        loan_type,
        required_loan_amount,
        lead_status,
        cam_status,
        assigned_bde_name,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    // Filter by customer_user_id or mobile number
    if (userMobile) {
      applicantQuery = applicantQuery.or(`customer_user_id.eq.${user.id},customer_mobile.eq.${userMobile}`)
    } else {
      applicantQuery = applicantQuery.eq('customer_user_id', user.id)
    }

    const { data: applicantLeads, error: applicantError } = await applicantQuery

    if (applicantError) {
      apiLogger.error('Fetch applicant leads error', applicantError)
    }

    // 2. Fetch applications where customer is the REFERRER
    let referrerLeads: typeof applicantLeads = []
    if (customerId) {
      const { data: refLeads, error: refError } = await supabase
        .from('leads')
        .select(`
          id,
          lead_id,
          customer_name,
          loan_type,
          required_loan_amount,
          lead_status,
          cam_status,
          assigned_bde_name,
          created_at,
          updated_at
        `)
        .eq('referrer_id', customerId)
        .order('created_at', { ascending: false })

      if (refError) {
        apiLogger.error('Fetch referrer leads error', refError)
      } else {
        referrerLeads = refLeads || []
      }
    }

    // 3. Transform and combine applications with visibility type
    const applicantApps: Application[] = (applicantLeads || []).map((app) => ({
      id: app.id,
      lead_number: app.lead_id,
      customer_name: app.customer_name,
      loan_type: app.loan_type,
      loan_amount: app.required_loan_amount,
      lead_status: app.lead_status,
      cam_status: app.cam_status,
      assigned_bde_name: app.assigned_bde_name,
      created_at: app.created_at,
      updated_at: app.updated_at,
      visibility_type: 'APPLICANT' as const,
    }))

    const referrerApps: Application[] = (referrerLeads || []).map((app) => ({
      id: app.id,
      lead_number: app.lead_id,
      customer_name: app.customer_name,
      loan_type: app.loan_type,
      loan_amount: app.required_loan_amount,
      lead_status: app.lead_status,
      cam_status: app.cam_status,
      assigned_bde_name: app.assigned_bde_name,
      created_at: app.created_at,
      updated_at: app.updated_at,
      visibility_type: 'REFERRER' as const,
    }))

    // 4. Combine and deduplicate (prioritize APPLICANT visibility if duplicate)
    const allApps = [...applicantApps, ...referrerApps]
    const transformedApps = allApps.filter(
      (app, index, self) => index === self.findIndex((a) => a.id === app.id)
    )

    // Sort by created_at descending
    transformedApps.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json({
      success: true,
      applications: transformedApps,
      count: transformedApps.length,
    } as ApplicationsResponse)
  } catch (error) {
    apiLogger.error('Applications API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ApplicationsResponse,
      { status: 500 }
    )
  }
}
