import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createSuccessResponse,
  createErrorResponse,
  logAuditTrail,
  extractClientInfo,
} from '@/lib/api/ai-crm-middleware'
import { maskRecord, shouldMaskForRole } from '@/lib/utils/data-masking'


const LEAD_SELECT_COLUMNS = `
  id,
  master_contact_id,
  customer_name,
  phone,
  email,
  alternate_phone,
  location,
  city,
  state,
  loan_type,
  loan_amount,
  loan_purpose,
  business_name,
  business_type,
  monthly_income,
  employment_type,
  company_name,
  purpose,
  urgency,
  status,
  stage,
  source,
  call_count,
  last_called_at,
  next_follow_up_date,
  follow_up_notes,
  documents,
  notes_timeline,
  metadata,
  created_at,
  updated_at
`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const { id } = await params

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // Fetch lead with specific columns
    const { data: lead, error } = await supabase
      .from('crm_leads')
      .select(LEAD_SELECT_COLUMNS)
      .eq('id', id)
      .eq('cro_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      logApiError(error as Error, request, { action: 'get_lead', requestId })
      return createErrorResponse('Failed to fetch lead', 500, requestId)
    }

    if (!lead) {
      return createErrorResponse('Lead not found', 404, requestId)
    }

    // Mask PII based on user role
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || 'CRO'
    const maskedLead = maskRecord(lead as Record<string, unknown>, shouldMaskForRole(userRole))

    return createSuccessResponse(maskedLead, requestId)
  } catch (error) {
    logApiError(error as Error, request, { action: 'get_lead', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE || RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const { id } = await params

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    const body = await request.json()

    // Whitelist allowed update fields
    const allowedFields = [
      'metadata', 'stage', 'status', 'next_follow_up_date',
      'follow_up_notes', 'loan_type', 'loan_amount', 'loan_purpose',
      'location', 'business_name', 'business_type', 'monthly_income',
      'employment_type', 'urgency',
    ]

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from('crm_leads')
      .update(updateData)
      .eq('id', id)
      .eq('cro_id', user.id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error || !data) {
      return createErrorResponse('Lead not found or update failed', 404, requestId)
    }

    // Log audit trail
    const clientInfo = extractClientInfo(request)
    await logAuditTrail(supabase, {
      userId: user.id,
      action: 'update_lead',
      entityType: 'crm_leads',
      entityId: id,
      newValues: updateData,
      ...clientInfo,
    })

    return createSuccessResponse(data, requestId)
  } catch (error) {
    logApiError(error as Error, request, { action: 'update_lead', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
