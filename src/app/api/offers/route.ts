import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { csrfProtection } from '@/lib/middleware/csrf'
import { offerSchema, updateOfferSchema } from '@/lib/validations/offers'
import { ZodError } from 'zod'
import { normalizeRole, UserRole } from '@/types/offers'
import { logger } from '@/lib/utils/logger'

// Create a module-specific logger
const offersApiLogger = logger

// Helper function to check if user is Super Admin
function isSuperAdminRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === UserRole.SUPER_ADMIN
}

// Helper function to check if user is Admin (includes Super Admin)
function isAdminRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === UserRole.SUPER_ADMIN || normalized === UserRole.ADMIN
}

// Helper function to sanitize input (basic XSS prevention)
function sanitizeInput(input: string): string {
  // Basic sanitization: remove HTML tags and dangerous characters
  // Zod schema validation provides the primary security layer
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>\"']/g, '') // Remove dangerous characters
    .trim()
}

// SSRF Prevention: Validate image URL is from allowed domains
function validateImageUrl(url: string | null | undefined): { valid: boolean; error?: string } {
  if (!url) return { valid: true }

  try {
    const parsedUrl = new URL(url)

    // Block internal/private IP ranges
    const hostname = parsedUrl.hostname.toLowerCase()

    // Block localhost and private networks
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^0\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
      /\.local$/i,
      /\.internal$/i,
      /\.localhost$/i,
    ]

    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'Image URL points to a blocked network address' }
      }
    }

    // Only allow HTTPS for external URLs (HTTP allowed for local dev)
    if (parsedUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      return { valid: false, error: 'Image URL must use HTTPS protocol' }
    }

    // Allow only common image hosting domains and our own storage
    const allowedDomains = [
      'supabase.co',
      'supabase.com',
      'amazonaws.com',
      's3.amazonaws.com',
      'cloudinary.com',
      'res.cloudinary.com',
      'imgix.net',
      'images.unsplash.com',
      'unsplash.com',
      'pexels.com',
      'images.pexels.com',
      'pixabay.com',
      'cdn.pixabay.com',
      // Add your own domain
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, ''),
    ].filter(Boolean)

    const isAllowedDomain = allowedDomains.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    )

    // In development, allow any domain that passes the blocked patterns
    if (process.env.NODE_ENV !== 'production') {
      return { valid: true }
    }

    if (!isAllowedDomain) {
      return { valid: false, error: 'Image URL domain is not in the allowed list' }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid image URL format' }
  }
}

// GET - Fetch offers
// For Super Admin: Get all offers with pagination
// For other users: Get active or expired offers
export async function GET(request: NextRequest) {
  offersApiLogger.debug('Offers API GET request started')

  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) {
      offersApiLogger.warn('Rate limit exceeded')
      return rateLimitResponse
    }

    // Use regular client for authentication
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const forUser = searchParams.get('forUser') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    offersApiLogger.debug('Query params', { status, forUser, page, limit })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      offersApiLogger.warn('Auth error', { error: authError?.message })
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    offersApiLogger.debug('User authenticated', { userId: user.id })

    // Get user role using centralized normalizeRole function
    let userRole = UserRole.CUSTOMER
    let userSubRole: string | null = null

    try {
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      if (roleError) {
        offersApiLogger.warn('Error fetching user role, defaulting to CUSTOMER', { error: roleError.message })
      } else if (userData?.role) {
        // Use centralized normalizeRole function
        userRole = normalizeRole(userData.role)
        userSubRole = userData.sub_role?.toUpperCase().trim() || null
        offersApiLogger.debug('User role normalized', { userRole, userSubRole })
      } else {
        offersApiLogger.debug('No user data in DB, using default CUSTOMER')
      }
    } catch (roleError) {
      offersApiLogger.warn('Exception fetching role, defaulting to CUSTOMER', { error: roleError })
    }

    // Use helper functions for role checks
    const isSuperAdmin = isSuperAdminRole(userRole)
    const isAdmin = isAdminRole(userRole)
    const isHR = userRole === UserRole.HR
    offersApiLogger.debug('Role checks', { isSuperAdmin, isAdmin, isHR })

    // Fetch offers based on user type
    if (forUser || !isSuperAdmin) {
      offersApiLogger.debug('Fetching offers for regular user')

      // Build query for regular users
      let query = supabase
        .from('offers')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply status filter
      if (status === 'expired') {
        query = query.eq('status', 'expired')
      } else if (status === 'draft') {
        query = query.eq('status', 'draft')
      } else if (status === 'scheduled') {
        query = query.eq('status', 'scheduled')
      } else {
        query = query.eq('status', 'active')
      }

      const { data: offers, error: fetchError } = await query

      if (fetchError) {
        offersApiLogger.error('Database error fetching user offers', fetchError)
        return NextResponse.json(
          {
            error: 'Failed to fetch offers',
            code: fetchError.code
          },
          { status: 500 }
        )
      }

      offersApiLogger.debug('Successfully fetched offers', { count: offers?.length || 0 })

      return NextResponse.json({
        offers: offers || [],
        total: offers?.length || 0,
        status: 'success'
      })
    } else {
      offersApiLogger.debug('Fetching offers for Super Admin')

      // Use admin client for Super Admin
      const supabaseAdmin = createSupabaseAdmin()

      const from = (page - 1) * limit
      const to = from + limit - 1

      let query = supabaseAdmin
        .from('offers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data: offers, error: fetchError, count } = await query

      if (fetchError) {
        offersApiLogger.error('Database error fetching admin offers', fetchError)
        return NextResponse.json(
          {
            error: 'Failed to fetch offers',
            code: fetchError.code
          },
          { status: 500 }
        )
      }

      offersApiLogger.debug('Successfully fetched admin offers', { count: offers?.length || 0, total: count })

      return NextResponse.json({
        offers: offers || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        status: 'success'
      })
    }
  } catch (error: unknown) {
    offersApiLogger.error('Fatal error in offers API GET', error as Error)
    logApiError(error as Error, request, { action: 'get' })

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to fetch offers',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// POST - Create new offer (Super Admin only)
export async function POST(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin using centralized role helper
  const { data: userData, error: roleError } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', user.id)
    .maybeSingle()

  if (roleError || !userData) {
    offersApiLogger.warn('Error fetching user role for POST', { error: roleError?.message })
    return NextResponse.json({ success: false, error: 'Unable to verify user permissions' }, { status: 500 })
  }

  // Use centralized role check
  if (!isSuperAdminRole(userData.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden - Super Admin access required' }, { status: 403 })
  }

  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate with Zod
    const validatedData = offerSchema.parse(body)

    // Validate image URL for SSRF prevention
    const imageValidation = validateImageUrl(validatedData.offer_image_url)
    if (!imageValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid image URL', message: imageValidation.error },
        { status: 400 }
      )
    }

    // Sanitize text inputs
    const sanitizedData = {
      ...validatedData,
      offer_title: sanitizeInput(validatedData.offer_title),
      rolled_out_by: sanitizeInput(validatedData.rolled_out_by),
      description: sanitizeInput(validatedData.description),
      ai_prompt: validatedData.ai_prompt ? sanitizeInput(validatedData.ai_prompt) : null
    }

    // Check for duplicate offers (same title + bank)
    const { data: existingOffer } = await supabase
      .from('offers')
      .select('id')
      .eq('offer_title', sanitizedData.offer_title)
      .eq('rolled_out_by', sanitizedData.rolled_out_by)
      .maybeSingle()

    if (existingOffer) {
      return NextResponse.json(
        {
          error: 'Duplicate offer',
          message: `An offer with title "${sanitizedData.offer_title}" from ${sanitizedData.rolled_out_by} already exists.`
        },
        { status: 409 }
      )
    }

    // Determine initial status based on dates, but respect draft status
    const now = new Date()
    const endDateObj = new Date(sanitizedData.end_date)

    let initialStatus: 'active' | 'expired' | 'draft' = sanitizedData.status || 'active'

    // Only auto-determine status if not explicitly set to draft
    if (initialStatus !== 'draft') {
      if (endDateObj < now) {
        initialStatus = 'expired'
      } else {
        initialStatus = 'active'
      }
    }

    // Create offer
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        offer_title: sanitizedData.offer_title,
        rolled_out_by: sanitizedData.rolled_out_by,
        description: sanitizedData.description,
        offer_image_url: sanitizedData.offer_image_url || null,
        image_source: sanitizedData.image_source || 'upload',
        ai_prompt: sanitizedData.ai_prompt,
        states_applicable: sanitizedData.states_applicable,
        start_date: sanitizedData.start_date,
        end_date: sanitizedData.end_date,
        status: initialStatus,
        created_by: user.id
      })
      .select()
      .maybeSingle()

    if (offerError) throw offerError

    return NextResponse.json({ offer, success: true }, { status: 201 })
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
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

    offersApiLogger.error('Error creating offer', error as Error)
    logApiError(error as Error, request, { action: 'create' })
    const errorMessage = error instanceof Error ? error.message : 'Failed to create offer'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// PUT - Update offer (Super Admin only)
export async function PUT(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin using centralized role helper
  const { data: userData, error: roleError } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', user.id)
    .maybeSingle()

  if (roleError || !userData) {
    offersApiLogger.warn('Error fetching user role for PUT', { error: roleError?.message })
    return NextResponse.json({ success: false, error: 'Unable to verify user permissions' }, { status: 500 })
  }

  // Use centralized role check
  if (!isSuperAdminRole(userData.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden - Super Admin access required' }, { status: 403 })
  }

  try {
    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2

    // Validate with Zod
    const validatedData = updateOfferSchema.parse(body)

    // Validate image URL for SSRF prevention
    const imageValidation = validateImageUrl(validatedData.offer_image_url)
    if (!imageValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid image URL', message: imageValidation.error },
        { status: 400 }
      )
    }

    // Sanitize text inputs
    const sanitizedData: any = {
      updated_at: new Date().toISOString()
    }

    if (validatedData.offer_title) {
      sanitizedData.offer_title = sanitizeInput(validatedData.offer_title)
    }
    if (validatedData.rolled_out_by) {
      sanitizedData.rolled_out_by = sanitizeInput(validatedData.rolled_out_by)
    }
    if (validatedData.description) {
      sanitizedData.description = sanitizeInput(validatedData.description)
    }
    if (validatedData.offer_image_url !== undefined) {
      sanitizedData.offer_image_url = validatedData.offer_image_url || null
    }
    if (validatedData.image_source) {
      sanitizedData.image_source = validatedData.image_source
    }
    if (validatedData.ai_prompt !== undefined) {
      sanitizedData.ai_prompt = validatedData.ai_prompt ? sanitizeInput(validatedData.ai_prompt) : null
    }
    if (validatedData.states_applicable) {
      sanitizedData.states_applicable = validatedData.states_applicable
    }
    if (validatedData.start_date) {
      sanitizedData.start_date = validatedData.start_date
    }
    if (validatedData.end_date) {
      sanitizedData.end_date = validatedData.end_date
    }
    if (validatedData.status) {
      sanitizedData.status = validatedData.status
    }

    // Handle scheduled publishing fields
    if (body.scheduled_publish_at !== undefined) {
      sanitizedData.scheduled_publish_at = body.scheduled_publish_at || null
    }
    if (body.timezone !== undefined) {
      sanitizedData.timezone = body.timezone || 'Asia/Kolkata'
    }
    if (body.auto_publish_enabled !== undefined) {
      sanitizedData.auto_publish_enabled = body.auto_publish_enabled
    }

    // If status is being set to 'scheduled', ensure scheduled_publish_at is set
    if (sanitizedData.status === 'scheduled' && !sanitizedData.scheduled_publish_at && !body.scheduled_publish_at) {
      return NextResponse.json(
        { error: 'Scheduled publish date/time is required for scheduled offers' },
        { status: 400 }
      )
    }

    // Update offer
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .update(sanitizedData)
      .eq('id', validatedData.id)
      .select()
      .maybeSingle()

    if (offerError) throw offerError

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ offer, success: true })
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
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

    offersApiLogger.error('Error updating offer', error as Error)
    logApiError(error as Error, request, { action: 'update' })
    const errorMessage = error instanceof Error ? error.message : 'Failed to update offer'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// DELETE - Delete offer (Super Admin only)
export async function DELETE(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin using centralized role helper
  const { data: userData, error: roleError } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', user.id)
    .maybeSingle()

  if (roleError || !userData) {
    offersApiLogger.warn('Error fetching user role for DELETE', { error: roleError?.message })
    return NextResponse.json({ success: false, error: 'Unable to verify user permissions' }, { status: 500 })
  }

  // Use centralized role check
  if (!isSuperAdminRole(userData.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden - Super Admin access required' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Offer ID required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid offer ID format' }, { status: 400 })
    }

    const { error } = await supabase
      .from('offers')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    offersApiLogger.error('Error deleting offer', error as Error)
    logApiError(error as Error, request, { action: 'delete' })
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete offer'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
