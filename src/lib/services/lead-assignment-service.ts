import { createClient } from '@/lib/supabase/server'

interface AssignmentResult {
  success: boolean
  assignedTo?: string
  employeeName?: string
  error?: string
  isDuplicate?: boolean
  existingLeadId?: string
}

interface DuplicateCheckResult {
  isDuplicate: boolean
  existingLeadId?: string
  existingLeadData?: {
    id: string
    name: string
    phone: string
    email: string
    created_at: string
    assigned_to: string
  }
  matchedOn?: 'phone' | 'email' | 'both'
}

interface EmployeeAvailability {
  id: string
  full_name: string
  is_available: boolean
  current_leads: number
  max_leads: number
  skills: string[]
  working_hours?: {
    start: string // "09:00"
    end: string   // "18:00"
    timezone: string
    days: number[] // [1,2,3,4,5] for Mon-Fri
  }
}

/**
 * Lead Assignment Service
 * Handles automatic assignment of online leads to Digital Sales employees
 * Supports round-robin, manual assignment, duplicate detection, and smart routing
 */
export class LeadAssignmentService {
  /**
   * Check for duplicate leads by phone or email
   */
  static async checkDuplicate(
    phone?: string,
    email?: string,
    chatbotId?: string,
    windowHours: number = 72 // Check last 72 hours by default
  ): Promise<DuplicateCheckResult> {
    try {
      if (!phone && !email) {
        return { isDuplicate: false }
      }

      const supabase = await createClient()
      const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000)

      // Normalize phone number (remove spaces, dashes, +91 prefix)
      const normalizedPhone = phone
        ? phone.replace(/[\s\-\+]/g, '').replace(/^91/, '').replace(/^0/, '')
        : null

      // Build query conditions
      let query = supabase
        .from('online_leads')
        .select('id, name, phone, email, created_at, assigned_to')
        .gte('created_at', windowStart.toISOString())

      if (chatbotId) {
        query = query.eq('chatbot_id', chatbotId)
      }

      // Check phone first
      if (normalizedPhone && normalizedPhone.length >= 10) {
        const { data: phoneMatches } = await query
          .or(`phone.ilike.%${normalizedPhone.slice(-10)}%`)
          .limit(1)

        if (phoneMatches && phoneMatches.length > 0) {
          // Also check email if provided
          if (email) {
            const emailNormalized = email.toLowerCase().trim()
            const matchesEmail = phoneMatches[0].email?.toLowerCase() === emailNormalized

            return {
              isDuplicate: true,
              existingLeadId: phoneMatches[0].id,
              existingLeadData: phoneMatches[0],
              matchedOn: matchesEmail ? 'both' : 'phone'
            }
          }

          return {
            isDuplicate: true,
            existingLeadId: phoneMatches[0].id,
            existingLeadData: phoneMatches[0],
            matchedOn: 'phone'
          }
        }
      }

      // Check email if phone didn't match
      if (email) {
        const emailNormalized = email.toLowerCase().trim()
        const { data: emailMatches } = await supabase
          .from('online_leads')
          .select('id, name, phone, email, created_at, assigned_to')
          .gte('created_at', windowStart.toISOString())
          .ilike('email', emailNormalized)
          .limit(1)

        if (emailMatches && emailMatches.length > 0) {
          return {
            isDuplicate: true,
            existingLeadId: emailMatches[0].id,
            existingLeadData: emailMatches[0],
            matchedOn: 'email'
          }
        }
      }

      return { isDuplicate: false }
    } catch (error) {
      console.error('Duplicate check error:', error)
      return { isDuplicate: false }
    }
  }

  /**
   * Check if an employee is within working hours
   */
  static isWithinWorkingHours(
    workingHours?: EmployeeAvailability['working_hours']
  ): boolean {
    if (!workingHours) return true // No restrictions if not configured

    const now = new Date()

    // Check if today is a working day
    const dayOfWeek = now.getDay() // 0 = Sunday
    if (!workingHours.days.includes(dayOfWeek)) {
      return false
    }

    // Get current time in employee's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: workingHours.timezone || 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    const timeString = formatter.format(now)
    const [currentHour, currentMinute] = timeString.split(':').map(Number)
    const currentMinutes = currentHour * 60 + currentMinute

    const [startHour, startMinute] = workingHours.start.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute

    const [endHour, endMinute] = workingHours.end.split(':').map(Number)
    const endMinutes = endHour * 60 + endMinute

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }

  /**
   * Get available employees with smart routing criteria
   */
  static async getAvailableEmployees(
    chatbotId: string,
    requiredSkills?: string[]
  ): Promise<EmployeeAvailability[]> {
    const supabase = await createClient()

    // Get chatbot settings
    const { data: chatbot } = await supabase
      .from('chatbots')
      .select('assigned_employees, routing_config')
      .eq('id', chatbotId)
      .maybeSingle()

    if (!chatbot?.assigned_employees?.length) {
      return []
    }

    // Get employees with their settings
    const { data: employees } = await supabase
      .from('employees')
      .select(`
        id,
        full_name,
        sub_role,
        is_active,
        working_hours,
        max_daily_leads,
        skills
      `)
      .in('id', chatbot.assigned_employees)
      .eq('is_active', true)
      .eq('sub_role', 'DIGITAL_SALES')

    if (!employees?.length) {
      return []
    }

    // Get today's lead counts
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: leadCounts } = await supabase
      .from('online_leads')
      .select('assigned_to')
      .in('assigned_to', employees.map(e => e.id))
      .gte('created_at', todayStart.toISOString())

    const countsMap: Record<string, number> = {}
    leadCounts?.forEach(l => {
      if (l.assigned_to) {
        countsMap[l.assigned_to] = (countsMap[l.assigned_to] || 0) + 1
      }
    })

    // Build availability list
    const available: EmployeeAvailability[] = []

    for (const emp of employees) {
      const currentLeads = countsMap[emp.id] || 0
      const maxLeads = emp.max_daily_leads || 50 // Default max
      const skills = emp.skills || []

      // Check working hours
      const withinHours = this.isWithinWorkingHours(emp.working_hours)

      // Check max leads
      const underLimit = currentLeads < maxLeads

      // Check skills match (if required)
      let hasRequiredSkills = true
      if (requiredSkills && requiredSkills.length > 0) {
        hasRequiredSkills = requiredSkills.every(skill =>
          skills.some((s: string) => s.toLowerCase() === skill.toLowerCase())
        )
      }

      const isAvailable = withinHours && underLimit && hasRequiredSkills

      available.push({
        id: emp.id,
        full_name: emp.full_name,
        is_available: isAvailable,
        current_leads: currentLeads,
        max_leads: maxLeads,
        skills,
        working_hours: emp.working_hours
      })
    }

    return available
  }

  /**
   * Smart assign - uses working hours, max leads, and skills-based routing
   */
  static async smartAssign(
    chatbotId: string,
    leadId: string,
    leadData?: {
      phone?: string
      email?: string
      location?: string
      loanType?: string
    }
  ): Promise<AssignmentResult> {
    try {
      const supabase = await createClient()

      // Check for duplicates first
      if (leadData?.phone || leadData?.email) {
        const dupCheck = await this.checkDuplicate(
          leadData.phone,
          leadData.email,
          chatbotId
        )

        if (dupCheck.isDuplicate) {
          // Update existing lead instead of creating new assignment
          await supabase
            .from('online_leads')
            .update({
              notes_timeline: supabase.sql`
                COALESCE(notes_timeline, '[]'::jsonb) ||
                jsonb_build_array(
                  jsonb_build_object(
                    'id', ${'dup-' + Date.now()},
                    'type', 'duplicate_detected',
                    'content', ${'Duplicate entry detected - matched on ' + dupCheck.matchedOn},
                    'created_at', ${new Date().toISOString()}
                  )
                )
              `
            })
            .eq('id', dupCheck.existingLeadId)

          return {
            success: true,
            isDuplicate: true,
            existingLeadId: dupCheck.existingLeadId,
            assignedTo: dupCheck.existingLeadData?.assigned_to,
            error: `Duplicate lead detected (matched on ${dupCheck.matchedOn})`
          }
        }
      }

      // Determine required skills based on lead data
      const requiredSkills: string[] = []
      if (leadData?.loanType) {
        requiredSkills.push(leadData.loanType.toLowerCase())
      }

      // Get available employees
      const available = await this.getAvailableEmployees(chatbotId, requiredSkills)
      const eligibleEmployees = available.filter(e => e.is_available)

      if (eligibleEmployees.length === 0) {
        // Fallback to any active employee if no one is available
        const anyAvailable = available.filter(e => e.current_leads < e.max_leads)
        if (anyAvailable.length === 0) {
          return {
            success: false,
            error: 'No employees available - all are at max capacity'
          }
        }

        // Use employee with least leads from fallback
        anyAvailable.sort((a, b) => a.current_leads - b.current_leads)
        const fallbackEmployee = anyAvailable[0]

        return await this.performAssignment(
          supabase,
          leadId,
          chatbotId,
          fallbackEmployee.id,
          fallbackEmployee.full_name,
          'smart_routing_fallback'
        )
      }

      // Sort by current lead count (round-robin with load balancing)
      eligibleEmployees.sort((a, b) => a.current_leads - b.current_leads)
      const selectedEmployee = eligibleEmployees[0]

      return await this.performAssignment(
        supabase,
        leadId,
        chatbotId,
        selectedEmployee.id,
        selectedEmployee.full_name,
        'smart_routing'
      )
    } catch (error) {
      console.error('Smart assignment error:', error)
      return {
        success: false,
        error: 'Smart assignment service error'
      }
    }
  }

  /**
   * Perform the actual assignment operation
   */
  private static async performAssignment(
    supabase: Awaited<ReturnType<typeof createClient>>,
    leadId: string,
    chatbotId: string,
    employeeId: string,
    employeeName: string,
    assignmentMode: string
  ): Promise<AssignmentResult> {
    // Get current lead data
    const { data: lead } = await supabase
      .from('online_leads')
      .select('notes_timeline')
      .eq('id', leadId)
      .maybeSingle()

    const currentTimeline = lead?.notes_timeline || []

    // Update the lead
    const { error: updateError } = await supabase
      .from('online_leads')
      .update({
        assigned_to: employeeId,
        assigned_at: new Date().toISOString(),
        notes_timeline: [
          ...currentTimeline,
          {
            id: `assign-${Date.now()}`,
            type: 'assignment',
            content: `Auto-assigned to ${employeeName} (${assignmentMode})`,
            created_at: new Date().toISOString()
          }
        ]
      })
      .eq('id', leadId)

    if (updateError) {
      throw updateError
    }

    // Add to assignment queue
    await supabase
      .from('lead_assignment_queue')
      .insert({
        lead_id: leadId,
        chatbot_id: chatbotId,
        assigned_to: employeeId,
        assignment_mode: assignmentMode,
        assigned_at: new Date().toISOString(),
        status: 'assigned'
      })

    return {
      success: true,
      assignedTo: employeeId,
      employeeName: employeeName
    }
  }

  /**
   * Assign a lead to an employee based on chatbot assignment mode
   */
  static async assignLead(
    chatbotId: string,
    leadId: string
  ): Promise<AssignmentResult> {
    try {
      const supabase = await createClient()

      // Get chatbot settings
      const { data: chatbot, error: chatbotError } = await supabase
        .from('chatbots')
        .select('id, name, assignment_mode, assigned_employees, organization_id, routing_config')
        .eq('id', chatbotId)
        .maybeSingle()

      if (chatbotError || !chatbot) {
        return {
          success: false,
          error: 'Chatbot not found'
        }
      }

      // If manual mode, don't auto-assign
      if (chatbot.assignment_mode === 'manual') {
        return {
          success: true,
          assignedTo: undefined,
          error: 'Manual assignment mode - lead not auto-assigned'
        }
      }

      // Use smart routing if enabled
      if (chatbot.assignment_mode === 'smart' || chatbot.routing_config?.use_smart_routing) {
        // Get lead data for duplicate check
        const { data: leadData } = await supabase
          .from('online_leads')
          .select('phone, email, collected_data')
          .eq('id', leadId)
          .maybeSingle()

        return await this.smartAssign(chatbotId, leadId, {
          phone: leadData?.phone,
          email: leadData?.email,
          loanType: leadData?.collected_data?.loan_type
        })
      }

      // Get available employees for this chatbot
      const assignedEmployeeIds = chatbot.assigned_employees || []

      if (assignedEmployeeIds.length === 0) {
        return {
          success: false,
          error: 'No employees assigned to this chatbot'
        }
      }

      // Get employees with their current lead counts for round-robin
      const { data: employees, error: employeeError } = await supabase
        .from('employees')
        .select('id, full_name, sub_role, is_active')
        .in('id', assignedEmployeeIds)
        .eq('is_active', true)
        .eq('sub_role', 'DIGITAL_SALES')

      if (employeeError || !employees || employees.length === 0) {
        return {
          success: false,
          error: 'No active Digital Sales employees available'
        }
      }

      // Get lead counts for each employee to do fair round-robin
      const { data: leadCounts } = await supabase
        .from('online_leads')
        .select('assigned_to')
        .in('assigned_to', employees.map(e => e.id))
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

      // Count leads per employee
      const countsMap: Record<string, number> = {}
      employees.forEach(e => { countsMap[e.id] = 0 })
      leadCounts?.forEach(l => {
        if (l.assigned_to) {
          countsMap[l.assigned_to] = (countsMap[l.assigned_to] || 0) + 1
        }
      })

      // Find employee with least leads (round-robin)
      let selectedEmployee = employees[0]
      let minLeads = countsMap[selectedEmployee.id] || 0

      for (const employee of employees) {
        const count = countsMap[employee.id] || 0
        if (count < minLeads) {
          minLeads = count
          selectedEmployee = employee
        }
      }

      return await this.performAssignment(
        supabase,
        leadId,
        chatbotId,
        selectedEmployee.id,
        selectedEmployee.full_name,
        'round_robin'
      )
    } catch (error) {
      console.error('Lead assignment error:', error)
      return {
        success: false,
        error: 'Assignment service error'
      }
    }
  }

  /**
   * Manually assign a lead to a specific employee
   */
  static async manualAssign(
    leadId: string,
    employeeId: string,
    assignedBy: string
  ): Promise<AssignmentResult> {
    try {
      const supabase = await createClient()

      // Verify employee exists and is active
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('id', employeeId)
        .eq('is_active', true)
        .maybeSingle()

      if (employeeError || !employee) {
        return {
          success: false,
          error: 'Employee not found or inactive'
        }
      }

      // Get current lead data
      const { data: lead } = await supabase
        .from('online_leads')
        .select('notes_timeline, chatbot_id')
        .eq('id', leadId)
        .maybeSingle()

      if (!lead) {
        return {
          success: false,
          error: 'Lead not found'
        }
      }

      const currentTimeline = lead.notes_timeline || []

      // Assign the lead
      const { error: updateError } = await supabase
        .from('online_leads')
        .update({
          assigned_to: employeeId,
          assigned_at: new Date().toISOString(),
          notes_timeline: [
            ...currentTimeline,
            {
              id: `assign-${Date.now()}`,
              type: 'assignment',
              content: `Manually assigned to ${employee.full_name}`,
              created_by: assignedBy,
              created_at: new Date().toISOString()
            }
          ]
        })
        .eq('id', leadId)

      if (updateError) {
        throw updateError
      }

      // Add to assignment queue for tracking
      await supabase
        .from('lead_assignment_queue')
        .insert({
          lead_id: leadId,
          chatbot_id: lead.chatbot_id,
          assigned_to: employeeId,
          assigned_by: assignedBy,
          assignment_mode: 'manual',
          assigned_at: new Date().toISOString(),
          status: 'assigned'
        })

      return {
        success: true,
        assignedTo: employeeId,
        employeeName: employee.full_name
      }
    } catch (error) {
      console.error('Manual assignment error:', error)
      return {
        success: false,
        error: 'Assignment service error'
      }
    }
  }

  /**
   * Reassign a lead to a different employee
   */
  static async reassignLead(
    leadId: string,
    newEmployeeId: string,
    reassignedBy: string,
    reason?: string
  ): Promise<AssignmentResult> {
    try {
      const supabase = await createClient()

      // Get current assignment
      const { data: lead } = await supabase
        .from('online_leads')
        .select('assigned_to, notes_timeline, chatbot_id')
        .eq('id', leadId)
        .maybeSingle()

      if (!lead) {
        return {
          success: false,
          error: 'Lead not found'
        }
      }

      // Get new employee details
      const { data: newEmployee } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('id', newEmployeeId)
        .eq('is_active', true)
        .maybeSingle()

      if (!newEmployee) {
        return {
          success: false,
          error: 'New employee not found or inactive'
        }
      }

      const currentTimeline = lead.notes_timeline || []

      // Update the lead
      const { error: updateError } = await supabase
        .from('online_leads')
        .update({
          assigned_to: newEmployeeId,
          assigned_at: new Date().toISOString(),
          notes_timeline: [
            ...currentTimeline,
            {
              id: `reassign-${Date.now()}`,
              type: 'reassignment',
              content: `Reassigned to ${newEmployee.full_name}${reason ? `: ${reason}` : ''}`,
              created_by: reassignedBy,
              created_at: new Date().toISOString()
            }
          ]
        })
        .eq('id', leadId)

      if (updateError) {
        throw updateError
      }

      // Update assignment queue
      await supabase
        .from('lead_assignment_queue')
        .update({
          status: 'reassigned',
          reassigned_to: newEmployeeId,
          reassigned_by: reassignedBy,
          reassigned_at: new Date().toISOString(),
          reassign_reason: reason
        })
        .eq('lead_id', leadId)
        .eq('status', 'assigned')

      // Create new queue entry
      await supabase
        .from('lead_assignment_queue')
        .insert({
          lead_id: leadId,
          chatbot_id: lead.chatbot_id,
          assigned_to: newEmployeeId,
          assigned_by: reassignedBy,
          assignment_mode: 'manual',
          assigned_at: new Date().toISOString(),
          status: 'assigned',
          notes: `Reassigned from previous owner${reason ? `: ${reason}` : ''}`
        })

      return {
        success: true,
        assignedTo: newEmployeeId,
        employeeName: newEmployee.full_name
      }
    } catch (error) {
      console.error('Reassignment error:', error)
      return {
        success: false,
        error: 'Reassignment service error'
      }
    }
  }

  /**
   * Get assignment statistics for a chatbot
   */
  static async getAssignmentStats(chatbotId: string) {
    try {
      const supabase = await createClient()

      const { data: stats } = await supabase
        .from('lead_assignment_queue')
        .select('assigned_to, status, assigned_at')
        .eq('chatbot_id', chatbotId)
        .gte('assigned_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      // Group by employee
      const employeeStats: Record<string, { total: number; assigned: number; reassigned: number }> = {}

      stats?.forEach(entry => {
        if (!entry.assigned_to) return
        if (!employeeStats[entry.assigned_to]) {
          employeeStats[entry.assigned_to] = { total: 0, assigned: 0, reassigned: 0 }
        }
        employeeStats[entry.assigned_to].total++
        if (entry.status === 'assigned') {
          employeeStats[entry.assigned_to].assigned++
        } else if (entry.status === 'reassigned') {
          employeeStats[entry.assigned_to].reassigned++
        }
      })

      return {
        success: true,
        stats: employeeStats,
        totalAssignments: stats?.length || 0
      }
    } catch (error) {
      console.error('Stats error:', error)
      return {
        success: false,
        error: 'Failed to get stats'
      }
    }
  }

  /**
   * Get employee availability status
   */
  static async getEmployeeAvailabilityStatus(chatbotId: string) {
    try {
      const available = await this.getAvailableEmployees(chatbotId)

      return {
        success: true,
        employees: available,
        summary: {
          total: available.length,
          available: available.filter(e => e.is_available).length,
          atCapacity: available.filter(e => e.current_leads >= e.max_leads).length,
          outsideHours: available.filter(e => !e.is_available && e.current_leads < e.max_leads).length
        }
      }
    } catch (error) {
      console.error('Availability check error:', error)
      return {
        success: false,
        error: 'Failed to get availability'
      }
    }
  }
}

export default LeadAssignmentService
