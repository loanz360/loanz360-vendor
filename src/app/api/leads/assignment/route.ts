export const dynamic = 'force-dynamic'

import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'

interface AssignmentRule {
  id: string
  name: string
  description: string
  priority: number
  isActive: boolean
  conditions: RuleCondition[]
  assignmentType: 'user' | 'team' | 'round_robin' | 'load_balanced' | 'skill_based'
  assignTo?: string
  teamId?: string
  matchCount: number
  createdAt: string
  updatedAt: string
}

interface RuleCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in'
  value: string | number | string[]
}

interface TeamMember {
  id: string
  name: string
  role: string
  activeLeads: number
  maxLeads: number
  isAvailable: boolean
  skills: string[]
  performanceScore: number
}

interface AssignmentResult {
  leadId: string
  assignedTo: string
  assignedToName: string
  ruleId?: string
  ruleName?: string
  assignedAt: string
}

// Dummy data
const dummyRules: AssignmentRule[] = [
  {
    id: 'rule-1',
    name: 'High Value Home Loans',
    description: 'Route high-value home loans to senior team',
    priority: 1,
    isActive: true,
    conditions: [
      { field: 'loan_type', operator: 'equals', value: 'HOME_LOAN' },
      { field: 'loan_amount', operator: 'greater_than', value: 5000000 }
    ],
    assignmentType: 'team',
    teamId: 'senior-team',
    matchCount: 0,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'rule-2',
    name: 'Partner Leads',
    description: 'All partner-sourced leads to partner team',
    priority: 2,
    isActive: true,
    conditions: [
      { field: 'source', operator: 'in', value: ['PARTNER', 'REFERRAL'] }
    ],
    assignmentType: 'round_robin',
    teamId: 'partner-team',
    matchCount: 0,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'rule-3',
    name: 'Default Assignment',
    description: 'All other leads distributed by load balancing',
    priority: 99,
    isActive: true,
    conditions: [],
    assignmentType: 'load_balanced',
    matchCount: 0,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
]

const dummyTeamMembers: TeamMember[] = [
  { id: 'agent-1', name: 'Suresh Kumar', role: 'Senior BDE', activeLeads: 0, maxLeads: 50, isAvailable: true, skills: ['Home Loans', 'Business Loans'], performanceScore: 0 },
  { id: 'agent-2', name: 'Meera Joshi', role: 'BDE', activeLeads: 0, maxLeads: 50, isAvailable: true, skills: ['Personal Loans', 'Car Loans'], performanceScore: 0 },
  { id: 'agent-3', name: 'Arun Nair', role: 'BDE', activeLeads: 0, maxLeads: 50, isAvailable: true, skills: ['Home Loans'], performanceScore: 0 },
  { id: 'agent-4', name: 'Kavita Singh', role: 'Senior BDE', activeLeads: 0, maxLeads: 50, isAvailable: false, skills: ['Business Loans', 'Gold Loans'], performanceScore: 0 },
]

// GET - Fetch assignment rules and team workload
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'rules' // rules, team, queue

    if (type === 'rules') {
      return NextResponse.json({
        success: true,
        data: {
          rules: dummyRules,
          summary: {
            totalRules: dummyRules.length,
            activeRules: dummyRules.filter(r => r.isActive).length,
            totalMatches: dummyRules.reduce((sum, r) => sum + r.matchCount, 0)
          }
        }
      })
    }

    if (type === 'team') {
      return NextResponse.json({
        success: true,
        data: {
          members: dummyTeamMembers,
          summary: {
            totalMembers: dummyTeamMembers.length,
            availableMembers: dummyTeamMembers.filter(m => m.isAvailable).length,
            totalActiveLeads: dummyTeamMembers.reduce((sum, m) => sum + m.activeLeads, 0),
            totalCapacity: dummyTeamMembers.reduce((sum, m) => sum + m.maxLeads, 0),
            utilizationRate: Math.round(
              (dummyTeamMembers.reduce((sum, m) => sum + m.activeLeads, 0) /
                dummyTeamMembers.reduce((sum, m) => sum + m.maxLeads, 0)) * 100
            )
          }
        }
      })
    }

    if (type === 'queue') {
      // Unassigned leads queue - empty until connected to database
      return NextResponse.json({
        success: true,
        data: {
          unassignedCount: 0,
          leads: [] // TODO: Fetch from database
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    )
  } catch (error) {
    apiLogger.error('Error fetching assignment data', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assignment data' },
      { status: 500 }
    )
  }
}

// POST - Assign lead(s) manually or trigger auto-assignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, leadIds, assignTo, reason } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      )
    }

    if (action === 'manual_assign') {
      if (!leadIds || !assignTo) {
        return NextResponse.json(
          { success: false, error: 'Lead IDs and assignee are required' },
          { status: 400 }
        )
      }

      const results: AssignmentResult[] = leadIds.map((leadId: string) => ({
        leadId,
        assignedTo: assignTo,
        assignedToName: dummyTeamMembers.find(m => m.id === assignTo)?.name || 'Unknown',
        assignedAt: new Date().toISOString()
      }))

      return NextResponse.json({
        success: true,
        message: `${leadIds.length} lead(s) assigned successfully`,
        data: results
      })
    }

    if (action === 'auto_assign') {
      // Auto-assign unassigned leads based on rules
      return NextResponse.json({
        success: true,
        message: '0 leads auto-assigned based on rules',
        data: { assignedCount: 0 }
      })
    }

    if (action === 'reassign') {
      if (!leadIds || !assignTo) {
        return NextResponse.json(
          { success: false, error: 'Lead IDs and new assignee are required' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `${leadIds.length} lead(s) reassigned`,
        data: { leadIds, assignTo, reason }
      })
    }

    if (action === 'balance_workload') {
      // Redistribute leads among team members
      return NextResponse.json({
        success: true,
        message: 'Workload balanced across team',
        data: { redistributedCount: 0 }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    apiLogger.error('Error in assignment action', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process assignment' },
      { status: 500 }
    )
  }
}

// PUT - Create or update assignment rule
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...ruleData } = body

    if (id) {
      // Update existing rule
      return NextResponse.json({
        success: true,
        message: 'Assignment rule updated',
        data: { id, ...ruleData, updatedAt: new Date().toISOString() }
      })
    } else {
      // Create new rule
      const newRule = {
        id: `rule-${Date.now()}`,
        ...ruleData,
        matchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      return NextResponse.json({
        success: true,
        message: 'Assignment rule created',
        data: newRule
      }, { status: 201 })
    }
  } catch (error) {
    apiLogger.error('Error saving assignment rule', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save assignment rule' },
      { status: 500 }
    )
  }
}

// DELETE - Delete assignment rule
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('id')

    if (!ruleId) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment rule deleted',
      data: { id: ruleId }
    })
  } catch (error) {
    apiLogger.error('Error deleting assignment rule', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete assignment rule' },
      { status: 500 }
    )
  }
}
