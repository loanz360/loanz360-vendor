/**
 * CRO Manager Types
 * Types for CRO Team Leader and CRO State Manager portals
 */

export interface CROTeamMember {
  userId: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  state: string | null
  subrole: string
  status?: string
  metrics?: CROMetrics
  reportsTo?: string
}

export interface CROMetrics {
  totalContacts: number
  activeContacts: number
  totalLeads: number
  activeLeads: number
  totalDeals: number
  activeDeals: number
  callsToday: number
  callsThisWeek: number
  callsThisMonth: number
  conversionRate: number
  avgCallDuration: number
  connectedRate: number
}

export interface TeamOverview {
  totalMembers: number
  activeMembers: number
  totalContacts: number
  totalLeads: number
  totalDeals: number
  callsToday: number
  callsThisWeek: number
  conversionRate: number
  topPerformer: CROTeamMember | null
}

export interface PipelineFilters {
  croId?: string
  status?: string
  stage?: string
  dateFrom?: string
  dateTo?: string
  loanType?: string
  page: number
  limit: number
}

export interface PipelineItem {
  id: string
  type: 'contact' | 'lead' | 'deal'
  customerName: string
  phone: string
  loanType?: string
  status: string
  stage?: string
  croName: string
  croId: string
  createdAt: string
  updatedAt: string
  amount?: number
  notes?: string
}

export interface CallAnalyticsSummary {
  totalCalls: number
  connectedCalls: number
  connectedRate: number
  avgDuration: number
  positiveRate: number
  outcomes: Record<string, number>
  dailyTrend: { date: string; calls: number; connected: number }[]
  croBreakdown: {
    croId: string
    croName: string
    calls: number
    connected: number
    avgDuration: number
    positiveRate: number
  }[]
}

export interface TeamTarget {
  croId: string
  croName: string
  targetCalls: number
  actualCalls: number
  targetLeads: number
  actualLeads: number
  targetConversions: number
  actualConversions: number
  achievementPercent: number
}

export interface TeamPerformance {
  rank: number
  croId: string
  croName: string
  score: number
  calls: number
  leads: number
  conversions: number
  avgAiScore: number
  trend: 'up' | 'down' | 'stable'
}

export interface TeamLeaderSummary {
  userId: string
  name: string
  state: string | null
  teamSize: number
  totalContacts: number
  totalLeads: number
  totalDeals: number
  callsToday: number
  performanceScore: number
}

export interface StateOverview extends TeamOverview {
  totalTeamLeaders: number
  teamLeaders: TeamLeaderSummary[]
}
