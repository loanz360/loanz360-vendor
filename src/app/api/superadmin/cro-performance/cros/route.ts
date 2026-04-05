export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - List all CROs for target assignment
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get all CROs
    const { data: cros, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        sub_role,
        status
      `)
      .or('sub_role.eq.CRO,sub_role.eq.cro')
      .eq('status', 'ACTIVE')
      .order('full_name')

    if (error) {
      apiLogger.error('Error fetching CROs', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Get employee IDs
    const croIds = cros?.map(c => c.id) || []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, employee_id')
      .in('user_id', croIds)

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.employee_id]) || [])

    // Enrich with employee IDs
    const enrichedCros = cros?.map(c => ({
      ...c,
      employee_id: profileMap.get(c.id) || 'N/A'
    }))

    return NextResponse.json({
      success: true,
      data: enrichedCros
    })

  } catch (error) {
    apiLogger.error('Error in GET /cro-performance/cros', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
