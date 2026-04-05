// PDF Generation Types for Payroll System

export interface PayslipData {
  // Company Information
  companyName: string
  companyAddress: string
  companyLogo?: string

  // Payslip Information
  payslipNumber: string
  month: number
  year: number
  periodStartDate: string
  periodEndDate: string
  paymentDate?: string

  // Employee Information
  employeeName: string
  employeeId: string
  designation: string
  department: string
  dateOfJoining: string
  panNumber?: string
  uanNumber?: string
  esicNumber?: string

  // Bank Details
  bankName?: string
  bankAccountNumber?: string
  bankIfsc?: string

  // Attendance Information
  totalWorkingDays: number
  daysPresent: number
  daysAbsent: number
  leavesTaken: number
  lopDays: number

  // Earnings
  earnings: {
    basicSalary: number
    hra: number
    da?: number
    specialAllowance?: number
    medicalAllowance?: number
    conveyanceAllowance?: number
    educationAllowance?: number
    performanceBonus?: number
    overtimeAmount?: number
    otherAllowances?: number
  }
  grossSalary: number

  // Deductions
  deductions: {
    pfEmployee: number
    pfEmployer?: number
    esiEmployee: number
    esiEmployer?: number
    professionalTax: number
    tds: number
    loanDeduction?: number
    advanceDeduction?: number
    lopAmount?: number
    otherDeductions?: number
  }
  totalDeductions: number

  // Net Salary
  netSalary: number

  // Employer Contributions (shown separately)
  employerContributions: {
    pfEmployer: number
    esiEmployer: number
  }

  // CTC Information
  ctc?: number

  // Year-to-Date (YTD) Information
  ytd?: {
    grossSalary: number
    totalDeductions: number
    netSalary: number
    tds: number
  }

  // Additional Information
  remarks?: string
  paymentStatus?: 'pending' | 'processing' | 'paid' | 'failed' | 'on_hold'
  isDraft?: boolean
}

export interface PayslipGenerationOptions {
  // PDF Options
  includeWatermark?: boolean
  watermarkText?: string
  includeDigitalSignature?: boolean
  signatureImageUrl?: string
  signatoryName?: string
  signatoryDesignation?: string

  // Security Options
  passwordProtected?: boolean
  password?: string

  // Display Options
  showEmployerContributions?: boolean
  showYTD?: boolean
  showCtc?: boolean
  includeCompanyLogo?: boolean

  // Color Theme
  primaryColor?: string
  accentColor?: string
}

export interface BulkPayslipGenerationResult {
  success: boolean
  totalPayslips: number
  successfullyGenerated: number
  failed: number
  errors: Array<{
    payslipNumber: string
    employeeName: string
    error: string
  }>
  generatedFiles: Array<{
    payslipNumber: string
    employeeName: string
    fileName: string
    fileUrl?: string
    fileSize?: number
  }>
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export const getMonthName = (month: number): string => {
  return MONTHS[month - 1] || 'Unknown'
}
