
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { csrfProtection } from '@/lib/middleware/csrf'
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import { apiLogger } from '@/lib/utils/logger'

// Validation schemas
const bankSchema = z.object({
  name: z.string().min(2).max(255).trim()
    .regex(/^[A-Z0-9_]+$/, 'Name must be uppercase letters, numbers, and underscores only'),
  display_name: z.string().min(2).max(255).trim(),
  type: z.enum(['BANK', 'NBFC', 'FINTECH']),
  logo_url: z.string().url().optional().nullable(),
  website_url: z.string().url().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().max(20).optional().nullable(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0)
})

const updateBankSchema = bankSchema.partial().extend({
  id: z.string().uuid()
})

// Helper function to sanitize input
function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })
}

// GET - Fetch banks
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') === 'true'
  const type = searchParams.get('type') // 'BANK', 'NBFC', 'FINTECH'

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // For active banks only, use the optimized RPC function
    if (activeOnly && !type) {
      const { data, error } = await supabase.rpc('get_active_banks')
      if (error) throw error
      return NextResponse.json({ banks: data || [] })
    }

    // For more complex queries, use direct table access
    let query = supabase
      .from('banks')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (type) {
      query = query.eq('type', type)
    }

    const { data: banks, error } = await query

    if (error) throw error

    return NextResponse.json({ banks: banks || [] })
  } catch (error: unknown) {
    apiLogger.error('Error fetching banks', error)
    logApiError(error as Error, request, { action: 'get_banks' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new bank (Super Admin only)
export async function POST(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Validate with Zod
    const validatedData = bankSchema.parse(body)

    // Sanitize text inputs
    const sanitizedData = {
      name: validatedData.name, // No sanitization needed (already validated as uppercase)
      display_name: sanitizeInput(validatedData.display_name),
      type: validatedData.type,
      logo_url: validatedData.logo_url || null,
      website_url: validatedData.website_url || null,
      description: validatedData.description ? sanitizeInput(validatedData.description) : null,
      contact_email: validatedData.contact_email || null,
      contact_phone: validatedData.contact_phone || null,
      is_active: validatedData.is_active,
      sort_order: validatedData.sort_order,
      created_by: user.id
    }

    // Check for duplicate name
    const { data: existingBank } = await supabase
      .from('banks')
      .select('id')
      .eq('name', sanitizedData.name)
      .maybeSingle()

    if (existingBank) {
      return NextResponse.json(
        {
          error: 'Duplicate bank',
          message: `A bank with name "${sanitizedData.name}" already exists.`
        },
        { status: 409 }
      )
    }

    // Create bank
    const { data: bank, error: bankError } = await supabase
      .from('banks')
      .insert(sanitizedData)
      .select()
      .maybeSingle()

    if (bankError) throw bankError

    return NextResponse.json({ bank, success: true }, { status: 201 })
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    apiLogger.error('Error creating bank', error)
    logApiError(error as Error, request, { action: 'create_bank' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update bank (Super Admin only)
export async function PUT(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Validate with Zod
    const validatedData = updateBankSchema.parse(body)

    // Build update object
    const updateData: any = {}

    if (validatedData.name) updateData.name = validatedData.name
    if (validatedData.display_name) updateData.display_name = sanitizeInput(validatedData.display_name)
    if (validatedData.type) updateData.type = validatedData.type
    if (validatedData.logo_url !== undefined) updateData.logo_url = validatedData.logo_url || null
    if (validatedData.website_url !== undefined) updateData.website_url = validatedData.website_url || null
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description ? sanitizeInput(validatedData.description) : null
    }
    if (validatedData.contact_email !== undefined) updateData.contact_email = validatedData.contact_email || null
    if (validatedData.contact_phone !== undefined) updateData.contact_phone = validatedData.contact_phone || null
    if (validatedData.is_active !== undefined) updateData.is_active = validatedData.is_active
    if (validatedData.sort_order !== undefined) updateData.sort_order = validatedData.sort_order

    // Update bank
    const { data: bank, error: bankError } = await supabase
      .from('banks')
      .update(updateData)
      .eq('id', validatedData.id)
      .select()
      .maybeSingle()

    if (bankError) throw bankError

    if (!bank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ bank, success: true })
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    apiLogger.error('Error updating bank', error)
    logApiError(error as Error, request, { action: 'update_bank' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete bank (Super Admin only)
export async function DELETE(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Bank ID required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid bank ID format' }, { status: 400 })
    }

    // Check if bank is used in any offers
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('id')
      .eq('rolled_out_by', id)
      .limit(1)

    if (offersError) throw offersError

    if (offers && offers.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete bank',
          message: 'This bank is associated with existing offers. Please remove or reassign those offers first.'
        },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('banks')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    apiLogger.error('Error deleting bank', error)
    logApiError(error as Error, request, { action: 'delete_bank' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
