import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { validatePagination } from '@/lib/validations/dse-validation'


// Simple email format regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Validation schema for visiting card capture
const visitingCardSchema = z.object({
  customer_id: z.string().uuid().optional(), // If attaching to existing customer
  front_image_url: z.string().min(1),
  back_image_url: z.string().min(1).optional(),
  ocr_data: z.object({
    full_name: z.string().optional(),
    company_name: z.string().optional(),
    designation: z.string().optional(),
    email: z.string().optional(),
    mobile: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
    raw_text: z.string().optional(),
  }).optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
  }).optional(),
  create_customer: z.boolean().default(true),
})

// POST - Capture visiting card and optionally create customer
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = visitingCardSchema.parse(body)

    // Validate OCR email format if provided
    if (validatedData.ocr_data?.email && !EMAIL_REGEX.test(validatedData.ocr_data.email)) {
      // Clear invalid email from OCR data rather than rejecting the whole request
      validatedData.ocr_data.email = undefined
    }

    let customerId = validatedData.customer_id
    let customer = null

    // If attaching to existing customer
    if (customerId) {
      const { data: existingCustomer, error } = await supabase
        .from('dse_customers')
        .select('*')
        .eq('id', customerId)
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)
        .maybeSingle()

      if (error || !existingCustomer) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 })
      }

      // Update existing customer with visiting card
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('dse_customers')
        .update({
          visiting_card_front_url: validatedData.front_image_url,
          visiting_card_back_url: validatedData.back_image_url,
          visiting_card_ocr_data: validatedData.ocr_data || {},
          visiting_card_captured_at: new Date().toISOString(),
          // Update fields from OCR if they're empty
          ...(validatedData.ocr_data?.email && !existingCustomer.email && { email: validatedData.ocr_data.email }),
          ...(validatedData.ocr_data?.website && !existingCustomer.website && { website: validatedData.ocr_data.website }),
        })
        .eq('id', customerId)
        .select()
        .maybeSingle()

      if (updateError) throw updateError
      customer = updatedCustomer

    } else if (validatedData.create_customer && validatedData.ocr_data) {
      // Create new customer from visiting card
      const ocr = validatedData.ocr_data

      // Check for duplicate mobile
      if (ocr.mobile) {
        const { data: existing } = await supabase
          .from('dse_customers')
          .select('id, customer_id, full_name')
          .eq('dse_user_id', user.id)
          .eq('primary_mobile', ocr.mobile)
          .eq('is_deleted', false)
          .maybeSingle()

        if (existing) {
          return NextResponse.json({
            success: false,
            error: 'A customer with this mobile number already exists',
            errorCode: 'DUPLICATE_MOBILE',
            existingCustomer: existing
          }, { status: 409 })
        }
      }

      const { data: newCustomer, error: createError } = await supabase
        .from('dse_customers')
        .insert({
          dse_user_id: user.id,
          full_name: ocr.full_name || 'Unknown',
          company_name: ocr.company_name,
          designation: ocr.designation,
          primary_mobile: ocr.mobile || null, // Don't insert fake data
          email: ocr.email,
          website: ocr.website,
          address_line1: ocr.address,
          source: 'Visiting Card',
          visiting_card_front_url: validatedData.front_image_url,
          visiting_card_back_url: validatedData.back_image_url,
          visiting_card_ocr_data: ocr,
          visiting_card_captured_at: new Date().toISOString(),
          visit_latitude: validatedData.location?.latitude,
          visit_longitude: validatedData.location?.longitude,
          visit_address: validatedData.location?.address,
          first_visit_date: new Date().toISOString().split('T')[0],
          last_visit_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .maybeSingle()

      if (createError) throw createError

      if (!newCustomer) {
        apiLogger.error('Customer insert from visiting card returned null despite no error')
        return NextResponse.json(
          { success: false, error: 'Failed to create customer from visiting card' },
          { status: 500 }
        )
      }

      customer = newCustomer
      customerId = newCustomer.id

      // Create audit log
      const { error: auditError } = await supabase.from('dse_audit_log').insert({
        entity_type: 'Customer',
        entity_id: customerId,
        action: 'VisitingCardCaptured',
        new_values: newCustomer,
        user_id: user.id,
        changes_summary: `Created customer from visiting card: ${newCustomer.full_name}`
      })

      if (auditError) {
        apiLogger.error('Failed to create audit log for visiting card capture', auditError)
      }
    }

    // Create a visit record if location is provided
    if (validatedData.location && customerId) {
      const { error: visitError } = await supabase.from('dse_visits').insert({
        dse_user_id: user.id,
        customer_id: customerId,
        visit_date: new Date().toISOString().split('T')[0],
        visit_time: new Date().toTimeString().split(' ')[0],
        visit_type: 'In Person',
        visit_purpose: 'Introduction',
        check_in_latitude: validatedData.location.latitude,
        check_in_longitude: validatedData.location.longitude,
        check_in_address: validatedData.location.address,
        check_in_time: new Date().toISOString(),
        outcome: 'Successful',
        outcome_notes: 'Visiting card collected',
        photos: [{ url: validatedData.front_image_url, type: 'visiting_card' }]
      })

      if (visitError) {
        apiLogger.error('Failed to create visit record for visiting card capture', visitError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        customer,
        visitingCardCaptured: true
      },
      message: customer ? 'Visiting card captured and customer created successfully' : 'Visiting card captured successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    apiLogger.error('Error capturing visiting card', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get all visiting cards for the DSE
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = validatePagination(searchParams.get('page'), searchParams.get('limit'))

    const { data: customers, error, count } = await supabase
      .from('dse_customers')
      .select('id, customer_id, full_name, company_name, designation, primary_mobile, email, visiting_card_front_url, visiting_card_back_url, visiting_card_captured_at, source', { count: 'exact' })
      .eq('dse_user_id', user.id)
      .eq('is_deleted', false)
      .not('visiting_card_front_url', 'is', null)
      .order('visiting_card_captured_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        visitingCards: customers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching visiting cards', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
