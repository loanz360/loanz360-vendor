import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { investmentProofsQuerySchema } from '@/lib/validations/hr-schemas'

// GET /api/hr/payroll/investment-proofs
// Fetch investment proofs (HR sees all, employees see their own)
export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check user role
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHROrAdmin = profile && (profile.role === 'hr' || profile.role === 'superadmin')

    const { searchParams } = new URL(request.url)
    const queryParams = investmentProofsQuerySchema.safeParse({
      declaration_id: searchParams.get('declaration_id') || undefined,
      employee_id: searchParams.get('employee_id') || undefined,
      financial_year: searchParams.get('financial_year') || undefined,
      status: searchParams.get('status') || undefined,
    })

    if (!queryParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { declaration_id: declarationId, employee_id: employeeId, financial_year: financialYear, status } = queryParams.data

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = adminClient
      .from('investment_proofs')
      .select(`
        *,
        tax_declarations!investment_proofs_declaration_id_fkey (
          financial_year,
          user_id,
          employee_profile!tax_declarations_user_id_fkey (
            first_name,
            last_name,
            employee_id,
            email
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    // If not HR/Admin, only show own proofs
    if (!isHROrAdmin) {
      query = query.eq('user_id', user.id)
    } else if (employeeId) {
      // HR/Admin can filter by employee
      query = query.eq('user_id', employeeId)
    }

    // Filter by declaration
    if (declarationId) {
      query = query.eq('declaration_id', declarationId)
    }

    // Filter by financial year (through tax_declarations relationship)
    if (financialYear) {
      query = query.eq('tax_declarations.financial_year', financialYear)
    }

    // Filter by status
    if (status) {
      query = query.eq('verification_status', status)
    }

    const { data: proofs, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: proofs || [],
      meta: { page, page_size: pageSize, total: count ?? 0 }
    })

  } catch (error) {
    apiLogger.error('Fetch investment proofs error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch investment proofs' },
      { status: 500 }
    )
  }
}

// POST /api/hr/payroll/investment-proofs
// Upload investment proof (employees for themselves, HR for any employee)
export async function POST(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check user role
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHROrAdmin = profile && (profile.role === 'hr' || profile.role === 'superadmin')

    const bodySchema = z.object({


      user_id: z.string().uuid().optional(),


      declaration_id: z.string().uuid().optional(),


      proof_type: z.string().optional(),


      section: z.string().optional(),


      amount: z.number().optional(),


      document_url: z.string().optional(),


      document_name: z.string().optional(),


      remarks: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      user_id,
      declaration_id,
      proof_type,
      section,
      amount,
      document_url,
      document_name,
      remarks
    } = body

    // Validate required fields
    if (!declaration_id || !proof_type || !section || !amount) {
      return NextResponse.json(
        { success: false, error: 'Declaration ID, proof type, section, and amount are required' },
        { status: 400 }
      )
    }

    // Validate document URL is provided
    if (!document_url || typeof document_url !== 'string' || document_url.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Proof document URL is required. Please upload a document first.' },
        { status: 400 }
      )
    }

    // Validate amount is positive
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Determine target user
    const targetUserId = isHROrAdmin && user_id ? user_id : user.id

    // Verify declaration exists and belongs to target user
    const { data: declaration, error: declError } = await adminClient
      .from('tax_declarations')
      .select('id, user_id, status')
      .eq('id', declaration_id)
      .maybeSingle()

    if (declError || !declaration) {
      return NextResponse.json(
        { success: false, error: 'Tax declaration not found' },
        { status: 404 }
      )
    }

    if (declaration.user_id !== targetUserId && !isHROrAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Cannot add proofs to approved declarations
    if (declaration.status === 'approved') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot add proofs to approved declaration'
        },
        { status: 400 }
      )
    }

    // Create proof record
    const { data: proof, error: createError } = await adminClient
      .from('investment_proofs')
      .insert({
        user_id: targetUserId,
        declaration_id,
        proof_type,
        section,
        amount,
        document_url,
        document_name,
        remarks,
        verification_status: 'pending'
      })
      .select()
      .maybeSingle()

    if (createError) {
      throw createError
    }

    return NextResponse.json({
      success: true,
      data: proof,
      message: 'Investment proof uploaded successfully'
    })

  } catch (error) {
    apiLogger.error('Upload investment proof error', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json(
      { success: false, error: 'Failed to upload investment proof' },
      { status: 500 }
    )
  }
}
