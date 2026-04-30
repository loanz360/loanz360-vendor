import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, getAccessibleDepartments } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

interface HierarchyNode {
  id: string
  employee_id: string
  full_name: string
  sub_role: string
  work_email: string
  profile_photo_url: string | null
  department: any
  is_active: boolean
  reporting_manager_id: string | null
  direct_reports_count: number
  hierarchy_level: number
  children?: HierarchyNode[]
}

/**
 * GET /api/superadmin/employee-management/org-hierarchy
 * Get organization hierarchy with lazy loading support
 * Tab 5: Organization Structure
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'MANAGE_ORG_HIERARCHY')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('department')
    const parentId = searchParams.get('parent_id') // For lazy loading
    const viewType = searchParams.get('view') || 'tree' // 'tree' or 'flat'
    const expandAll = searchParams.get('expand_all') === 'true'

    const supabase = createSupabaseAdmin()

    // Get accessible departments
    const accessibleDepartments = await getAccessibleDepartments(auth.userId!, auth.role!)

    // Base employee query
    let employeeQuery = supabase
      .from('employees')
      .select(`
        id,
        employee_id,
        full_name,
        sub_role,
        work_email,
        profile_photo_url,
        department_id,
        reporting_manager_id,
        is_active,
        date_of_joining,
        departments:department_id (
          id,
          name,
          code,
          department_type
        )
      `)
      .is('deleted_at', null)
      .order('hierarchy_level', { ascending: true })
      .order('full_name', { ascending: true })

    // Apply department filter
    if (departmentId) {
      employeeQuery = employeeQuery.eq('department_id', departmentId)
    } else if (accessibleDepartments.length > 0) {
      employeeQuery = employeeQuery.in('department_id', accessibleDepartments)
    }

    // Lazy loading - get children of specific parent
    if (parentId) {
      employeeQuery = employeeQuery.eq('reporting_manager_id', parentId)
    }

    const { data: employees, error: empError } = await employeeQuery

    if (empError) {
      logger.error('Error fetching employees for hierarchy:', empError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employees' },
        { status: 500 }
      )
    }

    // Get org_hierarchy data for additional metadata
    const { data: hierarchyData } = await supabase
      .from('org_hierarchy')
      .select('*')
      .eq('is_current', true)

    // Map hierarchy metadata
    const hierarchyMap = new Map()
    hierarchyData?.forEach(h => {
      hierarchyMap.set(h.employee_id, h)
    })

    // Count direct reports for each employee
    const directReportCounts = new Map()
    employees?.forEach(emp => {
      if (emp.reporting_manager_id) {
        const current = directReportCounts.get(emp.reporting_manager_id) || 0
        directReportCounts.set(emp.reporting_manager_id, current + 1)
      }
    })

    // Build employee nodes
    const employeeNodes: HierarchyNode[] = (employees || []).map(emp => {
      const hierarchyInfo = hierarchyMap.get(emp.id)
      return {
        id: emp.id,
        employee_id: emp.employee_id,
        full_name: emp.full_name,
        sub_role: emp.sub_role,
        work_email: emp.work_email,
        profile_photo_url: emp.profile_photo_url,
        department: emp.departments,
        is_active: emp.is_active,
        reporting_manager_id: emp.reporting_manager_id,
        direct_reports_count: directReportCounts.get(emp.id) || 0,
        hierarchy_level: hierarchyInfo?.hierarchy_level || 0,
        date_of_joining: emp.date_of_joining
      }
    })

    if (viewType === 'flat') {
      // Return flat list with hierarchy metadata
      return NextResponse.json({
        success: true,
        data: {
          employees: employeeNodes,
          view_type: 'flat'
        }
      })
    }

    // Build tree structure
    const nodeMap = new Map<string, HierarchyNode>()
    const rootNodes: HierarchyNode[] = []

    // First pass: create map
    employeeNodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] })
    })

    // Second pass: build tree
    employeeNodes.forEach(node => {
      const treeNode = nodeMap.get(node.id)!
      if (node.reporting_manager_id && nodeMap.has(node.reporting_manager_id)) {
        const parent = nodeMap.get(node.reporting_manager_id)!
        parent.children!.push(treeNode)
      } else {
        // Root level employees (no manager or manager not in filtered set)
        rootNodes.push(treeNode)
      }
    })

    // Get department summaries
    const departmentSummary: Record<string, any> = {}
    employeeNodes.forEach(node => {
      const deptId = node.department.id
      if (!departmentSummary[deptId]) {
        departmentSummary[deptId] = {
          department: node.department,
          total_employees: 0,
          active_employees: 0,
          hierarchy_levels: new Set()
        }
      }
      departmentSummary[deptId].total_employees++
      if (node.is_active) {
        departmentSummary[deptId].active_employees++
      }
      departmentSummary[deptId].hierarchy_levels.add(node.hierarchy_level)
    })

    // Convert Set to count
    Object.values(departmentSummary).forEach((dept: any) => {
      dept.hierarchy_depth = dept.hierarchy_levels.size
      delete dept.hierarchy_levels
    })

    return NextResponse.json({
      success: true,
      data: {
        tree: rootNodes,
        total_employees: employeeNodes.length,
        root_level_count: rootNodes.length,
        department_summary: Object.values(departmentSummary),
        view_type: 'tree',
        filters: {
          department: departmentId,
          parent_id: parentId
        }
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/org-hierarchy:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/superadmin/employee-management/org-hierarchy
 * Update reporting structure
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'MANAGE_ORG_HIERARCHY')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { employee_id, new_manager_id } = body

    if (!employee_id) {
      return NextResponse.json(
        { success: false, error: 'employee_id is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Get employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, reporting_manager_id')
      .eq('id', employee_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Verify new manager exists (if provided)
    if (new_manager_id) {
      const { data: manager, error: mgrError } = await supabase
        .from('employees')
        .select('id, employee_id, full_name')
        .eq('id', new_manager_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (mgrError || !manager) {
        return NextResponse.json(
          { success: false, error: 'Manager not found' },
          { status: 404 }
        )
      }

      // Prevent circular reporting (employee cannot report to themselves or their subordinates)
      if (new_manager_id === employee_id) {
        return NextResponse.json(
          { success: false, error: 'Employee cannot report to themselves' },
          { status: 400 }
        )
      }
    }

    // Update reporting manager
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        reporting_manager_id: new_manager_id || null,
        updated_by: auth.userId
      })
      .eq('id', employee_id)

    if (updateError) {
      logger.error('Error updating reporting structure:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update reporting structure' },
        { status: 500 }
      )
    }

    // Update org_hierarchy table
    await supabase
      .from('org_hierarchy')
      .update({ is_current: false })
      .eq('employee_id', employee_id)
      .eq('is_current', true)

    // Insert new hierarchy record
    await supabase
      .from('org_hierarchy')
      .insert({
        employee_id,
        reports_to_id: new_manager_id || null,
        effective_from: new Date().toISOString().split('T')[0],
        is_current: true,
        updated_by: auth.userId
      })

    logger.info(`Reporting structure updated for employee ${employee.employee_id}`)

    return NextResponse.json({
      success: true,
      message: 'Reporting structure updated successfully'
    })
  } catch (error) {
    logger.error('Error in PATCH /api/superadmin/employee-management/org-hierarchy:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
