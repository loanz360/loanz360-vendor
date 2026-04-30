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
    const type = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''
    const offset = (page - 1) * limit

    let query = supabase
      .from('partners')
      .select('id, partner_id, full_name, work_email, mobile_number, partner_type, status, city, state, created_at, updated_at, rating', { count: 'exact' })

    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`full_name.ilike.%${safeSearch}%,work_email.ilike.%${safeSearch}%,mobile_number.ilike.%${safeSearch}%,partner_id.ilike.%${safeSearch}%`)
      }
    }
    if (type) query = query.eq('partner_type', type)
    if (status) query = query.eq('status', status)

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: partners, error, count } = await query

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch partners' }, { status: 500 })
    }

    // Get lead counts per partner
    const partnerIds = (partners || []).map((p: unknown) => p.id)
    let leadCounts: Record<string, number> = {}
    let commissions: Record<string, number> = {}
    if (partnerIds.length > 0) {
      try {
        const { data: leads } = await supabase
          .from('partner_leads')
          .select('partner_id, status')
          .in('partner_id', partnerIds)
        if (leads) {
          leads.forEach((l: unknown) => {
            leadCounts[l.partner_id] = (leadCounts[l.partner_id] || 0) + 1
          })
        }
      } catch { /* ignore */ }

      try {
        const { data: payouts } = await supabase
          .from('partner_payouts')
          .select('partner_id, amount, status')
          .in('partner_id', partnerIds)
        if (payouts) {
          payouts.forEach((p: unknown) => {
            commissions[p.partner_id] = (commissions[p.partner_id] || 0) + (p.amount || 0)
          })
        }
      } catch { /* ignore */ }
    }

    const enriched = (partners || []).map((p: unknown) => ({
      ...p,
      totalLeads: leadCounts[p.id] || 0,
      totalCommission: commissions[p.id] || 0,
      location: [p.city, p.state].filter(Boolean).join(', ') || 'N/A'
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
