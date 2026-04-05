export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface OrgEmployee {
  id: string
  user_id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  employee_id: string | null
  sub_role: string | null
  role: string | null
  department: string | null
  profile_photo_url: string | null
  employee_status: string
  reporting_manager_id: string | null
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) return NextResponse.json({ success: false, error: 'HR access required' }, { status: 403 })

    // Fetch employees
    const { data: employees, error: empError } = await adminClient
      .from('employee_profile')
      .select('id, user_id, full_name, first_name, last_name, employee_id, sub_role, role, department, profile_photo_url, employee_status, reporting_manager_id')
      .neq('employee_status', 'terminated')
      .order('full_name', { ascending: true })

    if (empError) {
      apiLogger.error('Failed to fetch employees for org chart', empError)
      return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 })
    }

    // Fetch hierarchy relationships
    const { data: hierarchy } = await adminClient.from('employee_hierarchy').select('employee_id, manager_id, level')

    // Build lookup for manager relationships
    const managerMap: Record<string, string | null> = {}
    if (hierarchy) {
      hierarchy.forEach((h: { employee_id: string; manager_id: string | null }) => { managerMap[h.employee_id] = h.manager_id })
    }

    // Normalize employees
    const data = (employees || []).map((emp: OrgEmployee) => {
      const fullName = emp.full_name || `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Unknown"
      const managerId = emp.reporting_manager_id || managerMap[emp.id] || null
      return {
        id: emp.id,
        name: fullName,
        employee_id: emp.employee_id || emp.id.slice(0, 8),
        designation: emp.sub_role || emp.role || 'EMPLOYEE',
        department: emp.department || null,
        manager_id: managerId,
        photo_url: emp.profile_photo_url || null,
        status: emp.employee_status || 'active',
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/org-chart', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) return NextResponse.json({ success: false, error: 'HR access required' }, { status: 403 })

    const body = await request.json()
    const { employee_id, manager_id } = body
    if (!employee_id || !manager_id) return NextResponse.json({ success: false, error: 'employee_id and manager_id are required' }, { status: 400 })
    if (employee_id === manager_id) return NextResponse.json({ success: false, error: 'Employee cannot be their own manager' }, { status: 400 })

    // Validate the new manager exists
    const { data: managerRecord, error: mgrLookupErr } = await adminClient
      .from('employee_profile')
      .select('id')
      .eq('id', manager_id)
      .maybeSingle()
    if (mgrLookupErr) {
      apiLogger.error('PATCH /api/hr/org-chart - manager lookup', mgrLookupErr)
    }
    if (!managerRecord) {
      return NextResponse.json({ success: false, error: 'Manager not found. Please select a valid employee as manager.' }, { status: 404 })
    }

    // Validate the employee exists
    const { data: empRecord, error: empLookupErr } = await adminClient
      .from('employee_profile')
      .select('id')
      .eq('id', employee_id)
      .maybeSingle()
    if (empLookupErr) {
      apiLogger.error('PATCH /api/hr/org-chart - employee lookup', empLookupErr)
    }
    if (!empRecord) {
      return NextResponse.json({ success: false, error: 'Employee not found.' }, { status: 404 })
    }

    // Detect circular references: walk up from manager to ensure employee is not an ancestor
    const visited = new Set<string>([employee_id])
    let currentId: string | null = manager_id
    while (currentId) {
      if (visited.has(currentId)) {
        return NextResponse.json({ success: false, error: 'This assignment would create a circular reporting chain.' }, { status: 400 })
      }
      visited.add(currentId)
      const { data: parentEmp } = await adminClient
        .from('employee_profile')
        .select('reporting_manager_id')
        .eq('id', currentId)
        .maybeSingle()
      currentId = parentEmp?.reporting_manager_id || null
    }

    // Upsert into employee_hierarchy
    const { error: hierarchyError } = await adminClient
      .from('employee_hierarchy')
      .upsert({ employee_id, manager_id }, { onConflict: "employee_id" })

    if (hierarchyError) {
      apiLogger.error('Hierarchy upsert failed, falling back to employee_profile', hierarchyError)
      // Table may not exist yet - try updating employee_profile directly
    }

    // Also update reporting_manager_id in employee_profile if column exists
    await adminClient
      .from('employee_profile')
      .update({ reporting_manager_id: manager_id })
      .eq('id', employee_id)

    return NextResponse.json({ success: true, message: 'Manager assigned successfully' })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/org-chart', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}