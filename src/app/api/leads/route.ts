import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

export const dynamic = 'force-dynamic'

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Valid sort columns whitelist
const VALID_SORT_COLUMNS = ['created_at', 'updated_at', 'loan_amount', 'customer_name', 'status', 'priority']

// Allowed update fields for bulk PUT
const ALLOWED_BULK_UPDATE_FIELDS = ['status', 'priority', 'assigned_cro_id', 'assigned_bde_id']

// Roles that can access the leads management API
const AUTHORIZED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'EMPLOYEE']
const AUTHORIZED_SUB_ROLES = [
  'DIRECT_SALES_EXECUTIVE', 'DIRECT_SALES_MANAGER', 'CRO',
  'TELECALLER', 'DIGITAL_SALES', 'BUSINESS_DEVELOPMENT_EXECUTIVE',
  'BUSINESS_DEVELOPMENT_MANAGER', 'FIELD_SALES',
]

/**
 * Verify the user has a role authorized to manage leads
 */
async function verifyLeadsAccess(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, userId: string) {
  const { data: profile } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return false

  // Super Admin and Admin always have access
  if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') return true

  // Employees must have an authorized sub_role
  if (profile.role === 'EMPLOYEE' && AUTHORIZED_SUB_ROLES.includes(profile.sub_role)) return true

  return false
}

// GET - Fetch leads with filters
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // C6 FIX: Authorization check
    const hasAccess = await verifyLeadsAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied. Insufficient permissions.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '25') || 25), 100)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const source = searchParams.get('source')
    const loanType = searchParams.get('loanType') || searchParams.get('loan_type')
    const assignedTo = searchParams.get('assignedTo') || searchParams.get('assigned_to')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build query
    let query = supabase
      .from('leads')
      .select('id, lead_number, customer_name, customer_email, customer_mobile, loan_type, loan_amount, status, priority, source, assigned_cro_id, assigned_bde_id, created_at, updated_at', { count: 'exact' })

    // Apply filters
    if (status && status !== 'all' && status !== 'ALL') {
      if (status === 'ACTIVE') {
        query = query.not('status', 'in', '("CLOSED","REJECTED","CANCELLED","COMPLETED")')
      } else if (status === 'CLOSED') {
        query = query.in('status', ['CLOSED', 'REJECTED', 'CANCELLED', 'COMPLETED'])
      } else {
        query = query.eq('status', status)
      }
    }
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority)
    }
    if (source && source !== 'all') {
      query = query.eq('source', source)
    }
    if (loanType && loanType !== 'all') {
      query = query.eq('loan_type', loanType)
    }
    if (assignedTo) {
      // Validate UUID format
      if (!UUID_REGEX.test(assignedTo)) {
        return NextResponse.json({ success: false, error: 'Invalid assignedTo ID format' }, { status: 400 })
      }
      query = query.eq('assigned_cro_id', assignedTo)
    }

    // C5 FIX: Sanitize search input
    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`customer_name.ilike.%${safeSearch}%,customer_email.ilike.%${safeSearch}%,customer_mobile.ilike.%${safeSearch}%,lead_number.ilike.%${safeSearch}%`)
      }
    }

    // Sort with validated column
    const sortColumn = VALID_SORT_COLUMNS.includes(sortBy) ? sortBy : 'created_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: leads, count, error } = await query

    if (error) {
      apiLogger.error('Error querying leads', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 })
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: {
        leads: leads || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching leads', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new lead
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE || RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization check
    const hasAccess = await verifyLeadsAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const requiredFields = ['customer_name', 'customer_mobile', 'loan_type', 'loan_amount']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate assigned IDs are valid UUIDs if provided
    if (body.assigned_cro_id && typeof body.assigned_cro_id === 'string' && !UUID_REGEX.test(body.assigned_cro_id)) {
      return NextResponse.json({ success: false, error: 'Invalid assigned_cro_id format' }, { status: 400 })
    }
    if (body.assigned_bde_id && typeof body.assigned_bde_id === 'string' && !UUID_REGEX.test(body.assigned_bde_id)) {
      return NextResponse.json({ success: false, error: 'Invalid assigned_bde_id format' }, { status: 400 })
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        customer_name: body.customer_name,
        customer_email: body.customer_email || null,
        customer_mobile: body.customer_mobile,
        loan_type: body.loan_type,
        loan_amount: body.loan_amount,
        source: body.source || 'WEBSITE',
        status: 'NEW',
        priority: body.priority || 'MEDIUM',
        assigned_cro_id: body.assigned_cro_id || null,
        assigned_bde_id: body.assigned_bde_id || null,
        created_by: user.id,
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating lead', error)
      return NextResponse.json({ success: false, error: 'Failed to create lead' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: lead,
      message: 'Lead created successfully'
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error creating lead', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Bulk update leads (with field whitelist)
export async function PUT(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE || RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization check
    const hasAccess = await verifyLeadsAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const { leadIds, updates } = body as { leadIds?: unknown[]; updates?: Record<string, unknown> }

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No lead IDs provided' },
        { status: 400 }
      )
    }

    // Validate all IDs are UUIDs
    for (const id of leadIds) {
      if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
        return NextResponse.json(
          { success: false, error: 'Invalid lead ID format. All IDs must be valid UUIDs.' },
          { status: 400 }
        )
      }
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    // C7 FIX: Only allow whitelisted fields
    const sanitizedUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_BULK_UPDATE_FIELDS.includes(key)) {
        // Validate UUID fields
        if ((key === 'assigned_cro_id' || key === 'assigned_bde_id') && value && typeof value === 'string') {
          if (!UUID_REGEX.test(value)) {
            return NextResponse.json(
              { success: false, error: `Invalid ${key} format` },
              { status: 400 }
            )
          }
        }
        sanitizedUpdates[key] = value
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: `No valid update fields provided. Allowed: ${ALLOWED_BULK_UPDATE_FIELDS.join(', ')}` },
        { status: 400 }
      )
    }

    sanitizedUpdates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('leads')
      .update(sanitizedUpdates)
      .in('id', leadIds as string[])

    if (error) {
      apiLogger.error('Error updating leads', error)
      return NextResponse.json({ success: false, error: 'Failed to update leads' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${leadIds.length} leads updated successfully`,
      data: { updatedCount: leadIds.length }
    })
  } catch (error) {
    apiLogger.error('Error updating leads', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Bulk delete leads (soft delete)
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE || RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization check
    const hasAccess = await verifyLeadsAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')

    if (!ids) {
      return NextResponse.json(
        { success: false, error: 'No lead IDs provided' },
        { status: 400 }
      )
    }

    const leadIds = ids.split(',').filter(Boolean)

    // Validate all IDs are UUIDs
    for (const id of leadIds) {
      if (!UUID_REGEX.test(id)) {
        return NextResponse.json(
          { success: false, error: `Invalid lead ID format: ${id.substring(0, 8)}...` },
          { status: 400 }
        )
      }
    }

    // Soft delete using both patterns for consistency
    const { error } = await supabase
      .from('leads')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .in('id', leadIds)

    if (error) {
      apiLogger.error('Error deleting leads', error)
      return NextResponse.json({ success: false, error: 'Failed to delete leads' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${leadIds.length} leads deleted successfully`,
      data: { deletedCount: leadIds.length }
    })
  } catch (error) {
    apiLogger.error('Error deleting leads', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
