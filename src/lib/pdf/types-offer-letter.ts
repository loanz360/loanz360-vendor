/**
 * Offer Letter PDF Types
 */

export interface OfferLetterData {
  // Company
  companyName: string
  companyAddress: string
  companyLogo?: string

  // Letter metadata
  letterDate: string       // YYYY-MM-DD
  referenceNumber: string  // e.g., OL/2026/001

  // Employee details
  candidateName: string
  candidateAddress: string

  // Job details
  designation: string
  department: string
  reportingManager?: string
  dateOfJoining: string    // YYYY-MM-DD
  workLocation: string

  // Compensation (annual)
  basicSalary: number
  hra: number
  specialAllowance: number
  transportAllowance: number
  medicalAllowance: number
  otherAllowances: number
  pfContribution: number
  esiContribution: number
  professionalTax: number
  grossSalary: number
  totalDeductions: number
  netSalary: number
  ctcAnnual: number

  // Terms
  probationPeriodMonths: number
  noticePeriodDays: number

  // Signatory
  signatoryName: string
  signatoryDesignation: string
}

export interface OfferLetterOptions {
  includeCompensation?: boolean
  includeCompanyLogo?: boolean
  primaryColor?: string
}

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
