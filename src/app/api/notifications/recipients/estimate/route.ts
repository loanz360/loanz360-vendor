import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/notifications/recipients/estimate
 * Estimate the number of recipients based on targeting criteria
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Also check for Super Admin session
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    let isSuperAdmin = false

    if (superAdminSession) {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: session } = await supabaseAdmin
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (session && new Date(session.expires_at) > new Date()) {
        isSuperAdmin = true
      }
    }

    if (!user && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      target_type,
      target_category,
      target_subrole,
      target_geography
    } = body

    const supabaseAdmin = createSupabaseAdmin()
    let count = 0

    // Calculate count based on targeting
    if (target_type === 'all') {
      // Count all users
      const [
        { count: empCount },
        { count: partnerCount },
        { count: customerCount }
      ] = await Promise.all([
        supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('partners').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('customers').select('*', { count: 'exact', head: true })
      ])

      count = (empCount || 0) + (partnerCount || 0) + (customerCount || 0)
    } else if (target_type === 'category') {
      if (target_category === 'employee' || target_category === 'all') {
        let query = supabaseAdmin.from('employees').select('*', { count: 'exact', head: true })

        // Apply geography filters
        if (target_geography?.state_ids?.length > 0) {
          query = query.in('state_id', target_geography.state_ids)
        }
        if (target_geography?.city_ids?.length > 0) {
          query = query.in('city_id', target_geography.city_ids)
        }
        if (target_geography?.branch_ids?.length > 0) {
          query = query.in('branch_id', target_geography.branch_ids)
        }

        const { count: empCount } = await query
        count += empCount || 0
      }

      if (target_category === 'partner' || target_category === 'all') {
        let query = supabaseAdmin.from('partners').select('*', { count: 'exact', head: true })

        if (target_geography?.state_ids?.length > 0) {
          query = query.in('state_id', target_geography.state_ids)
        }
        if (target_geography?.city_ids?.length > 0) {
          query = query.in('city_id', target_geography.city_ids)
        }
        if (target_geography?.branch_ids?.length > 0) {
          query = query.in('branch_id', target_geography.branch_ids)
        }

        const { count: partnerCount } = await query
        count += partnerCount || 0
      }

      if (target_category === 'customer' || target_category === 'all') {
        const { count: customerCount } = await supabaseAdmin
          .from('customers')
          .select('*', { count: 'exact', head: true })
        count += customerCount || 0
      }
    } else if (target_type === 'subrole') {
      if (target_category === 'employee') {
        let query = supabaseAdmin
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('sub_role', target_subrole)

        if (target_geography?.state_ids?.length > 0) {
          query = query.in('state_id', target_geography.state_ids)
        }
        if (target_geography?.city_ids?.length > 0) {
          query = query.in('city_id', target_geography.city_ids)
        }
        if (target_geography?.branch_ids?.length > 0) {
          query = query.in('branch_id', target_geography.branch_ids)
        }

        const { count: empCount } = await query
        count = empCount || 0
      } else if (target_category === 'partner') {
        let query = supabaseAdmin
          .from('partners')
          .select('*', { count: 'exact', head: true })
          .eq('partner_type', target_subrole)

        if (target_geography?.state_ids?.length > 0) {
          query = query.in('state_id', target_geography.state_ids)
        }
        if (target_geography?.city_ids?.length > 0) {
          query = query.in('city_id', target_geography.city_ids)
        }
        if (target_geography?.branch_ids?.length > 0) {
          query = query.in('branch_id', target_geography.branch_ids)
        }

        const { count: partnerCount } = await query
        count = partnerCount || 0
      } else if (target_category === 'customer') {
        const { count: customerCount } = await supabaseAdmin
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('customer_type', target_subrole)
        count = customerCount || 0
      }
    }

    return NextResponse.json({ count })
  } catch (error) {
    apiLogger.error('Error estimating recipients', error)
    return NextResponse.json(
      { error: 'Failed to estimate recipients', count: 0 },
      { status: 500 }
    )
  }
}
