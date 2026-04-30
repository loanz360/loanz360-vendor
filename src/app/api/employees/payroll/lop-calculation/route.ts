
/**
 * Attendance ↔ Payroll LOP (Loss of Pay) Integration API
 * Calculates LOP deductions based on attendance records for payroll processing
 *
 * Business Logic:
 * - Absent days WITHOUT approved leave = LOP
 * - Late arrivals: Configurable penalty (e.g., 3 lates = 0.5 day LOP)
 * - Half-days count as 0.5 day present
 * - Weekends and holidays are excluded from calculation
 * - Overtime hours tracked for potential OT pay
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface LOPCalculation {
  month: number
  year: number
  totalWorkingDays: number
  presentDays: number
  halfDays: number
  absentDays: number
  approvedLeaveDays: number
  lopDays: number
  lopAmount: number
  lateCount: number
  latePenaltyDays: number
  overtimeHours: number
  overtimeAmount: number
  effectivePresentDays: number
  breakdown: {
    date: string
    status: string
    isLOP: boolean
    hours: number | null
    isLate: boolean
  }[]
}

// GET - Calculate LOP for a specific month/year
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || '') // 0-indexed
    const year = parseInt(searchParams.get('year') || '')

    if (isNaN(month) || isNaN(year) || month < 0 || month > 11) {
      return NextResponse.json(
        { success: false, error: 'Valid month (0-11) and year required' },
        { status: 400 }
      )
    }

    // Get date range for the month
    const startDate = new Date(year, month, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

    // Fetch attendance records for the month
    const { data: attendanceRecords, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')

    if (attError) throw attError

    // Fetch approved leaves for the month
    const { data: approvedLeaves, error: leaveError } = await supabase
      .from('leave_requests')
      .select('from_date, to_date, total_days, status')
      .eq('user_id', user.id)
      .in('status', ['approved', 'auto_approved'])
      .lte('from_date', endDate)
      .gte('to_date', startDate)

    if (leaveError) throw leaveError

    // Fetch holidays for the month
    const { data: holidays } = await supabase
      .from('holidays')
      .select('date, is_mandatory')
      .gte('date', startDate)
      .lte('date', endDate)

    const holidayDates = new Set((holidays || []).filter(h => h.is_mandatory).map(h => h.date))

    // Build set of approved leave dates
    const approvedLeaveDates = new Set<string>()
    for (const leave of (approvedLeaves || [])) {
      const from = new Date(leave.from_date)
      const to = new Date(leave.to_date)
      const current = new Date(from)
      while (current <= to) {
        approvedLeaveDates.add(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }
    }

    // Build attendance map
    const attendanceMap = new Map<string, typeof attendanceRecords[0]>()
    for (const record of (attendanceRecords || [])) {
      attendanceMap.set(record.date, record)
    }

    // Fetch employee salary for LOP amount calculation
    const { data: salaryData } = await supabase
      .from('employee_salary')
      .select('gross_salary')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    const monthlySalary = salaryData?.gross_salary || 0

    // Fetch late penalty config
    const { data: companyConfig } = await supabase
      .from('company_settings')
      .select('late_penalty_threshold, late_penalty_deduction_days, overtime_hourly_rate_multiplier')
      .limit(1)
      .maybeSingle()

    const latePenaltyThreshold = companyConfig?.late_penalty_threshold || 3 // 3 lates = penalty
    const latePenaltyDeductionDays = companyConfig?.late_penalty_deduction_days || 0.5 // Half day deduction per threshold
    const overtimeMultiplier = companyConfig?.overtime_hourly_rate_multiplier || 2.0 // 2x OT rate
    const standardHoursPerDay = 9

    // Calculate working days, LOP, overtime
    let totalWorkingDays = 0
    let presentDays = 0
    let halfDays = 0
    let absentDays = 0
    let approvedLeaveDayCount = 0
    let lopDays = 0
    let lateCount = 0
    let totalOvertimeHours = 0
    const breakdown: LOPCalculation['breakdown'] = []

    const current = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)

    while (current <= monthEnd) {
      const dateStr = current.toISOString().split('T')[0]
      const dayOfWeek = current.getDay()

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        current.setDate(current.getDate() + 1)
        continue
      }

      // Skip mandatory holidays
      if (holidayDates.has(dateStr)) {
        current.setDate(current.getDate() + 1)
        continue
      }

      totalWorkingDays++

      const record = attendanceMap.get(dateStr)
      const isApprovedLeave = approvedLeaveDates.has(dateStr)

      if (isApprovedLeave) {
        approvedLeaveDayCount++
        breakdown.push({ date: dateStr, status: 'leave', isLOP: false, hours: null, isLate: false })
      } else if (record) {
        const hours = record.total_hours ? parseFloat(String(record.total_hours)) : null

        if (record.status === 'present') {
          presentDays++
          if (record.is_late) lateCount++
          // Track overtime (hours > standard)
          if (hours && hours > standardHoursPerDay) {
            totalOvertimeHours += hours - standardHoursPerDay
          }
          breakdown.push({ date: dateStr, status: 'present', isLOP: false, hours, isLate: record.is_late || false })
        } else if (record.status === 'half-day') {
          halfDays++
          presentDays += 0.5
          lopDays += 0.5 // Half-day without leave = 0.5 LOP
          breakdown.push({ date: dateStr, status: 'half-day', isLOP: true, hours, isLate: record.is_late || false })
        } else {
          // Absent without approved leave = LOP
          absentDays++
          lopDays++
          breakdown.push({ date: dateStr, status: 'absent', isLOP: true, hours: null, isLate: false })
        }
      } else {
        // No attendance record and no approved leave = absent (LOP)
        // Only count as LOP if the date is in the past
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (current < today) {
          absentDays++
          lopDays++
          breakdown.push({ date: dateStr, status: 'absent', isLOP: true, hours: null, isLate: false })
        }
      }

      current.setDate(current.getDate() + 1)
    }

    // Calculate late penalty
    const latePenaltyDays = latePenaltyThreshold > 0
      ? Math.floor(lateCount / latePenaltyThreshold) * latePenaltyDeductionDays
      : 0

    // Total LOP includes late penalties
    const totalLopDays = lopDays + latePenaltyDays

    // Calculate LOP amount (per-day salary × LOP days)
    const perDaySalary = totalWorkingDays > 0 ? monthlySalary / totalWorkingDays : 0
    const lopAmount = Math.round(perDaySalary * totalLopDays * 100) / 100

    // Calculate overtime amount
    const hourlyRate = totalWorkingDays > 0 ? monthlySalary / (totalWorkingDays * standardHoursPerDay) : 0
    const overtimeAmount = Math.round(totalOvertimeHours * hourlyRate * overtimeMultiplier * 100) / 100

    const effectivePresentDays = presentDays + approvedLeaveDayCount

    const result: LOPCalculation = {
      month,
      year,
      totalWorkingDays,
      presentDays,
      halfDays,
      absentDays,
      approvedLeaveDays: approvedLeaveDayCount,
      lopDays: totalLopDays,
      lopAmount,
      lateCount,
      latePenaltyDays,
      overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
      overtimeAmount,
      effectivePresentDays,
      breakdown,
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    apiLogger.error('LOP calculation error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to calculate LOP' },
      { status: 500 }
    )
  }
}
