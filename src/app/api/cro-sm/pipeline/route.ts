
import { NextRequest, NextResponse } from 'next/server'
import { verifyCROStateManagerAuth } from '@/lib/api/cro-manager-middleware'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  const auth = await verifyCROStateManagerAuth(request)
  if (!auth.success) return auth.response

  const { supabase, teamCROIds, requestId } = auth.context

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'contacts'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const offset = (page - 1) * limit

    if (teamCROIds.length === 0) {
      return NextResponse.json({
        success: true, data: [],
        meta: { pagination: { page, limit, total: 0, totalPages: 0 } },
      })
    }

    // CRO name lookup
    const { data: profiles } = await supabase
      .from('employee_profile')
      .select('user_id, first_name, last_name')
      .in('user_id', teamCROIds)

    const croNameMap = new Map<string, string>()
    profiles?.forEach((p: { user_id: string; first_name: string; last_name: string }) => {
      croNameMap.set(p.user_id, `${p.first_name} ${p.last_name}`)
    })

    let data: Record<string, unknown>[] = []
    let total = 0

    if (type === 'contacts') {
      let query = supabase
        .from('crm_contacts')
        .select('id, name, phone, loan_type, status, assigned_to_cro, created_at', { count: 'exact' })
        .in('assigned_to_cro', teamCROIds)
      if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
      if (status) query = query.eq('status', status)

      const { data: contacts, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      data = (contacts || []).map((c) => ({
        id: c.id, customer_name: c.name, phone: c.phone, loan_type: c.loan_type || '',
        status: c.status, cro_name: croNameMap.get(c.assigned_to_cro) || 'Unknown', created_at: c.created_at,
      }))
      total = count || 0
    } else if (type === 'leads') {
      let query = supabase
        .from('crm_leads')
        .select('id, customer_name, phone, loan_type, status, stage, cro_id, created_at', { count: 'exact' })
        .in('cro_id', teamCROIds)
      if (search) query = query.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%`)
      if (status) query = query.eq('status', status)

      const { data: leads, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      data = (leads || []).map((l) => ({
        id: l.id, customer_name: l.customer_name, phone: l.phone, loan_type: l.loan_type || '',
        status: l.status, stage: l.stage, cro_name: croNameMap.get(l.cro_id) || 'Unknown', created_at: l.created_at,
      }))
      total = count || 0
    } else if (type === 'deals') {
      let query = supabase
        .from('crm_deals')
        .select('id, customer_name, phone, loan_type, status, stage, cro_id, created_at', { count: 'exact' })
        .in('cro_id', teamCROIds)
      if (search) query = query.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%`)
      if (status) query = query.eq('status', status)

      const { data: deals, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
      data = (deals || []).map((d) => ({
        id: d.id, customer_name: d.customer_name, phone: d.phone, loan_type: d.loan_type || '',
        status: d.status, stage: d.stage, cro_name: croNameMap.get(d.cro_id) || 'Unknown', created_at: d.created_at,
      }))
      total = count || 0
    }

    return NextResponse.json({
      success: true, data,
      meta: { pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    })
  } catch (error) {
    logger.error('[CRO-SM Pipeline] Error', { requestId, error: error instanceof Error ? error.message : 'Unknown' })
    return NextResponse.json({ success: false, error: 'Failed to fetch pipeline' }, { status: 500 })
  }
}
