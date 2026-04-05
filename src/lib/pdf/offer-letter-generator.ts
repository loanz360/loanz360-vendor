// Offer Letter PDF Generation Engine
// Server-side PDF generation following payslip-generator.ts pattern

import { renderToBuffer } from '@react-pdf/renderer'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import type { OfferLetterData, OfferLetterOptions } from './types-offer-letter'
import { OfferLetterTemplate } from './templates/offer-letter-template'

/**
 * Generate Offer Letter PDF buffer
 */
export async function generateOfferLetterPDF(
  data: OfferLetterData,
  options: OfferLetterOptions = {}
): Promise<Buffer> {
  try {
    const document = OfferLetterTemplate({ data, options })
    const pdfBuffer = await renderToBuffer(document)
    return pdfBuffer
  } catch (error) {
    console.error('Error generating offer letter PDF:', error)
    throw new Error(
      `Failed to generate offer letter PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate and upload Offer Letter to Supabase Storage
 */
export async function generateAndUploadOfferLetter(
  data: OfferLetterData,
  options: OfferLetterOptions = {}
): Promise<{ url: string; path: string }> {
  const pdfBuffer = await generateOfferLetterPDF(data, options)
  const supabase = createSupabaseAdmin()

  const fileName = `offer-letter-${data.referenceNumber.replace(/\//g, '-')}.pdf`
  const filePath = `offer-letters/${new Date().getFullYear()}/${fileName}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('hr-documents')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Failed to upload offer letter: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('hr-documents')
    .getPublicUrl(uploadData.path)

  return {
    url: urlData.publicUrl,
    path: uploadData.path,
  }
}

/**
 * Build OfferLetterData from employee record
 */
export function buildOfferLetterData(employee: {
  full_name: string
  present_address?: string
  sub_role: string
  department_name?: string
  date_of_joining: string
  city?: string
  state?: string
  probation_end_date?: string
  reporting_manager_name?: string
  salary?: {
    basic_salary?: number
    hra?: number
    special_allowance?: number
    transport_allowance?: number
    medical_allowance?: number
    other_allowances?: number
    pf_contribution?: number
    esi_contribution?: number
    professional_tax?: number
    ctc_annual?: number
  }
}, referenceNumber: string): OfferLetterData {
  const sal = employee.salary || {}
  const basicSalary = sal.basic_salary || 0
  const hra = sal.hra || 0
  const specialAllowance = sal.special_allowance || 0
  const transportAllowance = sal.transport_allowance || 0
  const medicalAllowance = sal.medical_allowance || 0
  const otherAllowances = sal.other_allowances || 0
  const pfContribution = sal.pf_contribution || 0
  const esiContribution = sal.esi_contribution || 0
  const professionalTax = sal.professional_tax || 0
  const grossSalary = basicSalary + hra + specialAllowance + transportAllowance + medicalAllowance + otherAllowances
  const totalDeductions = pfContribution + esiContribution + professionalTax
  const netSalary = grossSalary - totalDeductions

  // Calculate probation months
  let probationMonths = 6
  if (employee.probation_end_date && employee.date_of_joining) {
    const join = new Date(employee.date_of_joining)
    const probEnd = new Date(employee.probation_end_date)
    probationMonths = Math.max(1, Math.round((probEnd.getTime() - join.getTime()) / (30 * 24 * 60 * 60 * 1000)))
  }

  // Format sub_role for display
  const designation = employee.sub_role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return {
    companyName: process.env.COMPANY_NAME || 'LOANZ 360',
    companyAddress: process.env.COMPANY_ADDRESS || 'India',
    letterDate: new Date().toISOString().split('T')[0],
    referenceNumber,
    candidateName: employee.full_name,
    candidateAddress: employee.present_address || `${employee.city || ''}, ${employee.state || ''}`.trim().replace(/^,|,$/g, '') || 'Address on file',
    designation,
    department: employee.department_name || 'As Assigned',
    reportingManager: employee.reporting_manager_name,
    dateOfJoining: employee.date_of_joining,
    workLocation: employee.city || employee.state || 'As Assigned',
    basicSalary,
    hra,
    specialAllowance,
    transportAllowance,
    medicalAllowance,
    otherAllowances,
    pfContribution,
    esiContribution,
    professionalTax,
    grossSalary,
    totalDeductions,
    netSalary,
    ctcAnnual: sal.ctc_annual || grossSalary + pfContribution + esiContribution,
    probationPeriodMonths: probationMonths,
    noticePeriodDays: 30,
    signatoryName: process.env.SIGNATORY_NAME || 'HR Department',
    signatoryDesignation: process.env.SIGNATORY_DESIGNATION || 'Head of Human Resources',
  }
}
