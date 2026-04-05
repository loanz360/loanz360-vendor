/**
 * API Route: BA Leads Management
 * GET /api/partners/ba/leads - List all leads
 * POST /api/partners/ba/leads - Create a new lead manually
 *
 * Rate Limits:
 * - GET: 60 requests per minute (read operation)
 * - POST: 30 requests per minute (write operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type {
  GetLeadsResponse,
  CreateLeadRequest,
  CreateLeadResponse,
  LeadFilters,
} from '@/types/partner-leads'
import { triggerLeadCreated } from '@/lib/webhooks/trigger'
import { notifyLeadCreated } from '@/lib/notifications/ulap-lead-notifications'
import { apiLogger } from '@/lib/utils/logger'

const createLeadSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required').max(100),
  customer_mobile: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid mobile number'),
  customer_email: z.string().email('Invalid email').optional().or(z.literal('')),
  customer_city: z.string().max(100).optional(),
  loan_type: z.string().max(100).optional(),
  required_loan_amount: z.number().positive().optional(),
  lead_priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  remarks: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
})

export const dynamic = 'force-dynamic'

// ============================================================================
// GET - List all leads for Business Associate
// ============================================================================
export async function GET(request: NextRequest) {
  // Apply rate limiting (ADDED)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as GetLeadsResponse,
        { status: 401 }
      )
    }

    // 2. Get partner information
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' } as GetLeadsResponse,
        { status: 404 }
      )
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const formStatus = searchParams.get('form_status')
    const leadStatus = searchParams.get('lead_status')
    const search = searchParams.get('search')

    // 4. Build query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (formStatus) {
      query = query.eq('form_status', formStatus)
    }

    if (leadStatus) {
      query = query.eq('lead_status', leadStatus)
    }

    if (search) {
      // SQL injection prevention (FIXED)
      const sanitizedSearch = search.replace(/[%_'";\\]/g, '')
      query = query.or(
        `customer_name.ilike.%${sanitizedSearch}%,customer_mobile.ilike.%${sanitizedSearch}%,customer_email.ilike.%${sanitizedSearch}%,lead_id.ilike.%${sanitizedSearch}%`
      )
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    // 5. Execute query
    const { data: leads, error: leadsError, count } = await query

    if (leadsError) {
      apiLogger.error('Leads fetch error', leadsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leads' } as GetLeadsResponse,
        { status: 500 }
      )
    }

    // 6. Calculate pagination
    const totalPages = count ? Math.ceil(count / limit) : 0

    // 7. Return response
    return NextResponse.json({
      success: true,
      data: leads || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages,
      },
    } as GetLeadsResponse)
  } catch (error) {
    apiLogger.error('Get leads error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as GetLeadsResponse,
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Create a new lead manually (without link generation)
// ============================================================================
export async function POST(request: NextRequest) {
  // Apply rate limiting (ADDED)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as CreateLeadResponse,
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const rawBody = await request.json()
    const validation = createLeadSchema.safeParse(rawBody)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors } as CreateLeadResponse,
        { status: 400 }
      )
    }
    const {
      customer_name,
      customer_mobile,
      customer_email,
      customer_city,
      loan_type,
      required_loan_amount,
      lead_priority,
      remarks,
      tags,
    } = validation.data

    // 5. Get partner information
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' } as CreateLeadResponse,
        { status: 404 }
      )
    }

    // 6. Generate lead_id
    const { data: leadIdResult, error: leadIdError } = await supabase.rpc('generate_lead_id')

    if (leadIdError || !leadIdResult) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate lead ID' } as CreateLeadResponse,
        { status: 500 }
      )
    }

    const leadId = leadIdResult as string

    // 7. Normalize mobile number
    let normalizedMobile = customer_mobile.trim()
    if (!normalizedMobile.startsWith('+')) {
      normalizedMobile = '+91' + normalizedMobile.replace(/^0+/, '')
    }

    // 7.5. Check for blocking duplicates (Partner Flow: Block if same customer + same loan type)
    const { data: blockCheck, error: blockCheckError } = await supabase.rpc('check_partner_duplicate_blocking', {
      p_customer_mobile: normalizedMobile,
      p_customer_name: customer_name,
      p_loan_type: loan_type || null
    })

    // If duplicate check failed, log but don't block (fail-open for this check)
    if (blockCheckError) {
      apiLogger.error('Duplicate check error', blockCheckError)
    }

    // If lead is blocked due to duplicate
    if (blockCheck && blockCheck[0]?.is_blocked) {
      const blockInfo = blockCheck[0]
      return NextResponse.json({
        success: false,
        error: 'Duplicate lead detected',
        code: 'DUPLICATE_BLOCKED',
        message: blockInfo.block_reason,
        existing_lead: {
          lead_id: blockInfo.existing_lead_id,
          system: blockInfo.existing_system,
          loan_type: blockInfo.existing_loan_type
        },
        suggestion: 'You can create a lead for a different loan type or a different customer.'
      } as CreateLeadResponse, { status: 409 })
    }

    // 8. Create lead record (no duplicate tagging for partners - they're blocked if duplicate)
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        partner_id: partner.id,
        partner_type: 'BUSINESS_ASSOCIATE',
        lead_id: leadId,
        customer_name,
        customer_mobile: normalizedMobile,
        customer_email: customer_email || null,
        customer_city: customer_city || null,
        loan_type: loan_type || null,
        required_loan_amount: required_loan_amount || null,
        lead_status: 'NEW',
        lead_priority: lead_priority || 'MEDIUM',
        form_status: 'PENDING',
        remarks: remarks || null,
        tags: tags || null,
        trace_token: `MANUAL_${partner.partner_id}_${Date.now()}`, // Manual entry token
      })
      .select()
      .maybeSingle()

    if (leadError || !lead) {
      apiLogger.error('Lead creation error', leadError)
      return NextResponse.json(
        { success: false, error: 'Failed to create lead' } as CreateLeadResponse,
        { status: 500 }
      )
    }

    // 9. Trigger webhook for lead.created event (non-blocking)
    triggerLeadCreated(lead).catch(error => {
      apiLogger.error('Failed to trigger lead.created webhook', error)
    })

    // 9b. Send email/SMS/in-app notifications (non-blocking)
    notifyLeadCreated(
      lead.id,
      lead.lead_id || lead.id,
      customer_name,
      normalizedMobile,
      customer_email || undefined,
      loan_type || 'Not Specified',
      required_loan_amount || 0,
      partner.id
    ).catch(error => {
      apiLogger.error('Failed to send lead created notification', error)
    })

    // 10. Return response
    return NextResponse.json({
      success: true,
      data: lead as any,
    } as CreateLeadResponse)
  } catch (error) {
    apiLogger.error('Create lead error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as CreateLeadResponse,
      { status: 500 }
    )
  }
}
