import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Dynamically compute current Indian financial year string e.g. "2025-26" */
function getCurrentFinancialYear(): string {
  const now = new Date()
  const month = now.getMonth() // 0-indexed (0=Jan, 3=Apr)
  const y = now.getFullYear()
  const startYear = month >= 3 ? y : y - 1 // FY starts April
  const endYear = startYear + 1
  return `${startYear}-${String(endYear).slice(2)}`
}

/** Generate dynamic financial year list (current ± 2 years) */
function getFinancialYearsList(): string[] {
  const now = new Date()
  const month = now.getMonth()
  const currentStartYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const years: string[] = []
  for (let i = -2; i <= 2; i++) {
    const sy = currentStartYear + i
    years.push(`${sy}-${String(sy + 1).slice(2)}`)
  }
  return years
}

/** Get last day of a month */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Build compliance calendar with correct statutory filing deadlines.
 * - PF ECR: 15th of month (for previous month contributions)
 * - ESI: 15th of month (changed from 21st per 2023 ESIC notification)
 * - TDS: 7th of NEXT month (for current month salary TDS)
 * - PT: Last day of month (varies by state)
 */
function buildComplianceCalendar(now: Date, targetMonth?: number, targetYear?: number) {
  const month = targetMonth || now.getMonth() + 1
  const year = targetYear || now.getFullYear()
  const pad = (n: number) => String(n).padStart(2, '0')
  const daysDiff = (dateStr: string) => {
    const d = new Date(dateStr)
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }
  const getStatus = (dateStr: string): 'overdue' | 'due_soon' | 'upcoming' => {
    const d = daysDiff(dateStr)
    if (d < 0) return 'overdue'
    if (d <= 7) return 'due_soon'
    return 'upcoming'
  }

  const lastDay = getLastDayOfMonth(year, month)
  const pf15 = `${year}-${pad(month)}-15`
  const esi15 = `${year}-${pad(month)}-15`
  // TDS for current month is due by 7th of NEXT month
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthYear = month === 12 ? year + 1 : year
  const tds7 = `${nextMonthYear}-${pad(nextMonth)}-07`
  const ptEnd = `${year}-${pad(month)}-${pad(lastDay)}`
  const periodLabel = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }) + ' ' + year

  return [
    { id: `pf-${month}-${year}`, name: 'PF ECR Filing', due_date: pf15, period: periodLabel, status: getStatus(pf15), description: 'Submit PF ECR challan to EPFO by 15th of every month' },
    { id: `esi-${month}-${year}`, name: 'ESI Challan', due_date: esi15, period: periodLabel, status: getStatus(esi15), description: 'Deposit ESI challan to ESIC by 15th of every month' },
    { id: `tds-${month}-${year}`, name: 'TDS Payment', due_date: tds7, period: periodLabel, status: getStatus(tds7), description: `Deposit TDS to government by 7th of following month (${new Date(nextMonthYear, nextMonth - 1, 1).toLocaleString('default', { month: 'long' })} ${nextMonthYear})` },
    { id: `pt-${month}-${year}`, name: 'Professional Tax', due_date: ptEnd, period: periodLabel, status: getStatus(ptEnd), description: `Pay PT to state government by end of month (${pad(lastDay)}th)` },
  ]
}

/** Mask PAN for non-superadmin: ABCDE1234F → ABCDE****F */
function maskPAN(pan: string | null | undefined): string {
  if (!pan || pan.length < 10) return pan || ''
  return pan.slice(0, 5) + '****' + pan.slice(9)
}

/** Sanitize search input */
function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\'"();]/g, '').trim().slice(0, 100)
}

// ── Schemas ────────────────────────────────────────────────────────────────

const complianceCreateSchema = z.object({
  type: z.string().min(1, 'Compliance type is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE']).optional(),
})

// ── GET Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'overview'
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json({ success: false, error: 'Invalid month or year parameter' }, { status: 400 })
    }
    if (month < 1 || month > 12) {
      return NextResponse.json({ success: false, error: 'Invalid month parameter (1-12)' }, { status: 400 })
    }
    if (year < 2020 || year > 2100) {
      return NextResponse.json({ success: false, error: 'Invalid year parameter' }, { status: 400 })
    }

    const fy = searchParams.get('fy') || getCurrentFinancialYear()
    const parsedPage = parseInt(searchParams.get('page') || '1')
    if (isNaN(parsedPage)) {
      return NextResponse.json({ success: false, error: 'Invalid page parameter' }, { status: 400 })
    }
    const page = Math.max(1, parsedPage)
    const pageSize = 20
    const from = (page - 1) * pageSize
    const search = sanitizeSearch(searchParams.get('search') || '')

    // ── Meta endpoint: return available financial years ──
    if (tab === 'meta') {
      return NextResponse.json({
        success: true,
        data: {
          financial_years: getFinancialYearsList(),
          current_fy: getCurrentFinancialYear(),
        }
      })
    }

    // ── Overview Tab ──
    if (tab === 'overview') {
      const now = new Date()
      // Use requested month/year for overview, not just current month (fixes C5)
      const calendar = buildComplianceCalendar(now, month, year)
      let pfTotal = 0, esiTotal = 0, ptTotal = 0, form16Count = 0
      const errors: string[] = []

      try {
        const { data: pfData, error: pfError } = await adminClient
          .from('epf_monthly_contributions')
          .select('employee_contribution,employer_contribution')
          .eq('month', month)
          .eq('year', year)
        if (pfError) throw pfError
        if (pfData) pfData.forEach((r: { employee_contribution: number; employer_contribution: number }) => {
          pfTotal += (r.employee_contribution || 0) + (r.employer_contribution || 0)
        })
      } catch (err) {
        apiLogger.warn('Compliance PF query failed', { error: err instanceof Error ? err.message : String(err) })
        errors.push('PF data unavailable')
      }

      try {
        const { data: esiData, error: esiError } = await adminClient
          .from('esi_monthly_contributions')
          .select('employee_esi,employer_esi')
          .eq('month', month)
          .eq('year', year)
        if (esiError) throw esiError
        if (esiData) esiData.forEach((r: { employee_esi: number; employer_esi: number }) => {
          esiTotal += (r.employee_esi || 0) + (r.employer_esi || 0)
        })
      } catch (err) {
        apiLogger.warn('Compliance ESI query failed', { error: err instanceof Error ? err.message : String(err) })
        errors.push('ESI data unavailable')
      }

      try {
        const { data: ptData, error: ptError } = await adminClient
          .from('pt_monthly_deductions')
          .select('pt_amount')
          .eq('month', month)
          .eq('year', year)
        if (ptError) throw ptError
        if (ptData) ptData.forEach((r: { pt_amount: number }) => { ptTotal += (r.pt_amount || 0) })
      } catch (err) {
        apiLogger.warn('Compliance PT query failed', { error: err instanceof Error ? err.message : String(err) })
        errors.push('PT data unavailable')
      }

      try {
        const { count, error: f16Error } = await adminClient
          .from('form_16_records')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'generated')
        if (f16Error) throw f16Error
        form16Count = count || 0
      } catch (err) {
        apiLogger.warn('Compliance Form16 query failed', { error: err instanceof Error ? err.message : String(err) })
        errors.push('Form 16 data unavailable')
      }

      return NextResponse.json({
        success: true,
        data: {
          pf_total: pfTotal,
          esi_total: esiTotal,
          pt_total: ptTotal,
          form16_count: form16Count,
          calendar,
          month,
          year,
        },
        ...(errors.length > 0 ? { warnings: errors } : {})
      })
    }

    // ── PF Tab ──
    if (tab === 'pf') {
      // First get TOTAL summary across ALL records (not just current page) - fixes C4
      let totalSummary = { total_employee_contribution: 0, total_employer_contribution: 0, total_deposited: 0 }
      try {
        const { data: allPF } = await adminClient
          .from('epf_monthly_contributions')
          .select('employee_contribution,employer_contribution')
          .eq('month', month)
          .eq('year', year)
        if (allPF) {
          const s = allPF.reduce((a: { ec: number; er: number }, r: { employee_contribution: number; employer_contribution: number }) => ({
            ec: a.ec + (r.employee_contribution || 0),
            er: a.er + (r.employer_contribution || 0)
          }), { ec: 0, er: 0 })
          totalSummary = { total_employee_contribution: s.ec, total_employer_contribution: s.er, total_deposited: s.ec + s.er }
        }
      } catch (err) {
        apiLogger.warn('PF summary query failed', { error: err instanceof Error ? err.message : String(err) })
      }

      // Build paginated query with optional search
      let query = adminClient
        .from('epf_monthly_contributions')
        .select('user_id,employee_contribution,employer_contribution,basic_wages,status,employee_profile!inner(first_name,last_name,employee_id)', { count: 'exact' })
        .eq('month', month)
        .eq('year', year)

      if (search) {
        query = query.or(`employee_profile.first_name.ilike.%${search}%,employee_profile.last_name.ilike.%${search}%,employee_profile.employee_id.ilike.%${search}%`)
      }

      const { data, count, error } = await query.order('employee_profile(first_name)').range(from, from + pageSize - 1)

      if (error) {
        apiLogger.error('PF tab query failed', { error: 'An unexpected error occurred', month, year })
        return NextResponse.json({ success: false, error: 'Failed to fetch PF data: ' + error.message }, { status: 500 })
      }

      const rows = (data || []).map((r: Record<string, unknown>) => {
        const ep = r.employee_profile as { first_name?: string; last_name?: string; employee_id?: string } | null
        return {
          user_id: r.user_id,
          employee_id: ep?.employee_id || '',
          name: ((ep?.first_name || '') + ' ' + (ep?.last_name || '')).trim(),
          basic_salary: (r.basic_wages as number) || 0,
          employee_contribution: (r.employee_contribution as number) || 0,
          employer_contribution: (r.employer_contribution as number) || 0,
          total: ((r.employee_contribution as number) || 0) + ((r.employer_contribution as number) || 0),
          status: (r.status as string) || 'pending',
        }
      })

      const totalCount = count || 0
      return NextResponse.json({
        success: true,
        data: rows,
        summary: {
          total_employees: totalCount,
          ...totalSummary,
        },
        meta: { total: totalCount, page, total_pages: Math.max(1, Math.ceil(totalCount / pageSize)) }
      })
    }

    // ── ESI Tab ──
    if (tab === 'esi') {
      // Total summary across ALL records (not just current page) - fixes C4
      let totalSummary = { total_employee_esi: 0, total_employer_esi: 0, total_esi: 0 }
      try {
        const { data: allESI } = await adminClient
          .from('esi_monthly_contributions')
          .select('employee_esi,employer_esi')
          .eq('month', month)
          .eq('year', year)
        if (allESI) {
          const s = allESI.reduce((a: { ee: number; er: number }, r: { employee_esi: number; employer_esi: number }) => ({
            ee: a.ee + (r.employee_esi || 0),
            er: a.er + (r.employer_esi || 0)
          }), { ee: 0, er: 0 })
          totalSummary = { total_employee_esi: s.ee, total_employer_esi: s.er, total_esi: s.ee + s.er }
        }
      } catch (err) {
        apiLogger.warn('ESI summary query failed', { error: err instanceof Error ? err.message : String(err) })
      }

      let query = adminClient
        .from('esi_monthly_contributions')
        .select('user_id,employee_esi,employer_esi,gross_wages,status,employee_profile!inner(first_name,last_name,employee_id)', { count: 'exact' })
        .eq('month', month)
        .eq('year', year)

      if (search) {
        query = query.or(`employee_profile.first_name.ilike.%${search}%,employee_profile.last_name.ilike.%${search}%,employee_profile.employee_id.ilike.%${search}%`)
      }

      const { data, count, error } = await query.order('employee_profile(first_name)').range(from, from + pageSize - 1)

      if (error) {
        apiLogger.error('ESI tab query failed', { error: 'An unexpected error occurred', month, year })
        return NextResponse.json({ success: false, error: 'Failed to fetch ESI data: ' + error.message }, { status: 500 })
      }

      const rows = (data || []).map((r: Record<string, unknown>) => {
        const ep = r.employee_profile as { first_name?: string; last_name?: string; employee_id?: string } | null
        return {
          user_id: r.user_id,
          employee_id: ep?.employee_id || '',
          name: ((ep?.first_name || '') + ' ' + (ep?.last_name || '')).trim(),
          gross_salary: (r.gross_wages as number) || 0,
          employee_esi: (r.employee_esi as number) || 0,
          employer_esi: (r.employer_esi as number) || 0,
          total_esi: ((r.employee_esi as number) || 0) + ((r.employer_esi as number) || 0),
          status: (r.status as string) || 'pending',
        }
      })

      const totalCount = count || 0
      return NextResponse.json({
        success: true,
        data: rows,
        summary: {
          employees_covered: totalCount,
          ...totalSummary,
        },
        meta: { total: totalCount, page, total_pages: Math.max(1, Math.ceil(totalCount / pageSize)) }
      })
    }

    // ── PT Tab ──
    if (tab === 'pt') {
      let query = adminClient
        .from('pt_monthly_deductions')
        .select('user_id,state,gross_salary,pt_amount,month,year,status,employee_profile!inner(first_name,last_name,employee_id)', { count: 'exact' })
        .eq('month', month)
        .eq('year', year)

      if (search) {
        query = query.or(`employee_profile.first_name.ilike.%${search}%,employee_profile.last_name.ilike.%${search}%,employee_profile.employee_id.ilike.%${search}%`)
      }

      const { data, count, error } = await query.order('employee_profile(first_name)').range(from, from + pageSize - 1)

      if (error) {
        apiLogger.error('PT tab query failed', { error: 'An unexpected error occurred', month, year })
        return NextResponse.json({ success: false, error: 'Failed to fetch Professional Tax data: ' + error.message }, { status: 500 })
      }

      // Calculate PT totals across all records
      let ptTotalAmount = 0
      try {
        const { data: allPT } = await adminClient
          .from('pt_monthly_deductions')
          .select('pt_amount')
          .eq('month', month)
          .eq('year', year)
        if (allPT) allPT.forEach((r: { pt_amount: number }) => { ptTotalAmount += (r.pt_amount || 0) })
      } catch { /* continue without total */ }

      const rows = (data || []).map((r: Record<string, unknown>) => {
        const ep = r.employee_profile as { first_name?: string; last_name?: string; employee_id?: string } | null
        return {
          user_id: r.user_id,
          employee_id: ep?.employee_id || '',
          name: ((ep?.first_name || '') + ' ' + (ep?.last_name || '')).trim(),
          state: (r.state as string) || '',
          gross_salary: (r.gross_salary as number) || 0,
          pt_amount: (r.pt_amount as number) || 0,
          month: `${r.month}/${r.year}`,
          status: (r.status as string) || 'pending',
        }
      })

      const totalCount = count || 0
      return NextResponse.json({
        success: true,
        data: rows,
        summary: { total_pt: ptTotalAmount, total_employees: totalCount },
        meta: { total: totalCount, page, total_pages: Math.max(1, Math.ceil(totalCount / pageSize)) }
      })
    }

    // ── TDS Tab ──
    if (tab === 'tds') {
      let query = adminClient
        .from('form_16_records')
        .select('user_id,financial_year,gross_salary_fy,total_tds,status,employee_profile!inner(first_name,last_name,employee_id,pan_number)', { count: 'exact' })
        .eq('financial_year', fy)

      if (search) {
        query = query.or(`employee_profile.first_name.ilike.%${search}%,employee_profile.last_name.ilike.%${search}%,employee_profile.employee_id.ilike.%${search}%`)
      }

      const { data, count, error } = await query.order('employee_profile(first_name)').range(from, from + pageSize - 1)

      if (error) {
        // Fallback: show employees even if form_16_records table doesn't exist yet
        apiLogger.warn('TDS form_16_records query failed, falling back to employee_profile', { error: 'An unexpected error occurred' })
        try {
          let fallbackQuery = adminClient
            .from('employee_profile')
            .select('user_id,first_name,last_name,employee_id,pan_number', { count: 'exact' })
            .eq('status', 'active')

          if (search) {
            const safeSearch = search.replace(/[%_\\]/g, '\\$&')
            fallbackQuery = fallbackQuery.or(`first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,employee_id.ilike.%${safeSearch}%`)
          }

          const { data: epData, count: epCount } = await fallbackQuery.order('first_name').range(from, from + pageSize - 1)
          const rows = (epData || []).map((r: Record<string, unknown>) => ({
            user_id: r.user_id,
            employee_id: (r.employee_id as string) || '',
            name: (((r.first_name as string) || '') + ' ' + ((r.last_name as string) || '')).trim(),
            pan: maskPAN(r.pan_number as string),
            gross_salary_fy: 0,
            total_tds: 0,
            form16_status: 'not_generated',
          }))
          const total = epCount || 0
          return NextResponse.json({
            success: true,
            data: rows,
            meta: { total, page, total_pages: Math.max(1, Math.ceil(total / pageSize)) },
            warnings: ['Form 16 records table not available. Showing employee list.']
          })
        } catch {
          return NextResponse.json({ success: false, error: 'Failed to fetch TDS data' }, { status: 500 })
        }
      }

      const rows = (data || []).map((r: Record<string, unknown>) => {
        const ep = r.employee_profile as { first_name?: string; last_name?: string; employee_id?: string; pan_number?: string } | null
        return {
          user_id: r.user_id,
          employee_id: ep?.employee_id || '',
          name: ((ep?.first_name || '') + ' ' + (ep?.last_name || '')).trim(),
          pan: maskPAN(ep?.pan_number),
          gross_salary_fy: (r.gross_salary_fy as number) || 0,
          total_tds: (r.total_tds as number) || 0,
          form16_status: (r.status as string) || 'not_generated',
        }
      })

      const totalCount = count || 0
      return NextResponse.json({
        success: true,
        data: rows,
        meta: { total: totalCount, page, total_pages: Math.max(1, Math.ceil(totalCount / pageSize)) }
      })
    }

    // ── PT Slabs (reference data from database or defaults) ──
    if (tab === 'pt_slabs') {
      try {
        const { data: slabs } = await adminClient
          .from('professional_tax_slabs')
          .select('state_code,min_salary,max_salary,tax_amount,effective_from')
          .order('state_code')
          .order('min_salary')
        if (slabs && slabs.length > 0) {
          return NextResponse.json({ success: true, data: slabs })
        }
      } catch { /* fallback to hardcoded */ }

      // Hardcoded reference if DB table doesn't exist
      return NextResponse.json({
        success: true,
        data: [
          { state: 'Maharashtra', slabs: 'Up to Rs.7,500: Nil | Rs.7,501-Rs.10,000: Rs.175/mo | Above Rs.10,000: Rs.200/mo (Rs.300 in Feb)' },
          { state: 'Karnataka', slabs: 'Up to Rs.15,000: Nil | Above Rs.15,000: Rs.200/mo' },
          { state: 'Telangana', slabs: 'Up to Rs.15,000: Nil | Rs.15,001-Rs.20,000: Rs.150/mo | Above Rs.20,000: Rs.200/mo' },
          { state: 'West Bengal', slabs: 'Up to Rs.10,000: Nil | Rs.10,001-Rs.15,000: Rs.110/mo | Rs.15,001-Rs.25,000: Rs.130/mo | Rs.25,001-Rs.40,000: Rs.150/mo | Above Rs.40,000: Rs.200/mo' },
          { state: 'Tamil Nadu', slabs: 'Above Rs.21,000: Rs.208/mo (half-yearly payment)' },
          { state: 'Gujarat', slabs: 'Above Rs.12,000: Rs.200/mo' },
        ],
        source: 'defaults'
      })
    }

    return NextResponse.json({ success: false, error: 'Unknown tab: ' + tab }, { status: 400 })
  } catch (error) {
    const errorId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    apiLogger.error('HR Compliance API error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// ── POST Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const body = await request.json()
    const parsed = complianceCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { type, title, description, due_date, status } = parsed.data

    // Insert into compliance_records and also create audit log
    const { data, error } = await adminClient
      .from('compliance_records')
      .insert({
        type,
        title,
        description: description || null,
        due_date: due_date || null,
        status: status || 'PENDING',
        created_by: user.id,
      })
      .select()
      .maybeSingle()

    if (error) throw error

    // Audit log
    try {
      await adminClient.from('employee_activity_logs').insert({
        performed_by: user.id,
        action_type: 'CREATE',
        module_name: 'compliance',
        description: `Created compliance record: ${title} (${type})`,
        metadata: { type, title, status: status || 'PENDING' },
      })
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    const errorId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    apiLogger.error('HR Compliance POST error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
