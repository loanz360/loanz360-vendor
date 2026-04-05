/**
 * API Route: Generate Credit Appraisal Memo (CAM)
 * POST /api/cae/cam/generate
 * GET /api/cae/cam/generate?lead_id=xxx
 *
 * Generates a comprehensive Universal Credit Appraisal Memo with:
 * - 9-section CAM structure
 * - Lender matching against 50+ banks/NBFCs
 * - Auto-assignment to BDE
 *
 * ACCESS CONTROL:
 * - Customers: NO ACCESS
 * - Partners (BA/BP/CP): NO ACCESS
 * - CRO/DSE/TSE: NO ACCESS
 * - BDE: Full access for assigned leads only
 * - Super Admin: Full access
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createCAMService, CreditAppraisalMemo } from '@/lib/cae/cam-service'
import { createUniversalCAMGenerator } from '@/lib/cae/universal-cam'
import { createAutoAssignmentEngine } from '@/lib/cae/auto-assignment-engine'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// IMPORTANT: CAM is a confidential internal document
// Only BDE (for assigned leads) and Super Admin can access
// CRO, DSE, TSE, and Partners CANNOT see CAMs

// BDE sub_roles - ONLY these can access CAM for assigned leads
const BDE_SUB_ROLES = [
  'BDE',
  'BUSINESS_DEVELOPMENT_EXECUTIVE',
  'BUSINESS_DEVELOPMENT_MANAGER',
]

interface GenerateCAMRequest {
  lead_id: string
  force_regenerate?: boolean
  use_universal_cam?: boolean // Use new Universal CAM Generator
  auto_assign?: boolean // Auto-assign to BDE
  options?: {
    skip_lender_matching?: boolean
    max_lenders?: number
    preferred_lenders?: string[]
  }
}

interface GenerateCAMResponse {
  success: boolean
  data?: {
    cam: CreditAppraisalMemo
    generated_at: string
    processing_time_ms: number
  }
  error?: string
}

/**
 * Verify user has access to CAM operations
 *
 * STRICT ACCESS CONTROL:
 * - Customers: NO ACCESS
 * - Partners (BA/BP/CP): NO ACCESS
 * - CRO/DSE/TSE: NO ACCESS
 * - BDE: Only for assigned leads
 * - Super Admin: Full access
 */
async function verifyCAMAccess(
  supabase: any,
  userId: string,
  leadId: string,
  accessType: 'generate' | 'view'
): Promise<{ hasAccess: boolean; role: string; error?: string }> {
  // Check if user is a super admin
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (superAdmin) {
    return {
      hasAccess: true,
      role: 'SUPER_ADMIN',
    }
  }

  // Check if user has admin role in users table
  const { data: adminUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .in('role', ['SUPER_ADMIN', 'ADMIN'])
    .maybeSingle()

  if (adminUser) {
    return {
      hasAccess: true,
      role: adminUser.role,
    }
  }

  // Check if user is a BDE employee
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, sub_role, user_id, employee_status')
    .eq('user_id', userId)
    .eq('employee_status', 'ACTIVE')
    .maybeSingle()

  if (empError || !employee) {
    return {
      hasAccess: false,
      role: 'unknown',
      error: 'Access denied. Only BDE and Super Admin can access CAM.',
    }
  }

  const subRole = employee.sub_role || ''

  // ONLY BDE roles can access CAM - CRO, DSE, TSE, etc. CANNOT
  if (!BDE_SUB_ROLES.includes(subRole)) {
    return {
      hasAccess: false,
      role: subRole,
      error: `CAM access denied. Your role (${subRole}) cannot access Credit Appraisal Memos. Only BDE and Super Admin have access.`,
    }
  }

  // BDE must be assigned to this lead
  const { data: lead, error: leadError } = await supabase
    .from('partner_leads')
    .select('id, assigned_bde_id')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError || !lead) {
    return {
      hasAccess: false,
      role: subRole,
      error: 'Lead not found',
    }
  }

  // Check if lead is assigned to this BDE
  const isAssigned = lead.assigned_bde_id === employee.user_id

  if (!isAssigned) {
    return {
      hasAccess: false,
      role: subRole,
      error: 'Access denied. You can only access CAM for leads assigned to you.',
    }
  }

  return {
    hasAccess: true,
    role: subRole,
  }
}

/**
 * Log CAM access for compliance
 */
async function logCAMAccess(
  supabase: any,
  camId: string,
  userId: string,
  role: string,
  accessType: string,
  request: NextRequest
): Promise<void> {
  try {
    await supabase.from('cam_access_log').insert({
      cam_id: camId,
      accessed_by: userId,
      access_type: accessType,
      user_role: role,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
    })
  } catch (error) {
    apiLogger.error('Failed to log CAM access', error)
  }
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as GenerateCAMResponse,
        { status: 401 }
      )
    }

    // Parse request body
    const body: GenerateCAMRequest = await request.json()

    if (!body.lead_id) {
      return NextResponse.json(
        { success: false, error: 'lead_id is required' } as GenerateCAMResponse,
        { status: 400 }
      )
    }

    // Verify access - only admin/credit roles can generate CAM
    const access = await verifyCAMAccess(supabase, user.id, body.lead_id, 'generate')

    if (!access.hasAccess) {
      return NextResponse.json(
        { success: false, error: access.error || 'Access denied' } as GenerateCAMResponse,
        { status: 403 }
      )
    }

    // Check for existing CAM if not force regenerating
    if (!body.force_regenerate) {
      const { data: existingCAM } = await supabase
        .from('credit_appraisal_memos')
        .select('*')
        .eq('lead_id', body.lead_id)
        .eq('is_latest', true)
        .maybeSingle()

      if (existingCAM && existingCAM.status !== 'DRAFT') {
        // Log access
        await logCAMAccess(supabase, existingCAM.id, user.id, access.role, 'VIEW', request)

        return NextResponse.json({
          success: true,
          data: {
            cam: buildCAMResponse(existingCAM),
            generated_at: existingCAM.created_at,
            processing_time_ms: 0,
          },
        } as GenerateCAMResponse)
      }
    }

    // Fetch lead details
    const { data: lead } = await supabase
      .from('partner_leads')
      .select(`
        *,
        verification_results:partner_lead_verifications(*)
      `)
      .eq('id', body.lead_id)
      .maybeSingle()

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' } as GenerateCAMResponse,
        { status: 404 }
      )
    }

    // Use Universal CAM Generator if requested (new 9-section CAM with lender matching)
    if (body.use_universal_cam) {
      return await generateUniversalCAM(supabase, user, lead, body, request, access.role, startTime)
    }

    // Generate CAM using legacy CAMService
    const camService = createCAMService(supabase)
    const cam = await camService.generateCAM(body.lead_id)

    if (!cam) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate CAM. Lead may not exist or have insufficient data.' } as GenerateCAMResponse,
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime

    // Store the generated CAM with full data
    const { data: savedCAM, error: saveError } = await supabase
      .from('credit_appraisal_memos')
      .upsert({
        lead_id: body.lead_id,
        customer_id: lead?.customer_user_id,
        cam_id: cam.cam_id,
        status: cam.status,
        is_latest: true,
        version: 1,

        // Customer Profile
        customer_profile: cam.customer,

        // Loan Details
        loan_details: cam.loan,

        // Analysis Results
        income_analysis: cam.income_analysis,
        credit_analysis: cam.credit_analysis,
        risk_assessment: cam.risk_assessment,
        eligibility_analysis: cam.eligibility_analysis,
        document_summary: cam.document_summary,

        // Scores
        credit_score: cam.credit_analysis.credit_score,
        risk_grade: cam.risk_assessment.risk_grade,
        risk_score: cam.risk_assessment.overall_risk_score,
        eligibility_score: cam.eligibility_analysis.eligibility_score,

        // Eligibility
        is_eligible: cam.eligibility_analysis.is_eligible,
        max_eligible_amount: cam.eligibility_analysis.max_eligible_amount,
        recommended_amount: cam.loan.recommended_amount,
        recommended_tenure: cam.eligibility_analysis.recommended_tenure,
        recommended_emi: cam.eligibility_analysis.recommended_emi,

        // Ratios
        foir: cam.eligibility_analysis.foir,
        dti: cam.eligibility_analysis.dti,

        // Recommendation
        recommendation: cam.recommendation,
        recommendation_notes: cam.recommendation_notes,
        conditions: cam.conditions,

        // Risk Flags
        risk_flags: cam.risk_assessment.risk_flags,
        critical_flags_count: cam.risk_assessment.risk_flags?.filter((f: any) => f.severity === 'CRITICAL').length || 0,
        high_flags_count: cam.risk_assessment.risk_flags?.filter((f: any) => f.severity === 'HIGH').length || 0,
        medium_flags_count: cam.risk_assessment.risk_flags?.filter((f: any) => f.severity === 'MEDIUM').length || 0,

        // Processing
        processing_time_ms: processingTime,

        // Assignment (for BDE access)
        assigned_bde_id: lead?.assigned_bde_id,

        // Audit
        prepared_by: user.id,
        prepared_at: new Date().toISOString(),
        created_by: user.id,
        last_modified_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'cam_id',
      })
      .select()
      .maybeSingle()

    if (saveError) {
      apiLogger.error('Failed to save CAM', saveError)
      // Continue anyway - return the generated CAM
    }

    // Update lead status
    await supabase
      .from('leads')
      .update({
        cam_status: 'COMPLETED',
        cam_generated_at: new Date().toISOString(),
      })
      .eq('id', body.lead_id)

    // Log access
    if (savedCAM) {
      await logCAMAccess(supabase, savedCAM.id, user.id, access.role, 'VIEW', request)
    }

    return NextResponse.json({
      success: true,
      data: {
        cam,
        generated_at: new Date().toISOString(),
        processing_time_ms: processingTime,
      },
    } as GenerateCAMResponse)

  } catch (error) {
    apiLogger.error('CAM generation error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as GenerateCAMResponse,
      { status: 500 }
    )
  }
}

// GET: Retrieve existing CAM for a lead
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as GenerateCAMResponse,
        { status: 401 }
      )
    }

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'lead_id query parameter is required' } as GenerateCAMResponse,
        { status: 400 }
      )
    }

    // Verify access - BDEs can only view CAM for assigned leads
    const access = await verifyCAMAccess(supabase, user.id, leadId, 'view')

    if (!access.hasAccess) {
      return NextResponse.json(
        { success: false, error: access.error || 'Access denied' } as GenerateCAMResponse,
        { status: 403 }
      )
    }

    // Fetch existing CAM
    const { data: existingCAM, error } = await supabase
      .from('credit_appraisal_memos')
      .select('*')
      .eq('lead_id', leadId)
      .eq('is_latest', true)
      .maybeSingle()

    if (error || !existingCAM) {
      return NextResponse.json(
        { success: false, error: 'CAM not found for this lead' } as GenerateCAMResponse,
        { status: 404 }
      )
    }

    // Log access
    await logCAMAccess(supabase, existingCAM.id, user.id, access.role, 'VIEW', request)

    return NextResponse.json({
      success: true,
      data: {
        cam: buildCAMResponse(existingCAM),
        generated_at: existingCAM.created_at,
        processing_time_ms: existingCAM.processing_time_ms || 0,
      },
    } as GenerateCAMResponse)

  } catch (error) {
    apiLogger.error('CAM fetch error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as GenerateCAMResponse,
      { status: 500 }
    )
  }
}

/**
 * Build CAM response from database record
 */
function buildCAMResponse(dbRecord: any): CreditAppraisalMemo {
  return {
    cam_id: dbRecord.cam_id,
    lead_id: dbRecord.lead_id,
    created_at: dbRecord.created_at,
    updated_at: dbRecord.updated_at,
    status: dbRecord.status,
    version: dbRecord.version,

    customer: dbRecord.customer_profile,
    loan: dbRecord.loan_details,
    income_analysis: dbRecord.income_analysis,
    credit_analysis: dbRecord.credit_analysis,
    risk_assessment: dbRecord.risk_assessment,
    eligibility_analysis: dbRecord.eligibility_analysis,
    document_summary: dbRecord.document_summary,

    recommendation: dbRecord.recommendation,
    recommendation_notes: dbRecord.recommendation_notes,
    conditions: dbRecord.conditions,

    prepared_by: dbRecord.prepared_by,
    reviewed_by: dbRecord.reviewed_by,
    approved_by: dbRecord.approved_by,
    processing_time_ms: dbRecord.processing_time_ms,
  }
}

/**
 * Generate Universal CAM with 9 sections and lender matching
 */
async function generateUniversalCAM(
  supabase: any,
  user: any,
  lead: any,
  body: GenerateCAMRequest,
  request: NextRequest,
  userRole: string,
  startTime: number
): Promise<NextResponse> {
  try {
    // Build CAM generation input
    const camInput = {
      lead_id: body.lead_id,
      loan_type: lead.loan_type || 'PERSONAL_LOAN',
      requested_amount: lead.loan_amount || 500000,
      requested_tenure_months: lead.loan_tenure_months,

      customer_data: {
        profile: {
          name: lead.customer_name,
          mobile: lead.mobile,
          email: lead.email,
          dob: lead.date_of_birth,
          gender: lead.gender,
          marital_status: lead.marital_status,
          pan: lead.pan_number,
          alternate_mobile: lead.alternate_mobile,
          current_address: lead.address ? {
            line1: lead.address.line1 || lead.address.address_line_1 || '',
            line2: lead.address.line2 || lead.address.address_line_2,
            city: lead.address.city || '',
            state: lead.address.state || '',
            pincode: lead.address.pincode || lead.address.pin || '',
            country: 'India',
            type: 'OTHER' as const,
            years_at_address: null,
          } : undefined,
        },
        employment: lead.employment_details ? {
          employment_type: lead.employment_details.employment_type || lead.employment_type,
          gross_monthly_income: lead.employment_details.monthly_income || lead.monthly_income,
          net_monthly_income: lead.employment_details.net_income,
          salaried_details: lead.employment_details.employer_name ? {
            employer_name: lead.employment_details.employer_name,
            employer_type: lead.employment_details.employer_type,
            designation: lead.employment_details.designation,
            industry: lead.employment_details.industry,
            total_experience_months: lead.employment_details.total_experience_months,
            current_job_months: lead.employment_details.current_job_months,
          } : undefined,
          business_details: lead.employment_details.business_name ? {
            business_name: lead.employment_details.business_name,
            business_type: lead.employment_details.business_type,
            annual_turnover: lead.employment_details.annual_turnover,
            average_monthly_profit: lead.employment_details.monthly_profit,
          } : undefined,
        } : undefined,
      },

      verification_results: buildVerificationResults(lead.verification_results),

      options: body.options,
    }

    // Create CAM generator with dependencies
    const camGenerator = createUniversalCAMGenerator({
      fetchLenders: async () => {
        const { data } = await supabase
          .from('lenders')
          .select('*')
          .eq('is_active', true)
        return data || []
      },

      fetchLenderRules: async (loanType: string) => {
        const { data } = await supabase
          .from('lender_eligibility_rules')
          .select('*')
          .eq('loan_type', loanType)
          .eq('is_active', true)
        return data || []
      },

      fetchDocuments: async (leadId: string) => {
        const { data } = await supabase
          .from('partner_lead_documents')
          .select('*')
          .eq('lead_id', leadId)
        return data || []
      },

      fetchLeadDetails: async (leadId: string) => {
        const { data } = await supabase
          .from('partner_leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle()
        return data
      },

      findBestBDE: body.auto_assign !== false ? async (loanType, amount, state) => {
        const assignmentEngine = createAutoAssignmentEngine(supabase)
        const result = await assignmentEngine.findBestBDE({
          lead_id: body.lead_id,
          loan_type: loanType,
          loan_amount: amount,
          state,
        })

        if (result.success && result.assigned_to_bde_id) {
          return {
            bde_id: result.assigned_to_bde_id,
            bde_name: result.assigned_to_bde_name || 'Unknown',
            reason: result.assignment_reason || 'Auto-assigned',
          }
        }
        return null
      } : undefined,
    })

    // Generate CAM
    const result = await camGenerator.generate(camInput)

    if (!result.success || !result.cam) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Universal CAM generation failed',
        },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime

    // Store CAM in database with all 9 sections
    const { error: storeError } = await supabase
      .from('credit_appraisal_memos')
      .insert({
        id: result.cam.cam_id,
        lead_id: body.lead_id,
        cam_id: result.cam.cam_id,
        status: 'GENERATED',
        loan_type: result.cam.loan_type,
        requested_amount: result.cam.requested_amount,
        requested_tenure_months: result.cam.requested_tenure_months,

        // Store all 9 sections as JSONB
        applicant_profile: result.cam.applicant_profile,
        employment_income: result.cam.employment_income,
        credit_analysis: result.cam.credit_analysis,
        financial_analysis: result.cam.financial_analysis,
        risk_assessment: result.cam.risk_assessment,
        eligibility: result.cam.eligibility,
        lender_recommendations: result.cam.lender_recommendations,
        document_status: result.cam.document_status,
        final_assessment: result.cam.final_assessment,

        // Computed fields
        credit_score: result.cam.credit_analysis.credit_score,
        risk_grade: result.cam.risk_assessment.risk_grade,
        risk_score: result.cam.risk_assessment.overall_risk_score,
        is_eligible: result.cam.eligibility.is_eligible,
        max_eligible_amount: result.cam.eligibility.max_eligible_amount,
        foir: result.cam.eligibility.foir,

        // Assignment
        assigned_bde_id: result.cam.final_assessment.assigned_to_bde_id,
        assigned_at: result.cam.final_assessment.assigned_at,
        assignment_reason: result.cam.final_assessment.assignment_reason,

        // Meta
        is_latest: true,
        version: 1,
        processing_time_ms: processingTime,
        prepared_by: user.id,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (storeError) {
      apiLogger.error('CAM storage error', storeError)
    }

    // Store lender recommendations
    if (result.cam.lender_recommendations.length > 0) {
      const recommendations = result.cam.lender_recommendations.map(rec => ({
        cam_id: result.cam!.cam_id,
        lead_id: body.lead_id,
        lender_id: rec.lender_id,
        lender_code: rec.lender_code,
        lender_name: rec.lender_name,
        rank: rec.rank,
        match_score: rec.match_score,
        approval_probability: rec.approval_probability,
        eligible_amount: rec.max_eligible_amount,
        offered_rate: rec.offered_interest_rate,
        offered_tenure_months: rec.offered_tenure_months,
        estimated_emi: rec.estimated_emi,
        processing_fee: rec.processing_fee,
        is_best_match: rec.is_best_match,
        fast_track_eligible: rec.fast_track_eligible,
        pre_approved: rec.pre_approved,
        created_at: new Date().toISOString(),
      }))

      await supabase
        .from('cam_lender_recommendations')
        .insert(recommendations)
        .catch((err: Error) => apiLogger.error('Failed to store recommendations', err))
    }

    // Mark previous CAMs as not latest
    await supabase
      .from('credit_appraisal_memos')
      .update({ is_latest: false })
      .eq('lead_id', body.lead_id)
      .neq('id', result.cam.cam_id)

    // Update lead status
    await supabase
      .from('partner_leads')
      .update({
        lead_status: result.cam.final_assessment.assigned_to_bde_id ? 'ASSIGNED' : 'CAM_READY',
        cam_generated_at: new Date().toISOString(),
        assigned_bde_id: result.cam.final_assessment.assigned_to_bde_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.lead_id)

    // Log access
    await logCAMAccess(supabase, result.cam.cam_id, user.id, userRole, 'GENERATE', request)

    // Return comprehensive response
    return NextResponse.json({
      success: true,
      data: {
        cam_id: result.cam.cam_id,
        cam_type: 'UNIVERSAL',
        status: result.cam.final_assessment.profile_status,
        profile_strength: result.cam.final_assessment.profile_strength_label,
        risk_grade: result.cam.risk_assessment.risk_grade,
        eligible_amount: result.cam.eligibility.max_eligible_amount,
        recommended_lender: result.cam.final_assessment.recommended_lender_name,
        assigned_to: result.cam.final_assessment.assigned_to_bde_name,
        lender_matches: result.cam.lender_recommendations.length,
        processing_time_ms: processingTime,
        generated_at: new Date().toISOString(),
        summary: {
          applicant: result.cam.applicant_profile.name,
          loan_type: result.cam.loan_type,
          requested_amount: result.cam.requested_amount,
          kyc_status: result.cam.applicant_profile.kyc_status,
          credit_score: result.cam.credit_analysis.credit_score,
          monthly_income: result.cam.employment_income.total_monthly_income,
          foir: result.cam.eligibility.foir,
          strengths: result.cam.final_assessment.strengths.slice(0, 3),
          concerns: result.cam.final_assessment.concerns.slice(0, 3),
        },
        top_lenders: result.cam.lender_recommendations.slice(0, 5).map(r => ({
          name: r.lender_name,
          type: r.lender_type,
          eligible_amount: r.max_eligible_amount,
          rate: r.offered_interest_rate,
          probability: r.approval_probability,
        })),
      },
      warnings: result.warnings,
    })

  } catch (error) {
    apiLogger.error('Universal CAM generation error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/**
 * Build verification results from stored verifications
 */
function buildVerificationResults(verifications: any[]): any {
  if (!verifications || verifications.length === 0) {
    return undefined
  }

  const results: any = {}

  for (const v of verifications) {
    switch (v.verification_type) {
      case 'PAN':
      case 'AADHAAR':
      case 'DIGILOCKER':
        if (!results.identity) results.identity = {}
        if (v.verification_type === 'PAN' && v.verified_data) {
          results.identity.pan = {
            number: v.verified_data.pan_number,
            name: v.verified_data.name,
            status: v.status,
            verified: v.is_verified,
          }
        }
        if (v.verification_type === 'AADHAAR' && v.verified_data) {
          results.identity.aadhaar = {
            last_4: v.verified_data.aadhaar_last_4,
            name: v.verified_data.name,
            dob: v.verified_data.dob,
            address: v.verified_data.address,
            verified: v.is_verified,
          }
        }
        break

      case 'CIBIL':
      case 'EXPERIAN':
      case 'EQUIFAX':
        results.credit_bureau = v.verified_data
        if (results.credit_bureau) {
          results.credit_bureau.source = v.verification_type
        }
        break

      case 'GST':
        if (!results.income) results.income = {}
        results.income = { ...results.income, ...v.verified_data }
        break

      case 'ITR':
        if (!results.income) results.income = {}
        results.income = { ...results.income, ...v.verified_data }
        break

      case 'BANK_STATEMENT':
        results.bank_statement = v.verified_data
        break

      case 'AML':
        results.aml_screening = {
          status: v.is_verified ? 'CLEAR' : (v.verified_data?.match ? 'MATCH_FOUND' : 'PENDING'),
          details: v.verified_data?.details,
        }
        break
    }
  }

  return results
}
