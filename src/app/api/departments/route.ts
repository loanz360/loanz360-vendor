export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/departments - Get all departments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active departments
    const { data: departments, error } = await supabase
      .from('departments')
      .select(`
        *,
        department_head:employees!departments_department_head_id_fkey(id, full_name, email),
        parent_department:departments!departments_parent_department_id_fkey(id, name, code)
      `)
      .eq('is_active', true)
      .order('name')

    if (error) {
      apiLogger.error('Error fetching departments', error)
      return NextResponse.json(
        { error: 'Failed to fetch departments' },
        { status: 500 }
      )
    }

    // Get workload for each department
    const { data: workload } = await supabase
      .rpc('get_department_workload')

    return NextResponse.json({ departments, workload })
  } catch (error) {
    apiLogger.error('Error in GET /api/departments', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
