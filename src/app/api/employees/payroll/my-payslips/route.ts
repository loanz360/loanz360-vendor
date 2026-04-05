export const dynamic = 'force-dynamic'

// =====================================================
// EMPLOYEE MY PAYSLIPS API (Security Fix - C2)
// GET: Fetch current user's payslips only
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

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

    // Get query parameters with bounds validation
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam) : null
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    // Validate year if provided
    if (yearParam && (isNaN(year!) || year! < 2000 || year! > 2100)) {
      return NextResponse.json(
        { success: false, error: 'Invalid year parameter. Must be between 2000 and 2100.' },
        { status: 400 }
      )
    }

    // Build query - fetch ONLY current user's payslips
    // Join with payroll_details to get salary breakdown data
    let query = supabase
      .from('payslips')
      .select(`
        id,
        month,
        year,
        pdf_url,
        pdf_generated_at,
        is_emailed,
        download_count,
        created_at,
        payroll_details!payslips_payroll_detail_id_fkey (
          gross_salary,
          total_deductions,
          net_salary,
          basic_salary,
          hra,
          special_allowance,
          pf_employee,
          esi_employee,
          professional_tax,
          tds,
          working_days,
          present_days,
          lop_days,
          lop_amount
        )
      `)
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    // Filter by year if provided
    if (year) {
      query = query.eq('year', year)
    }

    // Apply limit
    query = query.limit(limit)

    const { data: payslips, error: payslipsError } = await query

    if (payslipsError) {
      apiLogger.error('Payslips fetch error', payslipsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payslips' },
        { status: 500 }
      )
    }

    // Flatten the joined data so frontend gets a flat payslip object
    const flattenedPayslips = (payslips || []).map((ps: Record<string, unknown>) => {
      const details = ps.payroll_details as Record<string, unknown> | null
      return {
        id: ps.id,
        month: ps.month,
        year: ps.year,
        pdf_url: ps.pdf_url,
        generated_date: ps.pdf_generated_at,
        email_sent: ps.is_emailed,
        download_count: ps.download_count,
        created_at: ps.created_at,
        gross_salary: details?.gross_salary ?? 0,
        total_deductions: details?.total_deductions ?? 0,
        net_salary: details?.net_salary ?? 0,
        basic_salary: details?.basic_salary ?? 0,
        hra: details?.hra ?? 0,
        special_allowance: details?.special_allowance ?? 0,
        pf_employee: details?.pf_employee ?? 0,
        esi_employee: details?.esi_employee ?? 0,
        professional_tax: details?.professional_tax ?? 0,
        tds: details?.tds ?? 0,
        working_days: details?.working_days ?? 0,
        present_days: details?.present_days ?? 0,
        lop_days: details?.lop_days ?? 0,
        lop_amount: details?.lop_amount ?? 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: flattenedPayslips
    })
  } catch (error) {
    apiLogger.error('My Payslips GET Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
