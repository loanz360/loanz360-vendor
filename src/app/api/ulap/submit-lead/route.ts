/**
 * API Route: ULAP Lead Submission
 * POST /api/ulap/submit-lead - Submit a new lead to the unified CRM pipeline
 *
 * This endpoint receives leads from multiple sources:
 * - BA Portal (Business Associates)
 * - BP Portal (Banking Partners)
 * - Employee Portal (Telecallers, DSE, Field Sales)
 * - Customer Referral
 * - Self Application (Public Form)
 *
 * All leads are stored in the unified `leads` table (single table architecture)
 *
 * After Phase 1 submission, a shareable link is generated for Phase 2 completion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptLeadPII } from '@/lib/security/encryption-pii';
import { notifyLeadCreated } from '@/lib/notifications/ulap-lead-notifications';
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit';
import crypto from 'crypto';
import { apiLogger } from '@/lib/utils/logger'

// Base URL for generating shareable links
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com';

// Generate short code for link
function generateShortCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

// Generate trace token
function generateTraceToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Check if a value is a valid UUID
function isValidUUID(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value);
}

// Map frontend source type to database source_type
function mapSourceType(frontendSource: string, partnerType: string): string {
  // Map based on source and partner type
  if (frontendSource === 'ULAP_PARTNER_LINK') {
    if (partnerType === 'BP') return 'ULAP_BP';
    return 'ULAP_BA';
  }
  if (frontendSource === 'ULAP_EMPLOYEE' || frontendSource === 'EMPLOYEE') return 'ULAP_EMPLOYEE';
  if (frontendSource === 'ULAP_CUSTOMER_REFERRAL') return 'ULAP_CUSTOMER_REFERRAL';
  if (frontendSource === 'ULAP_PUBLIC_FORM') return 'ULAP_PUBLIC';

  // Default mappings
  return 'ULAP_BA';
}

// Check if source is employee-based
function isEmployeeSource(sourceType: string): boolean {
  return sourceType === 'EMPLOYEE' || sourceType === 'ULAP_EMPLOYEE';
}

// POST - Submit a new lead
export async function POST(request: NextRequest) {
  try {
    // H1 FIX: Add rate limiting to prevent abuse
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE || RATE_LIMIT_CONFIGS.DEFAULT);
    if (rateLimitResponse) return rateLimitResponse;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Required fields validation
    if (!body.customer_name || !body.customer_mobile) {
      return NextResponse.json(
        { success: false, error: 'Customer name and mobile are required' },
        { status: 400 }
      );
    }

    // Validate mobile number format
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(body.customer_mobile)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Determine if this is an employee submission
    const isEmployee = isEmployeeSource(body.source_type || body.form_source || '');

    let partnerId: string | null = null;
    let partnerCode: string | null = null;
    let displayName = body.source_name || body.partner_name || 'Unknown';
    let generatorRole = 'EMPLOYEE';

    if (isEmployee) {
      // Employee submission - no partner lookup needed
      // Try to get employee info from employee_profile
      const { data: employee } = await supabase
        .from('employee_profile')
        .select('id, employee_id, first_name, last_name, subrole')
        .eq('user_id', user.id)
        .maybeSingle();

      if (employee) {
        displayName = body.source_name || `${employee.first_name} ${employee.last_name}` || user.email || 'Employee';
        partnerCode = employee.employee_id;
        generatorRole = employee.subrole || 'EMPLOYEE';
      } else {
        displayName = body.source_name || user.email || 'Employee';
      }
    } else {
      // Partner submission - lookup partner record
      const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select('id, partner_id, full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (partnerError || !partner) {
        apiLogger.error('Partner lookup error', partnerError);
        return NextResponse.json(
          { success: false, error: 'Partner profile not found. Please contact support.' },
          { status: 403 }
        );
      }

      partnerId = partner.id;
      partnerCode = partner.partner_id;
      displayName = body.partner_name || partner.full_name || 'Partner';
      generatorRole = body.source_partner_type === 'BP' ? 'BUSINESS_PARTNER' : 'BUSINESS_ASSOCIATE';
    }

    // Generate short code and trace token
    const shortCode = generateShortCode();
    const traceToken = generateTraceToken();

    // Generate shareable link for Phase 2
    const shareableLink = `${BASE_URL}/apply/${shortCode}`;

    // Calculate link expiry (15 days from now)
    const linkExpiryDate = new Date();
    linkExpiryDate.setDate(linkExpiryDate.getDate() + 15);

    // Determine source type based on form_source and partner type
    const sourceType = mapSourceType(
      body.form_source || 'ULAP_PARTNER_LINK',
      body.source_partner_type || 'BA'
    );

    // Build phase_1_data with ALL fields from the request body
    // This allows dynamic fields from Form Builder to be saved regardless of configuration
    // The Form Builder can add/remove/modify basic lead fields - all are captured here
    const phase1Data: Record<string, unknown> = {
      submitted_at: new Date().toISOString(),
      form_source: body.form_source || 'ULAP_PARTNER_LINK',
      source_partner_type: body.source_partner_type || null,
    };

    // Dynamically capture ALL fields from body (except internal/system fields)
    // This ensures any field added via Form Builder is automatically saved
    const systemFields = new Set([
      'form_source', 'source_partner_type', 'partner_name', 'collected_data',
    ]);

    for (const [key, value] of Object.entries(body)) {
      if (!systemFields.has(key) && value !== undefined) {
        phase1Data[key] = value;
      }
    }

    // ========================================
    // DYNAMIC FIELD MAPPING
    // ========================================
    // Map Form Builder field_keys to CRM table columns
    // Fields not in this map are stored in phase_1_data JSONB
    const fieldToCrmColumn: Record<string, string> = {
      // Customer fields
      customer_name: 'customer_name',
      customer_mobile: 'customer_mobile',
      customer_email: 'customer_email',
      customer_city: 'customer_city',
      customer_state: 'customer_state',
      customer_pincode: 'customer_pincode',
      customer_pan: 'customer_pan',
      customer_dob: 'customer_dob',
      customer_address: 'customer_address',
      customer_gender: 'customer_gender',
      customer_marital_status: 'customer_marital_status',
      // Employment type maps to customer_subrole
      employment_type: 'customer_subrole',
      // Income fields
      monthly_income: 'monthly_income',
      annual_income: 'annual_income',
      other_income: 'other_income',
      // Loan fields
      loan_amount: 'loan_amount',
      loan_purpose: 'loan_purpose',
      loan_tenure_months: 'loan_tenure_months',
      loan_type: 'loan_type',
      loan_category_id: 'loan_category_id',
      loan_category_code: 'loan_category_code',
      loan_subcategory_id: 'loan_subcategory_id',
      loan_subcategory_code: 'loan_subcategory_code',
      // Co-applicant fields
      has_co_applicant: 'has_co_applicant',
      co_applicant_name: 'co_applicant_name',
      co_applicant_mobile: 'co_applicant_mobile',
      co_applicant_email: 'co_applicant_email',
      co_applicant_relationship: 'co_applicant_relationship',
    };

    // Prepare lead data for insertion into the new `leads` table
    const leadData: Record<string, unknown> = {
      // ========================================
      // SOURCE ATTRIBUTION (always set)
      // ========================================
      source_type: sourceType,
      lead_generator_id: user.id,
      lead_generator_name: displayName,
      lead_generator_role: generatorRole,
      source_partner_id: partnerId,
      source_partner_code: partnerCode,
      source_partner_name: displayName,
      trace_token: traceToken,

      // ========================================
      // REQUIRED FIELDS (always set)
      // ========================================
      customer_name: body.customer_name,
      customer_mobile: body.customer_mobile,

      // ========================================
      // FORM/PHASE TRACKING
      // ========================================
      form_status: 'PHASE_1_SUBMITTED',
      application_phase: 1,
      form_completion_percentage: 30,
      phase_1_submitted_at: new Date().toISOString(),

      // ========================================
      // LINK TRACKING (ULAP)
      // ========================================
      short_link: shareableLink,
      short_code: shortCode,

      // ========================================
      // CAM TRACKING
      // ========================================
      cam_required: false,
      cam_status: 'NOT_REQUIRED',

      // ========================================
      // LEAD STATUS & QUALITY
      // ========================================
      lead_status: 'PHASE_1_SUBMITTED',
      lead_priority: 'MEDIUM',
      lead_score: 50,
      lead_quality: 'WARM',

      // ========================================
      // TIMESTAMPS
      // ========================================
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };

    // Dynamically map form fields to CRM columns
    // Any field in fieldToCrmColumn mapping gets set on the lead record
    for (const [formField, crmColumn] of Object.entries(fieldToCrmColumn)) {
      if (body[formField] !== undefined && body[formField] !== null && body[formField] !== '') {
        leadData[crmColumn] = body[formField];
      }
    }

    // ========================================
    // UUID VALIDATION FOR CATEGORY/SUBCATEGORY IDs
    // ========================================
    // CRITICAL FIX: The fallback data uses string codes like 'cat-personal' instead of UUIDs.
    // We must validate and handle these to prevent database UUID errors.
    // The database columns loan_category_id and loan_subcategory_id are UUID type.

    // Handle loan_category_id: MUST be a valid UUID or null
    const rawCategoryId = leadData.loan_category_id;
    if (rawCategoryId !== undefined && rawCategoryId !== null) {
      if (!isValidUUID(rawCategoryId)) {
        // Not a valid UUID - store as code if no code is already set
        if (!leadData.loan_category_code) {
          leadData.loan_category_code = String(rawCategoryId);
        }
        // CRITICAL: Set to null to prevent UUID type error
        leadData.loan_category_id = null;
      }
    }

    // Handle loan_subcategory_id: MUST be a valid UUID or null
    const rawSubcategoryId = leadData.loan_subcategory_id;
    if (rawSubcategoryId !== undefined && rawSubcategoryId !== null) {
      if (!isValidUUID(rawSubcategoryId)) {
        // Not a valid UUID - store as code if no code is already set
        if (!leadData.loan_subcategory_code) {
          leadData.loan_subcategory_code = String(rawSubcategoryId);
        }
        // CRITICAL: Set to null to prevent UUID type error
        leadData.loan_subcategory_id = null;
      }
    }

    // Double-check: Ensure UUID fields are either valid UUIDs or explicitly null
    // This is a safety net in case any code path missed the validation above
    if (leadData.loan_category_id && !isValidUUID(leadData.loan_category_id)) {
      leadData.loan_category_id = null;
    }
    if (leadData.loan_subcategory_id && !isValidUUID(leadData.loan_subcategory_id)) {
      leadData.loan_subcategory_id = null;
    }

    // Store ALL phase 1 data in JSONB (including fields not in CRM columns)
    // This ensures no data is lost even if Form Builder adds new fields
    leadData.phase_1_data = phase1Data;
    leadData.collected_data = body.collected_data || {};

    // SECURITY: Encrypt PII fields before database insertion
    // Encrypts PAN, DOB, address, income, co-applicant details + stores hashes for lookups
    const encryptedLeadData = encryptLeadPII(leadData);

    // Insert into the unified `leads` table
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert([encryptedLeadData])
      .select('id, lead_number')
      .maybeSingle();

    if (insertError) {
      apiLogger.error('Error inserting lead', insertError);
      apiLogger.error('Insert error details', {
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });

      // Check if it's a duplicate error
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A lead with this information already exists' },
          { status: 409 }
        );
      }

      // Check for missing column errors and provide helpful message
      if (insertError.code === 'PGRST204' || insertError.message?.includes('column')) {
        apiLogger.error('Database schema mismatch. Required migration 016_unified_leads_single_table.sql may not be applied.');
        return NextResponse.json(
          { success: false, error: 'Database configuration error. Please contact support.' },
          { status: 500 }
        );
      }

      // Check for RLS policy violation
      if (insertError.code === '42501' || insertError.message?.includes('policy')) {
        apiLogger.error('RLS policy violation - user may not have permission to insert leads');
        return NextResponse.json(
          { success: false, error: 'Permission denied. Please ensure you are logged in correctly.' },
          { status: 403 }
        );
      }

      // Check for constraint violation
      if (insertError.code === '23514') {
        apiLogger.error('Check constraint violation', insertError.message);
        return NextResponse.json(
          { success: false, error: 'Invalid data provided. Please check all fields.' },
          { status: 400 }
        );
      }

      // M17 FIX: Don't leak DB error details to client
      return NextResponse.json(
        { success: false, error: 'Failed to submit lead. Please try again or contact support.' },
        { status: 500 }
      );
    }

    // Safety check — lead should always be returned after successful insert
    if (!lead) {
      apiLogger.error('Lead insert returned null despite no error');
      return NextResponse.json(
        { success: false, error: 'Lead creation failed. Please try again.' },
        { status: 500 }
      );
    }

    // Send lead created notifications (non-blocking)
    notifyLeadCreated(
      lead.id,
      lead.lead_number || lead.id,
      body.customer_name,
      body.customer_mobile,
      body.customer_email || undefined,
      body.loan_type || 'Not Specified',
      body.loan_amount || body.required_loan_amount || 0,
      body.partner_id || undefined
    ).catch(error => {
      apiLogger.error('Failed to send lead created notification', error);
    });

    // Return success response with shareable link
    return NextResponse.json({
      success: true,
      data: {
        id: lead.id,
        lead_id: lead.lead_number, // Generated by trigger
        lead_number: lead.lead_number,
        customer_name: body.customer_name,
        loan_type: body.loan_type,
        status: 'PHASE_1_SUBMITTED',
        form_status: 'PHASE_1_SUBMITTED',
        shareable_link: shareableLink,
        short_code: shortCode,
        link_expires_at: linkExpiryDate.toISOString(),
      },
      message: 'Lead submitted successfully. Share the link with your customer to complete the application.',
    });
  } catch (error) {
    apiLogger.error('Error in ULAP submit-lead API', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
