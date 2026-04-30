import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// EMPLOYEE TAX DECLARATIONS API (Security Fix - C2)
// GET: Fetch current user's tax declarations only
// POST: Create/update tax declaration with Zod validation
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'

// Zod schema for tax declaration with section limits
// Frontend sends simplified names (section_80c as total); we map to DB columns in the handler
const taxDeclarationSchema = z.object({
  financial_year: z.string().min(1, 'Financial year is required')
    .regex(/^\d{4}-\d{4}$/, 'Financial year must be in format YYYY-YYYY'),
  section_80c: z.number().min(0, 'Section 80C must be non-negative').max(150000, 'Section 80C limit is 1,50,000').default(0),
  section_80d: z.number().min(0, 'Section 80D must be non-negative').max(100000, 'Section 80D limit is 1,00,000').default(0),
  section_80e: z.number().min(0, 'Section 80E must be non-negative').default(0),
  section_80g: z.number().min(0, 'Section 80G must be non-negative').default(0),
  section_80tta: z.number().min(0, 'Section 80TTA must be non-negative').max(10000, 'Section 80TTA limit is 10,000').default(0),
  hra_exemption: z.number().min(0, 'HRA exemption must be non-negative').default(0),
  other_exemptions: z.number().min(0, 'Other exemptions must be non-negative').default(0),
  rent_paid: z.number().min(0, 'Rent paid must be non-negative').default(0),
  metro_city: z.boolean().default(false),
  remarks: z.string().max(1000, 'Remarks must be under 1000 characters').optional().default(''),
})

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const financialYear = searchParams.get('financial_year')

    // Build query - fetch ONLY current user's tax declarations
    let query = supabase
      .from('tax_declarations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Filter by financial year if provided
    if (financialYear) {
      query = query.eq('financial_year', financialYear)
    }

    const { data: declarations, error: declarationsError } = await query

    if (declarationsError) {
      apiLogger.error('Tax declarations fetch error', declarationsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tax declarations' },
        { status: 500 }
      )
    }

    // Map DB column names to frontend-expected names
    const mappedDeclarations = (declarations || []).map((d: Record<string, unknown>) => ({
      ...d,
      section_80c: d.total_80c ?? 0,
      section_80d: d.total_80d ?? 0,
      section_80e: d.section_80e_education_loan ?? 0,
      section_80g: d.section_80g_donations ?? 0,
      section_80tta: d.section_80tta_savings_interest ?? 0,
      hra_exemption: d.hra_rent_paid ?? 0,
      other_exemptions: d.home_loan_interest ?? 0,
      rent_paid: d.hra_rent_paid ?? 0,
      metro_city: d.hra_metro_city ?? false,
    }))

    return NextResponse.json({
      success: true,
      data: mappedDeclarations
    })
  } catch (error) {
    apiLogger.error('Tax Declarations GET Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate with Zod schema including section limits
    const parsed = taxDeclarationSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Validation failed' },
        { status: 400 }
      )
    }

    const {
      financial_year,
      section_80c,
      section_80d,
      section_80e,
      section_80g,
      section_80tta,
      hra_exemption,
      other_exemptions,
      rent_paid,
      metro_city,
      remarks
    } = parsed.data

    // Sanitize text field - strip HTML tags from remarks
    const sanitizedRemarks = remarks ? remarks.replace(/<[^>]*>/g, '').trim() : ''

    // Check if declaration already exists for this financial year
    const { data: existing } = await supabase
      .from('tax_declarations')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('financial_year', financial_year)
      .maybeSingle()

    // Prevent updates to approved declarations
    if (existing?.status === 'approved') {
      return NextResponse.json(
        { success: false, error: 'Cannot update approved declaration. Please contact HR.' },
        { status: 400 }
      )
    }

    // Map frontend simplified names to actual DB column names
    // Section 80C: frontend sends total, store in other_80c (total_80c is generated)
    // Section 80D: frontend sends total, store in medical_insurance_self (total_80d is generated)
    const declarationData = {
      other_80c: section_80c,
      medical_insurance_self: section_80d,
      section_80e_education_loan: section_80e,
      section_80g_donations: section_80g,
      section_80tta_savings_interest: section_80tta,
      hra_rent_paid: hra_exemption || rent_paid,
      hra_metro_city: metro_city,
      home_loan_interest: other_exemptions,
      remarks: sanitizedRemarks,
      status: 'submitted' as const,
    }

    let result
    if (existing) {
      // Update existing declaration
      const { data: updated, error: updateError } = await supabase
        .from('tax_declarations')
        .update({
          ...declarationData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .eq('user_id', user.id) // Double-check ownership
        .select()
        .maybeSingle()

      if (updateError) throw updateError
      result = updated
    } else {
      // Create new declaration
      const { data: created, error: createError } = await supabase
        .from('tax_declarations')
        .insert({
          user_id: user.id,
          financial_year,
          ...declarationData,
        })
        .select()
        .maybeSingle()

      if (createError) throw createError
      result = created
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: existing ? 'Tax declaration updated successfully' : 'Tax declaration created successfully'
    })
  } catch (error) {
    apiLogger.error('Tax Declaration POST Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
