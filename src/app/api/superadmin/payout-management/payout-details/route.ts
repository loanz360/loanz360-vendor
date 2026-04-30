import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/superadmin/payout-management/payout-details
 * Unified payout details view - lists all payout applications from CP and Partner tables
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ALL'
    const type = searchParams.get('type') || 'all'
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const records: unknown[] = []
    let totalCount = 0

    // Fetch CP applications
    if (type === 'all' || type === 'cp') {
      let cpQuery = supabase
        .from('cp_applications')
        .select('id, app_id, applicant_name, application_number, bank_name, loan_type, disbursed_amount, commission_percentage, commission_amount, payment_amount, payment_date, payment_transaction_id, status, bank_sheet_matched, created_at, cp_partner_id', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (status !== 'ALL') cpQuery = cpQuery.eq('status', status)
      if (search) {
        cpQuery = cpQuery.or(`app_id.ilike.%${search}%,applicant_name.ilike.%${search}%,application_number.ilike.%${search}%,bank_name.ilike.%${search}%`)
      }

      const { data: cpApps, count: cpCount } = await cpQuery.range(0, 999)

      if (cpApps) {
        // Get partner names for CP
        const cpPartnerIds = [...new Set(cpApps.map(a => a.cp_partner_id).filter(Boolean))]
        let cpPartnerMap: Record<string, { name: string; code: string }> = {}
        if (cpPartnerIds.length > 0) {
          const { data: partners } = await supabase
            .from('partners')
            .select('id, full_name, partner_id')
            .in('id', cpPartnerIds)
          if (partners) {
            cpPartnerMap = Object.fromEntries(partners.map(p => [p.id, { name: p.full_name || 'CP Partner', code: p.partner_id || '' }]))
          }
        }

        cpApps.forEach(a => {
          const partner = cpPartnerMap[a.cp_partner_id] || { name: a.applicant_name || 'CP Partner', code: '' }
          records.push({
            id: a.id,
            app_id: a.app_id || a.application_number,
            source: 'CP',
            partner_name: partner.name,
            partner_code: partner.code,
            customer_name: a.applicant_name || '',
            bank_name: a.bank_name || '',
            loan_type: a.loan_type || '',
            disbursed_amount: a.disbursed_amount || 0,
            commission_percentage: a.commission_percentage || 0,
            commission_amount: a.commission_amount || 0,
            payment_amount: a.payment_amount,
            payment_date: a.payment_date,
            payment_transaction_id: a.payment_transaction_id,
            status: a.status,
            is_team_override: false,
            bank_sheet_matched: a.bank_sheet_matched || false,
            created_at: a.created_at,
          })
        })
        totalCount += cpCount || 0
      }
    }

    // Fetch Partner applications
    if (type === 'all' || type === 'ba' || type === 'bp') {
      let partnerQuery = supabase
        .from('partner_payout_applications')
        .select('id, app_id, partner_type, partner_code, customer_name, bank_name, loan_type, disbursed_amount, commission_percentage, expected_commission_amount, payment_amount, payment_date, payment_transaction_id, status, is_team_override, bank_sheet_matched, created_at, partner_id', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (type === 'ba') partnerQuery = partnerQuery.eq('partner_type', 'BA')
      if (type === 'bp') partnerQuery = partnerQuery.eq('partner_type', 'BP')
      if (status !== 'ALL') partnerQuery = partnerQuery.eq('status', status)
      if (search) {
        partnerQuery = partnerQuery.or(`app_id.ilike.%${search}%,customer_name.ilike.%${search}%,bank_name.ilike.%${search}%,partner_code.ilike.%${search}%`)
      }

      const { data: partnerApps, count: partnerCount } = await partnerQuery.range(0, 999)

      if (partnerApps) {
        const partnerIds = [...new Set(partnerApps.map(a => a.partner_id).filter(Boolean))]
        let partnerNameMap: Record<string, string> = {}
        if (partnerIds.length > 0) {
          const { data: partners } = await supabase
            .from('partners')
            .select('id, full_name')
            .in('id', partnerIds)
          if (partners) {
            partnerNameMap = Object.fromEntries(partners.map(p => [p.id, p.full_name || 'Partner']))
          }
        }

        partnerApps.forEach(a => {
          records.push({
            id: a.id,
            app_id: a.app_id,
            source: a.partner_type || 'BA',
            partner_name: partnerNameMap[a.partner_id] || 'Partner',
            partner_code: a.partner_code || '',
            customer_name: a.customer_name || '',
            bank_name: a.bank_name || '',
            loan_type: a.loan_type || '',
            disbursed_amount: a.disbursed_amount || 0,
            commission_percentage: a.commission_percentage || 0,
            commission_amount: a.expected_commission_amount || 0,
            payment_amount: a.payment_amount,
            payment_date: a.payment_date,
            payment_transaction_id: a.payment_transaction_id,
            status: a.status,
            is_team_override: a.is_team_override || false,
            bank_sheet_matched: a.bank_sheet_matched || false,
            created_at: a.created_at,
          })
        })
        totalCount += partnerCount || 0
      }
    }

    // Sort by date and paginate
    records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const paginatedRecords = records.slice((page - 1) * limit, page * limit)

    // Stats
    const creditedCount = records.filter(r => r.status === 'PAYOUT_CREDITED').length
    const pendingCount = records.filter(r => !['PAYOUT_CREDITED', 'REJECTED'].includes(r.status)).length
    const totalAmount = records
      .filter(r => r.status === 'PAYOUT_CREDITED')
      .reduce((sum, r) => sum + (r.payment_amount || r.commission_amount || 0), 0)

    return NextResponse.json({
      success: true,
      records: paginatedRecords,
      stats: {
        total: totalCount,
        credited: creditedCount,
        pending: pendingCount,
        totalAmount,
      },
      pagination: {
        page,
        limit,
        total: records.length,
        totalPages: Math.ceil(records.length / limit),
      },
    })
  } catch (error) {
    logger.error('Error in payout details API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
