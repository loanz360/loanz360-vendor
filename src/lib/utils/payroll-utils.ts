// =====================================================
// SHARED PAYROLL UTILITY FUNCTIONS
// Centralized formatting and calculation functions
// =====================================================

/**
 * Format currency in Indian Rupee format
 * @param amount - Amount to format
 * @param showDecimals - Whether to show decimal places (default: false)
 * @returns Formatted currency string (e.g., ₹1,50,000)
 */
export const formatCurrency = (amount: number, showDecimals: boolean = false): string => {
  if (!Number.isFinite(amount)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0
  }).format(amount)
}

/**
 * Format date in Indian format (DD/MM/YYYY)
 * @param date - Date string or Date object
 * @param format - Format type: 'short' | 'long' | 'full'
 * @returns Formatted date string
 */
export const formatDate = (
  date: string | Date,
  format: 'short' | 'long' | 'full' = 'short'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date

  if (format === 'short') {
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } else if (format === 'long') {
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } else {
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
}

/**
 * Get current financial year in India (April to March)
 * @param shortFormat - If true, returns "2024-25" format; if false, returns "2024-2025"
 * @returns Financial year string
 */
export const getCurrentFinancialYear = (shortFormat: boolean = true): string => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() // 0=Jan, 1=Feb, 2=Mar, 3=Apr...

  // Financial year in India: April 1 to March 31
  const startYear = month >= 3 ? year : year - 1
  const endYear = startYear + 1

  if (shortFormat) {
    return `${startYear}-${String(endYear).slice(-2)}`
  }
  return `${startYear}-${endYear}`
}

/**
 * Get financial year in alternative format (e.g., "FY 2024-25")
 * @param fullYear - Whether to show full year (2024-2025) or short (2024-25)
 * @returns Financial year string
 */
export const getFinancialYearLabel = (fullYear: boolean = false): string => {
  const fy = getCurrentFinancialYear()
  if (fullYear) {
    return `FY ${fy}`
  } else {
    const [start, end] = fy.split('-')
    return `FY ${start}-${end.slice(-2)}`
  }
}

/**
 * Get assessment year from financial year
 * @param financialYear - Financial year string (e.g., "2024-2025")
 * @returns Assessment year string (e.g., "2025-2026")
 */
export const getAssessmentYear = (financialYear: string): string => {
  const [start] = financialYear.split('-')
  const assessmentStart = parseInt(start) + 1
  return `${assessmentStart}-${assessmentStart + 1}`
}

/**
 * PF wage ceiling as per EPFO rules
 * PF is calculated on basic salary capped at ₹15,000/month
 */
export const PF_WAGE_CEILING = 15000

/**
 * Calculate PF (Provident Fund) employee contribution
 * PF is calculated on basic salary capped at ₹15,000/month (EPFO statutory limit)
 * @param basicSalary - Basic salary amount
 * @param rate - PF rate (default: 12%)
 * @param applyWageCeiling - Whether to apply ₹15,000 wage ceiling (default: true)
 * @returns PF amount
 */
export const calculatePF = (basicSalary: number, rate: number = 12, applyWageCeiling: boolean = true): number => {
  const pfBase = applyWageCeiling ? Math.min(basicSalary, PF_WAGE_CEILING) : basicSalary
  return Math.round((pfBase * rate) / 100)
}

/**
 * Calculate ESI (Employee State Insurance) contribution
 * @param grossSalary - Gross salary amount
 * @param employeeRate - Employee ESI rate (default: 0.75%)
 * @param employerRate - Employer ESI rate (default: 3.25%)
 * @returns Object with employee and employer ESI
 */
export const calculateESI = (
  grossSalary: number,
  employeeRate: number = 0.75,
  employerRate: number = 3.25
): { employee: number; employer: number; applicable: boolean } => {
  // ESI applicable only if gross salary <= ₹21,000 per month
  const applicable = grossSalary <= 21000

  if (!applicable) {
    return { employee: 0, employer: 0, applicable: false }
  }

  return {
    employee: Math.round((grossSalary * employeeRate) / 100),
    employer: Math.round((grossSalary * employerRate) / 100),
    applicable: true
  }
}

/**
 * Calculate Professional Tax based on state slabs
 * @param grossSalary - Gross monthly salary
 * @param stateCode - State code (default: 'MH' for Maharashtra)
 * @param month - Month number (1-12), used for February exception in MH
 * @returns Professional tax amount
 */
export const calculateProfessionalTax = (
  grossSalary: number,
  stateCode: string = 'MH',
  month?: number
): number => {
  // Maharashtra PT slabs (as per MH state rules)
  // Annual total = ₹2,500 (₹200 × 11 months + ₹300 in February)
  if (stateCode === 'MH') {
    if (grossSalary <= 7500) return 0
    if (grossSalary <= 10000) return 175
    // February exception: ₹300 to make annual total ₹2,500
    if (month === 2) return 300
    return 200
  }

  // Karnataka PT slabs
  if (stateCode === 'KA') {
    if (grossSalary <= 15000) return 0
    if (grossSalary <= 25000) return 200
    return 200
  }

  // West Bengal PT slabs
  if (stateCode === 'WB') {
    if (grossSalary <= 10000) return 0
    if (grossSalary <= 15000) return 110
    if (grossSalary <= 25000) return 130
    if (grossSalary <= 40000) return 150
    return 200
  }

  // Telangana / Andhra Pradesh
  if (stateCode === 'TG' || stateCode === 'AP') {
    if (grossSalary <= 15000) return 0
    if (grossSalary <= 20000) return 150
    return 200
  }

  return 0
}

/**
 * Calculate net salary
 * @param grossSalary - Gross salary
 * @param deductions - Object with all deductions
 * @returns Net salary
 */
export const calculateNetSalary = (
  grossSalary: number,
  deductions: {
    pf?: number
    esi?: number
    pt?: number
    tds?: number
    loan?: number
    advance?: number
    others?: number
  }
): number => {
  const totalDeductions =
    (deductions.pf || 0) +
    (deductions.esi || 0) +
    (deductions.pt || 0) +
    (deductions.tds || 0) +
    (deductions.loan || 0) +
    (deductions.advance || 0) +
    (deductions.others || 0)

  return grossSalary - totalDeductions
}

/**
 * Calculate CTC (Cost to Company)
 * @param grossSalary - Gross monthly salary
 * @param employerContributions - Employer contributions (PF, ESI, etc.)
 * @returns Annual CTC
 */
export const calculateCTC = (
  grossSalary: number,
  employerContributions: {
    pf?: number
    esi?: number
    gratuity?: number
    others?: number
  }
): number => {
  const monthlyEmployerContribution =
    (employerContributions.pf || 0) +
    (employerContributions.esi || 0) +
    (employerContributions.gratuity || 0) +
    (employerContributions.others || 0)

  return (grossSalary + monthlyEmployerContribution) * 12
}

/**
 * Month names array
 */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/**
 * Get month name from number (1-12)
 * @param month - Month number (1-12)
 * @returns Month name
 */
export const getMonthName = (month: number): string => {
  return MONTH_NAMES[month - 1] || 'Invalid Month'
}

/**
 * Format month and year for display
 * @param month - Month number (1-12)
 * @param year - Year (e.g., 2025)
 * @returns Formatted string (e.g., "January 2025")
 */
export const formatMonthYear = (month: number, year: number): string => {
  return `${getMonthName(month)} ${year}`
}

/**
 * Calculate LOP (Loss of Pay) amount
 * @param monthlySalary - Monthly salary
 * @param totalDays - Total working days in month
 * @param presentDays - Number of days present
 * @returns LOP amount
 */
export const calculateLOP = (
  monthlySalary: number,
  totalDays: number,
  presentDays: number
): { lopDays: number; lopAmount: number; payableSalary: number } => {
  const lopDays = Math.max(0, totalDays - presentDays)
  if (totalDays <= 0) return { lopDays: 0, lopAmount: 0, payableSalary: monthlySalary }
  const perDaySalary = monthlySalary / totalDays
  const lopAmount = Math.round(lopDays * perDaySalary)
  const payableSalary = monthlySalary - lopAmount

  return {
    lopDays,
    lopAmount,
    payableSalary
  }
}

/**
 * Calculate EMI for loan
 * @param principal - Loan principal amount
 * @param annualRate - Annual interest rate (percentage)
 * @param tenureMonths - Loan tenure in months
 * @returns Monthly EMI amount
 */
export const calculateEMI = (
  principal: number,
  annualRate: number,
  tenureMonths: number
): number => {
  if (tenureMonths <= 0) return 0
  if (annualRate === 0) {
    return Math.round(principal / tenureMonths)
  }

  const monthlyRate = annualRate / 12 / 100
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)

  return Math.round(emi)
}

/**
 * Format percentage
 * @param value - Value to format as percentage
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`
}

/**
 * Validate PAN number format
 * @param pan - PAN number string
 * @returns Boolean indicating validity
 */
export const isValidPAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  return panRegex.test(pan)
}

/**
 * Validate Aadhaar number format
 * @param aadhaar - Aadhaar number string
 * @returns Boolean indicating validity
 */
export const isValidAadhaar = (aadhaar: string): boolean => {
  // Aadhaar numbers cannot start with 0 or 1 (UIDAI rules)
  const aadhaarRegex = /^[2-9]\d{11}$/
  return aadhaarRegex.test(aadhaar.replace(/\s/g, ''))
}

/**
 * Validate UAN (Universal Account Number) format
 * @param uan - UAN number string
 * @returns Boolean indicating validity
 */
export const isValidUAN = (uan: string): boolean => {
  const uanRegex = /^[0-9]{12}$/
  return uanRegex.test(uan)
}

/**
 * Validate bank account number
 * @param accountNumber - Bank account number
 * @returns Boolean indicating validity
 */
export const isValidBankAccount = (accountNumber: string): boolean => {
  const accountRegex = /^[0-9]{9,18}$/
  return accountRegex.test(accountNumber)
}

/**
 * Validate IFSC code
 * @param ifsc - IFSC code
 * @returns Boolean indicating validity
 */
export const isValidIFSC = (ifsc: string): boolean => {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
  return ifscRegex.test(ifsc)
}
