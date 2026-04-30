import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const category = searchParams.get('category') || ''
    const offset = (page - 1) * limit

    let query = supabase
      .from('customer_identities')
      .select('id, unique_id, full_name, email, phone, primary_category, sub_category, kyc_status, profile_completion, is_active, created_at, updated_at', { count: 'exact' })

    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,unique_id.ilike.%${safeSearch}%,pan_number.ilike.%${safeSearch}%`)
      }
    }
    if (status === 'ACTIVE') query = query.eq('is_active', true)
    else if (status === 'INACTIVE') query = query.eq('is_active', false)
    if (category) query = query.eq('primary_category', category)

    query = query.eq('is_deleted', false).order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: customers, error, count } = await query

    if (error) {
      // Fallback to customer_profiles if customer_identities doesn't exist
      const { data: legacy, error: legacyErr, count: legacyCount } = await supabase
        .from('customer_profiles')
        .select('id, full_name, email, phone, pan_number, kyc_status, profile_completed, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (legacyErr) {
        return NextResponse.json({ success: false, error: 'Failed to fetch customers' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: (legacy || []).map((c: any) => ({
          id: c.id,
          unique_id: `C-${c.id?.substring(0, 6)}`,
          full_name: c.full_name,
          email: c.email,
          phone: c.phone,
          primary_category: 'INDIVIDUAL',
          kyc_status: c.kyc_status || 'PENDING',
          profile_completion: c.profile_completed ? 100 : 30,
          is_active: true,
          created_at: c.created_at
        })),
        total: legacyCount || 0,
        page, limit,
        totalPages: Math.ceil((legacyCount || 0) / limit)
      })
    }

    // Get loan counts per customer
    const customerIds = (customers || []).map((c: any) => c.id)
    let loanCounts: Record<string, number> = {}
    if (customerIds.length > 0) {
      try {
        const { data: loans } = await supabase
          .from('loan_applications_v2')
          .select('primary_applicant_id, status')
          .in('primary_applicant_id', customerIds)
        if (loans) {
          loans.forEach((l: any) => {
            loanCounts[l.primary_applicant_id] = (loanCounts[l.primary_applicant_id] || 0) + 1
          })
        }
      } catch { /* loan_applications_v2 may not exist */ }
    }

    const enriched = (customers || []).map((c: any) => ({
      ...c,
      status: c.is_active ? 'ACTIVE' : 'INACTIVE',
      category: c.primary_category,
      totalLoans: loanCounts[c.id] || 0,
    }))

    return NextResponse.json({
      success: true,
      data: enriched,
      total: count || 0,
      page, limit,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
