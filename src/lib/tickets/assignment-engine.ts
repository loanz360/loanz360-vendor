/**
 * Assignment Engine - Enterprise-grade Ticket Assignment System
 *
 * Features:
 * - Round-robin assignment
 * - Workload-based assignment
 * - Skills-based matching
 * - Availability tracking
 * - Auto-assignment rules
 * - Manual override support
 * - Assignment history tracking
 */

import { createClient } from '@/lib/supabase/server'

// Types
export type AssignmentMethod = 'round_robin' | 'workload' | 'skills' | 'manual' | 'auto'
export type AgentStatus = 'available' | 'busy' | 'away' | 'offline'

export interface Agent {
  id: string
  name: string
  email: string
  role: string
  status: AgentStatus
  skills: string[]
  categories: string[]  // Categories they can handle
  max_tickets: number   // Max concurrent tickets
  current_tickets: number
  avg_resolution_time_hours: number
  customer_satisfaction_score: number
  is_available: boolean
  shift_start?: string
  shift_end?: string
  ticket_sources: ('EMPLOYEE' | 'CUSTOMER' | 'PARTNER')[]
}

export interface AssignmentRule {
  id: string
  name: string
  description?: string
  ticket_source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | null
  priority?: string | null
  category?: string | null
  method: AssignmentMethod
  target_role?: string
  target_team_id?: string
  target_agent_id?: string  // For specific agent assignment
  skills_required?: string[]
  is_active: boolean
  order: number  // Rule priority order
  created_at: string
  updated_at: string
}

export interface AssignmentResult {
  success: boolean
  agent_id?: string
  agent_name?: string
  method_used: AssignmentMethod
  reason: string
  alternatives?: Agent[]
}

export interface WorkloadStats {
  agent_id: string
  agent_name: string
  total_assigned: number
  open_tickets: number
  in_progress_tickets: number
  avg_response_time_hours: number
  avg_resolution_time_hours: number
  workload_score: number  // 0-100, lower is better
  efficiency_score: number  // 0-100, higher is better
}

// Assignment Rules Defaults
export const DEFAULT_ASSIGNMENT_RULES: Omit<AssignmentRule, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Urgent Priority - Senior Agent',
    description: 'Assign urgent tickets to senior agents based on skills',
    ticket_source: null,
    priority: 'urgent',
    category: null,
    method: 'skills',
    target_role: 'senior_support_agent',
    skills_required: ['urgent_handling', 'escalation'],
    is_active: true,
    order: 1
  },
  {
    name: 'Customer Tickets - Customer Support Team',
    description: 'Route customer tickets to customer support agents',
    ticket_source: 'CUSTOMER',
    priority: null,
    category: null,
    method: 'workload',
    target_role: 'customer_support_agent',
    is_active: true,
    order: 10
  },
  {
    name: 'Partner Tickets - Partner Support Team',
    description: 'Route partner tickets to partner support agents',
    ticket_source: 'PARTNER',
    priority: null,
    category: null,
    method: 'workload',
    target_role: 'partner_support_agent',
    is_active: true,
    order: 10
  },
  {
    name: 'Employee Tickets - HR Support',
    description: 'Route employee tickets to HR support team',
    ticket_source: 'EMPLOYEE',
    priority: null,
    category: null,
    method: 'workload',
    target_role: 'hr_support_agent',
    is_active: true,
    order: 10
  },
  {
    name: 'Technical Issues - Tech Team',
    description: 'Route technical issues to tech-skilled agents',
    ticket_source: null,
    priority: null,
    category: 'technical_issue',
    method: 'skills',
    skills_required: ['technical', 'debugging'],
    is_active: true,
    order: 5
  },
  {
    name: 'Default Round Robin',
    description: 'Fallback assignment using round robin',
    ticket_source: null,
    priority: null,
    category: null,
    method: 'round_robin',
    target_role: 'support_agent',
    is_active: true,
    order: 100
  }
]

/**
 * Get available agents for a ticket source
 */
export async function getAvailableAgents(
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  role?: string,
  skills?: string[],
  category?: string
): Promise<Agent[]> {
  const supabase = await createClient()

  // Build query for employees with agent roles
  let query = supabase
    .from('employees')
    .select('*')
    .eq('status', 'active')
    .in('role', getAgentRoles(ticketSource, role))

  const { data: employees } = await query

  if (!employees) return []

  const agents: Agent[] = []

  for (const emp of employees) {
    // Get agent's current ticket count
    const ticketCount = await getAgentTicketCount(emp.id, ticketSource)

    // Parse agent skills and categories from metadata
    const agentSkills = emp.skills || []
    const agentCategories = emp.categories || []
    const maxTickets = emp.max_concurrent_tickets || 20

    // Check skills match if required
    if (skills && skills.length > 0) {
      const hasRequiredSkills = skills.every(skill => agentSkills.includes(skill))
      if (!hasRequiredSkills) continue
    }

    // Check category match if required
    if (category && agentCategories.length > 0 && !agentCategories.includes(category)) {
      continue
    }

    // Check if agent has capacity
    if (ticketCount >= maxTickets) continue

    // Check availability (shift hours)
    const isInShift = checkAgentShift(emp.shift_start, emp.shift_end)
    if (!isInShift) continue

    agents.push({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role: emp.role,
      status: emp.agent_status || 'available',
      skills: agentSkills,
      categories: agentCategories,
      max_tickets: maxTickets,
      current_tickets: ticketCount,
      avg_resolution_time_hours: emp.avg_resolution_time_hours || 8,
      customer_satisfaction_score: emp.customer_satisfaction_score || 4.0,
      is_available: emp.agent_status !== 'offline' && emp.agent_status !== 'away',
      shift_start: emp.shift_start,
      shift_end: emp.shift_end,
      ticket_sources: emp.ticket_sources || [ticketSource]
    })
  }

  return agents.filter(a => a.is_available)
}

/**
 * Get agent roles for a ticket source
 */
function getAgentRoles(source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER', specificRole?: string): string[] {
  if (specificRole) return [specificRole]

  const roleMap: Record<string, string[]> = {
    EMPLOYEE: ['hr_support_agent', 'support_agent', 'senior_support_agent', 'support_manager'],
    CUSTOMER: ['customer_support_agent', 'support_agent', 'senior_support_agent', 'customer_support_manager'],
    PARTNER: ['partner_support_agent', 'support_agent', 'senior_support_agent', 'partner_support_manager']
  }

  return roleMap[source] || ['support_agent']
}

/**
 * Get agent's current ticket count
 */
async function getAgentTicketCount(
  agentId: string,
  source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<number> {
  const supabase = await createClient()
  const tableName = getTableName(source)

  const { count } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to_id', agentId)
    .not('status', 'in', '(resolved,closed)')

  return count || 0
}

/**
 * Check if agent is within their shift hours
 */
function checkAgentShift(shiftStart?: string, shiftEnd?: string): boolean {
  if (!shiftStart || !shiftEnd) return true // No shift defined = always available

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()
  const currentTime = currentHour * 60 + currentMinutes

  const [startHour, startMin] = shiftStart.split(':').map(Number)
  const [endHour, endMin] = shiftEnd.split(':').map(Number)
  const startTime = startHour * 60 + (startMin || 0)
  const endTime = endHour * 60 + (endMin || 0)

  if (startTime < endTime) {
    return currentTime >= startTime && currentTime <= endTime
  } else {
    // Overnight shift
    return currentTime >= startTime || currentTime <= endTime
  }
}

/**
 * Get applicable assignment rules
 */
async function getApplicableRules(
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  priority: string,
  category?: string
): Promise<AssignmentRule[]> {
  const supabase = await createClient()

  const { data: rules } = await supabase
    .from('assignment_rules')
    .select('*')
    .eq('is_active', true)
    .order('order', { ascending: true })

  if (!rules) return []

  return (rules as AssignmentRule[]).filter(rule => {
    // Check source match
    if (rule.ticket_source && rule.ticket_source !== ticketSource) {
      return false
    }

    // Check priority match
    if (rule.priority && rule.priority !== priority) {
      return false
    }

    // Check category match
    if (rule.category && rule.category !== category) {
      return false
    }

    return true
  })
}

/**
 * Round-robin assignment
 */
async function assignRoundRobin(agents: Agent[]): Promise<Agent | null> {
  if (agents.length === 0) return null

  const supabase = await createClient()

  // Get last assigned agent
  const { data: lastAssignment } = await supabase
    .from('assignment_history')
    .select('assigned_to_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastAgentId = lastAssignment?.assigned_to_id

  if (!lastAgentId) {
    return agents[0]
  }

  // Find next agent in rotation
  const lastIndex = agents.findIndex(a => a.id === lastAgentId)
  const nextIndex = (lastIndex + 1) % agents.length

  return agents[nextIndex]
}

/**
 * Workload-based assignment
 */
function assignByWorkload(agents: Agent[]): Agent | null {
  if (agents.length === 0) return null

  // Sort by workload (current tickets / max tickets)
  const sorted = [...agents].sort((a, b) => {
    const workloadA = a.current_tickets / a.max_tickets
    const workloadB = b.current_tickets / b.max_tickets
    return workloadA - workloadB
  })

  return sorted[0]
}

/**
 * Skills-based assignment
 */
function assignBySkills(agents: Agent[], requiredSkills: string[]): Agent | null {
  if (agents.length === 0) return null

  // Score agents by skill match and performance
  const scored = agents.map(agent => {
    const skillMatch = requiredSkills.filter(skill => agent.skills.includes(skill)).length
    const skillScore = (skillMatch / requiredSkills.length) * 50
    const performanceScore = (agent.customer_satisfaction_score / 5) * 30
    const capacityScore = ((agent.max_tickets - agent.current_tickets) / agent.max_tickets) * 20

    return {
      agent,
      score: skillScore + performanceScore + capacityScore
    }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored[0]?.agent || null
}

/**
 * Main assignment function
 */
export async function assignTicket(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  priority: string,
  category?: string,
  preferredAgentId?: string,
  forceMethod?: AssignmentMethod
): Promise<AssignmentResult> {
  const supabase = await createClient()

  // If preferred agent specified, try them first
  if (preferredAgentId) {
    const agents = await getAvailableAgents(ticketSource)
    const preferredAgent = agents.find(a => a.id === preferredAgentId)

    if (preferredAgent && preferredAgent.is_available) {
      await performAssignment(ticketId, ticketSource, preferredAgent.id, 'manual')

      return {
        success: true,
        agent_id: preferredAgent.id,
        agent_name: preferredAgent.name,
        method_used: 'manual',
        reason: 'Assigned to preferred agent'
      }
    }
  }

  // Get applicable rules
  const rules = await getApplicableRules(ticketSource, priority, category)

  for (const rule of rules) {
    const method = forceMethod || rule.method
    const agents = await getAvailableAgents(
      ticketSource,
      rule.target_role,
      rule.skills_required,
      category
    )

    if (agents.length === 0) continue

    let selectedAgent: Agent | null = null

    switch (method) {
      case 'round_robin':
        selectedAgent = await assignRoundRobin(agents)
        break
      case 'workload':
        selectedAgent = assignByWorkload(agents)
        break
      case 'skills':
        selectedAgent = assignBySkills(agents, rule.skills_required || [])
        break
      case 'auto':
        // Auto mode: try skills first, then workload
        selectedAgent = rule.skills_required
          ? assignBySkills(agents, rule.skills_required)
          : assignByWorkload(agents)
        break
    }

    if (selectedAgent) {
      await performAssignment(ticketId, ticketSource, selectedAgent.id, method)

      return {
        success: true,
        agent_id: selectedAgent.id,
        agent_name: selectedAgent.name,
        method_used: method,
        reason: `Assigned via rule: ${rule.name}`,
        alternatives: agents.filter(a => a.id !== selectedAgent!.id).slice(0, 3)
      }
    }
  }

  // No assignment possible
  return {
    success: false,
    method_used: 'auto',
    reason: 'No available agents matching criteria'
  }
}

/**
 * Perform the actual assignment
 */
async function performAssignment(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  agentId: string,
  method: AssignmentMethod
): Promise<void> {
  const supabase = await createClient()
  const tableName = getTableName(ticketSource)

  // Get previous assignment
  const { data: ticket } = await supabase
    .from(tableName)
    .select('assigned_to_id')
    .eq('id', ticketId)
    .maybeSingle()

  const previousAgentId = ticket?.assigned_to_id

  // Update ticket
  await supabase
    .from(tableName)
    .update({
      assigned_to_id: agentId,
      assigned_at: new Date().toISOString(),
      status: 'assigned'
    })
    .eq('id', ticketId)

  // Record assignment history
  await supabase.from('assignment_history').insert({
    ticket_id: ticketId,
    ticket_source: ticketSource,
    assigned_from_id: previousAgentId,
    assigned_to_id: agentId,
    assignment_method: method,
    assigned_at: new Date().toISOString()
  })
}

/**
 * Reassign a ticket to a different agent
 */
export async function reassignTicket(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  newAgentId: string,
  reason: string,
  reassignedById: string
): Promise<boolean> {
  const supabase = await createClient()
  const tableName = getTableName(ticketSource)

  // Get current assignment
  const { data: ticket } = await supabase
    .from(tableName)
    .select('assigned_to_id')
    .eq('id', ticketId)
    .maybeSingle()

  if (!ticket) return false

  // Update ticket
  const { error } = await supabase
    .from(tableName)
    .update({
      assigned_to_id: newAgentId,
      assigned_at: new Date().toISOString()
    })
    .eq('id', ticketId)

  if (error) return false

  // Record reassignment
  await supabase.from('assignment_history').insert({
    ticket_id: ticketId,
    ticket_source: ticketSource,
    assigned_from_id: ticket.assigned_to_id,
    assigned_to_id: newAgentId,
    assignment_method: 'manual',
    assigned_at: new Date().toISOString(),
    reassigned_by_id: reassignedById,
    reassignment_reason: reason
  })

  return true
}

/**
 * Unassign a ticket
 */
export async function unassignTicket(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  reason: string,
  unassignedById: string
): Promise<boolean> {
  const supabase = await createClient()
  const tableName = getTableName(ticketSource)

  // Get current assignment
  const { data: ticket } = await supabase
    .from(tableName)
    .select('assigned_to_id')
    .eq('id', ticketId)
    .maybeSingle()

  if (!ticket) return false

  // Update ticket
  const { error } = await supabase
    .from(tableName)
    .update({
      assigned_to_id: null,
      assigned_at: null,
      status: 'new'
    })
    .eq('id', ticketId)

  if (error) return false

  // Record unassignment
  await supabase.from('assignment_history').insert({
    ticket_id: ticketId,
    ticket_source: ticketSource,
    assigned_from_id: ticket.assigned_to_id,
    assigned_to_id: null,
    assignment_method: 'manual',
    assigned_at: new Date().toISOString(),
    reassigned_by_id: unassignedById,
    reassignment_reason: `Unassigned: ${reason}`
  })

  return true
}

/**
 * Get workload statistics for all agents
 */
export async function getWorkloadStats(
  ticketSource?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<WorkloadStats[]> {
  const supabase = await createClient()
  const stats: WorkloadStats[] = []

  const sources = ticketSource ? [ticketSource] : ['EMPLOYEE', 'CUSTOMER', 'PARTNER']

  // Get all active agents
  const { data: agents } = await supabase
    .from('employees')
    .select('id, name')
    .eq('status', 'active')
    .in('role', [
      'support_agent', 'senior_support_agent', 'support_manager',
      'customer_support_agent', 'customer_support_manager',
      'partner_support_agent', 'partner_support_manager',
      'hr_support_agent'
    ])

  if (!agents) return []

  for (const agent of agents) {
    let totalAssigned = 0
    let openTickets = 0
    let inProgressTickets = 0
    let totalResponseTime = 0
    let totalResolutionTime = 0
    let responseCount = 0
    let resolutionCount = 0

    for (const source of sources) {
      const tableName = getTableName(source as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER')

      // Get ticket counts
      const { data: tickets } = await supabase
        .from(tableName)
        .select('status, response_time_hours, resolution_time_hours')
        .eq('assigned_to_id', agent.id)

      if (tickets) {
        totalAssigned += tickets.length
        openTickets += tickets.filter(t => t.status === 'new' || t.status === 'assigned').length
        inProgressTickets += tickets.filter(t => t.status === 'in_progress').length

        for (const ticket of tickets) {
          if (ticket.response_time_hours) {
            totalResponseTime += ticket.response_time_hours
            responseCount++
          }
          if (ticket.resolution_time_hours) {
            totalResolutionTime += ticket.resolution_time_hours
            resolutionCount++
          }
        }
      }
    }

    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0
    const avgResolutionTime = resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0

    // Calculate workload score (lower is better - more capacity)
    const workloadScore = Math.min(100, ((openTickets + inProgressTickets) / 20) * 100)

    // Calculate efficiency score (higher is better)
    const efficiencyScore = Math.max(0, 100 - (avgResolutionTime / 24) * 10)

    stats.push({
      agent_id: agent.id,
      agent_name: agent.name,
      total_assigned: totalAssigned,
      open_tickets: openTickets,
      in_progress_tickets: inProgressTickets,
      avg_response_time_hours: avgResponseTime,
      avg_resolution_time_hours: avgResolutionTime,
      workload_score: workloadScore,
      efficiency_score: efficiencyScore
    })
  }

  return stats.sort((a, b) => a.workload_score - b.workload_score)
}

/**
 * Get assignment history for a ticket
 */
export async function getAssignmentHistory(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<any[]> {
  const supabase = await createClient()

  const { data: history } = await supabase
    .from('assignment_history')
    .select(`
      *,
      assigned_from:employees!assigned_from_id(id, name),
      assigned_to:employees!assigned_to_id(id, name),
      reassigned_by:employees!reassigned_by_id(id, name)
    `)
    .eq('ticket_id', ticketId)
    .eq('ticket_source', ticketSource)
    .order('assigned_at', { ascending: false })

  return history || []
}

/**
 * Update agent status
 */
export async function updateAgentStatus(
  agentId: string,
  status: AgentStatus
): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('employees')
    .update({ agent_status: status })
    .eq('id', agentId)

  return !error
}

// Helper function
function getTableName(source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'): string {
  switch (source) {
    case 'EMPLOYEE':
      return 'employee_support_tickets'
    case 'CUSTOMER':
      return 'customer_support_tickets'
    case 'PARTNER':
      return 'partner_support_tickets'
  }
}
