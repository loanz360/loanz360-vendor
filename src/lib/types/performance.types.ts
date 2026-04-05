/**
 * ============================================================================
 * UNIFIED PERFORMANCE MANAGEMENT TYPE SYSTEM
 * ============================================================================
 * Comprehensive type definitions for all sales department roles
 * Last Updated: 2025-11-23
 * ============================================================================
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Performance grade enum
 */
export type PerformanceGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'

/**
 * Performance insight types
 */
export type InsightType = 'strength' | 'improvement' | 'recommendation' | 'warning' | 'achievement'

/**
 * Insight priority levels
 */
export type InsightPriority = 'low' | 'medium' | 'high' | 'critical'

/**
 * Trend direction
 */
export type TrendDirection = 'up' | 'down' | 'stable'

/**
 * Time period options
 */
export type TimePeriod = '24h' | '7d' | '30d' | '90d' | 'custom'

/**
 * Sales department roles
 */
export type SalesRole =
  | 'CRO'
  | 'BUSINESS_DEVELOPMENT_EXECUTIVE'
  | 'BUSINESS_DEVELOPMENT_MANAGER'
  | 'DIGITAL_SALES'
  | 'CHANNEL_PARTNER_EXECUTIVE'
  | 'CHANNEL_PARTNER_MANAGER'
  | 'DIRECT_SALES_EXECUTIVE'
  | 'DIRECT_SALES_MANAGER'
  | 'TELE_SALES'

// ============================================================================
// BASE INTERFACES
// ============================================================================

/**
 * Base metric interface
 */
export interface BaseMetric {
  label: string
  value: number
  target: number
  unit?: string
  achievementPercentage: number
  trend?: TrendDirection
  changePercentage?: number
  rank?: number
  totalEmployees?: number
}

/**
 * Metric card data
 */
export interface MetricCard extends BaseMetric {
  icon: string
  color: string
  category: 'lead' | 'revenue' | 'conversion' | 'quality' | 'activity' | 'team'
  description?: string
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  employeeId?: string
  avatar?: string
  location?: string
  primaryMetric: number
  secondaryMetric?: number
  tertiaryMetric?: number
  trend: TrendDirection
  changePercentage: number
  isCurrentUser: boolean
  badge?: string
}

/**
 * AI Insight
 */
export interface AIInsight {
  id: string
  type: InsightType
  priority: InsightPriority
  title: string
  description: string
  actionItems: string[]
  metricName?: string
  currentValue?: number
  targetValue?: number
  variancePercentage?: number
  isRead: boolean
  isActioned: boolean
  createdAt: string
  expiresAt?: string
}

/**
 * Graph data point
 */
export interface GraphDataPoint {
  date: string
  value: number
  label?: string
  target?: number
  average?: number
}

/**
 * Performance summary
 */
export interface PerformanceSummary {
  overallScore: number
  grade: PerformanceGrade
  rank: number
  totalEmployees: number
  percentile: number
  targetAchievement: number
  trend: TrendDirection
  changeFromLastMonth: number
}

// ============================================================================
// MONTHLY TARGETS
// ============================================================================

/**
 * Base monthly targets
 */
export interface BaseMonthlyTargets {
  id: string
  userId: string
  month: number
  year: number
  createdAt: string
  updatedAt: string
  createdBy?: string
}

/**
 * BDM Monthly Targets
 */
export interface BDMMonthlyTargets extends BaseMonthlyTargets {
  teamRevenueTarget: number
  teamConversionRateTarget: number
  teamTargetAchievementTarget: number
  bdeCountTarget: number
  trainingHoursTarget: number
  gradeDistributionTarget: number // Percentage of team with A/B grades
  attritionRateTarget: number
  onboardingSuccessTarget: number
  teamCSATTarget: number
}

/**
 * Digital Sales Monthly Targets
 */
export interface DigitalSalesMonthlyTargets extends BaseMonthlyTargets {
  websiteLeadsTarget: number
  socialLeadsTarget: number
  emailLeadsTarget: number
  onlineCompletionsTarget: number
  conversionRateTarget: number
  revenueTarget: number
  costPerLeadTarget: number
  costPerAcquisitionTarget: number
  responseTimeTarget: number // minutes
  landingPageConversionTarget: number
}

/**
 * Channel Partner Executive Monthly Targets
 */
export interface CPEMonthlyTargets extends BaseMonthlyTargets {
  activePartnersTarget: number
  newPartnersTarget: number
  partnerEngagementTarget: number
  applicationsViaPartnersTarget: number
  partnerRevenueTarget: number
  partnerConversionRateTarget: number
  trainingSessionsTarget: number
  supportTicketsTarget: number
  partnerNPSTarget: number
  partnerPayoutTarget: number
}

/**
 * Channel Partner Manager Monthly Targets
 */
export interface CPMMonthlyTargets extends BaseMonthlyTargets {
  networkSizeTarget: number
  networkRevenueTarget: number
  networkTargetAchievementTarget: number
  cpeCountTarget: number
  newPartnerAcquisitionTarget: number
  partnerRetentionRateTarget: number
  networkConversionRateTarget: number
  strategicPartnerCountTarget: number
  partnerSatisfactionTarget: number
}

/**
 * Direct Sales Executive Monthly Targets
 */
export interface DSEMonthlyTargets extends BaseMonthlyTargets {
  fieldVisitsTarget: number
  meetingsScheduledTarget: number
  meetingsAttendedTarget: number
  leadsGeneratedTarget: number
  leadsConvertedTarget: number
  fieldConversionRateTarget: number
  revenueTarget: number
  averageDealSizeTarget: number
  territoryCoverageTarget: number
  customerDemosTarget: number
}

/**
 * Direct Sales Manager Monthly Targets
 */
export interface DSMMonthlyTargets extends BaseMonthlyTargets {
  teamFieldVisitsTarget: number
  teamRevenueTarget: number
  teamTargetAchievementTarget: number
  dseCountTarget: number
  territoryCoverageTarget: number
  teamConversionRateTarget: number
  teamAverageDealSizeTarget: number
  newTerritoryExpansionTarget: number
  teamCSATTarget: number
}

/**
 * Sales Agent Monthly Targets
 */
export interface SalesAgentMonthlyTargets extends BaseMonthlyTargets {
  outboundCallsTarget: number
  inboundCallsTarget: number
  totalTalkTimeTarget: number // minutes
  averageCallDurationTarget: number // minutes
  callsToLeadsTarget: number
  leadsQualifiedTarget: number
  appointmentsBookedTarget: number
  callConversionRateTarget: number
  callQualityScoreTarget: number
  customerSatisfactionTarget: number
}

// ============================================================================
// DAILY METRICS
// ============================================================================

/**
 * Base daily metrics
 */
export interface BaseDailyMetrics {
  id: string
  userId: string
  metricDate: string
  createdAt: string
  updatedAt: string
}

/**
 * BDM Daily Metrics
 */
export interface BDMDailyMetrics extends BaseDailyMetrics {
  // Team Performance
  teamSize: number
  teamTotalRevenue: number
  teamTotalLeads: number
  teamTotalConversions: number
  teamConversionRate: number

  // Team Activity
  teamMeetingsConducted: number
  oneOnOnesCompleted: number
  teamTrainingHours: number

  // Team Quality
  teamCSATScore: number
  teamAveragePerformanceScore: number
  underperformersCount: number
  topPerformersCount: number
}

/**
 * Digital Sales Daily Metrics
 */
export interface DigitalSalesDailyMetrics extends BaseDailyMetrics {
  // Lead Sources
  websiteLeads: number
  socialLeads: number
  emailLeads: number
  organicLeads: number
  paidLeads: number
  totalLeads: number

  // Applications
  applicationsStarted: number
  applicationsCompleted: number
  applicationsApproved: number

  // Conversions
  leadsConverted: number
  conversionRate: number

  // Revenue
  revenueGenerated: number

  // Costs
  marketingSpend: number
  costPerLead: number
  costPerAcquisition: number

  // Quality
  avgResponseTimeMinutes: number
  landingPageConversions: number
  landingPageVisits: number
  landingPageConversionRate: number
}

/**
 * CPE Daily Metrics
 */
export interface CPEDailyMetrics extends BaseDailyMetrics {
  // Partner Management
  activePartners: number
  newPartnersOnboarded: number
  partnerMeetings: number
  partnerCallsMade: number

  // Partner Activity
  applicationsViaPartners: number
  partnerLeadsGenerated: number
  partnerRevenue: number
  partnerConversions: number

  // Partner Support
  supportTicketsCreated: number
  supportTicketsResolved: number
  trainingSessionsConducted: number

  // Partner Engagement
  partnerEngagementScore: number
  partnerResponseRate: number
  partnerSatisfactionScore: number
}

/**
 * CPM Daily Metrics
 */
export interface CPMDailyMetrics extends BaseDailyMetrics {
  // Network Overview
  totalNetworkSize: number
  activePartners: number
  strategicPartners: number

  // Network Performance
  networkRevenue: number
  networkApplications: number
  networkConversions: number
  networkConversionRate: number

  // Team Management
  cpeTeamSize: number
  teamMeetingsConducted: number
  networkTrainingSessions: number

  // Partner Acquisition & Retention
  newPartnersAcquired: number
  partnersChurned: number
  partnerRetentionRate: number
}

/**
 * DSE Daily Metrics
 */
export interface DSEDailyMetrics extends BaseDailyMetrics {
  // Field Activity
  fieldVisitsCompleted: number
  meetingsScheduled: number
  meetingsAttended: number
  travelDistanceKm: number

  // Lead Generation
  leadsGenerated: number
  leadsConverted: number
  fieldConversionRate: number

  // Revenue
  revenueGenerated: number
  dealsClosedCount: number
  averageDealSize: number

  // Territory
  territoryCoverage: number
  newProspectsAdded: number

  // Customer Engagement
  customerDemos: number
  productPresentations: number
  sameDayFollowups: number
  customerReferrals: number
}

/**
 * DSM Daily Metrics
 */
export interface DSMDailyMetrics extends BaseDailyMetrics {
  // Team Field Activity
  teamFieldVisits: number
  teamMeetingsScheduled: number
  teamMeetingsAttended: number
  teamTravelDistance: number

  // Team Performance
  teamRevenue: number
  teamLeadsGenerated: number
  teamConversions: number
  teamConversionRate: number

  // Team Management
  dseTeamSize: number
  oneOnOnesCompleted: number
  fieldCoachingSessions: number
  teamTrainingHours: number

  // Territory Management
  territoryCoverage: number
  newTerritoriesExpanded: number
  territoryPenetrationRate: number
}

/**
 * Sales Agent Daily Metrics
 */
export interface SalesAgentDailyMetrics extends BaseDailyMetrics {
  // Call Activity
  outboundCallsMade: number
  inboundCallsReceived: number
  totalCalls: number
  totalTalkTimeMinutes: number
  averageCallDuration: number

  // Call Outcomes
  callsToLeads: number
  leadsQualified: number
  appointmentsBooked: number
  callbacksScheduled: number

  // Call Quality
  callConversionRate: number
  firstCallResolutionRate: number
  callQualityScore: number
  holdTimeAverage: number
  afterCallWorkTime: number

  // Customer Satisfaction
  customerSatisfactionScore: number
  positiveCallsCount: number
  escalationsCount: number
}

// ============================================================================
// MONTHLY SUMMARY
// ============================================================================

/**
 * Base monthly summary
 */
export interface BaseMonthlySummary {
  id: string
  userId: string
  month: number
  year: number
  performanceScore: number
  performanceGrade: PerformanceGrade
  companyRank: number
  totalEmployees: number
  percentile: number
  targetAchievementPercentage: number
  generatedAt: string
  updatedAt: string
}

/**
 * BDM Monthly Summary
 */
export interface BDMMonthlySummary extends BaseMonthlySummary {
  // Team Performance
  teamTotalRevenue: number
  teamAverageConversionRate: number
  teamTargetAchievement: number

  // Team Composition
  bdeCount: number
  teamTrainingHours: number
  gradeDistributionPercentage: number

  // Team Quality
  teamAttritionRate: number
  onboardingSuccessRate: number
  teamCSAT: number

  // Rankings
  revenueRank: number
  conversionRank: number
  teamQualityRank: number
}

/**
 * Digital Sales Monthly Summary
 */
export interface DigitalSalesMonthlySummary extends BaseMonthlySummary {
  // Lead Generation
  totalWebsiteLeads: number
  totalSocialLeads: number
  totalEmailLeads: number
  totalLeads: number

  // Applications
  totalApplications: number
  totalConversions: number

  // Revenue
  totalRevenue: number
  totalMarketingSpend: number

  // Calculated Metrics
  overallConversionRate: number
  avgCostPerLead: number
  avgCostPerAcquisition: number
  roiPercentage: number

  // Achievement
  revenueAchievementPercentage: number
  leadAchievementPercentage: number
}

/**
 * CPE Monthly Summary
 */
export interface CPEMonthlySummary extends BaseMonthlySummary {
  // Partner Network
  totalActivePartners: number
  newPartnersOnboarded: number
  partnerChurnCount: number

  // Partner Performance
  totalPartnerApplications: number
  totalPartnerRevenue: number
  totalPartnerConversions: number
  partnerConversionRate: number

  // Partner Engagement
  avgPartnerEngagementScore: number
  totalTrainingSessions: number
  totalSupportTicketsResolved: number
  avgPartnerNPS: number

  // Achievement
  partnerRevenueAchievementPercentage: number
  partnerAcquisitionAchievementPercentage: number
}

/**
 * CPM Monthly Summary
 */
export interface CPMMonthlySummary extends BaseMonthlySummary {
  // Network Size
  totalNetworkSize: number
  newPartnersAcquired: number
  partnerRetentionRate: number

  // Network Performance
  networkRevenue: number
  networkApplications: number
  networkConversions: number
  networkConversionRate: number

  // Team Management
  cpeTeamSize: number
  avgCPEPerformanceScore: number

  // Strategic Metrics
  strategicPartnerCount: number
  networkMarketSharePercentage: number
  partnerSatisfactionScore: number

  // Achievement
  networkRevenueAchievementPercentage: number
  partnerRetentionAchievementPercentage: number
}

/**
 * DSE Monthly Summary
 */
export interface DSEMonthlySummary extends BaseMonthlySummary {
  // Field Activity
  totalFieldVisits: number
  totalMeetingsScheduled: number
  totalMeetingsAttended: number
  totalTravelDistanceKm: number

  // Lead & Conversion
  totalLeadsGenerated: number
  totalConversions: number
  fieldConversionRate: number

  // Revenue
  totalRevenue: number
  totalDealsCount: number
  averageDealSize: number

  // Territory
  territoryCoveragePercentage: number
  newProspectsAdded: number

  // Customer Engagement
  totalCustomerDemos: number
  totalCustomerReferrals: number

  // Achievement
  revenueAchievementPercentage: number
  conversionAchievementPercentage: number
}

/**
 * DSM Monthly Summary
 */
export interface DSMMonthlySummary extends BaseMonthlySummary {
  // Team Field Activity
  teamTotalFieldVisits: number
  teamTotalMeetings: number
  teamTotalTravelDistance: number

  // Team Performance
  teamTotalRevenue: number
  teamTotalConversions: number
  teamConversionRate: number
  teamAverageDealSize: number

  // Team Management
  dseTeamSize: number
  totalOneOnOnes: number
  totalCoachingSessions: number
  teamTrainingHours: number

  // Territory
  totalTerritoryCoverage: number
  newTerritoriesExpanded: number

  // Team Quality
  teamCSAT: number
  teamAvgPerformanceScore: number

  // Achievement
  teamRevenueAchievementPercentage: number
  teamTargetAchievementPercentage: number
}

/**
 * Sales Agent Monthly Summary
 */
export interface SalesAgentMonthlySummary extends BaseMonthlySummary {
  // Call Volume
  totalOutboundCalls: number
  totalInboundCalls: number
  totalCalls: number
  totalTalkTimeMinutes: number

  // Call Outcomes
  totalCallsToLeads: number
  totalLeadsQualified: number
  totalAppointmentsBooked: number

  // Performance Metrics
  overallCallConversionRate: number
  avgCallDuration: number
  avgFirstCallResolution: number
  avgCallQualityScore: number

  // Customer Satisfaction
  avgCustomerSatisfaction: number
  totalPositiveCalls: number
  totalEscalations: number

  // Achievement
  callVolumeAchievementPercentage: number
  conversionAchievementPercentage: number
  qualityAchievementPercentage: number
}

// ============================================================================
// DASHBOARD RESPONSE TYPES
// ============================================================================

/**
 * Current month performance response
 */
export interface CurrentMonthPerformance<
  TTargets = any,
  TMetrics = any,
  TSummary = any
> {
  userId: string
  userName: string
  userRole: SalesRole
  month: number
  year: number

  // Performance summary
  summary: PerformanceSummary

  // Metric cards
  metrics: MetricCard[]

  // Targets
  targets: TTargets

  // Current metrics (aggregated from daily)
  currentMetrics: TMetrics

  // Monthly summary
  monthlySummary?: TSummary

  // AI Insights
  insights: AIInsight[]

  // Graph data
  graphData: {
    daily: GraphDataPoint[]
    weekly?: GraphDataPoint[]
    comparison?: {
      self: GraphDataPoint[]
      average: GraphDataPoint[]
      topPerformer?: GraphDataPoint[]
    }
  }

  // Leaderboard
  leaderboard: LeaderboardEntry[]
  currentUserRank: number
}

/**
 * Historical performance response
 */
export interface HistoricalPerformance {
  userId: string
  periods: {
    month: number
    year: number
    summary: BaseMonthlySummary
    highlights: string[]
  }[]
  trends: {
    metric: string
    data: GraphDataPoint[]
    trend: TrendDirection
    changePercentage: number
  }[]
}

/**
 * Team performance response (for managers)
 */
export interface TeamPerformance {
  managerId: string
  managerName: string
  teamSize: number

  // Team summary
  teamSummary: {
    totalRevenue: number
    totalLeads: number
    totalConversions: number
    avgConversionRate: number
    avgPerformanceScore: number
    targetAchievement: number
  }

  // Team members
  teamMembers: {
    userId: string
    name: string
    role: SalesRole
    performanceScore: number
    grade: PerformanceGrade
    rank: number
    targetAchievement: number
    revenueContribution: number
    trend: TrendDirection
  }[]

  // Team distribution
  gradeDistribution: {
    grade: PerformanceGrade
    count: number
    percentage: number
  }[]

  // Team insights
  teamInsights: {
    topPerformers: string[]
    underperformers: string[]
    improvements: string[]
    warnings: string[]
  }
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Export options
 */
export interface ExportOptions {
  format: 'excel' | 'pdf' | 'csv' | 'pptx'
  period: TimePeriod
  startDate?: string
  endDate?: string
  includeGraphs: boolean
  includeLeaderboard: boolean
  includeInsights: boolean
}

/**
 * Export response
 */
export interface ExportResponse {
  success: boolean
  downloadUrl: string
  fileName: string
  fileSize: number
  expiresAt: string
}

// ============================================================================
// GAMIFICATION TYPES
// ============================================================================

/**
 * Achievement badge
 */
export interface AchievementBadge {
  id: string
  name: string
  description: string
  icon: string
  category: 'milestone' | 'streak' | 'excellence' | 'team' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  unlockedAt?: string
  progress?: number
  target?: number
}

/**
 * Contest
 */
export interface Contest {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  status: 'upcoming' | 'active' | 'completed'
  category: string
  prize: string
  participants: number
  currentUserRank?: number
  leaderboard: LeaderboardEntry[]
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * API Response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

/**
 * Pagination
 */
export interface Pagination {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T = any> extends APIResponse<T> {
  pagination: Pagination
}

// ============================================================================
// TELE SALES SPECIFIC TYPES
// ============================================================================

/**
 * Tele Sales Monthly Targets
 */
export interface TeleSalesMonthlyTargets extends BaseMonthlyTargets {
  // Call Targets
  outboundCallsTarget: number
  inboundCallsTarget: number
  totalCallsTarget: number
  talkTimeTarget: number // minutes

  // Lead Targets
  leadsGeneratedTarget: number
  leadsQualifiedTarget: number
  leadsConvertedTarget: number

  // Sales Targets
  revenueTarget: number
  applicationsCompletedTarget: number
  loanDisbursementsTarget: number

  // Quality Targets
  callQualityScoreTarget: number
  customerSatisfactionTarget: number
  firstCallResolutionTarget: number

  // Efficiency Targets
  averageHandleTimeTarget: number // seconds
  callbackCompletionTarget: number
  followUpComplianceTarget: number
}

/**
 * Tele Sales Daily Metrics
 */
export interface TeleSalesDailyMetrics extends BaseDailyMetrics {
  // Call Activity
  outboundCallsMade: number
  inboundCallsReceived: number
  totalCalls: number
  totalTalkTimeMinutes: number
  averageCallDuration: number
  callsAnswered: number
  callsDropped: number
  voicemailsLeft: number

  // Lead Management
  leadsGenerated: number
  leadsQualified: number
  leadsContacted: number
  leadsConverted: number
  leadsNurtured: number
  hotLeadsIdentified: number

  // Sales Performance
  revenueGenerated: number
  applicationsStarted: number
  applicationsCompleted: number
  loanDisbursements: number
  averageDealSize: number

  // Call Quality
  callQualityScore: number
  customerSatisfactionScore: number
  firstCallResolutionRate: number
  transferRate: number

  // Efficiency Metrics
  averageHandleTime: number // seconds
  averageWrapUpTime: number // seconds
  callbacksScheduled: number
  callbacksCompleted: number
  followUpsCompleted: number

  // Cross-sell/Up-sell
  crossSellAttempts: number
  crossSellSuccessful: number
  upsellAttempts: number
  upsellSuccessful: number

  // Compliance & Quality
  scriptAdherence: number // percentage
  complianceScore: number
  escalationsCreated: number
  complaintsReceived: number
}

/**
 * Tele Sales Monthly Summary
 */
export interface TeleSalesMonthlySummary extends BaseMonthlySummary {
  // Call Volume Summary
  totalOutboundCalls: number
  totalInboundCalls: number
  totalCalls: number
  totalTalkTimeMinutes: number
  avgCallsPerDay: number
  avgTalkTimePerDay: number

  // Lead Summary
  totalLeadsGenerated: number
  totalLeadsQualified: number
  totalLeadsConverted: number
  leadConversionRate: number
  avgLeadsPerDay: number

  // Sales Summary
  totalRevenue: number
  totalApplications: number
  totalDisbursements: number
  avgDealSize: number
  revenuePerCall: number

  // Quality Summary
  avgCallQualityScore: number
  avgCustomerSatisfaction: number
  avgFirstCallResolution: number

  // Efficiency Summary
  avgHandleTime: number
  callbackCompletionRate: number
  followUpComplianceRate: number

  // Cross-sell/Up-sell Summary
  totalCrossSellAttempts: number
  crossSellConversionRate: number
  totalUpsellAttempts: number
  upsellConversionRate: number

  // Achievement Percentages
  callVolumeAchievement: number
  revenueAchievement: number
  qualityAchievement: number
  efficiencyAchievement: number

  // Rankings
  revenueRank: number
  callVolumeRank: number
  qualityRank: number
  conversionRank: number
}

/**
 * Tele Sales Gamification Data
 */
export interface TeleSalesGamification {
  // Current Streaks
  currentCallStreak: number
  currentConversionStreak: number
  currentQualityStreak: number

  // Points System
  totalPoints: number
  pointsThisMonth: number
  pointsToday: number
  pointsBreakdown: {
    callPoints: number
    conversionPoints: number
    qualityPoints: number
    bonusPoints: number
  }

  // Level System
  currentLevel: number
  levelName: string
  experiencePoints: number
  experienceToNextLevel: number
  levelProgress: number

  // Badges
  badges: AchievementBadge[]
  recentBadges: AchievementBadge[]

  // Leaderboard Position
  dailyRank: number
  weeklyRank: number
  monthlyRank: number

  // Contests
  activeContests: Contest[]
  contestsWon: number

  // Achievements
  achievementsUnlocked: number
  totalAchievements: number
  nextAchievement?: {
    name: string
    description: string
    progress: number
    target: number
  }
}

/**
 * Tele Sales Real-time Metrics (for live dashboard)
 */
export interface TeleSalesRealTimeMetrics {
  // Current Status
  isOnCall: boolean
  currentCallDuration: number // seconds
  currentCallType?: 'inbound' | 'outbound'

  // Today's Live Stats
  callsToday: number
  talkTimeToday: number
  leadsToday: number
  conversionsToday: number
  revenueToday: number

  // Queue Status
  queuePosition: number
  waitingCallbacks: number
  scheduledFollowUps: number

  // Targets Progress (real-time)
  dailyCallProgress: number
  dailyRevenueProgress: number
  dailyLeadProgress: number

  // Quality Alerts
  qualityAlerts: {
    type: 'warning' | 'critical'
    message: string
    metric: string
    timestamp: string
  }[]

  // Last Updated
  lastUpdatedAt: string
}

/**
 * Tele Sales Predictive Analytics
 */
export interface TeleSalesPredictiveAnalytics {
  // Predictions
  predictedMonthlyRevenue: number
  predictedMonthlyConversions: number
  predictedPerformanceGrade: PerformanceGrade

  // Probability Scores
  targetAchievementProbability: number
  bonusQualificationProbability: number
  promotionReadiness: number

  // Recommendations
  recommendedCallTimes: {
    hour: number
    successRate: number
    recommendation: string
  }[]

  // Risk Indicators
  performanceRiskLevel: 'low' | 'medium' | 'high'
  riskFactors: string[]
  improvementActions: string[]

  // Best Practices
  topPerformerBehaviors: string[]
  skillGaps: {
    skill: string
    currentScore: number
    targetScore: number
    trainingRecommendation: string
  }[]

  // Forecast
  weeklyForecast: {
    week: number
    predictedRevenue: number
    predictedCalls: number
    confidence: number
  }[]
}
