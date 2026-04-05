/**
 * Attendance & Leave Enhancement Utilities
 *
 * Indian Labour Compliance, Comp-off Management, Analytics Helpers,
 * and Leave Proration for the LOANZ 360 HRIS platform.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface StateWorkingHoursLimit {
  state: string
  maxHoursPerDay: number
  maxHoursPerWeek: number
  spreadOverHours: number // max spread-over including breaks
  act: string
}

export interface OvertimeResult {
  regularHours: number
  overtimeHours: number
  overtimeRate: number // multiplier (2x per Factories Act)
  effectiveOvertimeHours: number // overtimeHours * overtimeRate
  weeklyLimitExceeded: boolean
}

export interface SandwichLeaveResult {
  totalDays: number
  workingDays: number
  sandwichDays: number // holidays/weekends sandwiched between leave days
  effectiveLeaveDays: number // total days counted as leave under sandwich rule
  sandwichedDates: string[]
}

export interface CompOffCredit {
  userId: string
  workDate: string
  hoursWorked: number
  creditType: 'full_day' | 'half_day'
  expiresAt: string // comp-offs typically expire in 30-90 days
  status: 'available'
  reason: string
}

export interface AttendanceRecord {
  isLate: boolean
  lateByMinutes: number
}

export interface AttendanceStatusRecord {
  date: string
  status: string
}

export interface AttendanceCheckInRecord {
  date: string
  status: string
  checkIn: string | null
}

export interface AttendanceHoursRecord {
  totalHours: number | null
}

export interface PunctualityScore {
  score: number // 0-100
  totalRecords: number
  lateCount: number
  onTimeCount: number
  averageLateMinutes: number
  grade: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'Poor'
}

export interface WeeklyTrend {
  weekStart: string
  weekEnd: string
  presentDays: number
  absentDays: number
  lateDays: number
  leaveDays: number
  halfDays: number
}

export interface AttendanceTrend {
  weeklyTrends: WeeklyTrend[]
  monthlyPresent: number
  monthlyAbsent: number
  monthlyLeave: number
  monthlyLate: number
  attendanceRate: number
}

export interface AttendanceAnomaly {
  type: 'recurring_late_day' | 'frequent_monday_absence' | 'pattern_absence' | 'early_departure_pattern' | 'irregular_hours'
  description: string
  severity: 'low' | 'medium' | 'high'
  affectedDates: string[]
  dayOfWeek?: string
  frequency: number
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Indian Labour Compliance Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * State-wise working hours limits per Shops & Establishments Act / Factories Act.
 * Reference: respective state S&E Acts and the Factories Act 1948.
 */
const STATE_WORKING_HOURS: Record<string, Omit<StateWorkingHoursLimit, 'state'>> = {
  // South India
  'karnataka': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Karnataka Shops & Commercial Establishments Act, 1961' },
  'tamil_nadu': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 12, act: 'Tamil Nadu Shops & Establishments Act, 1947' },
  'kerala': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 12, act: 'Kerala Shops & Commercial Establishments Act, 1960' },
  'andhra_pradesh': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 12, act: 'AP Shops & Establishments Act, 1988' },
  'telangana': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 12, act: 'Telangana Shops & Establishments Act, 1988' },

  // West India
  'maharashtra': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Maharashtra Shops & Establishments Act, 2017' },
  'gujarat': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Gujarat Shops & Establishments Act, 2019' },
  'goa': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Goa Shops & Establishments Act, 1973' },
  'rajasthan': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Rajasthan Shops & Commercial Establishments Act, 1958' },

  // North India
  'delhi': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 11, act: 'Delhi Shops & Establishments Act, 1954' },
  'uttar_pradesh': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'UP Shops & Commercial Establishments Act, 1962' },
  'haryana': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Haryana Shops & Commercial Establishments Act, 1958' },
  'punjab': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 11, act: 'Punjab Shops & Commercial Establishments Act, 1958' },
  'madhya_pradesh': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'MP Shops & Establishments Act, 1958' },
  'himachal_pradesh': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'HP Shops & Commercial Establishments Act, 1969' },
  'uttarakhand': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Uttarakhand Shops & Commercial Establishments Act, 1962' },

  // East India
  'west_bengal': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 12, act: 'West Bengal Shops & Establishments Act, 1963' },
  'odisha': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Odisha Shops & Commercial Establishments Act, 1956' },
  'bihar': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Bihar Shops & Establishments Act, 1953' },
  'jharkhand': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Jharkhand Shops & Establishments Act, 1953' },
  'assam': { maxHoursPerDay: 8, maxHoursPerWeek: 48, spreadOverHours: 12, act: 'Assam Shops & Establishments Act, 1971' },
  'chhattisgarh': { maxHoursPerDay: 9, maxHoursPerWeek: 48, spreadOverHours: 10.5, act: 'Chhattisgarh Shops & Establishments Act, 1958' },
}

// Default fallback (Factories Act 1948 baseline)
const DEFAULT_WORKING_HOURS: Omit<StateWorkingHoursLimit, 'state'> = {
  maxHoursPerDay: 9,
  maxHoursPerWeek: 48,
  spreadOverHours: 10.5,
  act: 'Factories Act, 1948 (default)'
}

/**
 * Returns max working hours per day/week based on Shops & Establishments Act for the given state.
 * Falls back to Factories Act 1948 defaults if state is not found.
 */
export function getStateWiseWorkingHoursLimit(state: string): StateWorkingHoursLimit {
  const normalized = state.toLowerCase().trim().replace(/\s+/g, '_')
  const limits = STATE_WORKING_HOURS[normalized] ?? DEFAULT_WORKING_HOURS
  return { state: normalized, ...limits }
}

/**
 * Calculates overtime hours and pay multiplier per Factories Act 1948, Section 59.
 * Overtime is paid at 2x the ordinary rate of wages.
 *
 * @param totalHours - Total hours worked in the day
 * @param state - Indian state for working hours threshold
 * @param weeklyHours - Optional: total hours worked in the week (for weekly limit check)
 */
export function calculateOvertime(
  totalHours: number,
  state: string,
  weeklyHours?: number
): OvertimeResult {
  const limits = getStateWiseWorkingHoursLimit(state)
  const dailyThreshold = limits.maxHoursPerDay
  const overtimeRate = 2 // Factories Act mandates 2x rate

  const overtimeHours = Math.max(0, totalHours - dailyThreshold)
  const regularHours = Math.min(totalHours, dailyThreshold)
  const weeklyLimitExceeded = weeklyHours !== undefined && weeklyHours > limits.maxHoursPerWeek

  return {
    regularHours,
    overtimeHours,
    overtimeRate,
    effectiveOvertimeHours: overtimeHours * overtimeRate,
    weeklyLimitExceeded
  }
}

/**
 * Calculates sandwich rule leave days.
 *
 * The "sandwich rule" means that if an employee takes leave on Friday and Monday,
 * the intervening Saturday and Sunday are also counted as leave days.
 * Similarly, holidays falling between two leave days are counted as leave.
 *
 * @param fromDate - Leave start date (YYYY-MM-DD)
 * @param toDate - Leave end date (YYYY-MM-DD)
 * @param holidays - Array of holiday dates (YYYY-MM-DD)
 */
export function getSandwichLeaveDays(
  fromDate: string,
  toDate: string,
  holidays: string[]
): SandwichLeaveResult {
  const start = new Date(fromDate + 'T00:00:00Z')
  const end = new Date(toDate + 'T00:00:00Z')

  if (end < start) {
    return { totalDays: 0, workingDays: 0, sandwichDays: 0, effectiveLeaveDays: 0, sandwichedDates: [] }
  }

  const holidaySet = new Set(holidays)
  const sandwichedDates: string[] = []
  let totalDays = 0
  let workingDays = 0
  let sandwichDays = 0

  const current = new Date(start)

  while (current <= end) {
    totalDays++
    const dateStr = current.toISOString().split('T')[0]
    const dayOfWeek = current.getUTCDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isHoliday = holidaySet.has(dateStr)

    if (isWeekend || isHoliday) {
      // Check if this non-working day is sandwiched between leave days
      // (i.e., there are actual leave/working days both before and after)
      const isFirstDay = dateStr === fromDate
      const isLastDay = dateStr === toDate

      if (!isFirstDay && !isLastDay) {
        // Sandwiched: non-working day between two leave days
        sandwichDays++
        sandwichedDates.push(dateStr)
      } else if (isFirstDay || isLastDay) {
        // Weekend/holiday that is the actual leave start/end day
        workingDays++ // Still counts as a leave day taken
      }
    } else {
      workingDays++
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  // Effective leave days = working days taken off + sandwiched non-working days
  const effectiveLeaveDays = workingDays + sandwichDays

  return {
    totalDays,
    workingDays,
    sandwichDays,
    effectiveLeaveDays,
    sandwichedDates
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Comp-off Management Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Default comp-off expiry period in days */
const COMP_OFF_EXPIRY_DAYS = 60

/**
 * Generates a comp-off credit data object for an employee who worked on a
 * holiday or weekend. The credit type depends on hours worked:
 * - >= 4 hours and < 8 hours: half_day comp-off
 * - >= 8 hours: full_day comp-off
 *
 * @param userId - Employee user ID
 * @param workDate - Date the employee worked (YYYY-MM-DD)
 * @param hoursWorked - Total hours worked on that day
 * @param expiryDays - Number of days until the comp-off expires (default: 60)
 */
export function generateCompOffCredit(
  userId: string,
  workDate: string,
  hoursWorked: number,
  expiryDays: number = COMP_OFF_EXPIRY_DAYS
): CompOffCredit | null {
  if (hoursWorked < 4) {
    // Minimum 4 hours to qualify for any comp-off
    return null
  }

  const creditType: 'full_day' | 'half_day' = hoursWorked >= 8 ? 'full_day' : 'half_day'

  const expiresAt = new Date(workDate + 'T00:00:00Z')
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiryDays)

  return {
    userId,
    workDate,
    hoursWorked,
    creditType,
    expiresAt: expiresAt.toISOString().split('T')[0],
    status: 'available',
    reason: `Worked ${hoursWorked.toFixed(1)} hours on ${workDate} (${creditType === 'full_day' ? 'Full Day' : 'Half Day'} comp-off)`
  }
}

/**
 * Checks if a given work day qualifies for comp-off credit.
 * Eligible days: weekends (Saturday/Sunday) or public holidays.
 *
 * @param dayOfWeek - 0 = Sunday, 6 = Saturday
 * @param isHoliday - Whether the day is a declared public holiday
 */
export function isCompOffEligible(dayOfWeek: number, isHoliday: boolean): boolean {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  return isWeekend || isHoliday
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Attendance Analytics Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Calculates a punctuality score (0-100) based on attendance records.
 *
 * Scoring:
 * - Base: each on-time arrival = full points, late arrival = reduced points
 * - Late penalty scaled by severity: 1-15 min = mild, 16-30 = moderate, 30+ = severe
 */
export function calculatePunctualityScore(
  records: AttendanceRecord[]
): PunctualityScore {
  if (records.length === 0) {
    return {
      score: 100,
      totalRecords: 0,
      lateCount: 0,
      onTimeCount: 0,
      averageLateMinutes: 0,
      grade: 'Excellent'
    }
  }

  let totalScore = 0
  let lateCount = 0
  let totalLateMinutes = 0

  for (const record of records) {
    if (!record.isLate) {
      totalScore += 100
    } else {
      lateCount++
      totalLateMinutes += record.lateByMinutes

      // Graduated penalty based on lateness severity
      if (record.lateByMinutes <= 15) {
        totalScore += 70 // Mild: 30% penalty
      } else if (record.lateByMinutes <= 30) {
        totalScore += 50 // Moderate: 50% penalty
      } else if (record.lateByMinutes <= 60) {
        totalScore += 25 // Significant: 75% penalty
      } else {
        totalScore += 0 // Severe: 100% penalty (> 1 hour late)
      }
    }
  }

  const score = Math.round(totalScore / records.length)
  const onTimeCount = records.length - lateCount
  const averageLateMinutes = lateCount > 0 ? Math.round(totalLateMinutes / lateCount) : 0

  let grade: PunctualityScore['grade']
  if (score >= 90) grade = 'Excellent'
  else if (score >= 75) grade = 'Good'
  else if (score >= 60) grade = 'Average'
  else if (score >= 40) grade = 'Needs Improvement'
  else grade = 'Poor'

  return {
    score,
    totalRecords: records.length,
    lateCount,
    onTimeCount,
    averageLateMinutes,
    grade
  }
}

/**
 * Calculates weekly and monthly attendance trends from a set of records.
 *
 * @param records - Array of attendance records with date and status
 */
export function calculateAttendanceTrend(
  records: AttendanceStatusRecord[]
): AttendanceTrend {
  if (records.length === 0) {
    return {
      weeklyTrends: [],
      monthlyPresent: 0,
      monthlyAbsent: 0,
      monthlyLeave: 0,
      monthlyLate: 0,
      attendanceRate: 0
    }
  }

  // Sort records by date
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))

  // Group by ISO week
  const weekMap = new Map<string, AttendanceStatusRecord[]>()

  for (const record of sorted) {
    const date = new Date(record.date + 'T00:00:00Z')
    const weekStart = getWeekStart(date)
    const key = weekStart.toISOString().split('T')[0]

    if (!weekMap.has(key)) {
      weekMap.set(key, [])
    }
    weekMap.get(key)!.push(record)
  }

  // Build weekly trends
  const weeklyTrends: WeeklyTrend[] = []

  for (const [weekStartStr, weekRecords] of weekMap) {
    const weekStart = new Date(weekStartStr + 'T00:00:00Z')
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

    const trend: WeeklyTrend = {
      weekStart: weekStartStr,
      weekEnd: weekEnd.toISOString().split('T')[0],
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      leaveDays: 0,
      halfDays: 0
    }

    for (const r of weekRecords) {
      const status = r.status.toLowerCase()
      if (status === 'present') trend.presentDays++
      else if (status === 'absent') trend.absentDays++
      else if (status === 'late') trend.lateDays++
      else if (status === 'leave' || status === 'on_leave') trend.leaveDays++
      else if (status === 'half_day') trend.halfDays++
    }

    weeklyTrends.push(trend)
  }

  // Monthly aggregates
  let monthlyPresent = 0
  let monthlyAbsent = 0
  let monthlyLeave = 0
  let monthlyLate = 0

  for (const r of records) {
    const status = r.status.toLowerCase()
    if (status === 'present') monthlyPresent++
    else if (status === 'absent') monthlyAbsent++
    else if (status === 'leave' || status === 'on_leave') monthlyLeave++
    else if (status === 'late') monthlyLate++
  }

  const totalWorkDays = monthlyPresent + monthlyAbsent + monthlyLate
  const attendanceRate = totalWorkDays > 0
    ? Math.round(((monthlyPresent + monthlyLate) / totalWorkDays) * 100)
    : 0

  return {
    weeklyTrends,
    monthlyPresent,
    monthlyAbsent,
    monthlyLeave,
    monthlyLate,
    attendanceRate
  }
}

/**
 * Detects attendance anomalies / patterns such as:
 * - Consistently late on a specific day of the week
 * - Frequent absences on Mondays or Fridays
 * - Patterns of consecutive absences
 */
export function detectAttendanceAnomalies(
  records: AttendanceCheckInRecord[]
): AttendanceAnomaly[] {
  if (records.length < 5) {
    // Need at least some data to detect patterns
    return []
  }

  const anomalies: AttendanceAnomaly[] = []
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Track late arrivals by day of week
  const lateByDay: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  // Track absences by day of week
  const absentByDay: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  // Track null check-ins (missing/ghost records)
  const nullCheckIns: string[] = []

  for (const record of records) {
    const date = new Date(record.date + 'T00:00:00Z')
    const dayOfWeek = date.getUTCDay()
    const status = record.status.toLowerCase()

    if (status === 'present' && record.checkIn === null) {
      nullCheckIns.push(record.date)
    }

    if (status === 'late' || (status === 'present' && record.checkIn !== null)) {
      // Check for late pattern by day
      if (status === 'late') {
        lateByDay[dayOfWeek].push(record.date)
      }
    }

    if (status === 'absent') {
      absentByDay[dayOfWeek].push(record.date)
    }
  }

  // Detect: Recurring late on a specific day (3+ occurrences)
  for (let day = 0; day < 7; day++) {
    const lateDates = lateByDay[day]
    if (lateDates.length >= 3) {
      anomalies.push({
        type: 'recurring_late_day',
        description: `Frequently late on ${dayNames[day]}s (${lateDates.length} times)`,
        severity: lateDates.length >= 5 ? 'high' : 'medium',
        affectedDates: lateDates,
        dayOfWeek: dayNames[day],
        frequency: lateDates.length
      })
    }
  }

  // Detect: Frequent Monday absences (common pattern, 2+ in a month is flagged)
  const mondayAbsences = absentByDay[1]
  if (mondayAbsences.length >= 2) {
    anomalies.push({
      type: 'frequent_monday_absence',
      description: `Frequent Monday absences (${mondayAbsences.length} times)`,
      severity: mondayAbsences.length >= 3 ? 'high' : 'medium',
      affectedDates: mondayAbsences,
      dayOfWeek: 'Monday',
      frequency: mondayAbsences.length
    })
  }

  // Detect: Frequent Friday absences
  const fridayAbsences = absentByDay[5]
  if (fridayAbsences.length >= 2) {
    anomalies.push({
      type: 'pattern_absence',
      description: `Frequent Friday absences (${fridayAbsences.length} times) - possible long weekend pattern`,
      severity: fridayAbsences.length >= 3 ? 'high' : 'medium',
      affectedDates: fridayAbsences,
      dayOfWeek: 'Friday',
      frequency: fridayAbsences.length
    })
  }

  // Detect: Records marked present but no check-in (irregular)
  if (nullCheckIns.length >= 3) {
    anomalies.push({
      type: 'irregular_hours',
      description: `${nullCheckIns.length} days marked present with no check-in recorded`,
      severity: nullCheckIns.length >= 5 ? 'high' : 'low',
      affectedDates: nullCheckIns,
      frequency: nullCheckIns.length
    })
  }

  return anomalies
}

/**
 * Calculates total overtime hours from attendance records.
 * Hours above the daily threshold (default 8 hours) are counted as overtime.
 *
 * @param records - Array of records with totalHours field
 * @param dailyThreshold - Standard working hours per day (default: 8)
 */
export function calculateOvertimeHours(
  records: AttendanceHoursRecord[],
  dailyThreshold: number = 8
): { totalOvertimeHours: number; daysWithOvertime: number; averageOvertimePerDay: number } {
  let totalOvertimeHours = 0
  let daysWithOvertime = 0

  for (const record of records) {
    if (record.totalHours !== null && record.totalHours > dailyThreshold) {
      const overtime = record.totalHours - dailyThreshold
      totalOvertimeHours += overtime
      daysWithOvertime++
    }
  }

  return {
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    daysWithOvertime,
    averageOvertimePerDay: daysWithOvertime > 0
      ? Math.round((totalOvertimeHours / daysWithOvertime) * 100) / 100
      : 0
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Leave Proration
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Calculates prorated leave allocation for mid-year joiners.
 *
 * Uses proportional calculation:
 *   prorated = totalAllocation * (remaining months / total months in year)
 *
 * Rounds up to the nearest 0.5 day to be employee-friendly.
 *
 * @param totalAllocation - Full-year leave allocation (e.g., 24 days)
 * @param joiningDate - Employee's joining date (YYYY-MM-DD)
 * @param yearStart - Leave year start date (YYYY-MM-DD), typically Jan 1 or Apr 1
 * @param yearEnd - Leave year end date (YYYY-MM-DD), typically Dec 31 or Mar 31
 */
export function calculateProratedLeaves(
  totalAllocation: number,
  joiningDate: string,
  yearStart: string,
  yearEnd: string
): {
  proratedLeaves: number
  fullYearAllocation: number
  monthsRemaining: number
  totalMonths: number
  joiningDate: string
  yearStart: string
  yearEnd: string
} {
  const joining = new Date(joiningDate + 'T00:00:00Z')
  const start = new Date(yearStart + 'T00:00:00Z')
  const end = new Date(yearEnd + 'T00:00:00Z')

  // If joining is before or on the year start, full allocation
  if (joining <= start) {
    return {
      proratedLeaves: totalAllocation,
      fullYearAllocation: totalAllocation,
      monthsRemaining: getMonthDifference(start, end),
      totalMonths: getMonthDifference(start, end),
      joiningDate,
      yearStart,
      yearEnd
    }
  }

  // If joining is after the year end, no allocation
  if (joining > end) {
    return {
      proratedLeaves: 0,
      fullYearAllocation: totalAllocation,
      monthsRemaining: 0,
      totalMonths: getMonthDifference(start, end),
      joiningDate,
      yearStart,
      yearEnd
    }
  }

  const totalMonths = getMonthDifference(start, end)
  const monthsRemaining = getMonthDifference(joining, end)

  // Proportional calculation
  const rawProrated = totalAllocation * (monthsRemaining / totalMonths)

  // Round up to nearest 0.5 (employee-friendly rounding)
  const proratedLeaves = Math.ceil(rawProrated * 2) / 2

  return {
    proratedLeaves,
    fullYearAllocation: totalAllocation,
    monthsRemaining,
    totalMonths,
    joiningDate,
    yearStart,
    yearEnd
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Get the Monday of the week for a given date (ISO week) */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  // Shift so Monday = 0
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

/** Calculate approximate months between two dates (rounded up to include partial months) */
function getMonthDifference(from: Date, to: Date): number {
  const yearDiff = to.getUTCFullYear() - from.getUTCFullYear()
  const monthDiff = to.getUTCMonth() - from.getUTCMonth()
  const dayDiff = to.getUTCDate() - from.getUTCDate()

  let months = yearDiff * 12 + monthDiff
  // If there are remaining days in the partial month, count it
  if (dayDiff > 0) {
    months += 1
  } else if (dayDiff === 0) {
    months += 1 // Include the current month
  }

  return Math.max(0, months)
}
