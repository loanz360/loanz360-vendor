/**
 * Intelligent Auto-Assignment Engine for Support Tickets
 * Assigns tickets to employees based on workload, skills, and availability
 */

import { createClient } from '@/lib/supabase/server'

export type AssignmentStrategy =
  | 'round_robin' // Distribute evenly
  | 'workload_based' // Assign to least busy
  | 'skill_based' // Match category to employee skills
  | 'priority_based' // Senior employees for urgent tickets

export interface AssignmentResult {
  success: boolean
  assignedTo?: string
  assignedToName?: string
  strategy: AssignmentStrategy
  reason: string
  error?: string
}

/**
 * Get employee workload (number of active tickets)
 */
async function getEmployeeWorkload(
  supabase: any,
  employeeId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('partner_support_tickets')
    .select('id', { count: 'exact', head: true })
    .or(`assigned_to_partner_support_id.eq.${employeeId},routed_to_employee_id.eq.${employeeId}`)
    .not('status', 'in', '(resolved,closed)')

  if (error) {
    console.error('Error fetching workload:', error)
    return 999 // High number to deprioritize on error
  }

  return data || 0
}

/**
 * Get employees in a department with their current workload
 */
async function getDepartmentEmployees(
  supabase: any,
  department: string
) {
  const { data, error } = await supabase
    .from('department_employees')
    .select(`
      employee_id,
      role,
      profiles!inner (
        id,
        full_name,
        email,
        is_active
      )
    `)
    .eq('department', department)
    .eq('is_active', true)
    .eq('profiles.is_active', true)

  if (error) {
    console.error('Error fetching department employees:', error)
    return []
  }

  // Get workload for each employee
  const employeesWithWorkload = await Promise.all(
    data.map(async (emp: any) => ({
      id: emp.employee_id,
      name: emp.profiles.full_name,
      email: emp.profiles.email,
      role: emp.role,
      workload: await getEmployeeWorkload(supabase, emp.employee_id)
    }))
  )

  return employeesWithWorkload
}

/**
 * Round Robin Assignment
 * Assigns to the employee who was assigned least recently
 */
async function assignRoundRobin(
  supabase: any,
  department: string
): Promise<AssignmentResult> {
  try {
    const employees = await getDepartmentEmployees(supabase, department)

    if (employees.length === 0) {
      return {
        success: false,
        strategy: 'round_robin',
        reason: 'No available employees in department',
        error: 'No employees found'
      }
    }

    // Get last assignment timestamp for each employee
    const employeesWithLastAssignment = await Promise.all(
      employees.map(async (emp: any) => {
        const { data } = await supabase
          .from('partner_support_tickets')
          .select('created_at')
          .or(`assigned_to_partner_support_id.eq.${emp.id},routed_to_employee_id.eq.${emp.id}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          ...emp,
          lastAssignment: data?.created_at ? new Date(data.created_at).getTime() : 0
        }
      })
    )

    // Sort by oldest last assignment (or never assigned)
    employeesWithLastAssignment.sort((a, b) => a.lastAssignment - b.lastAssignment)

    const selected = employeesWithLastAssignment[0]

    return {
      success: true,
      assignedTo: selected.id,
      assignedToName: selected.name,
      strategy: 'round_robin',
      reason: `Round robin: ${selected.name} (last assigned: ${
        selected.lastAssignment === 0 ? 'never' : new Date(selected.lastAssignment).toLocaleString()
      })`
    }
  } catch (error) {
    return {
      success: false,
      strategy: 'round_robin',
      reason: 'Assignment failed',
      error: (error as Error).message
    }
  }
}

/**
 * Workload-Based Assignment
 * Assigns to the employee with the least active tickets
 */
async function assignWorkloadBased(
  supabase: any,
  department: string
): Promise<AssignmentResult> {
  try {
    const employees = await getDepartmentEmployees(supabase, department)

    if (employees.length === 0) {
      return {
        success: false,
        strategy: 'workload_based',
        reason: 'No available employees in department',
        error: 'No employees found'
      }
    }

    // Sort by workload (ascending)
    employees.sort((a: any, b: any) => a.workload - b.workload)

    const selected = employees[0]

    return {
      success: true,
      assignedTo: selected.id,
      assignedToName: selected.name,
      strategy: 'workload_based',
      reason: `Workload based: ${selected.name} (${selected.workload} active tickets)`
    }
  } catch (error) {
    return {
      success: false,
      strategy: 'workload_based',
      reason: 'Assignment failed',
      error: (error as Error).message
    }
  }
}

/**
 * Skill-Based Assignment
 * Assigns based on employee expertise in ticket category
 */
async function assignSkillBased(
  supabase: any,
  department: string,
  category: string
): Promise<AssignmentResult> {
  try {
    const employees = await getDepartmentEmployees(supabase, department)

    if (employees.length === 0) {
      return {
        success: false,
        strategy: 'skill_based',
        reason: 'No available employees in department',
        error: 'No employees found'
      }
    }

    // Get employees with matching skills
    const { data: skillMatches } = await supabase
      .from('employee_skills')
      .select('employee_id, skill_level')
      .in('employee_id', employees.map((e: any) => e.id))
      .eq('skill_category', category)
      .eq('is_active', true)

    if (!skillMatches || skillMatches.length === 0) {
      // No skill match, fall back to workload-based
      return assignWorkloadBased(supabase, department)
    }

    // Find employees with skills, prioritize by skill level and workload
    const skilledEmployees = employees
      .filter((emp: any) =>
        skillMatches.some((skill: any) => skill.employee_id === emp.id)
      )
      .map((emp: any) => {
        const skill = skillMatches.find((s: any) => s.employee_id === emp.id)
        return {
          ...emp,
          skillLevel: skill?.skill_level || 0
        }
      })
      .sort((a: any, b: any) => {
        // First by skill level (descending), then by workload (ascending)
        if (b.skillLevel !== a.skillLevel) {
          return b.skillLevel - a.skillLevel
        }
        return a.workload - b.workload
      })

    const selected = skilledEmployees[0]

    return {
      success: true,
      assignedTo: selected.id,
      assignedToName: selected.name,
      strategy: 'skill_based',
      reason: `Skill based: ${selected.name} (${category} expertise: ${selected.skillLevel}/5, ${selected.workload} active tickets)`
    }
  } catch (error) {
    return {
      success: false,
      strategy: 'skill_based',
      reason: 'Assignment failed',
      error: (error as Error).message
    }
  }
}

/**
 * Priority-Based Assignment
 * Assigns urgent tickets to senior/manager employees
 */
async function assignPriorityBased(
  supabase: any,
  department: string,
  priority: string
): Promise<AssignmentResult> {
  try {
    const employees = await getDepartmentEmployees(supabase, department)

    if (employees.length === 0) {
      return {
        success: false,
        strategy: 'priority_based',
        reason: 'No available employees in department',
        error: 'No employees found'
      }
    }

    // For urgent/high priority, prefer managers and senior employees
    if (priority === 'urgent' || priority === 'high') {
      const seniorEmployees = employees.filter(
        (emp: any) => emp.role === 'manager' || emp.role === 'senior'
      )

      if (seniorEmployees.length > 0) {
        // Among senior employees, pick least busy
        seniorEmployees.sort((a: any, b: any) => a.workload - b.workload)
        const selected = seniorEmployees[0]

        return {
          success: true,
          assignedTo: selected.id,
          assignedToName: selected.name,
          strategy: 'priority_based',
          reason: `Priority based: ${selected.name} (${selected.role}, ${selected.workload} active tickets) - handling ${priority} priority`
        }
      }
    }

    // For normal priority or if no senior employees, use workload-based
    return assignWorkloadBased(supabase, department)
  } catch (error) {
    return {
      success: false,
      strategy: 'priority_based',
      reason: 'Assignment failed',
      error: (error as Error).message
    }
  }
}

/**
 * Main auto-assignment function
 * Intelligently assigns ticket to best available employee
 */
export async function autoAssignTicket(
  ticketId: string,
  strategy: AssignmentStrategy = 'workload_based'
): Promise<AssignmentResult> {
  const supabase = await createClient()

  try {
    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('partner_support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return {
        success: false,
        strategy,
        reason: 'Ticket not found',
        error: ticketError?.message || 'Ticket not found'
      }
    }

    // Check if already assigned
    if (ticket.assigned_to_partner_support_id || ticket.routed_to_employee_id) {
      return {
        success: false,
        strategy,
        reason: 'Ticket already assigned',
        error: 'Ticket is already assigned to an employee'
      }
    }

    // Get department
    const department = ticket.routed_to_department
    if (!department) {
      return {
        success: false,
        strategy,
        reason: 'No department assigned',
        error: 'Ticket must be routed to a department first'
      }
    }

    // Execute assignment based on strategy
    let result: AssignmentResult

    switch (strategy) {
      case 'round_robin':
        result = await assignRoundRobin(supabase, department)
        break

      case 'workload_based':
        result = await assignWorkloadBased(supabase, department)
        break

      case 'skill_based':
        result = await assignSkillBased(supabase, department, ticket.category)
        break

      case 'priority_based':
        result = await assignPriorityBased(supabase, department, ticket.priority)
        break

      default:
        return {
          success: false,
          strategy,
          reason: 'Invalid strategy',
          error: `Unknown strategy: ${strategy}`
        }
    }

    if (!result.success || !result.assignedTo) {
      return result
    }

    // Update ticket with assignment
    const { error: updateError } = await supabase
      .from('partner_support_tickets')
      .update({
        assigned_to_partner_support_id: result.assignedTo,
        status: 'assigned',
        partner_support_status: 'assigned',
        assigned_at: new Date().toISOString()
      })
      .eq('id', ticketId)

    if (updateError) {
      return {
        success: false,
        strategy,
        reason: 'Failed to update ticket',
        error: updateError.message
      }
    }

    // Log activity
    await supabase.from('partner_ticket_activity_log').insert({
      ticket_id: ticketId,
      action_type: 'assigned',
      action_by_type: 'system',
      action_by_name: 'Auto-Assignment Engine',
      description: `Auto-assigned to ${result.assignedToName} using ${strategy} strategy: ${result.reason}`
    })

    return result
  } catch (error) {
    console.error('Auto-assignment error:', error)
    return {
      success: false,
      strategy,
      reason: 'System error',
      error: (error as Error).message
    }
  }
}

/**
 * Batch auto-assign all unassigned tickets in a department
 */
export async function autoAssignDepartmentQueue(
  department: string,
  strategy: AssignmentStrategy = 'workload_based'
): Promise<{ success: number; failed: number; results: AssignmentResult[] }> {
  const supabase = await createClient()

  const { data: unassignedTickets } = await supabase
    .from('partner_support_tickets')
    .select('id')
    .eq('routed_to_department', department)
    .is('assigned_to_partner_support_id', null)
    .is('routed_to_employee_id', null)
    .not('status', 'in', '(resolved,closed)')

  if (!unassignedTickets || unassignedTickets.length === 0) {
    return { success: 0, failed: 0, results: [] }
  }

  const results = await Promise.all(
    unassignedTickets.map(ticket => autoAssignTicket(ticket.id, strategy))
  )

  const successCount = results.filter(r => r.success).length
  const failedCount = results.length - successCount

  return {
    success: successCount,
    failed: failedCount,
    results
  }
}
