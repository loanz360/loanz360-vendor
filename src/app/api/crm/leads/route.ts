import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'
import { LEAD_SORT_WHITELIST, isValidSortColumn, LEAD_FIELD_MAPPING } from '@/lib/constants/sales-pipeline'


// GET /api/crm/leads - List leads with search, filter, and pagination
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR cannot access individual leads - redirect to statistics endpoint
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const loanType = searchParams.get('loan_type') || ''
    const assignedTo = searchParams.get('assigned_to') || ''
    const fromDate = searchParams.get('from_date') || ''
    const toDate = searchParams.get('to_date') || ''
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const tags = searchParams.get('tags') || ''
    const minScore = searchParams.get('min_score') || ''
    const maxScore = searchParams.get('max_score') || ''

    const offset = (page - 1) * limit

    // Build query based on role
    let query = supabase
      .from('crm_leads')
      .select('*', { count: 'exact' })
      .is('deleted_at', null) // Exclude soft-deleted leads

    // Role-based filtering: CROs see only their assigned leads
    if (profile.subrole === 'cro') {
      query = query.eq('cro_id', user.id)
    }
    // Super Admin sees all leads (no additional filter)

    // Apply search filter with SQL injection prevention
    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`customer_name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`)
      }
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status)
    }

    // Apply loan type filter
    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    // Apply assigned to filter (for Super Admin only)
    if (assignedTo && profile.role === 'superadmin') {
      query = query.eq('cro_id', assignedTo)
    }

    // Apply date range filters
    if (fromDate) {
      query = query.gte('created_at', fromDate)
    }
    if (toDate) {
      query = query.lte('created_at', toDate)
    }

    // Apply sorting (validate against whitelist to prevent injection)
    const safeSortBy = isValidSortColumn(sortBy, LEAD_SORT_WHITELIST) ? sortBy : 'created_at'
    query = query.order(safeSortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: leads, error: leadsError, count } = await query

    if (leadsError) {
      apiLogger.error('Error fetching leads', leadsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/crm/leads', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/crm/leads - Create new lead
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR cannot access individual leads - redirect to statistics endpoint
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Only CRO and Super Admin can create leads
    if (profile.subrole !== 'cro' && profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()

    // Comprehensive validation of required fields
    if (!body.customer_name || typeof body.customer_name !== 'string' || body.customer_name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Customer name is required and must be a non-empty string'
      }, { status: 400 })
    }

    if (!body.customer_mobile || typeof body.customer_mobile !== 'string' || body.customer_mobile.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Customer mobile is required and must be a non-empty string'
      }, { status: 400 })
    }

    // Validate mobile number format (Indian: 10 digits starting with 6-9)
    const mobileRegex = /^[6-9]\d{9}$/
    if (!mobileRegex.test(body.customer_mobile.trim())) {
      return NextResponse.json({ success: false, error: 'Invalid mobile number format. Must be 10 digits starting with 6-9'
      }, { status: 400 })
    }

    if (!body.loan_type || typeof body.loan_type !== 'string' || body.loan_type.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Loan type is required and must be a non-empty string'
      }, { status: 400 })
    }

    // Validate email format if provided
    if (body.customer_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.customer_email)) {
        return NextResponse.json({ success: false, error: 'Invalid email format'
        }, { status: 400 })
      }
    }

    // Validate pincode format if provided (Indian: 6 digits)
    if (body.customer_pincode) {
      const pincodeRegex = /^\d{6}$/
      if (!pincodeRegex.test(body.customer_pincode)) {
        return NextResponse.json({ success: false, error: 'Invalid pincode format. Must be 6 digits'
        }, { status: 400 })
      }
    }

    // Validate string lengths to prevent database errors
    if (body.customer_name.trim().length > 255) {
      return NextResponse.json({ success: false, error: 'Customer name must be less than 255 characters'
      }, { status: 400 })
    }

    // Check for duplicates (Internal Flow: Keep both + tag + link)
    let duplicateWarning = null
    if (!body.force_create) {
      const { data: duplicateCheck } = await supabase.rpc('find_duplicate_leads', {
        p_customer_name: body.customer_name,
        p_customer_mobile: body.customer_mobile,
        p_customer_email: body.customer_email || null,
        p_loan_type: body.loan_type,
        p_exclude_system: null,
        p_exclude_lead_id: null
      })

      if (duplicateCheck && duplicateCheck.length > 0) {
        // Found duplicates - prepare for linking
        const duplicateLeadIds = duplicateCheck.map((dup: any) => dup.lead_identifier)
        const isDuplicate = true

        // Add DUPLICATE tag
        const leadTags = body.tags || []
        if (!leadTags.includes('DUPLICATE')) {
          leadTags.push('DUPLICATE')
        }
        body.tags = leadTags

        // Store duplicate IDs for linking
        body.duplicate_lead_ids = duplicateLeadIds

        // Prepare warning message
        duplicateWarning = {
          message: `This lead has ${duplicateCheck.length} potential duplicate(s)`,
          duplicate_count: duplicateCheck.length,
          duplicate_leads: duplicateLeadIds,
          duplicates: duplicateCheck.map((dup: any) => ({
            lead_id: dup.lead_identifier,
            system: dup.system_name,
            name: dup.customer_name,
            mobile: dup.customer_mobile,
            loan_type: dup.loan_type,
            confidence: dup.confidence_score
          })),
          action: 'Lead created and tagged as DUPLICATE. Both leads are kept for review.'
        }
      }
    }

    // Prepare lead data - mapped to crm_leads schema
    const leadData: any = {
      customer_name: body.customer_name,
      phone: body.customer_mobile || body.phone,
      alternate_phone: body.alternate_phone || null,
      email: body.customer_email || body.email || null,
      location: body.customer_city || body.location || null,
      loan_type: body.loan_type,
      loan_amount: body.loan_amount_required || body.loan_amount || null,
      loan_purpose: body.loan_purpose || null,
      business_name: body.business_name || body.company_name || null,
      business_type: body.business_type || null,
      monthly_income: body.monthly_income || null,
      source: body.lead_source || body.source || 'Manual Entry',
      status: (body.lead_status || body.status || 'active').toLowerCase(),
      stage: (body.stage || 'new').toLowerCase(),
      next_follow_up_date: body.next_followup_at || body.next_follow_up_date || null,
      follow_up_notes: body.remarks || body.follow_up_notes || null,
      notes: body.notes || null,
      // Only admins can assign to other CROs; CROs always use their own ID
      cro_id: (profile.role === 'superadmin' && (body.assigned_to || body.cro_id)) ? (body.assigned_to || body.cro_id) : user.id
    }

    // Create lead
    const { data: newLead, error: createError } = await supabase
      .from('crm_leads')
      .insert(leadData)
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating lead', createError)
      return NextResponse.json({ success: false, error: 'Failed to create lead' }, { status: 500 })
    }

    // If duplicates found, link back to original leads
    if (duplicateWarning && body.duplicate_lead_ids) {
      const duplicateCheck = duplicateWarning.duplicates
      for (const dup of duplicateCheck) {
        await supabase.rpc('add_duplicate_link', {
          p_lead_system: dup.system,
          p_lead_id: dup.lead_id,
          p_duplicate_lead_id: newLead.lead_id
        }).catch((err: any) => {
          apiLogger.error('Failed to link duplicate', err)
        })
      }
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: newLead.id,
      action: 'create',
      performed_by: user.id,
      changes: { new: newLead }
    })

    // Create initial follow-up if scheduled
    if (body.next_followup_at) {
      await supabase.from('crm_followups').insert({
        lead_id: newLead.id,
        scheduled_at: body.next_followup_at,
        owner_id: user.id,
        created_by: user.id,
        title: body.followup_purpose || 'Initial Follow-up',
        reminder_enabled: true
      })
    }

    return NextResponse.json({
      success: true,
      data: newLead,
      warning: duplicateWarning  // Include duplicate warning if applicable
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/leads', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/crm/leads - Update lead (requires lead_id in body)
export async function PUT(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR cannot access individual leads - redirect to statistics endpoint
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const leadId = body.id

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 })
    }

    // Fetch existing lead
    const { data: existingLead, error: fetchError } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Check permissions: CRO can only update their assigned leads
    if (profile.subrole === 'cro' && existingLead.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only update your assigned or created leads' }, { status: 403 })
    }

    // Prepare update data (only include fields that are provided)
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Use shared field mapping from constants, plus extra legacy mappings
    const extendedFieldMapping: Record<string, string> = {
      ...LEAD_FIELD_MAPPING,
      'customer_email': 'email',
      'customer_city': 'location',
      'loan_amount_required': 'loan_amount',
      'company_name': 'business_name',
      'lead_status': 'status',
      'next_followup_at': 'next_follow_up_date',
      'next_follow_up_date': 'next_follow_up_date',
      'follow_up_notes': 'follow_up_notes',
      'alternate_phone': 'alternate_phone',
      'location': 'location',
      'business_type': 'business_type',
      'source': 'source',
    }

    // CROs cannot reassign leads via PUT; only superadmin can
    const disallowedForCRO = ['cro_id', 'assigned_to']

    for (const [inputField, dbColumn] of Object.entries(extendedFieldMapping)) {
      if (body[inputField] !== undefined) {
        if (profile.subrole === 'cro' && disallowedForCRO.includes(inputField)) continue
        updateData[dbColumn] = body[inputField]
      }
    }

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('crm_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating lead', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: updatedLead.id,
      action: 'update',
      performed_by: user.id,
      changes: {
        old: existingLead,
        new: updatedLead
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedLead
    })

  } catch (error) {
    apiLogger.error('Unexpected error in PUT /api/crm/leads', error)
    logApiError(error as Error, request, { action: 'update' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/crm/leads - Soft delete lead (requires lead_id in query)
export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR cannot access individual leads - redirect to statistics endpoint
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse query parameters
    const leadId = request.nextUrl.searchParams.get('id')

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 })
    }

    // Fetch existing lead
    const { data: existingLead, error: fetchError } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Only Super Admin can delete leads
    if (profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Only Super Admin can delete leads' }, { status: 403 })
    }

    // Soft delete lead
    const { data: deletedLead, error: deleteError } = await supabase
      .from('crm_leads')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', leadId)
      .select()
      .maybeSingle()

    if (deleteError) {
      apiLogger.error('Error deleting lead', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: deletedLead.id,
      action: 'delete',
      performed_by: user.id,
      changes: { deleted: existingLead }
    })

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Unexpected error in DELETE /api/crm/leads', error)
    logApiError(error as Error, request, { action: 'delete' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
