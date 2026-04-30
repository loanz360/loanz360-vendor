import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * Bank Products Management API - SuperAdmin / Admin
 * GET: List all products with advanced filtering (active + inactive)
 * POST: Create a new bank product
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


// Allowed roles for bank product management
const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN']

async function verifyAdminAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized', status: 401, user: null, role: null }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!userData || !ALLOWED_ROLES.includes(userData.role)) {
    return { error: 'Access denied. Super Admin or Admin role required.', status: 403, user: null, role: null }
  }

  return { error: null, status: 200, user, role: userData.role }
}

// =====================================================
// GET: List all bank products with admin-level filtering
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { error: authErr, status, user } = await verifyAdminAccess(supabase)
    if (authErr) return NextResponse.json({ success: false, error: authErr }, { status })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const bankName = searchParams.get('bank_name') || ''
    const loanType = searchParams.get('loan_type') || ''
    const isActive = searchParams.get('is_active') // 'true', 'false', or null (all)
    const featured = searchParams.get('featured') // 'true', 'false', or null (all)
    const sortBy = searchParams.get('sort_by') || 'bank_name'
    const sortOrder = searchParams.get('sort_order') === 'desc'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const offset = (page - 1) * limit

    // Build query - admins see ALL products (active + inactive)
    let query = supabase
      .from('loan_products')
      .select('*', { count: 'exact' })

    if (search) {
      const sanitized = search.replace(/[%_'";\\\[\]{}()]/g, '')
      query = query.or(`bank_name.ilike.%${sanitized}%,name.ilike.%${sanitized}%,loan_type.ilike.%${sanitized}%,product_code.ilike.%${sanitized}%`)
    }

    if (bankName) {
      query = query.eq('bank_name', bankName)
    }

    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    if (isActive === 'true') {
      query = query.eq('is_active', true)
    } else if (isActive === 'false') {
      query = query.eq('is_active', false)
    }

    if (featured === 'true') {
      query = query.eq('featured', true)
    } else if (featured === 'false') {
      query = query.eq('featured', false)
    }

    // Validate sort column
    const validSortColumns = [
      'bank_name', 'name', 'loan_type', 'min_interest_rate', 'max_amount',
      'min_cibil', 'min_income', 'display_order', 'is_active', 'created_at', 'updated_at'
    ]
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'bank_name'

    query = query
      .order(safeSortBy, { ascending: !sortOrder })
      .range(offset, offset + limit - 1)

    const { data: products, error, count } = await query

    if (error) {
      apiLogger.error('Failed to fetch bank products (admin):', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch products' }, { status: 500 })
    }

    // Get distinct banks and loan types for filter dropdowns
    const [{ data: bankData }, { data: typeData }] = await Promise.all([
      supabase.from('loan_products').select('bank_name'),
      supabase.from('loan_products').select('loan_type'),
    ])

    const banks = [...new Set((bankData || []).map(b => b.bank_name))].sort()
    const loanTypes = [...new Set((typeData || []).map(t => t.loan_type))].sort()

    // Stats
    const allProducts = products || []
    const activeCount = (await supabase.from('loan_products').select('id', { count: 'exact', head: true }).eq('is_active', true)).count || 0
    const inactiveCount = (await supabase.from('loan_products').select('id', { count: 'exact', head: true }).eq('is_active', false)).count || 0
    const featuredCount = (await supabase.from('loan_products').select('id', { count: 'exact', head: true }).eq('featured', true)).count || 0

    return NextResponse.json({
      success: true,
      data: products || [],
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        banks,
        loanTypes,
        stats: {
          total: (count || 0) + (page > 1 ? (page - 1) * limit : 0),
          active: activeCount,
          inactive: inactiveCount,
          featured: featuredCount,
          bankCount: banks.length,
        },
      },
    })
  } catch (error) {
    apiLogger.error('Bank products admin API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// POST: Create a new bank product
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { error: authErr, status, user } = await verifyAdminAccess(supabase)
    if (authErr) return NextResponse.json({ success: false, error: authErr }, { status })

    const bodySchema = z.object({


      bank_name: z.string().optional(),


      bank_code: z.string().optional(),


      bank_logo_url: z.string().optional(),


      name: z.string().optional(),


      loan_type: z.string().optional(),


      description: z.string().optional(),


      product_code: z.string().optional(),


      min_amount: z.string().optional(),


      max_amount: z.string().optional(),


      min_interest_rate: z.string().optional(),


      max_interest_rate: z.string().optional(),


      interest_rate_type: z.string().optional(),


      processing_fee: z.number().optional(),


      processing_fee_percentage: z.string().optional(),


      processing_fee_min: z.string().optional(),


      processing_fee_max: z.string().optional(),


      min_tenure: z.string().optional(),


      max_tenure: z.string().optional(),


      min_cibil: z.string().optional(),


      min_income: z.string().optional(),


      min_age: z.string().optional(),


      max_age: z.string().optional(),


      employment_types: z.string().optional(),


      has_collateral: z.string().optional(),


      max_ltv: z.string().optional(),


      prepayment_allowed: z.string().optional(),


      prepayment_charges: z.string().optional(),


      foreclosure_charges: z.string().optional(),


      top_up_available: z.string().optional(),


      balance_transfer_available: z.string().optional(),


      tax_benefit_eligible: z.string().optional(),


      tax_sections: z.string().optional(),


      display_order: z.string().optional(),


      featured: z.string().optional(),


      is_active: z.boolean().optional(),


      effective_from: z.string().optional(),


      effective_until: z.string().optional(),


      notes: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    const requiredFields = ['bank_name', 'name', 'loan_type']
    for (const field of requiredFields) {
      if (!body[field] || !String(body[field]).trim()) {
        return NextResponse.json(
          { success: false, error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Sanitize and prepare data
    const productData = {
      bank_name: String(body.bank_name).trim(),
      bank_code: body.bank_code ? String(body.bank_code).trim() : null,
      bank_logo_url: body.bank_logo_url || null,
      name: String(body.name).trim(),
      loan_type: String(body.loan_type).trim(),
      description: body.description ? String(body.description).trim() : null,
      product_code: body.product_code ? String(body.product_code).trim() : null,
      min_amount: parseFloat(body.min_amount) || 50000,
      max_amount: parseFloat(body.max_amount) || 10000000,
      min_interest_rate: parseFloat(body.min_interest_rate) || 8.0,
      max_interest_rate: parseFloat(body.max_interest_rate) || 18.0,
      interest_rate_type: body.interest_rate_type || 'reducing_balance',
      processing_fee: body.processing_fee || '1-2%',
      processing_fee_percentage: parseFloat(body.processing_fee_percentage) || 1.0,
      processing_fee_min: parseFloat(body.processing_fee_min) || 0,
      processing_fee_max: parseFloat(body.processing_fee_max) || 0,
      min_tenure: parseInt(body.min_tenure) || 12,
      max_tenure: parseInt(body.max_tenure) || 60,
      min_cibil: parseInt(body.min_cibil) || 650,
      min_income: parseFloat(body.min_income) || 15000,
      min_age: parseInt(body.min_age) || 21,
      max_age: parseInt(body.max_age) || 65,
      employment_types: body.employment_types || ['salaried', 'self_employed', 'business'],
      has_collateral: body.has_collateral || false,
      max_ltv: body.max_ltv ? parseFloat(body.max_ltv) : null,
      prepayment_allowed: body.prepayment_allowed !== false,
      prepayment_charges: body.prepayment_charges || null,
      foreclosure_charges: body.foreclosure_charges || null,
      top_up_available: body.top_up_available || false,
      balance_transfer_available: body.balance_transfer_available || false,
      tax_benefit_eligible: body.tax_benefit_eligible || false,
      tax_sections: body.tax_sections || null,
      display_order: parseInt(body.display_order) || 100,
      featured: body.featured || false,
      is_active: body.is_active !== false,
      effective_from: body.effective_from || new Date().toISOString().split('T')[0],
      effective_until: body.effective_until || null,
      notes: body.notes || null,
      created_by: user!.id,
      updated_by: user!.id,
    }

    const { data: product, error } = await supabase
      .from('loan_products')
      .insert([productData])
      .select()
      .single()

    if (error) {
      apiLogger.error('Failed to create bank product:', error)
      return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully',
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Create bank product error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
