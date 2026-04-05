// ============================================================================
// BDM TEAM TARGETS - TYPE DEFINITIONS
// ============================================================================
// Version: 1.0
// Date: December 7, 2025
// Purpose: Complete TypeScript type definitions for Team Targets module
// ============================================================================

// ============================================================================
// CORE ENUMS & TYPES
// ============================================================================

export type PerformanceStatus = 'exceeding' | 'on_track' | 'at_risk' | 'behind'
export type TrendDirection = 'up' | 'down' | 'stable'
export type PerformanceGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
export type DayStatus = 'exceeded' | 'met' | 'partial' | 'missed' | 'no_activity'
export type BadgeCategory = 'performance' | 'consistency' | 'quality' | 'milestone' | 'team'
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type TabKey = 'overview' | 'bde-deep-dive' | 'leaderboard' | 'target-settings' | 'projections'

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

export interface BDEDailyAchievementRow {
  id: string
  bde_user_id: string
  achievement_date: string

  leads_contacted: number
  conversions: number
  revenue: number

  mtd_leads_contacted: number
  mtd_conversions: number
  mtd_revenue: number

  notes_added: number
  documents_uploaded: number
  meetings_attended: number
  calls_made: number
  emails_sent: number
  followups_completed: number

  avg_response_time_minutes: number | null
  avg_time_per_lead_minutes: number | null
  followup_rate: number | null
  documentation_completeness: number | null

  first_activity_time: string | null
  last_activity_time: string | null
  working_hours: number | null

  daily_leads_target: number | null
  daily_conversions_target: number | null
  daily_revenue_target: number | null

  achievement_rate: number | null
  status: DayStatus

  current_streak: number
  is_weekend: boolean
  is_holiday: boolean
  holiday_name: string | null

  day_grade: PerformanceGrade | null

  metadata: Record<string, any>

  created_at: string
  updated_at: string
}

export interface AchievementBadgeRow {
  id: string
  badge_code: string
  badge_name: string
  badge_description: string | null
  icon: string | null
  color: string | null
  category: BadgeCategory
  criteria: BadgeCriteria
  rarity: BadgeRarity
  points: number
  is_active: boolean
  is_auto_awarded: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface BDEEarnedBadgeRow {
  id: string
  bde_user_id: string
  badge_id: string
  earned_at: string
  earned_in_month: string
  earning_context: Record<string, any>
  is_displayed: boolean
  is_favorite: boolean
  awarded_by: string | null
  award_note: string | null
}

export interface TargetTemplateRow {
  id: string
  template_name: string
  template_description: string | null
  created_by: string
  is_default: boolean
  is_public: boolean
  config: TargetConfig
  auto_rules: AutoRules
  usage_count: number
  last_used_at: string | null
  last_used_by: string | null
  created_at: string
  updated_at: string
}

export interface PerformanceProjectionRow {
  id: string
  projection_type: 'bde' | 'team' | 'organization'
  entity_id: string
  projection_date: string
  for_month: string
  days_remaining: number
  current_day: number
  metric: string
  current_value: number
  target_value: number
  projected_value: number
  projected_optimistic: number | null
  projected_pessimistic: number | null
  confidence_percentage: number | null
  likelihood: 'very_likely' | 'likely' | 'possible' | 'unlikely'
  probability_exceed_target: number | null
  probability_meet_target: number | null
  probability_fall_short: number | null
  model_version: string
  model_accuracy: number | null
  training_data_points: number | null
  reasoning: string | null
  risk_factors: string[]
  success_factors: string[]
  recommended_actions: string[]
  metadata: Record<string, any>
  created_at: string
}

export interface TeamTargetRow {
  id: string
  target_type: 'BDM' | 'BDE'
  user_id: string
  set_by: string | null
  month: number
  year: number
  daily_contact_target: number | null
  weekly_conversion_target: number | null
  monthly_conversion_target: number | null
  monthly_disbursement_target: number | null
  monthly_revenue_target: number | null
  conversion_rate_target: number | null
  avg_tat_target: number | null
  customer_satisfaction_target: number | null
  team_revenue_target: number | null
  team_conversion_rate_target: number | null
  bde_count_target: number | null
  team_quality_score_target: number | null
  activity_targets: Record<string, any>
  quality_targets: Record<string, any>
  is_active: boolean
  is_published: boolean
  published_at: string | null
  published_by: string | null
  template_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// BADGE CRITERIA TYPES
// ============================================================================

export type BadgeCriteria =
  | StreakCriteria
  | RankingCriteria
  | AchievementCriteria
  | SustainedCriteria
  | MilestoneCriteria
  | CollaborationCriteria

export interface StreakCriteria {
  type: 'streak'
  metric: 'daily_activity' | 'daily_target' | 'quality_maintenance'
  threshold: number
  description?: string
}

export interface RankingCriteria {
  type: 'ranking'
  metric: 'conversion_rate' | 'revenue' | 'leads' | 'quality_score' | 'avg_conversion_time'
  rank: number
  period?: 'month' | 'week' | 'quarter'
  direction?: 'highest' | 'lowest'
}

export interface AchievementCriteria {
  type: 'achievement'
  metric: 'revenue' | 'conversions' | 'leads'
  threshold: number
  comparison?: 'percentage_of_target' | 'absolute'
}

export interface SustainedCriteria {
  type: 'sustained'
  metric: 'quality_score' | 'response_time' | 'conversion_rate'
  threshold: number
  duration: number // days
}

export interface MilestoneCriteria {
  type: 'milestone'
  metric: 'lifetime_conversions' | 'lifetime_revenue'
  threshold: number
}

export interface CollaborationCriteria {
  type: 'collaboration'
  count: number
  category?: string
}

// ============================================================================
// TARGET CONFIGURATION TYPES
// ============================================================================

export interface TargetConfig {
  leads_contacted_target: number | 'auto'
  conversions_target: number | 'auto'
  revenue_target: number | 'auto'
  conversion_rate_target: number
  quality_score_target: number
}

export interface AutoRules {
  based_on: 'team_avg' | 'org_avg' | 'last_month' | 'custom'
  adjustment_factor: number
  min_target: number
  max_target: number
  experience_scaling?: {
    '0-6_months': number
    '6-12_months': number
    '12-24_months': number
    '24+_months': number
  }
}

// ============================================================================
// TAB 1: MONTHLY OVERVIEW TYPES
// ============================================================================

export interface TeamSummaryCard {
  id: string
  title: string
  value: number | string
  target?: number
  achievement?: number // percentage
  trend: {
    direction: TrendDirection
    percentage: number
    comparison: string
  }
  color: string
  icon: string
  subtitle?: string
}

export interface DayPerformance {
  date: string
  dayOfMonth: number
  dayOfWeek: string

  teamLeadsContacted: number
  teamConversions: number
  teamRevenue: number

  bdeActivities: BDEDayActivity[]

  isWeekend: boolean
  isHoliday: boolean
  holidayName?: string
  performanceGrade: 'excellent' | 'good' | 'average' | 'poor' | 'no_activity'
  color: string

  vsAvgDay: number
  rankInMonth: number
}

export interface BDEDayActivity {
  bdeId: string
  bdeName: string
  leadsContacted: number
  conversions: number
  revenue: number
  notes: number
  meetings: number
}

export interface CalendarHeatmap {
  month: string
  year: number
  days: DayPerformance[]
  monthStats: {
    totalDays: number
    workingDays: number
    holidays: number
    avgDailyLeads: number
    avgDailyConversions: number
    avgDailyRevenue: number
  }
}

export interface BDETargetRow {
  bdeId: string
  bdeName: string
  bdeAvatar: string
  bdeEmail: string
  employeeCode: string
  joiningDate: string
  experienceMonths: number

  targets: {
    leadsContactedTarget: number
    conversionsTarget: number
    revenueTarget: number
    conversionRateTarget: number
    qualityScoreTarget: number
  }

  achievements: {
    leadsContacted: number
    conversions: number
    revenue: number
    conversionRate: number
    qualityScore: number
  }

  achievementRates: {
    leadsContactedRate: number
    conversionsRate: number
    revenueRate: number
    conversionRateAchieved: boolean
    qualityScoreAchieved: boolean
  }

  overallAchievementRate: number
  performanceStatus: PerformanceStatus
  projectedEndOfMonth: {
    leadsContacted: number
    conversions: number
    revenue: number
    confidence: 'high' | 'medium' | 'low'
  }

  dailyTrends: DailyTrendPoint[]

  rankByLeads: number
  rankByConversions: number
  rankByRevenue: number
  overallRank: number

  badges: Badge[]
  currentStreak: number
  longestStreak: number

  lastActivityAt: string
  lastActivityType: string
  hoursSinceLastActivity: number
}

export interface DailyTrendPoint {
  date: string
  leadsContacted: number
  conversions: number
  revenue: number
  cumulativeLeads: number
  cumulativeConversions: number
  cumulativeRevenue: number
}

export interface Badge {
  id: string
  code: string
  name: string
  icon: string
  color: string
  category: BadgeCategory
  rarity: BadgeRarity
  points: number
  earnedAt: string
  description: string
}

// ============================================================================
// TAB 2: INDIVIDUAL BDE DEEP DIVE TYPES
// ============================================================================

export interface BDESummaryHeader {
  bdeInfo: {
    id: string
    name: string
    avatar: string
    employeeCode: string
    joiningDate: string
    experienceMonths: number
    currentRank: number
    totalBDEs: number
  }

  currentMonthSummary: {
    overallAchievement: number
    grade: PerformanceGrade
    status: PerformanceStatus
    daysRemaining: number
    projectedFinalScore: number
  }
}

export interface DailyPerformanceGraph {
  currentDay: number
  totalDays: number

  dataLines: {
    leadsActual: number[]
    leadsTarget: number[]
    conversionsActual: number[]
    conversionsTarget: number[]
    revenueActual: number[]
    revenueTarget: number[]
  }

  annotations: GraphAnnotation[]
  projection: ProjectionData
}

export interface GraphAnnotation {
  day: number
  type: 'milestone' | 'achievement' | 'alert' | 'note'
  label: string
  icon: string
  color: string
}

export interface ProjectionData {
  enabled: boolean
  days: number[]
  projectedValues: number[]
  confidenceIntervalLower: number[]
  confidenceIntervalUpper: number[]
  confidence: 'high' | 'medium' | 'low'
}

export interface BDELeadFunnel {
  bdeId: string
  month: string
  stages: FunnelStage[]
  metrics: FunnelMetrics
  bottlenecks: Bottleneck[]
}

export interface FunnelStage {
  stage: string
  stageName: string
  count: number
  totalValue: number
  avgDaysInStage: number
  conversionToNext: number
  leads: FunnelLead[]
}

export interface FunnelLead {
  leadId: string
  customerName: string
  amount: number
  daysInStage: number
  lastActivity: string
}

export interface FunnelMetrics {
  totalLeadsEntered: number
  currentlyActive: number
  sanctioned: number
  rejected: number
  dropped: number
  overallConversionRate: number
}

export interface Bottleneck {
  stage: string
  reason: string
  affectedLeads: number
  recommendation: string
}

export interface DailyActivityRow {
  date: string
  dayOfMonth: number
  dayOfWeek: string

  leadsContacted: number
  conversions: number
  revenue: number
  notes: number
  documents: number
  meetings: number
  calls: number
  emails: number

  cumulativeLeads: number
  cumulativeConversions: number
  cumulativeRevenue: number

  dailyTargetLeads: number
  dailyTargetConversions: number
  dailyTargetRevenue: number
  achievementRate: number

  status: DayStatus
  statusColor: string
  icon: string

  firstActivityTime: string
  lastActivityTime: string
  workingHours: number

  avgTimePerLead: number
  responseTime: number
  followupRate: number
}

export interface BDEInsights {
  bdeId: string
  month: string
  generatedAt: string

  strengths: InsightItem[]
  improvementAreas: ImprovementArea[]
  predictions: Prediction[]
  alerts: Alert[]
  coachingPoints: CoachingPoint[]
}

export interface InsightItem {
  category: 'activity' | 'conversion' | 'quality' | 'consistency'
  title: string
  description: string
  metric: string
  evidence: string[]
  icon: string
  color: string
}

export interface ImprovementArea {
  category: 'activity' | 'conversion' | 'quality' | 'consistency'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  recommendations: string[]
  estimatedImpact: string
  icon: string
  color: string
}

export interface Prediction {
  type: 'end_of_month_forecast' | 'target_achievement' | 'performance_trend'
  metric: string
  currentValue: number
  projectedValue: number
  targetValue: number
  likelihood: 'very_likely' | 'likely' | 'possible' | 'unlikely'
  confidence: number
  reasoning: string
}

export interface Alert {
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: 'declining_trend' | 'target_miss_risk' | 'quality_drop' | 'inactivity'
  title: string
  description: string
  actionRequired: string
  daysToResolve: number
}

export interface CoachingPoint {
  topic: string
  reason: string
  suggestedApproach: string
  resources: string[]
  priority: 'high' | 'medium' | 'low'
}

// ============================================================================
// TAB 3: TEAM LEADERBOARD TYPES
// ============================================================================

export interface LeaderboardEntry {
  rank: number
  previousRank: number
  rankChange: number

  bdeInfo: {
    id: string
    name: string
    avatar: string
    employeeCode: string
    experienceMonths: number
  }

  overallScore: number
  grade: PerformanceGrade

  leadsAchievement: number
  conversionsAchievement: number
  revenueAchievement: number
  qualityScore: number

  leadsContacted: number
  conversions: number
  revenue: number
  conversionRate: number

  rankByLeads: number
  rankByConversions: number
  rankByRevenue: number
  rankByQuality: number

  badges: Badge[]
  badgeCount: number
  currentStreak: number

  status: PerformanceStatus
  trendDirection: TrendDirection

  isCurrentUser: boolean
}

export interface CategoryRankings {
  categories: RankingCategory[]
}

export interface RankingCategory {
  id: string
  name: string
  icon: string
  color: string
  description: string
  topPerformers: TopPerformer[]
}

export interface TopPerformer {
  rank: number
  bdeName: string
  bdeAvatar: string
  value: number
  achievement: number
  badge: string
}

export interface AchievementDistribution {
  type: 'histogram'
  bins: {
    range: string
    count: number
    bdes: string[]
    color: string
  }[]
  stats: {
    mean: number
    median: number
    mode: number
    stdDev: number
    highestAchievement: number
    lowestAchievement: number
  }
}

export interface EfficiencyScatter {
  type: 'scatter'
  xAxis: string
  yAxis: string
  dataPoints: {
    bdeId: string
    bdeName: string
    x: number
    y: number
    size: number
    color: string
    quadrant: 'high_activity_high_conversion' | 'high_activity_low_conversion' |
              'low_activity_high_conversion' | 'low_activity_low_conversion'
  }[]
  avgActivity: number
  avgConversionRate: number
  insights: {
    topRight: string
    topLeft: string
    bottomRight: string
    bottomLeft: string
  }
}

export interface RevenueContribution {
  type: 'pie'
  slices: {
    bdeName: string
    revenue: number
    percentage: number
    color: string
  }[]
  top20Percent: {
    bdes: string[]
    revenueContribution: number
  }
}

export interface TeamAchievements {
  activeStreaks: StreakInfo[]
  recentMilestones: Milestone[]
  teamRecords: TeamRecord[]
}

export interface StreakInfo {
  bdeId: string
  bdeName: string
  bdeAvatar: string
  streakType: 'daily_activity' | 'daily_target' | 'quality_maintenance'
  currentStreak: number
  longestStreak: number
  icon: string
  color: string
}

export interface Milestone {
  bdeId: string
  bdeName: string
  milestoneType: string
  milestone: string
  achievedAt: string
  icon: string
  color: string
}

export interface TeamRecord {
  category: string
  recordHolder: string
  value: number
  achievedDate: string
  isCurrentMonth: boolean
}

// ============================================================================
// TAB 4: TARGET SETTINGS TYPES
// ============================================================================

export interface TargetSettingsForm {
  month: string
  year: number
  mode: 'individual' | 'bulk' | 'template'

  individualTarget?: IndividualTarget
  bulkTarget?: BulkTarget
  template?: TemplateTarget

  preview: TargetPreview[]
  validation: ValidationResult
}

export interface IndividualTarget {
  bdeId: string
  bdeName: string

  leadsContactedTarget: number
  conversionsTarget: number
  revenueTarget: number
  conversionRateTarget: number
  qualityScoreTarget: number

  rationale: string
  comparedToLastMonth: {
    leadsChange: number
    conversionsChange: number
    revenueChange: number
  }
}

export interface BulkTarget {
  selectedBdeIds: string[]
  baselineType: 'same_for_all' | 'scaled_by_experience' | 'scaled_by_last_month'

  targets: {
    leadsContactedTarget: number
    conversionsTarget: number
    revenueTarget: number
    conversionRateTarget: number
  }

  scalingFactors: {
    experienceMultiplier: {
      '0-6_months': number
      '6-12_months': number
      '12-24_months': number
      '24+_months': number
    }
    lastMonthMultiplier: number
  }
}

export interface TemplateTarget {
  templateId: string
  templateName: string
  description: string
  targets: TargetConfig
  applyTo: 'all' | 'selected'
  selectedBdeIds?: string[]
}

export interface TargetTemplate {
  id: string
  name: string
  description: string
  createdBy: string
  createdAt: string
  lastUsed: string
  usageCount: number
  isDefault: boolean

  config: TargetConfig
  autoRules: AutoRules
}

export interface TargetPreview {
  bdeId: string
  bdeName: string
  proposedTargets: {
    leadsContactedTarget: number
    conversionsTarget: number
    revenueTarget: number
  }
  currentTargets: {
    leadsContactedTarget: number
    conversionsTarget: number
    revenueTarget: number
  }
  lastMonthAchievement: {
    leadsContacted: number
    conversions: number
    revenue: number
  }
  feasibilityScore: number
  recommendation: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface TargetHistory {
  bdeId: string
  bdeName: string
  history: HistoryEntry[]
  trends: TrendAnalysis
  graphData: {
    months: string[]
    achievementRates: number[]
    targets: number[]
  }
}

export interface HistoryEntry {
  month: string
  year: number
  targets: {
    leadsContactedTarget: number
    conversionsTarget: number
    revenueTarget: number
  }
  achievements: {
    leadsContacted: number
    conversions: number
    revenue: number
  }
  achievementRates: {
    leadsRate: number
    conversionsRate: number
    revenueRate: number
    overallRate: number
  }
  rank: number
  grade: PerformanceGrade
  status: 'exceeded' | 'met' | 'partial' | 'missed'
}

export interface TrendAnalysis {
  averageAchievementRate: number
  bestMonth: string
  worstMonth: string
  improvementTrend: 'improving' | 'declining' | 'stable'
  consistency: number
}

// ============================================================================
// TAB 5: PREDICTIVE ANALYTICS TYPES
// ============================================================================

export interface MonthEndProjection {
  generatedAt: string
  currentDay: number
  daysRemaining: number

  teamProjection: TeamProjectionData
  bdeProjections: BDEProjectionData[]
}

export interface TeamProjectionData {
  metric: 'leads' | 'conversions' | 'revenue'

  current: {
    value: number
    asOfDay: number
  }

  target: {
    value: number
    dailyRequiredRateRemaining: number
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
  dailyRequiredRate: number
  comparison: {
    vsCurrentPace: string
    vsHistoricalAvg: string
    feasibility: 'very_feasible' | 'feasible' | 'challenging' | 'unlikely'
  }
}

export interface BDEProjectionData {
  bdeId: string
  bdeName: string
  projections: MetricProjection[]
  riskFactors: string[]
  successFactors: string[]
}

export interface MetricProjection {
  metric: string
  current: number
  target: number
  projected: number
  likelihood: 'very_likely' | 'likely' | 'possible' | 'unlikely'
  confidence: number
}

export interface ScenarioAnalyzer {
  baselineScenario: Scenario
  alternativeScenarios: Scenario[]
}

export interface Scenario {
  name: string
  description: string
  assumptions: ScenarioAssumption[]
  projectedResult: {
    leads: number
    conversions: number
    revenue: number
  }
  impact?: {
    leadsChange: number
    conversionsChange: number
    revenueChange: number
  }
  feasibility?: 'high' | 'medium' | 'low'
}

export interface ScenarioAssumption {
  parameter: string
  currentValue: number
  adjustedValue: number
  change: string
}

export interface RiskOpportunityDashboard {
  risks: Risk[]
  opportunities: Opportunity[]
}

export interface Risk {
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
  }

  status: 'open' | 'in_progress' | 'mitigated' | 'accepted'
}

export interface Opportunity {
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
    deadline: string
  }

  status: 'identified' | 'planned' | 'in_execution' | 'realized'
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasMore: boolean
  }
}

export interface ErrorResponse {
  success: false
  error: string
  message: string
  statusCode: number
  timestamp: string
}

// ============================================================================
// FILTER & SORT TYPES
// ============================================================================

export interface TeamTargetsFilters {
  month?: number
  year?: number
  bdeIds?: string[]
  performanceStatus?: PerformanceStatus[]
  achievementRateRange?: {
    min: number
    max: number
  }
  search?: string
}

export interface SortConfig {
  field: string
  direction: 'asc' | 'desc'
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface TeamTargetsPageProps {
  initialTab?: TabKey
}

export interface BDEDeepDiveProps {
  bdeId: string
  onClose?: () => void
}

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  sortBy?: string
  onSort?: (field: string) => void
}

export interface TargetSettingsProps {
  month: number
  year: number
  onSave?: (targets: TeamTargetRow[]) => void
}

export interface ProjectionsDashboardProps {
  month: string
  year: number
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export type {
  // Add any additional utility types here
}
