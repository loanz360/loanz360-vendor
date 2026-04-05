/**
 * Partner Quality Scoring Engine
 *
 * Calculates a 0-100 quality score for each partner based on:
 *   - Lead volume (20%)
 *   - Conversion rate (25%)
 *   - Disbursement value (20%)
 *   - Document quality / form completion (15%)
 *   - Activity frequency (10%)
 *   - Compliance / fraud-free record (10%)
 *
 * Grade tiers:
 *   Platinum: 90-100
 *   Gold:     70-89
 *   Silver:   50-69
 *   Bronze:   0-49
 */

export interface PartnerMetrics {
  totalLeads: number
  leadsSanctioned: number
  leadsDisbursed: number
  leadsDropped: number
  leadsRejected: number
  totalDisbursedValue: number
  avgFormCompletion: number       // 0-100
  loginDaysLast30: number
  daysSinceLastLogin: number | null
  fraudFlags: number
  rejectedForCompliance: number
  daysActive: number              // days since joining
}

export interface PartnerScore {
  total: number                   // 0-100
  grade: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE'
  gradeLabel: string
  gradeColor: string
  gradeBgColor: string
  breakdown: {
    leadVolume: number
    conversionRate: number
    disbursementValue: number
    documentQuality: number
    activityFrequency: number
    compliance: number
  }
  insights: string[]
}

// Weight configuration
const WEIGHTS = {
  leadVolume: 0.20,
  conversionRate: 0.25,
  disbursementValue: 0.20,
  documentQuality: 0.15,
  activityFrequency: 0.10,
  compliance: 0.10,
} as const

// Benchmark values (can be made configurable per company)
const BENCHMARKS = {
  excellentLeadsPerMonth: 15,
  goodLeadsPerMonth: 8,
  excellentConversionRate: 40,
  goodConversionRate: 20,
  excellentDisbursedValue: 5000000,   // 50L per month
  goodDisbursedValue: 1000000,        // 10L per month
  excellentFormCompletion: 90,
  goodFormCompletion: 70,
  excellentLoginDays: 25,
  goodLoginDays: 15,
} as const

function scoreLeadVolume(metrics: PartnerMetrics): number {
  if (metrics.daysActive <= 0) return 0
  const monthsActive = Math.max(1, metrics.daysActive / 30)
  const leadsPerMonth = metrics.totalLeads / monthsActive

  if (leadsPerMonth >= BENCHMARKS.excellentLeadsPerMonth) return 100
  if (leadsPerMonth >= BENCHMARKS.goodLeadsPerMonth) return 70
  if (leadsPerMonth >= 3) return 50
  if (leadsPerMonth >= 1) return 30
  return 10
}

function scoreConversionRate(metrics: PartnerMetrics): number {
  if (metrics.totalLeads === 0) return 0
  const rate = (metrics.leadsSanctioned / metrics.totalLeads) * 100

  if (rate >= BENCHMARKS.excellentConversionRate) return 100
  if (rate >= BENCHMARKS.goodConversionRate) return 70
  if (rate >= 10) return 50
  if (rate >= 5) return 30
  return 15
}

function scoreDisbursementValue(metrics: PartnerMetrics): number {
  if (metrics.daysActive <= 0) return 0
  const monthsActive = Math.max(1, metrics.daysActive / 30)
  const valuePerMonth = metrics.totalDisbursedValue / monthsActive

  if (valuePerMonth >= BENCHMARKS.excellentDisbursedValue) return 100
  if (valuePerMonth >= BENCHMARKS.goodDisbursedValue) return 70
  if (valuePerMonth >= 200000) return 50
  if (valuePerMonth > 0) return 30
  return 0
}

function scoreDocumentQuality(metrics: PartnerMetrics): number {
  if (metrics.avgFormCompletion >= BENCHMARKS.excellentFormCompletion) return 100
  if (metrics.avgFormCompletion >= BENCHMARKS.goodFormCompletion) return 70
  if (metrics.avgFormCompletion >= 50) return 50
  if (metrics.avgFormCompletion > 0) return 30
  return 0
}

function scoreActivityFrequency(metrics: PartnerMetrics): number {
  if (metrics.loginDaysLast30 >= BENCHMARKS.excellentLoginDays) return 100
  if (metrics.loginDaysLast30 >= BENCHMARKS.goodLoginDays) return 70
  if (metrics.loginDaysLast30 >= 8) return 50
  if (metrics.loginDaysLast30 >= 3) return 30
  if (metrics.loginDaysLast30 >= 1) return 15
  return 0
}

function scoreCompliance(metrics: PartnerMetrics): number {
  if (metrics.fraudFlags > 0) return 0
  if (metrics.rejectedForCompliance > 2) return 30
  if (metrics.rejectedForCompliance > 0) return 60
  return 100
}

function getGrade(score: number): { grade: PartnerScore['grade']; label: string; color: string; bgColor: string } {
  if (score >= 90) return { grade: 'PLATINUM', label: 'Platinum', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/30' }
  if (score >= 70) return { grade: 'GOLD', label: 'Gold', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/30' }
  if (score >= 50) return { grade: 'SILVER', label: 'Silver', color: 'text-gray-300', bgColor: 'bg-gray-500/10 border-gray-500/30' }
  return { grade: 'BRONZE', label: 'Bronze', color: 'text-orange-700', bgColor: 'bg-orange-900/10 border-orange-700/30' }
}

function generateInsights(metrics: PartnerMetrics, breakdown: PartnerScore['breakdown']): string[] {
  const insights: string[] = []

  if (breakdown.leadVolume < 30) {
    insights.push('Lead volume is very low. Consider providing lead generation training.')
  }
  if (breakdown.conversionRate >= 70) {
    insights.push('Excellent conversion rate! This partner delivers quality leads.')
  } else if (breakdown.conversionRate < 30 && metrics.totalLeads > 5) {
    insights.push('Low conversion rate. Review lead quality and provide guidance on customer qualification.')
  }
  if (breakdown.activityFrequency < 30 && metrics.daysActive > 30) {
    insights.push('Partner is becoming inactive. Schedule a check-in call to re-engage.')
  }
  if (breakdown.compliance === 0) {
    insights.push('ALERT: Fraud flags detected. Immediate review required.')
  }
  if (metrics.daysSinceLastLogin !== null && metrics.daysSinceLastLogin > 14) {
    insights.push(`Partner hasn't logged in for ${metrics.daysSinceLastLogin} days. At risk of churning.`)
  }
  if (breakdown.documentQuality < 50 && metrics.totalLeads > 3) {
    insights.push('Document quality is poor. Send documentation checklist and training materials.')
  }

  return insights
}

/**
 * Calculate partner quality score from raw metrics.
 */
export function calculatePartnerScore(metrics: PartnerMetrics): PartnerScore {
  const breakdown = {
    leadVolume: scoreLeadVolume(metrics),
    conversionRate: scoreConversionRate(metrics),
    disbursementValue: scoreDisbursementValue(metrics),
    documentQuality: scoreDocumentQuality(metrics),
    activityFrequency: scoreActivityFrequency(metrics),
    compliance: scoreCompliance(metrics),
  }

  const total = Math.round(
    breakdown.leadVolume * WEIGHTS.leadVolume +
    breakdown.conversionRate * WEIGHTS.conversionRate +
    breakdown.disbursementValue * WEIGHTS.disbursementValue +
    breakdown.documentQuality * WEIGHTS.documentQuality +
    breakdown.activityFrequency * WEIGHTS.activityFrequency +
    breakdown.compliance * WEIGHTS.compliance
  )

  const gradeInfo = getGrade(total)
  const insights = generateInsights(metrics, breakdown)

  return {
    total,
    grade: gradeInfo.grade,
    gradeLabel: gradeInfo.label,
    gradeColor: gradeInfo.color,
    gradeBgColor: gradeInfo.bgColor,
    breakdown,
    insights,
  }
}

/**
 * Determine churn risk level from partner activity data.
 */
export type ChurnRisk = 'GREEN' | 'YELLOW' | 'RED' | 'BLACK'

export interface ChurnAnalysis {
  risk: ChurnRisk
  label: string
  color: string
  bgColor: string
  reason: string
  action: string
}

export function analyzeChurnRisk(
  daysSinceLastLogin: number | null,
  leadsLast30Days: number,
  loginDaysLast30: number,
  isActive: boolean
): ChurnAnalysis {
  if (!isActive) {
    return {
      risk: 'BLACK',
      label: 'Churned',
      color: 'text-gray-400',
      bgColor: 'bg-gray-800 border-gray-600',
      reason: 'Partner account is inactive',
      action: 'Consider reactivation campaign or reassignment',
    }
  }

  if (daysSinceLastLogin !== null && daysSinceLastLogin > 30) {
    return {
      risk: 'RED',
      label: 'Churning',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/30',
      reason: `No login in ${daysSinceLastLogin} days`,
      action: 'Urgent: Schedule a call immediately. Send re-engagement offer.',
    }
  }

  if (daysSinceLastLogin !== null && daysSinceLastLogin > 14) {
    return {
      risk: 'YELLOW',
      label: 'At Risk',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10 border-yellow-500/30',
      reason: `No login in ${daysSinceLastLogin} days, ${leadsLast30Days} leads in 30 days`,
      action: 'Send a WhatsApp check-in. Share new product updates or incentive details.',
    }
  }

  if (loginDaysLast30 < 5 && leadsLast30Days === 0) {
    return {
      risk: 'YELLOW',
      label: 'At Risk',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10 border-yellow-500/30',
      reason: 'Low activity: few logins, no recent leads',
      action: 'Schedule training session. Review if partner needs product guidance.',
    }
  }

  return {
    risk: 'GREEN',
    label: 'Active',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/30',
    reason: 'Partner is actively engaged',
    action: 'Maintain relationship. Share new opportunities.',
  }
}

/**
 * Determine partner onboarding stage.
 */
export type OnboardingStage =
  | 'INVITED'
  | 'REGISTERED'
  | 'KYC_PENDING'
  | 'KYC_VERIFIED'
  | 'TRAINING_ASSIGNED'
  | 'TRAINING_COMPLETED'
  | 'AGREEMENT_SIGNED'
  | 'ACTIVATED'
  | 'FIRST_LEAD'

export interface OnboardingStatus {
  stage: OnboardingStage
  label: string
  progress: number  // 0-100
  nextStep: string
  color: string
}

const ONBOARDING_STAGES: Record<OnboardingStage, OnboardingStatus> = {
  INVITED: { stage: 'INVITED', label: 'Invited', progress: 10, nextStep: 'Waiting for registration', color: 'text-blue-400' },
  REGISTERED: { stage: 'REGISTERED', label: 'Registered', progress: 25, nextStep: 'Submit KYC documents', color: 'text-cyan-400' },
  KYC_PENDING: { stage: 'KYC_PENDING', label: 'KYC Pending', progress: 35, nextStep: 'KYC verification in progress', color: 'text-yellow-400' },
  KYC_VERIFIED: { stage: 'KYC_VERIFIED', label: 'KYC Verified', progress: 50, nextStep: 'Complete assigned training', color: 'text-purple-400' },
  TRAINING_ASSIGNED: { stage: 'TRAINING_ASSIGNED', label: 'Training Assigned', progress: 55, nextStep: 'Complete training modules', color: 'text-purple-400' },
  TRAINING_COMPLETED: { stage: 'TRAINING_COMPLETED', label: 'Training Done', progress: 70, nextStep: 'Sign partner agreement', color: 'text-indigo-400' },
  AGREEMENT_SIGNED: { stage: 'AGREEMENT_SIGNED', label: 'Agreement Signed', progress: 85, nextStep: 'Account activation pending', color: 'text-orange-400' },
  ACTIVATED: { stage: 'ACTIVATED', label: 'Activated', progress: 95, nextStep: 'Submit first lead', color: 'text-green-400' },
  FIRST_LEAD: { stage: 'FIRST_LEAD', label: 'Producing', progress: 100, nextStep: 'Fully operational', color: 'text-emerald-400' },
}

export function getOnboardingStatus(stage: OnboardingStage): OnboardingStatus {
  return ONBOARDING_STAGES[stage] || ONBOARDING_STAGES.INVITED
}

export function getAllOnboardingStages(): OnboardingStatus[] {
  return Object.values(ONBOARDING_STAGES)
}
