import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * API Route: ULAP Module - Lead Submission
 * POST /api/ulap/module/submit - Submit a lead from the ULAP Lead Module
 *
 * This endpoint handles lead submissions from all stakeholder portals:
 * - BA Portal (Business Associates)
 * - BP Portal (Banking Partners)
 * - Employee Portals (CRO, DSE, Digital Sales, Telecaller, Field Sales, BDE)
 * - Customer Self-Apply
 * - Customer Referral
 *
 * All leads are stored in the unified `leads` table with full source attribution.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

// Base URL for generating shareable links
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'

// Generate short code for link
function generateShortCode(): string {
  return crypto.randomBytes(4).toString('hex')
}

// Generate trace token (hidden from user)
function generateTraceToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Check if a value is a valid UUID
function isValidUUID(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return UUID_REGEX.test(value)
}

// Map source type to lead generator role
function getLeadGeneratorRole(sourceType: string): string {
  const roleMap: Record<string, string> = {
    ULAP_BA: 'BUSINESS_ASSOCIATE',
    ULAP_BP: 'BUSINESS_PARTNER',
    ULAP_CRO: 'CRO',
    ULAP_DSE: 'DSE',
    ULAP_DIGITAL_SALES: 'DIGITAL_SALES',
    ULAP_TELECALLER: 'TELECALLER',
    ULAP_FIELD_SALES: 'FIELD_SALES',
    ULAP_BDE: 'BDE',
    ULAP_CUSTOMER: 'CUSTOMER',
    ULAP_CUSTOMER_REFERRAL: 'CUSTOMER_REFERRAL',
    ULAP_SHARE_LINK: 'SHARE_LINK',
  }
  return roleMap[sourceType] || 'UNKNOWN'
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      customer_name: z.string().optional(),

      customer_mobile: z.string().optional(),

      source_type: z.string().optional(),

      source_user_name: z.string().optional(),

      source_partner_id: z.string().uuid().optional(),

      source_partner_name: z.string().optional(),

      trace_token: z.string().optional(),

      customer_email: z.string().email().optional(),

      customer_city: z.string().optional(),

      customer_state: z.string().optional(),

      customer_pincode: z.string().optional(),

      loan_type: z.string().optional(),

      required_loan_amount: z.string().optional(),

      collected_data: z.string().optional(),

      loan_category_id: z.string().uuid().optional(),

      loan_subcategory_id: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Required fields validation
    if (!body.customer_name || !body.customer_mobile) {
      return NextResponse.json(
        { success: false, error: 'Customer name and mobile are required' },
        { status: 400 }
      )
    }

    // Validate mobile number format (Indian format)
    const mobileRegex = /^[6-9]\d{9}$/
    if (!mobileRegex.test(body.customer_mobile)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format. Please enter a valid 10-digit mobile number.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Determine source type and lead generator info
    const sourceType = body.source_type || 'ULAP_CUSTOMER'
    const leadGeneratorRole = getLeadGeneratorRole(sourceType)

    // Get lead generator name and additional context
    let leadGeneratorName = body.source_user_name || user.user_metadata?.full_name || user.email || 'Unknown'
    let partnerId = body.source_partner_id || null
    let partnerName = body.source_partner_name || null
    let partnerCode = null

    // For partner sources, look up partner details
    if (sourceType === 'ULAP_BA' || sourceType === 'ULAP_BP') {
      const { data: partner } = await supabase
        .from('partners')
        .select('id, full_name, partner_code, partner_type')
        .eq('user_id', user.id)
        .maybeSingle()

      if (partner) {
        partnerId = partner.id
        partnerName = partner.full_name
        partnerCode = partner.partner_code
        leadGeneratorName = partner.full_name
      }
    }

    // For employee sources, get employee details
    if (['ULAP_CRO', 'ULAP_DSE', 'ULAP_DIGITAL_SALES', 'ULAP_TELECALLER', 'ULAP_FIELD_SALES', 'ULAP_BDE'].includes(sourceType)) {
      const { data: employee } = await supabase
        .from('employees')
        .select('id, full_name, employee_code')
        .eq('user_id', user.id)
        .maybeSingle()

      if (employee) {
        leadGeneratorName = employee.full_name
      }
    }

    // For customer sources, get customer details
    if (sourceType === 'ULAP_CUSTOMER' || sourceType === 'ULAP_CUSTOMER_REFERRAL') {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, full_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (customer) {
        leadGeneratorName = customer.full_name
      }
    }

    // Generate short code and trace token
    const shortCode = generateShortCode()
    const traceToken = body.trace_token || generateTraceToken()

    // Generate shareable link for Phase 2
    const shareableLink = `${BASE_URL}/apply/${shortCode}`

    // Prepare lead data
    const leadData: Record<string, unknown> = {
      // Source Attribution
      source_type: sourceType,
      lead_generator_id: user.id,
      lead_generator_name: leadGeneratorName,
      lead_generator_role: leadGeneratorRole,
      source_partner_id: partnerId,
      source_partner_code: partnerCode,
      source_partner_name: partnerName,
      trace_token: traceToken,

      // Customer Information
      customer_name: body.customer_name,
      customer_mobile: body.customer_mobile,
      customer_email: body.customer_email || null,
      customer_city: body.customer_city || null,
      customer_state: body.customer_state || null,
      customer_pincode: body.customer_pincode || null,

      // Loan Details
      loan_type: body.loan_type || null,
      // Note: loan_category_id and loan_subcategory_id are added below after UUID validation
      loan_amount: body.required_loan_amount || null,

      // Form/Phase Tracking
      form_status: 'PHASE_1_SUBMITTED',
      application_phase: 1,
      form_completion_percentage: 30,
      phase_1_submitted_at: new Date().toISOString(),

      // Link Tracking
      short_link: shareableLink,
      short_code: shortCode,

      // Lead Status
      lead_status: 'PHASE_1_SUBMITTED',
      lead_priority: 'MEDIUM',
      lead_score: 50,
      lead_quality: 'WARM',

      // Dynamic Fields
      phase_1_data: {
        submitted_at: new Date().toISOString(),
        source_type: sourceType,
        ...body.collected_data,
      },
      collected_data: body.collected_data || {},

      // Timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    }

    // ========================================
    // UUID VALIDATION FOR CATEGORY/SUBCATEGORY IDs
    // ========================================
    // CRITICAL FIX: The fallback data uses string codes like 'cat-personal' instead of UUIDs.
    // We must validate and handle these to prevent database UUID errors.
    // The database columns loan_category_id and loan_subcategory_id are UUID type.

    // Handle loan_category_id: only set if it's a valid UUID
    if (body.loan_category_id) {
      if (isValidUUID(body.loan_category_id)) {
        leadData.loan_category_id = body.loan_category_id
      } else {
        // Store the invalid ID as a code for reference
        leadData.loan_category_code = String(body.loan_category_id)
        // Explicitly set to null to prevent UUID type error
        leadData.loan_category_id = null
      }
    }

    // Handle loan_subcategory_id: only set if it's a valid UUID
    if (body.loan_subcategory_id) {
      if (isValidUUID(body.loan_subcategory_id)) {
        leadData.loan_subcategory_id = body.loan_subcategory_id
      } else {
        // Store the invalid ID as a code for reference
        leadData.loan_subcategory_code = String(body.loan_subcategory_id)
        // Explicitly set to null to prevent UUID type error
        leadData.loan_subcategory_id = null
      }
    }

    // Safety net: Double-check UUID fields before insert
    if (leadData.loan_category_id && !isValidUUID(leadData.loan_category_id)) {
      leadData.loan_category_id = null
    }
    if (leadData.loan_subcategory_id && !isValidUUID(leadData.loan_subcategory_id)) {
      leadData.loan_subcategory_id = null
    }

    // Insert into the unified `leads` table
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert([leadData])
      .select('id, lead_number')
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error inserting lead', insertError)

      // Handle duplicate error
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A lead with this information already exists' },
          { status: 409 }
        )
      }

      // Handle RLS policy violation
      if (insertError.code === '42501' || insertError.message?.includes('policy')) {
        return NextResponse.json(
          { success: false, error: 'Permission denied. Please ensure you are logged in correctly.' },
          { status: 403 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to submit lead. Please try again.' },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      lead_id: lead.id,
      lead_number: lead.lead_number,
      phase2_url: shareableLink,
      message: 'Lead submitted successfully!',
    })
  } catch (error) {
    apiLogger.error('Error in ULAP module submit API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
