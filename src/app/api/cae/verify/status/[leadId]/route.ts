/**
 * API Route: Get Verification Status
 * GET /api/cae/verify/status/[leadId]
 *
 * Retrieves verification status and results for a lead
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


interface VerificationStatusResponse {
  success: boolean
  data?: {
    lead_id: string
    overall_status: string
    verifications: any[]
    risk_flags: any[]
    summary: {
      total: number
      completed: number
      failed: number
      pending: number
    }
  }
  error?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { leadId } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as VerificationStatusResponse,
        { status: 401 }
      )
    }

    // Fetch lead with verification status
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, verification_status, risk_flags')
      .eq('id', leadId)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' } as VerificationStatusResponse,
        { status: 404 }
      )
    }

    // Fetch all verification results for this lead
    const verifications: any[] = []

    // Bank Statement Analysis
    const { data: bankStatements } = await supabase
      .from('bank_statement_analysis')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (bankStatements) {
      verifications.push(
        ...bankStatements.map((bs) => ({
          type: 'INCOME_BANK_STATEMENT',
          ...bs,
        }))
      )
    }

    // Account Aggregator Consents
    const { data: aaConsents } = await supabase
      .from('account_aggregator_consents')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (aaConsents) {
      verifications.push(
        ...aaConsents.map((aa) => ({
          type: 'INCOME_ACCOUNT_AGGREGATOR',
          ...aa,
        }))
      )
    }

    // Bank Account Verifications (Penny Drop)
    const { data: bankVerifications } = await supabase
      .from('bank_account_verifications')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (bankVerifications) {
      verifications.push(
        ...bankVerifications.map((bv) => ({
          type: 'BANK_ACCOUNT_PENNY_DROP',
          ...bv,
        }))
      )
    }

    // MCA Verifications
    const { data: mcaVerifications } = await supabase
      .from('mca_verifications')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (mcaVerifications) {
      verifications.push(
        ...mcaVerifications.map((mca) => ({
          type: 'BUSINESS_MCA',
          ...mca,
        }))
      )
    }

    // AML Screening
    const { data: amlResults } = await supabase
      .from('aml_screening_results')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (amlResults) {
      verifications.push(
        ...amlResults.map((aml) => ({
          type: 'AML_SCREENING',
          ...aml,
        }))
      )
    }

    // CERSAI Searches
    const { data: cersaiSearches } = await supabase
      .from('cersai_searches')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (cersaiSearches) {
      verifications.push(
        ...cersaiSearches.map((cs) => ({
          type: 'COLLATERAL_CERSAI',
          ...cs,
        }))
      )
    }

    // Court Case Checks
    const { data: courtCases } = await supabase
      .from('court_case_checks')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (courtCases) {
      verifications.push(
        ...courtCases.map((cc) => ({
          type: 'LITIGATION_CHECK',
          ...cc,
        }))
      )
    }

    // Video KYC Sessions
    const { data: videoKyc } = await supabase
      .from('video_kyc_sessions')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (videoKyc) {
      verifications.push(
        ...videoKyc.map((vk) => ({
          type: 'VIDEO_KYC',
          ...vk,
        }))
      )
    }

    // Calculate summary
    const summary = {
      total: verifications.length,
      completed: verifications.filter((v) => v.status === 'COMPLETED' || v.status === 'SUCCESS').length,
      failed: verifications.filter((v) => v.status === 'FAILED').length,
      pending: verifications.filter(
        (v) => v.status === 'PENDING' || v.status === 'PROCESSING' || v.status === 'IN_PROGRESS'
      ).length,
    }

    return NextResponse.json({
      success: true,
      data: {
        lead_id: leadId,
        overall_status: lead.verification_status || 'PENDING',
        verifications,
        risk_flags: lead.risk_flags || [],
        summary,
      },
    } as VerificationStatusResponse)
  } catch (error) {
    apiLogger.error('Verification status error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as VerificationStatusResponse,
      { status: 500 }
    )
  }
}
