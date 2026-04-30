import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// EMPLOYEE INVESTMENT PROOFS API (Security - Employee only)
// GET: Fetch current user's investment proofs only
// POST: Upload investment proof for the authenticated user
// DELETE: Delete user's own pending proof (not approved ones)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'

// Zod schema for uploading investment proof
const investmentProofSchema = z.object({
  financial_year: z.string().min(1, 'Financial year is required')
    .regex(/^\d{4}-\d{4}$/, 'Financial year must be in format YYYY-YYYY'),
  proof_type: z.string().min(1, 'Proof type is required'),
  tax_section: z.string().min(1, 'Tax section is required'),
  declared_amount: z.number().min(0, 'Amount must be non-negative'),
  document_url: z.string().min(1, 'Document is required'),
  document_name: z.string().min(1, 'Document name is required').max(255),
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

    // Build query - fetch ONLY current user's investment proofs
    let query = supabase
      .from('investment_proofs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // If financial_year provided, filter by it via declaration lookup
    if (financialYear) {
      // First get the user's declaration IDs for this FY
      const { data: declarations } = await supabase
        .from('tax_declarations')
        .select('id')
        .eq('user_id', user.id)
        .eq('financial_year', financialYear)

      if (declarations && declarations.length > 0) {
        const declarationIds = declarations.map(d => d.id)
        query = query.in('declaration_id', declarationIds)
      } else {
        // No declarations for this FY, return empty
        return NextResponse.json({ success: true, data: [] })
      }
    }

    const { data: proofs, error: proofsError } = await query

    if (proofsError) {
      apiLogger.error('Investment proofs fetch error', proofsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch investment proofs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: proofs || []
    })
  } catch (error) {
    apiLogger.error('Investment Proofs GET Error', error)
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

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr

    // Validate with Zod
    const parsed = investmentProofSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Validation failed' },
        { status: 400 }
      )
    }

    const {
      financial_year,
      proof_type,
      tax_section,
      declared_amount,
      document_url,
      document_name,
      remarks
    } = parsed.data

    // Sanitize text fields
    const sanitizedRemarks = remarks ? remarks.replace(/<[^>]*>/g, '').trim() : ''

    // Find the user's tax declaration for this financial year
    const { data: declaration, error: declError } = await supabase
      .from('tax_declarations')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('financial_year', financial_year)
      .maybeSingle()

    if (declError || !declaration) {
      return NextResponse.json(
        { success: false, error: 'No tax declaration found for this financial year. Please submit a tax declaration first.' },
        { status: 404 }
      )
    }

    // Create proof record - map frontend field names to DB column names
    const { data: proof, error: createError } = await supabase
      .from('investment_proofs')
      .insert({
        user_id: user.id,
        declaration_id: declaration.id,
        proof_type,
        section: tax_section,
        amount: declared_amount,
        document_url,
        document_name,
        remarks: sanitizedRemarks,
        verification_status: 'pending'
      })
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Investment proof create error', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload investment proof' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: proof,
      message: 'Investment proof uploaded successfully'
    })
  } catch (error) {
    apiLogger.error('Investment Proof POST Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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
    const proofId = searchParams.get('id')

    if (!proofId) {
      return NextResponse.json(
        { success: false, error: 'Proof ID is required' },
        { status: 400 }
      )
    }

    // Verify proof belongs to user and is still pending
    const { data: proof, error: fetchError } = await supabase
      .from('investment_proofs')
      .select('id, verification_status')
      .eq('id', proofId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !proof) {
      return NextResponse.json(
        { success: false, error: 'Investment proof not found' },
        { status: 404 }
      )
    }

    if (proof.verification_status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete a proof that has been verified or rejected. Contact HR.' },
        { status: 400 }
      )
    }

    // Delete the proof
    const { error: deleteError } = await supabase
      .from('investment_proofs')
      .delete()
      .eq('id', proofId)
      .eq('user_id', user.id)

    if (deleteError) {
      apiLogger.error('Investment proof delete error', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete investment proof' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Investment proof deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Investment Proof DELETE Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
