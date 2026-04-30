/**
 * CRO Leads API
 *
 * Enterprise-grade API for lead management
 * Features:
 * - RBAC authentication
 * - Input validation with Zod
 * - Pagination
 * - Audit logging
 * - Soft deletes
 * - Rate limiting
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { maskDataForRole } from '@/lib/utils/data-masking'
import {
  verifyCROAuth,
  validateRequestBody,
  validateQueryParams,
  createSuccessResponse,
  createPaginatedResponse,
  createErrorResponse,
  logAuditTrail,
  extractClientInfo,
} from '@/lib/api/ai-crm-middleware'
import {
  createLeadSchema,
  leadsQuerySchema,
  type CreateLeadInput,
  type LeadsQueryInput,
} from '@/lib/validations/ai-crm-schemas'
import { sanitizeSearchForPostgrest } from '@/lib/constants/sales-pipeline'


// =============================================================================
// POST - Create new lead
// =============================================================================

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // Validate request body
    const validationResult = await validateRequestBody<CreateLeadInput>(
      request,
      createLeadSchema,
      requestId
    )
    if (!validationResult.success) {
      return validationResult.response
    }

    const leadData = validationResult.data

    // Check for duplicate lead (same phone in last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: existingLead } = await supabase
      .from('crm_leads')
      .select('id, customer_name, created_at')
      .eq('cro_id', user.id)
      .eq('phone', leadData.phone)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .is('deleted_at', null)
      .maybeSingle()

    if (existingLead) {
      return createErrorResponse(
        `A lead with this phone number was already created on ${new Date(existingLead.created_at).toLocaleDateString()}`,
        409,
        requestId,
        { existingLeadId: existingLead.id }
      )
    }

    // Verify contact ownership if contactId or positiveContactId provided
    const sourceContactId = leadData.contactId || leadData.positiveContactId
    if (sourceContactId) {
      // Check positive_contacts ownership
      if (leadData.positiveContactId) {
        const { data: contact } = await supabase
          .from('positive_contacts')
          .select('id')
          .eq('id', leadData.positiveContactId)
          .eq('cro_id', user.id)
          .maybeSingle()
        if (!contact) {
          return createErrorResponse(
            'Contact not found or does not belong to you',
            403,
            requestId
          )
        }
      }
      // Check master_contacts ownership
      if (leadData.contactId) {
        const { data: contact } = await supabase
          .from('master_contacts')
          .select('id')
          .eq('id', leadData.contactId)
          .eq('cro_id', user.id)
          .maybeSingle()
        if (!contact) {
          return createErrorResponse(
            'Contact not found or does not belong to you',
            403,
            requestId
          )
        }
      }
    }

    // Create lead with all validated data
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .insert({
        master_contact_id: leadData.contactId || leadData.positiveContactId || null,
        cro_id: user.id,
        customer_name: leadData.name,
        phone: leadData.phone,
        email: leadData.email || null,
        alternate_phone: leadData.alternate_phone || null,
        location: leadData.location,
        loan_type: leadData.loan_type,
        loan_amount: leadData.loan_amount,
        loan_purpose: leadData.purpose,
        business_name: leadData.company_name || null,
        business_type: leadData.business_type || null,
        monthly_income: leadData.monthly_income,
        notes_timeline: leadData.notes
          ? [
              {
                id: crypto.randomUUID(),
                type: 'manual_note',
                content: leadData.notes,
                created_by: user.id,
                created_by_name: user.email,
                created_at: new Date().toISOString(),
              },
            ]
          : [],
        source: leadData.source,
        status: 'active',
        stage: 'new',
        documents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        id,
        customer_name,
        phone,
        email,
        location,
        loan_type,
        loan_amount,
        loan_purpose,
        business_name,
        business_type,
        monthly_income,
        status,
        stage,
        source,
        created_at
      `)
      .maybeSingle()

    if (leadError) {
      logApiError(leadError as Error, request, { action: 'create_lead', requestId })
      return createErrorResponse(
        'Failed to create lead',
        500,
        requestId,
        { code: 'DB_ERROR' }
      )
    }

    // Update source contact status if converting from positive contact
    if (leadData.positiveContactId) {
      await supabase
        .from('positive_contacts')
        .update({
          status: 'converted_to_lead',
          converted_at: new Date().toISOString(),
          converted_lead_id: lead.id,
        })
        .eq('id', leadData.positiveContactId)
        .eq('cro_id', user.id)
    }

    // Log audit trail
    const clientInfo = extractClientInfo(request)
    await logAuditTrail(supabase, {
      userId: user.id,
      action: 'create_lead',
      entityType: 'crm_leads',
      entityId: lead.id,
      newValues: lead,
      metadata: {
        source: leadData.source,
        sourceContactId: leadData.contactId || leadData.positiveContactId,
      },
      ...clientInfo,
    })

    return createSuccessResponse(
      {
        ...lead,
        message: 'Lead created successfully',
      },
      requestId
    )
  } catch (error) {
    logApiError(error as Error, request, { action: 'create_lead', requestId })
    return createErrorResponse(
      'Internal server error',
      500,
      requestId,
      { code: 'INTERNAL_ERROR' }
    )
  }
}

// =============================================================================
// GET - List leads with pagination and filtering
// =============================================================================

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // Validate query parameters
    const queryResult = validateQueryParams<LeadsQueryInput>(
      request,
      leadsQuerySchema,
      requestId
    )
    if (!queryResult.success) {
      return queryResult.response
    }

    const {
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      status,
      stage,
      loan_type,
      search,
      from_date,
      to_date,
      min_amount,
      max_amount,
    } = queryResult.data

    // Calculate offset
    const offset = (page - 1) * limit

    // Build query with specific columns (no SELECT *)
    let query = supabase
      .from('crm_leads')
      .select(
        `
        id,
        master_contact_id,
        customer_name,
        phone,
        email,
        alternate_phone,
        location,
        loan_type,
        loan_amount,
        loan_purpose,
        business_name,
        business_type,
        monthly_income,
        status,
        stage,
        next_follow_up_date,
        follow_up_notes,
        documents,
        notes_timeline,
        call_count,
        last_called_at,
        source,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('cro_id', user.id)
      .is('deleted_at', null)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (stage) {
      query = query.eq('stage', stage)
    }

    if (loan_type) {
      query = query.eq('loan_type', loan_type)
    }

    if (search) {
      // Sanitize search input to prevent PostgREST filter injection
      const safeSearch = sanitizeSearchForPostgrest(search)
      if (safeSearch) {
        query = query.or(
          `customer_name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,location.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`
        )
      }
    }

    if (from_date) {
      query = query.gte('created_at', from_date)
    }

    if (to_date) {
      query = query.lte('created_at', to_date)
    }

    if (min_amount) {
      query = query.gte('loan_amount', min_amount)
    }

    if (max_amount) {
      query = query.lte('loan_amount', max_amount)
    }

    // Apply sorting
    const validSortColumns = [
      'created_at',
      'updated_at',
      'loan_amount',
      'customer_name',
      'status',
      'stage',
      'next_follow_up_date',
    ]
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at'
    query = query.order(sortColumn, { ascending: sort_order === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: leads, error, count } = await query

    if (error) {
      logApiError(error as Error, request, { action: 'list_leads', requestId })
      return createErrorResponse(
        'Failed to fetch leads',
        500,
        requestId
      )
    }

    // Get summary stats using parallel count queries (avoids N+1 pattern)
    const baseQuery = () => supabase.from('crm_leads').select('id', { count: 'exact', head: true }).eq('cro_id', user.id).is('deleted_at', null)
    const [
      totalRes,
      activeRes, followUpRes, convertedRes, droppedRes,
      newRes, contactedRes, qualifiedRes, docsPendingRes, readyRes,
    ] = await Promise.all([
      baseQuery(),
      baseQuery().eq('status', 'active'),
      baseQuery().eq('status', 'follow_up'),
      baseQuery().eq('status', 'converted'),
      baseQuery().eq('status', 'dropped'),
      baseQuery().eq('stage', 'new'),
      baseQuery().eq('stage', 'contacted'),
      baseQuery().eq('stage', 'qualified'),
      baseQuery().eq('stage', 'docs_pending'),
      baseQuery().eq('stage', 'ready_to_convert'),
    ])

    const summary = {
      total: totalRes.count || 0,
      by_status: {
        active: activeRes.count || 0,
        follow_up: followUpRes.count || 0,
        converted: convertedRes.count || 0,
        dropped: droppedRes.count || 0,
      },
      by_stage: {
        new: newRes.count || 0,
        contacted: contactedRes.count || 0,
        qualified: qualifiedRes.count || 0,
        docs_pending: docsPendingRes.count || 0,
        ready_to_convert: readyRes.count || 0,
      },
    }

    // Mask PII based on user role
    const maskedLeads = maskDataForRole(
      (leads || []) as Record<string, unknown>[],
      user.role,
      user.sub_role
    )

    return NextResponse.json({
      success: true,
      data: maskedLeads,
      summary,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'list_leads', requestId })
    return createErrorResponse(
      'Internal server error',
      500,
      requestId
    )
  }
}
