/**
 * ============================================================================
 * BDM TEAM PIPELINE - TYPE DEFINITIONS
 * ============================================================================
 * Comprehensive TypeScript types for the BDM Team Pipeline module
 * Version: 1.0
 * Date: December 7, 2025
 * ============================================================================
 */

import { LeadStatus, PartnerType, CustomerSubrole, BankType, PerformanceGrade, TrendDirection } from './enterprise-leads'

// ============================================================================
// COMMON TYPES
// ============================================================================

export type TabKey = 'analytics' | 'stages' | 'bde_performance' | 'bank_analytics'

export type ViewMode = 'kanban' | 'table'

export type TimeRange = 'today' | 'last7days' | 'last30days' | 'last90days' | 'custom'

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

export type AlertType =
  | 'no_contact'
  | 'doc_pending'
  | 'overdue_followup'
  | 'high_workload'
  | 'nearing_sanction'
  | 'sla_breach'
  | 'stale_lead'
  | 'assignment_pending'

export type Priority = 'critical' | 'high' | 'medium' | 'low'

export type RiskLevel = 'at_risk' | 'healthy' | 'excellent'

export type BDEStatus = 'active' | 'paused' | 'on_leave' | 'notice_period'

export type RecommendationType = 'REASSIGN' | 'INCREASE_CAPACITY' | 'PAUSE_ASSIGNMENT' | 'HIRE_NEW'

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface DateRangeFilter {
  preset: TimeRange
  startDate?: string
  endDate?: string
}

export interface PipelineFilters {
  dateRange: DateRangeFilter
  bdeIds: string[]
  leadStatuses: LeadStatus[]
  loanTypes: string[]
  bankIds: string[]
  loanAmountRange: {
    min: number
    max: number
  }
  partnerTypes: PartnerType[]
  riskLevel: 'all' | 'at_risk' | 'healthy' | 'excellent'
  priority: 'all' | Priority
}

export interface BDEFilters {
  status: BDEStatus | 'all'
  performanceGrade: PerformanceGrade | 'all'
  workloadRange: {
    min: number
    max: number
  }
}

// ============================================================================
// TAB 1: ANALYTICS DASHBOARD
// ============================================================================

export interface KPICard {
  id: string
  label: string
  value: number | string
  formattedValue: string
  unit?: string
  trend: TrendDirection
  changePercentage: number
  changeValue?: number
  color: string
  icon: string
  description?: string
  target?: number
  targetAchievement?: number
}

export interface PipelineFunnelData {
  stage: LeadStatus
  count: number
  percentage: number
  value: number // Total loan amount
  color: string
  dropoffRate?: number // % lost from previous stage
}

export interface LeadDistributionData {
  status: LeadStatus
  count: number
  percentage: number
  color: string
}

export interface BankDistributionData {
  bankId: string
  bankName: string
  bankLogo?: string
  count: number
  totalValue: number
  percentage: number
  color: string
}

export interface LoanTypeDistributionData {
  loanType: string
  count: number
  totalValue: number
  percentage: number
  avgTicketSize: number
  color: string
}

export interface ActivityHeatmapData {
  bdeId: string
  bdeName: string
  hourlyActivity: {
    hour: number
    activityCount: number
    intensity: 'low' | 'medium' | 'high'
  }[]
  dailyActivity: {
    date: string
    activityCount: number
    intensity: 'low' | 'medium' | 'high'
  }[]
}

export interface ConversionTrendData {
  date: string
  conversionRate: number
  target: number
  movingAverage: number
}

export interface TopBDEData {
  rank: number
  bdeId: string
  bdeName: string
  bdeAvatar?: string
  conversionRate: number
  sanctionedCount: number
  sanctionedAmount: number
  badge?: string
  isCurrentUser: boolean
}

export interface PipelineAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  leadId?: string
  leadNumber?: string
  bdeId?: string
  bdeName?: string
  actionRequired: string
  createdAt: string
  expiresAt?: string
  isRead: boolean
  isResolved: boolean
  metadata?: Record<string, any>
}

export interface AnalyticsDashboardData {
  kpiCards: KPICard[]
  funnel: PipelineFunnelData[]
  leadDistribution: LeadDistributionData[]
  bankDistribution: BankDistributionData[]
  loanTypeDistribution: LoanTypeDistributionData[]
  conversionTrend: ConversionTrendData[]
  topBDEs: TopBDEData[]
  alerts: PipelineAlert[]
  lastUpdated: string
}

// ============================================================================
// TAB 2: PIPELINE STAGES VIEW
// ============================================================================

export interface KanbanLead {
  id: string
  leadId: string // L-2025-000123
  customerName: string
  customerMobile: string
  customerEmail?: string
  loanType: string
  loanAmount: number
  requestedAmount: number
  assignedBde: {
    id: string
    name: string
    avatar?: string
  }
  daysInStage: number
  daysInStageColor: 'green' | 'yellow' | 'red' // <3, 3-7, >7
  lastActivityAt: string
  lastActivityType: string
  documentProgress: number // 0-100
  bank?: {
    id: string
    name: string
    logo?: string
  }
  priority: Priority
  riskLevel: RiskLevel
  tags: string[]
  expectedSanctionDate?: string
}

export interface KanbanColumn {
  id: LeadStatus
  title: string
  count: number
  totalValue: number
  leads: KanbanLead[]
  color: string
  icon: string
}

export interface PipelineTableRow {
  leadId: string
  leadNumber: string
  customerName: string
  customerMobile: string
  assignedBdeName: string
  assignedBdeAvatar?: string
  status: LeadStatus
  statusColor: string
  loanType: string
  loanAmount: number
  bank: string | null
  bankLogo?: string
  daysInStage: number
  lastContact: string
  documentProgress: number
  priority: Priority
  riskLevel: RiskLevel
  actions: ('view' | 'reassign' | 'export' | 'contact')[]
}

export interface StageStatistics {
  stage: LeadStatus
  count: number
  totalValue: number
  avgDaysSpent: number
  conversionRateToNext: number
  dropRate: number
}

export interface TimelineEvent {
  id: string
  timestamp: string
  eventType: 'STATUS_CHANGE' | 'NOTE_ADDED' | 'DOCUMENT_UPLOADED' | 'CONTACT_MADE' |
    'ASSIGNMENT_CHANGED' | 'BANK_UPDATE' | 'MEETING_SCHEDULED' | 'MEETING_COMPLETED'
  title: string
  description: string
  performedBy: string
  performedByRole: string
  icon: string
  color: string
  metadata?: Record<string, any>
}

export interface DocumentRequirement {
  type: string
  category: string
  required: boolean
  uploaded: boolean
  uploadedAt?: string
  verifiedStatus?: 'pending' | 'verified' | 'rejected'
}

export interface Communication {
  id: string
  type: 'call' | 'email' | 'whatsapp' | 'sms' | 'meeting'
  direction: 'inbound' | 'outbound'
  timestamp: string
  summary: string
  duration?: number
  performedBy: string
}

export interface LeadDetailPanel {
  customer: {
    id: string
    name: string
    mobile: string
    email: string
    subrole: CustomerSubrole
    city: string
    pincode: string
  }
  loan: {
    leadId: string
    leadNumber: string
    loanType: string
    requestedAmount: number
    sanctionedAmount: number | null
    tenure: number | null
    interestRate: number | null
    bank: {
      id: string
      name: string
      logo?: string
    } | null
    bankApplicationNumber: string | null
    priority: Priority
    riskLevel: RiskLevel
  }
  assignment: {
    assignedBde: {
      id: string
      name: string
      avatar?: string
      mobile: string
      email: string
    }
    assignedAt: string
    assignmentType: 'AUTO' | 'MANUAL'
    assignedBy: string | null
  }
  timeline: TimelineEvent[]
  documents: {
    required: DocumentRequirement[]
    completionPercentage: number
  }
  communications: Communication[]
  bankStatus: {
    submittedAt: string | null
    currentStage: string | null
    expectedDecisionDate: string | null
    bankRemarks: string | null
  }
}

export interface StageChangeRequest {
  leadId: string
  fromStatus: LeadStatus
  toStatus: LeadStatus
  reason: string
  notes?: string
}

// ============================================================================
// TAB 3: BDE PERFORMANCE MATRIX
// ============================================================================

export interface BDEPerformanceRow {
  // BDE Info
  bdeId: string
  bdeName: string
  bdeAvatar?: string
  bdeEmail: string
  bdeMobile: string
  joiningDate: string
  experienceMonths: number

  // Current Workload
  totalAssigned: number
  inProcess: number
  contactedToday: number
  qualified: number
  documentPending: number
  underReview: number

  // Monthly Performance
  sanctionedMTD: number
  sanctionedAmountMTD: number
  rejectedMTD: number
  droppedMTD: number

  // Pipeline Metrics
  totalPipelineValue: number
  avgConversionTime: number // days
  workloadPercentage: number // current/max * 100

  // Status
  status: BDEStatus
  statusReason: string | null

  // Performance Metrics
  performanceScore: number // 0-100
  performanceGrade: PerformanceGrade
  conversionRate: number

  // Comparison
  vsTeamAvg: number // % above/below team average
  vsOrgAvg: number // % above/below org average
  rankInTeam: number
  trend: TrendDirection
}

export interface BDELeadBreakdown {
  status: LeadStatus
  count: number
  percentage: number
  totalValue: number
}

export interface BDERecentActivity {
  date: string
  activities: {
    type: 'CONTACT' | 'NOTE' | 'DOCUMENT' | 'STATUS_CHANGE' | 'MEETING'
    count: number
    leadIds: string[]
  }[]
}

export interface BDEPendingFollowup {
  leadId: string
  leadNumber: string
  customerName: string
  dueDate: string
  priority: Priority
  lastContact: string
  daysOverdue: number
}

export interface BDEDocumentPending {
  leadId: string
  leadNumber: string
  customerName: string
  pendingDocuments: string[]
  requestedDate: string
  daysOverdue: number
}

export interface BDEConversionMetrics {
  overall: number
  vsTeamAvg: number
  vsOrgAvg: number
  byLoanType: {
    loanType: string
    conversionRate: number
    count: number
  }[]
  byBank: {
    bankName: string
    conversionRate: number
    count: number
  }[]
}

export interface BDEQualityScore {
  overall: number // 0-100
  noteFrequency: number
  responseTime: number
  documentCompleteness: number
  customerSatisfaction: number
}

export interface BDEDrilldown {
  summary: BDEPerformanceRow
  leadBreakdown: BDELeadBreakdown[]
  recentActivity: BDERecentActivity[]
  pendingFollowups: BDEPendingFollowup[]
  documentsPending: BDEDocumentPending[]
  conversionMetrics: BDEConversionMetrics
  qualityScore: BDEQualityScore
}

export interface BDEComparisonData {
  bdeName: string
  sanctioned: number
  qualified: number
  inProcess: number
  conversionRate: number
  workloadPercentage: number
}

export interface WorkloadHeatmapData {
  name: string
  currentLeads: number
  maxLeads: number
  utilizationPercentage: number
  color: 'green' | 'yellow' | 'red' // <60%, 60-80%, >80%
}

export interface EfficiencyScatterPoint {
  bdeName: string
  totalHandled: number // X-axis
  conversionPercentage: number // Y-axis
  bubbleSize: number // Total value sanctioned
  color: string
}

export interface LoadBalancingRecommendation {
  id: string
  type: RecommendationType
  priority: Priority
  title: string
  description: string
  impact: {
    affectedBdes: number
    affectedLeads: number
    expectedImprovement: string
  }
  actions: {
    label: string
    action: string
    data?: any
  }[]
  createdAt: string
}

export interface BDEActionRequest {
  actionType: 'reassign' | 'set_target' | 'send_message' | 'pause' | 'resume' | 'adjust_capacity'
  bdeId: string
  data: any
  reason: string
}

export interface ReassignLeadsRequest {
  fromBdeId: string
  toBdeId: string
  leadIds: string[]
  reason: string
  preserveActivity: boolean
}

export interface SetTargetsRequest {
  bdeId: string
  targets: {
    dailyContactTarget: number
    weeklyConversionTarget: number
    monthlyDisbursementTarget: number
  }
  startDate: string
  endDate: string
}

export interface SendMessageRequest {
  bdeIds: string[]
  messageType: 'PERFORMANCE_ALERT' | 'MOTIVATION' | 'SLA_BREACH' | 'APPRECIATION'
  subject: string
  body: string
  priority: Priority
}

// ============================================================================
// TAB 4: BANK & LOAN ANALYTICS
// ============================================================================

export interface BankPerformanceRow {
  bankId: string
  bankName: string
  bankLogo?: string
  bankType: BankType

  // Application Volume
  totalApplications: number
  inProgress: number
  sanctioned: number
  rejected: number

  // Processing Metrics
  avgSanctionTime: number // days
  minSanctionTime: number
  maxSanctionTime: number

  // Success Metrics
  successRate: number // sanctioned / (sanctioned + rejected) * 100
  rejectionRate: number

  // Financial Metrics
  totalAmount: number
  sanctionedAmount: number
  rejectedAmount: number
  avgSanctionedAmount: number

  // Comparison
  vsOtherBanks: number // % better/worse than avg
  trend: TrendDirection
  grade: PerformanceGrade
}

export interface LoanTypePortfolioData {
  loanType: string
  count: number
  percentage: number
  totalValue: number
  color: string
}

export interface LoanTypeTicketSize {
  loanType: string
  avgAmount: number
  minAmount: number
  maxAmount: number
  medianAmount: number
}

export interface LoanTypeConversionData {
  loanType: string
  applicationsSubmitted: number
  sanctioned: number
  conversionRate: number
  vsOverallAvg: number
}

export interface LoanTypeDocRequirements {
  loanType: string
  requiredDocs: string[]
  avgCompletionTime: number
  completionRate: number
}

export interface BankApprovalRateData {
  bankName: string
  approvalRate: number
  applicationsCount: number
  color: string
}

export interface BankProcessingSpeedData {
  bankName: string
  avgDays: number
  trend: 'improving' | 'deteriorating' | 'stable'
}

export interface RejectionReasonData {
  bankName: string
  totalRejections: number
  reasons: {
    reason: string
    count: number
    percentage: number
  }[]
}

export interface TopRejectionReason {
  rank: number
  reason: string
  count: number
  percentage: number
  affectedBanks: string[]
}

export interface DisbursementTrendData {
  month: string
  disbursedCount: number
  disbursedAmount: number
  avgTicketSize: number
}

export interface AmountRangeData {
  label: string
  min: number
  max: number | null
  count: number
  percentage: number
  totalValue: number
  avgConversionRate: number
}

export interface HighValueLead {
  leadId: string
  leadNumber: string
  customerName: string
  loanType: string
  amount: number
  bank: string | null
  status: LeadStatus
  assignedBdeName: string
  daysInPipeline: number
  priority: Priority
  specialHandling: boolean
}

export interface PipelineValueByStage {
  stage: LeadStatus
  count: number
  totalValue: number
  avgValue: number
  percentageOfTotal: number
}

export interface DisbursementProjection {
  currentMonth: string
  disbursedTillDate: number
  disbursedAmountTillDate: number
  inProgress: number
  inProgressValue: number
  projected: number
  projectedValue: number
  target: number
  targetValue: number
  achievementPercentage: number
  confidence: 'high' | 'medium' | 'low'
}

export interface PreferredBankData {
  rank: number
  bankName: string
  bankLogo?: string
  applicationCount: number
  marketShare: number
  successRate: number
  avgTicketSize: number
  whyPreferred: string[]
}

export interface SuccessHeatmapCell {
  bank: string
  loanType: string
  applications: number
  successRate: number
  color: 'green' | 'yellow' | 'red'
}

export interface TATBenchmarkData {
  bank: string
  avgTAT: number
  industryAvg: number
  vsIndustry: number
  grade: PerformanceGrade
}

export interface BankRecommendation {
  rank: number
  bankName: string
  bankLogo?: string
  approvalProbability: number
  expectedTAT: number
  expectedInterestRate: number
  reasoning: string
}

export interface BankRecommendationRequest {
  customerProfile: {
    subrole: CustomerSubrole
    loanType: string
    amount: number
    creditScore: number | null
  }
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    total: number
    page: number
    pageSize: number
    hasMore: boolean
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface ExportRequest {
  format: 'excel' | 'pdf' | 'csv'
  data: any[]
  filename: string
  columns?: string[]
  options?: {
    includeCharts?: boolean
    includeFilters?: boolean
    template?: string
  }
}

export interface ExportResponse {
  success: boolean
  downloadUrl?: string
  error?: string
}

// ============================================================================
// REAL-TIME UPDATE TYPES
// ============================================================================

export interface RealtimeEvent {
  type: 'LEAD_UPDATED' | 'BDE_PERFORMANCE_UPDATED' | 'ALERT_CREATED' | 'STATUS_CHANGED'
  payload: any
  timestamp: string
}

export interface SubscriptionConfig {
  channel: string
  event: string
  filter?: string
  callback: (payload: any) => void
}

// ============================================================================
// CUSTOM REPORT TYPES
// ============================================================================

export interface CustomReport {
  id: string
  reportName: string
  reportDescription?: string
  reportType: 'pipeline' | 'bde_performance' | 'bank_analytics' | 'loan_analytics' | 'team_summary'
  filters: PipelineFilters
  columns: string[]
  groupBy: string[]
  sortBy: { field: string; direction: 'asc' | 'desc' }[]
  aggregations: Record<string, 'sum' | 'avg' | 'count' | 'min' | 'max'>
  chartType?: 'table' | 'bar' | 'line' | 'pie' | 'donut' | 'area'
  chartConfig?: Record<string, any>
  isScheduled: boolean
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly'
  scheduleDay?: number
  scheduleTime?: string
  timezone?: string
  emailRecipients: string[]
  exportFormat: 'excel' | 'pdf' | 'csv'
  isShared: boolean
  sharedWith: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================================
// AI/ML TYPES
// ============================================================================

export interface LeadScore {
  leadId: string
  conversionProbability: number // 0-100
  churnRiskScore: number // 0-100
  qualityScore: number // 0-100
  urgencyScore: number // 0-100
  recommendedBdeId: string | null
  recommendedBankId: string | null
  nextBestAction: string
  nextBestActionDetails: string
  confidenceLevel: number
  modelVersion: string
}

export interface AIRecommendation {
  id: string
  type: 'lead_assignment' | 'bank_selection' | 'next_action' | 'workload_balancing'
  priority: Priority
  title: string
  description: string
  data: any
  confidenceLevel: number
  expectedImpact: string
  createdAt: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  field: string
  direction: SortDirection
}

export interface PaginationConfig {
  page: number
  pageSize: number
}

export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'scatter' | 'heatmap' | 'funnel'

export interface ChartConfig {
  type: ChartType
  xAxis?: string
  yAxis?: string
  legend?: boolean
  colors?: string[]
  height?: number
  width?: number
}

// ============================================================================
// STATE MANAGEMENT TYPES
// ============================================================================

export interface TeamPipelineState {
  activeTab: TabKey
  filters: PipelineFilters
  viewMode: ViewMode
  selectedLeadId: string | null
  selectedBdeId: string | null
  isLoading: boolean
  error: string | null
  lastUpdated: string | null
}

export interface TeamPipelineActions {
  setActiveTab: (tab: TabKey) => void
  setFilters: (filters: Partial<PipelineFilters>) => void
  setViewMode: (mode: ViewMode) => void
  selectLead: (leadId: string | null) => void
  selectBDE: (bdeId: string | null) => void
  refreshData: () => Promise<void>
}

// ============================================================================
// END OF TYPE DEFINITIONS
// ============================================================================
