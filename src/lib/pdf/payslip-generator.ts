// Payslip PDF Generation Engine
// Server-side PDF generation and management

import { renderToStream, renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import type {
  PayslipData,
  PayslipGenerationOptions,
  BulkPayslipGenerationResult
} from './types'
import { PayslipTemplate } from './templates/payslip-template'

/**
 * Generate a PDF buffer from payslip data
 */
export async function generatePayslipPDF(
  data: PayslipData,
  options: PayslipGenerationOptions = {}
): Promise<Buffer> {
  try {
    // Create the PDF document component
    const document = PayslipTemplate({ data, options })

    // Render to buffer
    const pdfBuffer = await renderToBuffer(document)

    return pdfBuffer
  } catch (error) {
    console.error('Error generating payslip PDF:', error)
    throw new Error(
      `Failed to generate payslip PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate a PDF stream from payslip data (for immediate download)
 */
export async function generatePayslipStream(
  data: PayslipData,
  options: PayslipGenerationOptions = {}
): Promise<NodeJS.ReadableStream> {
  try {
    const document = PayslipTemplate({ data, options })
    const stream = await renderToStream(document)
    return stream
  } catch (error) {
    console.error('Error generating payslip stream:', error)
    throw new Error(
      `Failed to generate payslip stream: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate payslip PDF and upload to Supabase Storage
 */
export async function generateAndUploadPayslip(
  data: PayslipData,
  options: PayslipGenerationOptions = {}
): Promise<{
  success: boolean
  pdfUrl?: string
  fileName?: string
  fileSize?: number
  error?: string
}> {
  try {
    // Generate PDF buffer
    const pdfBuffer = await generatePayslipPDF(data, options)

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Generate file name
    const fileName = `payslip_${data.payslipNumber}_${data.year}_${String(data.month).padStart(2, '0')}.pdf`
    const filePath = `payslips/${data.year}/${String(data.month).padStart(2, '0')}/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payroll-documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // Get signed URL (24 hours expiry) instead of public URL for security
    const { data: urlData, error: signedUrlError } = await supabase.storage
      .from('payroll-documents')
      .createSignedUrl(filePath, 86400) // 24 hours in seconds

    if (signedUrlError || !urlData) {
      throw new Error(`Failed to create signed URL: ${signedUrlError?.message}`)
    }

    return {
      success: true,
      pdfUrl: urlData.signedUrl,
      fileName,
      fileSize: pdfBuffer.length
    }
  } catch (error) {
    console.error('Error generating and uploading payslip:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Bulk generate payslips for multiple employees
 */
export async function bulkGeneratePayslips(
  payslipsData: PayslipData[],
  options: PayslipGenerationOptions = {}
): Promise<BulkPayslipGenerationResult> {
  const result: BulkPayslipGenerationResult = {
    success: true,
    totalPayslips: payslipsData.length,
    successfullyGenerated: 0,
    failed: 0,
    errors: [],
    generatedFiles: []
  }

  // Process each payslip
  for (const payslipData of payslipsData) {
    try {
      const uploadResult = await generateAndUploadPayslip(payslipData, options)

      if (uploadResult.success && uploadResult.pdfUrl) {
        result.successfullyGenerated++
        result.generatedFiles.push({
          payslipNumber: payslipData.payslipNumber,
          employeeName: payslipData.employeeName,
          fileName: uploadResult.fileName!,
          fileUrl: uploadResult.pdfUrl,
          fileSize: uploadResult.fileSize
        })
      } else {
        result.failed++
        result.errors.push({
          payslipNumber: payslipData.payslipNumber,
          employeeName: payslipData.employeeName,
          error: uploadResult.error || 'Unknown error'
        })
      }
    } catch (error) {
      result.failed++
      result.errors.push({
        payslipNumber: payslipData.payslipNumber,
        employeeName: payslipData.employeeName,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  result.success = result.failed === 0

  return result
}

/**
 * Fetch payslip data from database and generate PDF
 */
export async function generatePayslipFromDatabase(
  payslipId: string,
  options: PayslipGenerationOptions = {}
): Promise<{
  success: boolean
  pdfBuffer?: Buffer
  pdfUrl?: string
  error?: string
}> {
  try {
    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Fetch payslip with all related data
    const { data: payslip, error: fetchError } = await supabase
      .from('payslips')
      .select(`
        *,
        payroll_details!inner(
          *,
          payroll_runs!inner(*)
        ),
        users!inner(
          id,
          email,
          user_profiles(
            full_name,
            employee_id,
            designation,
            department,
            date_of_joining,
            pan_number,
            uan_number,
            esic_number
          )
        )
      `)
      .eq('id', payslipId)
      .maybeSingle()

    if (fetchError || !payslip) {
      throw new Error(`Payslip not found: ${fetchError?.message}`)
    }

    // Extract payroll detail
    const payrollDetail = payslip.payroll_details
    const payrollRun = payrollDetail.payroll_runs
    const user = payslip.users
    const profile = user.user_profiles

    // Map database data to PayslipData format
    const payslipData: PayslipData = {
      // Company information (should come from settings/config)
      companyName: process.env.COMPANY_NAME || 'LOANZ 360',
      companyAddress: process.env.COMPANY_ADDRESS || 'India',

      // Payslip information
      payslipNumber: payslip.payslip_number,
      month: payslip.month,
      year: payslip.year,
      periodStartDate: payrollRun.period_start_date,
      periodEndDate: payrollRun.period_end_date,
      paymentDate: payrollDetail.payment_date,

      // Employee information
      employeeName: profile?.full_name || 'N/A',
      employeeId: profile?.employee_id || 'N/A',
      designation: profile?.designation || 'N/A',
      department: profile?.department || 'N/A',
      dateOfJoining: profile?.date_of_joining || new Date().toISOString(),
      panNumber: profile?.pan_number,
      uanNumber: profile?.uan_number,
      esicNumber: profile?.esic_number,

      // Bank details
      bankName: payrollDetail.bank_name,
      bankAccountNumber: payrollDetail.bank_account_number,
      bankIfsc: payrollDetail.bank_ifsc,

      // Attendance
      totalWorkingDays: payrollDetail.working_days || 0,
      daysPresent: payrollDetail.days_present || 0,
      daysAbsent: (payrollDetail.working_days || 0) - (payrollDetail.days_present || 0),
      leavesTaken: payrollDetail.leaves_taken || 0,
      lopDays: payrollDetail.lop_days || 0,

      // Earnings
      earnings: {
        basicSalary: payrollDetail.basic_salary || 0,
        hra: payrollDetail.hra || 0,
        da: payrollDetail.da || 0,
        specialAllowance: payrollDetail.special_allowance || 0,
        medicalAllowance: payrollDetail.medical_allowance || 0,
        conveyanceAllowance: payrollDetail.conveyance_allowance || 0,
        educationAllowance: payrollDetail.education_allowance || 0,
        performanceBonus: payrollDetail.performance_bonus || 0,
        overtimeAmount: payrollDetail.overtime_amount || 0,
        otherAllowances: payrollDetail.other_allowances || 0
      },
      grossSalary: payrollDetail.gross_salary || 0,

      // Deductions
      deductions: {
        pfEmployee: payrollDetail.pf_employee || 0,
        pfEmployer: payrollDetail.pf_employer || 0,
        esiEmployee: payrollDetail.esi_employee || 0,
        esiEmployer: payrollDetail.esi_employer || 0,
        professionalTax: payrollDetail.professional_tax || 0,
        tds: payrollDetail.tds || 0,
        loanDeduction: payrollDetail.loan_deduction || 0,
        advanceDeduction: payrollDetail.advance_deduction || 0,
        lopAmount: payrollDetail.lop_amount || 0,
        otherDeductions: payrollDetail.other_deductions || 0
      },
      totalDeductions: payrollDetail.total_deductions || 0,

      // Net salary
      netSalary: payrollDetail.net_salary || 0,

      // Employer contributions
      employerContributions: {
        pfEmployer: payrollDetail.pf_employer || 0,
        esiEmployer: payrollDetail.esi_employer || 0
      },

      // Remarks
      remarks: payrollDetail.remarks,
      paymentStatus: payrollDetail.payment_status
    }

    // Generate PDF
    const pdfBuffer = await generatePayslipPDF(payslipData, options)

    // Optionally upload to storage
    if (options.includeWatermark !== false) {
      const uploadResult = await generateAndUploadPayslip(payslipData, options)
      if (uploadResult.success && uploadResult.pdfUrl) {
        // Update payslip record with PDF URL
        await supabase
          .from('payslips')
          .update({
            pdf_url: uploadResult.pdfUrl,
            pdf_generated_at: new Date().toISOString()
          })
          .eq('id', payslipId)

        return {
          success: true,
          pdfBuffer,
          pdfUrl: uploadResult.pdfUrl
        }
      }
    }

    return {
      success: true,
      pdfBuffer
    }
  } catch (error) {
    console.error('Error generating payslip from database:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete payslip PDF from storage
 */
export async function deletePayslipPDF(pdfUrl: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Extract file path from URL
    const url = new URL(pdfUrl)
    const filePath = url.pathname.split('/payroll-documents/')[1]

    if (!filePath) {
      throw new Error('Invalid PDF URL')
    }

    // Delete from storage
    const { error } = await supabase.storage
      .from('payroll-documents')
      .remove([filePath])

    if (error) {
      throw error
    }

    return true
  } catch (error) {
    console.error('Error deleting payslip PDF:', error)
    return false
  }
}

/**
 * Get payslip download URL (signed URL for private buckets)
 */
export async function getPayslipDownloadUrl(
  pdfUrl: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Extract file path from URL
    const url = new URL(pdfUrl)
    const filePath = url.pathname.split('/payroll-documents/')[1]

    if (!filePath) {
      throw new Error('Invalid PDF URL')
    }

    // Create signed URL
    const { data, error } = await supabase.storage
      .from('payroll-documents')
      .createSignedUrl(filePath, expiresIn)

    if (error || !data) {
      throw error
    }

    return data.signedUrl
  } catch (error) {
    console.error('Error creating signed URL:', error)
    return null
  }
}
