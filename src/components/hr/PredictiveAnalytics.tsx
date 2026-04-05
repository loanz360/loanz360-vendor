'use client'

import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Users, Target, BarChart3 } from 'lucide-react'

interface EmployeeRiskData {
  id: string
  name: string
  department: string
  tenure_months: number
  last_review_score: number // 1-5
  leaves_taken_ratio: number // 0-1 (leaves taken / allocated)
  salary_hike_months_ago: number
  has_pending_grievance: boolean
  manager_change_recent: boolean
  late_attendance_count: number // last 30 days
}

interface RiskResult {
  employee: EmployeeRiskData
  riskScore: number // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: string[]
}

function calculateAttritionRisk(employee: EmployeeRiskData): RiskResult {
  let score = 0
  const factors: string[] = []

  // Tenure risk (new employees <6 months and 1-2 year employees have higher risk)
  if (employee.tenure_months < 6) { score += 15; factors.push('New employee (< 6 months)') }
  else if (employee.tenure_months >= 12 && employee.tenure_months <= 24) { score += 10; factors.push('1-2 year tenure (common exit window)') }
  else if (employee.tenure_months > 60) { score -= 5 } // Long tenure reduces risk

  // Review score (low scores correlate with exits)
  if (employee.last_review_score <= 2) { score += 20; factors.push('Low performance review score') }
  else if (employee.last_review_score <= 3) { score += 10; factors.push('Average review score') }
  else if (employee.last_review_score >= 4.5) { score += 5; factors.push('High performer (poaching risk)') }

  // Leave pattern (high leave usage can indicate disengagement)
  if (employee.leaves_taken_ratio > 0.9) { score += 15; factors.push('High leave utilization (>90%)') }
  else if (employee.leaves_taken_ratio > 0.7) { score += 8; factors.push('Above-average leave usage') }

  // Salary stagnation
  if (employee.salary_hike_months_ago > 18) { score += 20; factors.push('No salary revision in 18+ months') }
  else if (employee.salary_hike_months_ago > 12) { score += 10; factors.push('No salary revision in 12+ months') }

  // Grievances
  if (employee.has_pending_grievance) { score += 15; factors.push('Pending grievance/complaint') }

  // Manager change
  if (employee.manager_change_recent) { score += 10; factors.push('Recent manager change') }

  // Attendance pattern
  if (employee.late_attendance_count > 5) { score += 10; factors.push('Frequent late arrivals') }
  else if (employee.late_attendance_count > 3) { score += 5; factors.push('Occasional late arrivals') }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  const riskLevel = score >= 70 ? 'critical' : score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low'

  return { employee, riskScore: score, riskLevel, factors }
}

const riskColors = {
  low: { text: 'text-emerald-400', bg: 'bg-emerald-500/20', bar: 'bg-emerald-500' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-500/20', bar: 'bg-amber-500' },
  high: { text: 'text-orange-400', bg: 'bg-orange-500/20', bar: 'bg-orange-500' },
  critical: { text: 'text-red-400', bg: 'bg-red-500/20', bar: 'bg-red-500' },
}

interface HeadcountForecast {
  month: string
  projected: number
  hires: number
  exits: number
}

function forecastHeadcount(
  currentHeadcount: number,
  avgMonthlyHires: number,
  avgMonthlyExits: number,
  months: number = 6
): HeadcountForecast[] {
  const forecasts: HeadcountForecast[] = []
  let headcount = currentHeadcount
  const now = new Date()

  for (let i = 1; i <= months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const monthLabel = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    // Add slight variance for realism
    const hiresVariance = Math.round(avgMonthlyHires * (0.8 + Math.random() * 0.4))
    const exitsVariance = Math.round(avgMonthlyExits * (0.8 + Math.random() * 0.4))
    headcount = headcount + hiresVariance - exitsVariance
    forecasts.push({ month: monthLabel, projected: headcount, hires: hiresVariance, exits: exitsVariance })
  }
  return forecasts
}

interface PredictiveAnalyticsProps {
  employees: EmployeeRiskData[]
  currentHeadcount: number
  avgMonthlyHires: number
  avgMonthlyExits: number
}

export default function PredictiveAnalytics({ employees, currentHeadcount, avgMonthlyHires, avgMonthlyExits }: PredictiveAnalyticsProps) {
  const riskResults = useMemo(() =>
    employees.map(calculateAttritionRisk).sort((a, b) => b.riskScore - a.riskScore),
    [employees]
  )

  const forecast = useMemo(() =>
    forecastHeadcount(currentHeadcount, avgMonthlyHires, avgMonthlyExits),
    [currentHeadcount, avgMonthlyHires, avgMonthlyExits]
  )

  const riskSummary = useMemo(() => ({
    critical: riskResults.filter(r => r.riskLevel === 'critical').length,
    high: riskResults.filter(r => r.riskLevel === 'high').length,
    medium: riskResults.filter(r => r.riskLevel === 'medium').length,
    low: riskResults.filter(r => r.riskLevel === 'low').length,
  }), [riskResults])

  const maxForecast = Math.max(...forecast.map(f => f.projected))

  return (
    <div className="space-y-6">
      {/* Risk Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as const).map(level => (
          <div key={level} className={`${riskColors[level].bg} rounded-lg p-3 border border-white/10`}>
            <p className="text-xs text-gray-400 capitalize">{level} Risk</p>
            <p className={`text-2xl font-bold ${riskColors[level].text}`}>{riskSummary[level]}</p>
            <p className="text-[10px] text-gray-500">{employees.length > 0 ? ((riskSummary[level] / employees.length) * 100).toFixed(0) : 0}% of workforce</p>
          </div>
        ))}
      </div>

      {/* Top At-Risk Employees */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-[#FF6700]" />
          <h4 className="text-sm font-medium text-white">Top At-Risk Employees</h4>
        </div>
        <div className="space-y-2">
          {riskResults.slice(0, 5).map(result => {
            const colors = riskColors[result.riskLevel]
            return (
              <div key={result.employee.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.bg}`}>
                  <Users className={`w-4 h-4 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{result.employee.name}</span>
                    <span className="text-[10px] text-gray-500">{result.employee.department}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${result.riskScore}%` }} />
                    </div>
                    <span className={`text-xs font-medium ${colors.text}`}>{result.riskScore}%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{result.factors.slice(0, 2).join(' · ')}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Headcount Forecast */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[#FF6700]" />
          <h4 className="text-sm font-medium text-white">6-Month Headcount Forecast</h4>
        </div>
        <div className="flex items-end gap-2 h-32 mb-2">
          {forecast.map(f => (
            <div key={f.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400">{f.projected}</span>
              <div className="w-full bg-white/5 rounded-t relative" style={{ height: `${maxForecast > 0 ? (f.projected / maxForecast) * 100 : 0}%` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-[#FF6700]/40 to-[#FF6700]/10 rounded-t" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {forecast.map(f => (
            <div key={f.month} className="flex-1 text-center">
              <span className="text-[9px] text-gray-500">{f.month}</span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-[9px] text-emerald-400">{f.hires}</span>
                <TrendingDown className="w-2.5 h-2.5 text-red-400" />
                <span className="text-[9px] text-red-400">{f.exits}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { calculateAttritionRisk, forecastHeadcount }
export type { EmployeeRiskData, RiskResult, HeadcountForecast }
