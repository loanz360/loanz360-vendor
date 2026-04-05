import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { isValidUUID } from '@/lib/validations/dse-validation'

export const dynamic = 'force-dynamic'

// Validation schema for consent recording
const consentSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  consent_type: z.enum(['data_collection', 'credit_check', 'bank_sharing', 'marketing'], {
    errorMap: () => ({ message: 'consent_type must be one of: data_collection, credit_check, bank_sharing, marketing' }),
  }),
  consent_given: z.boolean(),
})

// POST - Record customer consent
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const body = await request.json()
    const validated = consentSchema.parse(body)

    // Verify customer exists and belongs to this DSE
    const { data: customer, error: customerError } = await supabase
      .from('dse_customers')
      .select('id')
      .eq('id', validated.customer_id)
      .eq('dse_user_id', user.id)
      .maybeSingle()

    if (customerError || !customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Extract IP address from request headers
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Upsert consent record (on customer_id + consent_type)
    const consentRecord = {
      customer_id: validated.customer_id,
      consent_type: validated.consent_type,
      consent_given: validated.consent_given,
      given_at: validated.consent_given ? new Date().toISOString() : null,
      revoked_at: !validated.consent_given ? new Date().toISOString() : null,
      ip_address: ipAddress,
      consent_text_version: '1.0',
      recorded_by: user.id,
      updated_at: new Date().toISOString(),
    }

    const { data: consent, error: upsertError } = await supabase
      .from('customer_consents')
      .upsert(consentRecord, {
        onConflict: 'customer_id,consent_type',
      })
      .select()
      .single()

    if (upsertError) {
      apiLogger.error('Error recording consent', upsertError)
      return NextResponse.json(
        { success: false, error: 'Failed to record consent' },
        { status: 500 }
      )
    }

    apiLogger.info('Customer consent recorded', {
      customer_id: validated.customer_id,
      consent_type: validated.consent_type,
      consent_given: validated.consent_given,
      recorded_by: user.id,
    })

    return NextResponse.json({
      success: true,
      data: consent,
      message: `Consent ${validated.consent_given ? 'granted' : 'revoked'} successfully`,
    })
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('Error in consent POST', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Fetch consents for a customer
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customer_id query parameter is required' },
        { status: 400 }
      )
    }

    if (!isValidUUID(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer_id format' },
        { status: 400 }
      )
    }

    const { data: consents, error: fetchError } = await supabase
      .from('customer_consents')
      .select('*')
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false })

    if (fetchError) {
      apiLogger.error('Error fetching consents', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch consents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: consents || [],
    })
  } catch (error: unknown) {
    apiLogger.error('Error in consent GET', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
