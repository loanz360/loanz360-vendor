/**
 * ============================================================================
 * BDM TEAM PERFORMANCE - TYPE DEFINITIONS
 * ============================================================================
 * Enterprise-grade TypeScript types for Team Performance Module
 * Version: 1.0
 * Date: December 7, 2025
 * ============================================================================
 */

// Re-export common types from team-targets
export type {
  PerformanceStatus,
  TrendDirection,
  PerformanceGrade,
  DayStatus,
  BadgeCategory,
  BadgeRarity,
  Badge,
  BDEDailyAchievementRow,
  AchievementBadgeRow,
  BDEEarnedBadgeRow,
  TargetTemplateRow,
  PerformanceProjectionRow,
  TeamTargetRow,
} from './bdm-team-targets'

// ============================================================================
// TAB 1: TEAM OVERVIEW TYPES
// ============================================================================

export interface TeamSummaryKPI {
  id: string
  label: string
  value: number | string
  formattedValue: string
  target?: number
  targetFormatted?: string
  achievementPercentage?: number
  trend: {
    direction: 'up' | 'down' | 'stable'
    percentage: number
    comparisonText: string // "vs yesterday", "vs last month"
  }
  status: 'excellent' | 'good' | 'warning' | 'critical'
  color: string
  bgColor: string
  icon: string
  subtitle?: string
  subMetrics?: {
    label: string
    value: string
  }[]
}

export interface CalendarDayData {
  date: string // "2025-12-07"
  dayOfMonth: number
  dayOfWeek: string // "Mon", "Tue", etc.
  isWeekend: boolean
  isHoliday: boolean
  holidayName?: string

  teamMetrics: {
    leadsContacted: number
    conversions: number
    revenue: number
    activeBDEs: number
    bdesWithActivity: number
  }

  vsTarget: {
    leadsPercentage: number
    conversionsPercentage: number
    revenuePercentage: number
  }

  performanceLevel: 'exceeded' | 'met' | 'partial' | 'missed' | 'no_activity'
  color: string
  bgColor: string

  topPerformer?: {
    bdeId: string
    bdeName: string
    conversions: number
  }
}

export interface CalendarHeatmap {
  month: number
  year: number
  monthName: string
  days: CalendarDayData[]
  monthSummary: {
    totalWorkingDays: number
    daysWithActivity: number
    totalHolidays: number
    averageDailyLeads: number
    averageDailyConversions: number
    averageDailyRevenue: number
    bestDay: CalendarDayData | null
    worstDay: CalendarDayData | null
  }
}

export interface BDEPerformanceRow {
  bdeId: string
  bdeName: string
  bdeAvatar?: string
  employeeCode: string
  joiningDate: string
  experienceMonths: number

  targets: {
    leadsContactedTarget: number
    conversionsTarget: number
    revenueTarget: number
    conversionRateTarget: number
  }

  currentPerformance: {
    leadsContacted: number
    conversions: number
    revenue: number
    conversionRate: number
  }

  achievementRates: {
    leads: number // percentage
    conversions: number
    revenue: number
    overall: number
  }

  status: 'exceeding' | 'on_track' | 'at_risk' | 'behind'
  statusColor: string
  statusBgColor: string

  trend: {
    direction: 'up' | 'down' | 'stable'
    changePercentage: number
  }

  lastActivity: {
    timestamp: string
    type: string
    hoursAgo: number
  }

  badges: Badge[]
  currentStreak: number

  rankByLeads: number
  rankByConversions: number
  rankByRevenue: number
  overallRank: number
}

export interface AIInsightCard {
  id: string
  type: 'strength' | 'alert' | 'recommendation' | 'prediction'
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  icon: string
  color: string
  bgColor: string
  actionItems?: string[]
  relatedMetric?: string
  relatedBDEs?: {
    id: string
    name: string
  }[]
  confidenceLevel?: number // 0-100 for predictions
  createdAt: string
}

export interface TeamOverviewResponse {
  success: boolean
  data: {
    bdmInfo: {
      id: string
      name: string
      email: string
    }
    periodInfo: {
      month: number
      year: number
      monthName: string
      currentDay: number
      totalDays: number
      workingDaysRemaining: number
    }
    summaryKPIs: TeamSummaryKPI[]
    calendarHeatmap: CalendarHeatmap
    bdePerformanceGrid: BDEPerformanceRow[]
    aiInsights: AIInsightCard[]
    lastUpdated: string
  }
  error?: string
}

// ============================================================================
// TAB 2: BDE DEEP DIVE TYPES
// ============================================================================

export interface BDEDetailHeader {
  bdeInfo: {
    id: string
    name: string
    avatar?: string
    employeeCode: string
    email: string
    mobile: string
    joiningDate: string
    experienceMonths: number
  }
  currentMonth: {
    month: number
    year: number
    currentDay: number
    totalDays: number
  }
  performanceSummary: {
    overallAchievement: number
    grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
    status: 'exceeding' | 'on_track' | 'at_risk' | 'behind'
    rank: number
    totalBDEs: number
    daysRemaining: number
    projectedFinalAchievement: number
  }
  streakAndBadges: {
    currentStreak: number
    longestStreak: number
    badgesEarnedThisMonth: number
    totalCareerBadges: number
    featuredBadges: Badge[]
  }
  qualityMetrics: {
    overallQualityScore: number
    avgResponseTime: number
    documentCompleteness: number
    followupRate: number
  }
}

export interface DailyPerformanceTrend {
  date: string
  dayOfMonth: number
  leadsContactedActual: number
  leadsContactedTarget: number
  leadsContactedCumulative: number
  conversionsActual: number
  conversionsTarget: number
  conversionsCumulative: number
  revenueActual: number
  revenueTarget: number
  revenueCumulative: number
  achievementRate: number
  dayStatus: DayStatus
}

export interface ProjectionLine {
  enabled: boolean
  fromDay: number
  projectedDays: number[]
  projectedValues: number[]
  confidence: 'high' | 'medium' | 'low'
  confidenceIntervalUpper: number[]
  confidenceIntervalLower: number[]
}

export interface ConversionFunnelStage {
  stageName: string
  stageCode: string
  count: number
  totalValue: number
  percentage: number
  conversionToNext: number | null
  avgDaysInStage: number
  color: string
  leads: {
    leadId: string
    leadNumber: string
    customerName: string
    amount: number
    daysInStage: number
    lastActivity: string
  }[]
}

export interface DailyActivityDetail {
  date: string
  dayOfMonth: number
  dayOfWeek: string

  metrics: {
    leadsContacted: number
    conversions: number
    revenue: number
    calls: number
    emails: number
    meetings: number
    notes: number
    documents: number
    followups: number
  }

  cumulative: {
    leadsContacted: number
    conversions: number
    revenue: number
  }

  targets: {
    leads: number
    conversions: number
    revenue: number
  }

  achievementRate: number
  status: DayStatus
  statusColor: string

  workingHours: {
    firstActivity: string | null
    lastActivity: string | null
    totalHours: number
  }

  quality: {
    avgTimePerLead: number | null
    responseTime: number | null
    followupRate: number | null
  }

  dayGrade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' | null
}

export interface CoachingInsight {
  category: 'strength' | 'improvement' | 'prediction' | 'alert' | 'coaching'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  icon: string
  color: string
  evidence: string[]
  recommendations: string[]
  estimatedImpact?: string
  confidenceLevel?: number
}

export interface BDEDetailResponse {
  success: boolean
  data: {
    header: BDEDetailHeader
    dailyTrends: DailyPerformanceTrend[]
    projections: {
      leads: ProjectionLine
      conversions: ProjectionLine
      revenue: ProjectionLine
    }
    conversionFunnel: ConversionFunnelStage[]
    dailyActivityTable: DailyActivityDetail[]
    coachingInsights: CoachingInsight[]
    lastUpdated: string
  }
  error?: string
}

// ============================================================================
// TAB 3: LEADERBOARD TYPES
// ============================================================================

export interface LeaderboardEntry {
  rank: number
  previousRank: number
  rankChange: number

  bde: {
    id: string
    name: string
    avatar?: string
    employeeCode: string
    experienceMonths: number
  }

  overallScore: number
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'

  metrics: {
    leadsContacted: number
    conversions: number
    revenue: number
    conversionRate: number
    qualityScore: number
  }

  achievementRates: {
    leads: number
    conversions: number
    revenue: number
    overall: number
  }

  rankings: {
    byLeads: number
    byConversions: number
    byRevenue: number
    byQuality: number
  }

  badges: Badge[]
  currentStreak: number

  status: 'exceeding' | 'on_track' | 'at_risk' | 'behind'
  trend: {
    direction: 'up' | 'down' | 'stable'
    changePercentage: number
  }

  isCurrentUser: boolean
}

export interface CategoryLeader {
  categoryId: string
  categoryName: string
  categoryIcon: string
  categoryDescription: string
  topPerformers: {
    rank: number
    bdeId: string
    bdeName: string
    bdeAvatar?: string
    value: number
    formattedValue: string
    achievement: number
    badgeIcon: string
  }[]
}

export interface AchievementDistributionBin {
  range: string // "0-50%", "50-70%", etc.
  min: number
  max: number
  count: number
  percentage: number
  bdeIds: string[]
  color: string
}

export interface EfficiencyQuadrant {
  quadrantName: string
  description: string
  bdes: {
    bdeId: string
    bdeName: string
    leadsHandled: number
    conversionRate: number
    revenue: number
    color: string
  }[]
}

export interface TeamMilestone {
  bdeId: string
  bdeName: string
  bdeAvatar?: string
  milestoneType: string
  milestoneName: string
  achievedAt: string
  icon: string
  color: string
}

export interface LeaderboardResponse {
  success: boolean
  data: {
    periodInfo: {
      month: number
      year: number
      monthName: string
    }
    leaderboard: LeaderboardEntry[]
    categoryLeaders: CategoryLeader[]
    achievementDistribution: {
      bins: AchievementDistributionBin[]
      stats: {
        mean: number
        median: number
        stdDev: number
        highest: number
        lowest: number
      }
    }
    efficiencyQuadrants: EfficiencyQuadrant[]
    revenueContribution: {
      bdeId: string
      bdeName: string
      revenue: number
      percentage: number
      color: string
    }[]
    teamMilestones: TeamMilestone[]
    lastUpdated: string
  }
  error?: string
}

// ============================================================================
// TAB 4: HISTORICAL ANALYSIS TYPES
// ============================================================================

export interface MonthlyHistoricalData {
  month: number
  year: number
  monthName: string

  teamMetrics: {
    totalLeadsContacted: number
    totalConversions: number
    totalRevenue: number
    avgConversionRate: number
    teamSize: number
  }

  targets: {
    leadsTarget: number
    conversionsTarget: number
    revenueTarget: number
  }

  achievementRates: {
    leads: number
    conversions: number
    revenue: number
    overall: number
  }

  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
  rank: number | null
  totalTeams: number | null

  momGrowth: {
    leadsChange: number
    conversionsChange: number
    revenueChange: number
  }

  topPerformer: {
    bdeId: string
    bdeName: string
    conversions: number
  } | null
}

export interface BDETrendComparison {
  bdeId: string
  bdeName: string
  color: string
  monthlyData: {
    month: string
    conversions: number
    revenue: number
    achievementRate: number
  }[]
}

export interface SeasonalPattern {
  pattern: string
  description: string
  affectedMonths: string[]
  avgImpact: number // percentage
  confidence: number
}

export interface HistoricalInsight {
  type: 'pattern' | 'trend' | 'achievement' | 'correlation'
  title: string
  description: string
  evidence: string[]
  icon: string
  color: string
}

export interface HistoricalAnalysisResponse {
  success: boolean
  data: {
    periodInfo: {
      periodType: 'last_3_months' | 'last_6_months' | 'last_12_months' | 'ytd' | 'custom'
      startMonth: string
      endMonth: string
    }
    monthlyData: MonthlyHistoricalData[]
    bdeTrendComparisons: BDETrendComparison[]
    seasonalPatterns: SeasonalPattern[]
    insights: HistoricalInsight[]
    lastUpdated: string
  }
  error?: string
}

// ============================================================================
// TAB 5: PROJECTIONS & PLANNING TYPES
// ============================================================================

export interface MonthEndProjection {
  metric: 'leads' | 'conversions' | 'revenue'

  current: {
    value: number
    asOfDay: number
  }

  target: {
    value: number
    dailyRequiredRate: number
  }

  projected: {
    mostLikely: number
    optimistic: number
    pessimistic: number
    confidence: number
  }

  likelihood: {
    exceedTarget: number
    meetTarget: number
    fallShort: number
  }

  gap: number
  currentPace: number
  requiredPace: number
  feasibility: 'very_feasible' | 'feasible' | 'challenging' | 'unlikely'

  reasoning: string
}

export interface BDEProjectionSummary {
  bdeId: string
  bdeName: string

  conversionsProjection: {
    current: number
    target: number
    projected: number
    likelihood: 'very_likely' | 'likely' | 'possible' | 'unlikely'
    gap: number
  }

  revenueProjection: {
    current: number
    target: number
    projected: number
    likelihood: 'very_likely' | 'likely' | 'possible' | 'unlikely'
    gap: number
  }

  status: 'on_track' | 'at_risk' | 'behind'
  statusColor: string
}

export interface WhatIfScenario {
  scenarioId: string
  scenarioName: string
  scenarioDescription: string
  assumptions: {
    parameter: string
    currentValue: number | string
    adjustedValue: number | string
    change: string
  }[]
  projectedOutcome: {
    conversions: number
    revenue: number
    conversionChange: number
    revenueChange: number
  }
  feasibility: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  implementationSteps?: string[]
}

export interface RiskItem {
  id: string
  category: 'performance_decline' | 'resource_constraint' | 'external_factor'
  severity: 'critical' | 'high' | 'medium' | 'low'
  probability: number

  title: string
  description: string

  impact: {
    affectedBDEs: string[]
    potentialLoss: {
      conversions: number
      revenue: number
    }
  }

  mitigation: {
    actions: string[]
    owner: string
    deadline: string
    status: 'open' | 'in_progress' | 'mitigated'
  }
}

export interface OpportunityItem {
  id: string
  category: 'quick_wins' | 'pipeline_acceleration' | 'resource_optimization'
  priority: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'

  title: string
  description: string

  potential: {
    additionalConversions: number
    additionalRevenue: number
    timeframe: string
  }

  requirements: string[]

  action: {
    nextSteps: string[]
    owner: string
    status: 'identified' | 'planned' | 'in_execution' | 'realized'
  }
}

export interface SmartTargetRecommendation {
  bdeId: string
  bdeName: string

  lastMonthActual: {
    conversions: number
    revenue: number
  }

  recommended: {
    conversions: number
    revenue: number
  }

  rationale: string
  adjustmentFactor: number
  templateUsed: string
}

export interface ProjectionsResponse {
  success: boolean
  data: {
    periodInfo: {
      month: number
      year: number
      currentDay: number
      daysRemaining: number
    }
    teamProjections: MonthEndProjection[]
    bdeProjections: BDEProjectionSummary[]
    whatIfScenarios: WhatIfScenario[]
    risks: RiskItem[]
    opportunities: OpportunityItem[]
    nextMonthRecommendations: SmartTargetRecommendation[]
    lastUpdated: string
  }
  error?: string
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface ExportRequest {
  format: 'excel' | 'pdf' | 'csv'
  tab: 'overview' | 'bde-details' | 'leaderboard' | 'historical' | 'projections'
  month: number
  year: number
  bdeId?: string // For bde-details export
  includeCharts?: boolean
  includeRawData?: boolean
}

export interface ExportResponse {
  success: boolean
  downloadUrl?: string
  fileName?: string
  error?: string
}

// ============================================================================
// COMMON UTILITY TYPES
// ============================================================================

export interface APIError {
  error: string
  message?: string
  statusCode?: number
  details?: unknown}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface SortParams {
  sortBy: string
  sortDirection: 'asc' | 'desc'
}

export interface FilterParams {
  month?: number
  year?: number
  bdeIds?: string[]
  status?: string[]
  achievementRange?: {
    min: number
    max: number
  }
}
