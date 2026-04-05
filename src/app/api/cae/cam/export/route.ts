/**
 * API Route: Export Credit Appraisal Memo (CAM)
 * POST /api/cae/cam/export
 *
 * Exports CAM to various formats: PDF, Excel, JSON
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { CreditAppraisalMemo } from '@/lib/cae/cam-service'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

type ExportFormat = 'pdf' | 'excel' | 'json' | 'html'

interface ExportCAMRequest {
  lead_id: string
  format: ExportFormat
  include_sections?: string[]
}

interface ExportCAMResponse {
  success: boolean
  data?: {
    format: ExportFormat
    content: string // Base64 encoded for binary formats, raw for text formats
    filename: string
    mime_type: string
  }
  error?: string
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ExportCAMResponse,
        { status: 401 }
      )
    }

    // Parse request body
    const body: ExportCAMRequest = await request.json()

    if (!body.lead_id) {
      return NextResponse.json(
        { success: false, error: 'lead_id is required' } as ExportCAMResponse,
        { status: 400 }
      )
    }

    if (!body.format || !['pdf', 'excel', 'json', 'html'].includes(body.format)) {
      return NextResponse.json(
        { success: false, error: 'format must be one of: pdf, excel, json, html' } as ExportCAMResponse,
        { status: 400 }
      )
    }

    // Fetch CAM data
    const { data: camRecord, error: fetchError } = await supabase
      .from('credit_appraisal_memos')
      .select('*')
      .eq('lead_id', body.lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError || !camRecord) {
      return NextResponse.json(
        { success: false, error: 'CAM not found. Please generate a CAM first.' } as ExportCAMResponse,
        { status: 404 }
      )
    }

    const cam = camRecord.cam_data as CreditAppraisalMemo
    const timestamp = new Date().toISOString().split('T')[0]
    let content: string
    let filename: string
    let mimeType: string

    switch (body.format) {
      case 'json':
        content = JSON.stringify(cam, null, 2)
        filename = `CAM_${cam.cam_id}_${timestamp}.json`
        mimeType = 'application/json'
        break

      case 'html':
        content = generateHTMLReport(cam)
        filename = `CAM_${cam.cam_id}_${timestamp}.html`
        mimeType = 'text/html'
        break

      case 'pdf':
        // For PDF, generate HTML and let client render to PDF
        // In production, this would use a PDF library like puppeteer
        content = Buffer.from(generatePDFHTML(cam)).toString('base64')
        filename = `CAM_${cam.cam_id}_${timestamp}.pdf`
        mimeType = 'application/pdf'
        break

      case 'excel':
        // For Excel, generate CSV format
        // In production, this would use a library like exceljs
        content = Buffer.from(generateCSVReport(cam)).toString('base64')
        filename = `CAM_${cam.cam_id}_${timestamp}.csv`
        mimeType = 'text/csv'
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Unsupported format' } as ExportCAMResponse,
          { status: 400 }
        )
    }

    // Log export
    await supabase.from('cam_export_logs').insert({
      lead_id: body.lead_id,
      cam_id: cam.cam_id,
      export_format: body.format,
      exported_by: user.id,
      created_at: new Date().toISOString(),
    }).catch(err => apiLogger.error('Failed to log export', err))

    return NextResponse.json({
      success: true,
      data: {
        format: body.format,
        content,
        filename,
        mime_type: mimeType,
      },
    } as ExportCAMResponse)

  } catch (error) {
    apiLogger.error('CAM export error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ExportCAMResponse,
      { status: 500 }
    )
  }
}

/**
 * Generate HTML report for CAM
 */
function generateHTMLReport(cam: CreditAppraisalMemo): string {
  const riskColor = {
    'VERY_LOW': '#22c55e',
    'LOW': '#84cc16',
    'MODERATE': '#eab308',
    'HIGH': '#f97316',
    'VERY_HIGH': '#ef4444',
  }[cam.risk_assessment.risk_grade] || '#6b7280'

  const decisionColor = {
    'APPROVE': '#22c55e',
    'CONDITIONAL_APPROVE': '#84cc16',
    'MANUAL_REVIEW': '#eab308',
    'DECLINE': '#ef4444',
  }[cam.recommendation.decision] || '#6b7280'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credit Appraisal Memo - ${cam.cam_id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #374151; background: #f9fafb; }
    .container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; }
    .header h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .header .cam-id { opacity: 0.9; font-size: 0.9rem; }
    .section { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-size: 1.1rem; font-weight: 600; color: #1f2937; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e5e7eb; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .field { padding: 0.75rem; background: #f9fafb; border-radius: 8px; }
    .field-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
    .field-value { font-weight: 600; color: #1f2937; }
    .score-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6; }
    .score-value { font-size: 2rem; font-weight: 700; color: #1e40af; }
    .risk-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: white; background: ${riskColor}; }
    .decision-badge { display: inline-block; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: white; background: ${decisionColor}; }
    .recommendation { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 1rem; margin-top: 1rem; }
    .recommendation-title { font-weight: 600; color: #166534; margin-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .footer { text-align: center; color: #9ca3af; font-size: 0.75rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Credit Appraisal Memo</h1>
      <div class="cam-id">CAM ID: ${cam.cam_id} | Generated: ${new Date(cam.created_at).toLocaleString()}</div>
    </div>

    <!-- Decision Summary -->
    <div class="section">
      <div class="section-title">Decision Summary</div>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="decision-badge">${cam.recommendation.decision.replace(/_/g, ' ')}</span>
        </div>
        <div class="score-card">
          <div>
            <div style="font-size: 0.75rem; color: #6b7280;">Credit Score</div>
            <div class="score-value">${cam.credit_analysis.credit_score || 'N/A'}</div>
          </div>
        </div>
        <div class="score-card">
          <div>
            <div style="font-size: 0.75rem; color: #6b7280;">Risk Grade</div>
            <div><span class="risk-badge">${cam.risk_assessment.risk_grade}</span></div>
          </div>
        </div>
        <div class="score-card">
          <div>
            <div style="font-size: 0.75rem; color: #6b7280;">Eligible Amount</div>
            <div class="score-value">₹${(cam.eligibility_analysis.eligible_amount / 100000).toFixed(2)}L</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Customer Profile -->
    <div class="section">
      <div class="section-title">Customer Profile</div>
      <div class="grid">
        <div class="field">
          <div class="field-label">Name</div>
          <div class="field-value">${cam.customer.name}</div>
        </div>
        <div class="field">
          <div class="field-label">PAN</div>
          <div class="field-value">${cam.customer.pan || 'N/A'}</div>
        </div>
        <div class="field">
          <div class="field-label">Mobile</div>
          <div class="field-value">${cam.customer.mobile || 'N/A'}</div>
        </div>
        <div class="field">
          <div class="field-label">Age</div>
          <div class="field-value">${cam.customer.age || 'N/A'} years</div>
        </div>
        <div class="field">
          <div class="field-label">Employment Type</div>
          <div class="field-value">${cam.customer.employment_type || 'N/A'}</div>
        </div>
        <div class="field">
          <div class="field-label">Employer</div>
          <div class="field-value">${cam.customer.employer_name || 'N/A'}</div>
        </div>
      </div>
    </div>

    <!-- Loan Details -->
    <div class="section">
      <div class="section-title">Loan Details</div>
      <div class="grid">
        <div class="field">
          <div class="field-label">Loan Type</div>
          <div class="field-value">${cam.loan.loan_type}</div>
        </div>
        <div class="field">
          <div class="field-label">Requested Amount</div>
          <div class="field-value">₹${(cam.loan.requested_amount / 100000).toFixed(2)} Lakhs</div>
        </div>
        <div class="field">
          <div class="field-label">Eligible Amount</div>
          <div class="field-value">₹${(cam.eligibility_analysis.eligible_amount / 100000).toFixed(2)} Lakhs</div>
        </div>
        <div class="field">
          <div class="field-label">Recommended Tenure</div>
          <div class="field-value">${cam.eligibility_analysis.recommended_tenure || 'N/A'} months</div>
        </div>
      </div>
    </div>

    <!-- Income Analysis -->
    <div class="section">
      <div class="section-title">Income Analysis</div>
      <div class="grid">
        <div class="field">
          <div class="field-label">Gross Monthly Income</div>
          <div class="field-value">₹${cam.income_analysis.gross_monthly_income.toLocaleString()}</div>
        </div>
        <div class="field">
          <div class="field-label">Net Monthly Income</div>
          <div class="field-value">₹${cam.income_analysis.net_monthly_income.toLocaleString()}</div>
        </div>
        <div class="field">
          <div class="field-label">Income Stability</div>
          <div class="field-value">${(cam.income_analysis.income_stability_score * 100).toFixed(0)}%</div>
        </div>
        <div class="field">
          <div class="field-label">Co-Applicant Income</div>
          <div class="field-value">₹${(cam.income_analysis.co_applicant_income || 0).toLocaleString()}</div>
        </div>
      </div>
    </div>

    <!-- Credit Analysis -->
    <div class="section">
      <div class="section-title">Credit Analysis</div>
      <div class="grid">
        <div class="field">
          <div class="field-label">Credit Score</div>
          <div class="field-value">${cam.credit_analysis.credit_score || 'Not Available'}</div>
        </div>
        <div class="field">
          <div class="field-label">Credit Grade</div>
          <div class="field-value">${cam.credit_analysis.credit_grade || 'N/A'}</div>
        </div>
        <div class="field">
          <div class="field-label">Existing EMIs</div>
          <div class="field-value">₹${cam.credit_analysis.existing_emis.toLocaleString()}</div>
        </div>
        <div class="field">
          <div class="field-label">Total Obligations</div>
          <div class="field-value">₹${cam.credit_analysis.total_obligations.toLocaleString()}</div>
        </div>
      </div>
    </div>

    <!-- Risk Assessment -->
    <div class="section">
      <div class="section-title">Risk Assessment</div>
      <div class="grid">
        <div class="field">
          <div class="field-label">Risk Score</div>
          <div class="field-value">${cam.risk_assessment.risk_score}/100</div>
        </div>
        <div class="field">
          <div class="field-label">Risk Grade</div>
          <div class="field-value"><span class="risk-badge">${cam.risk_assessment.risk_grade}</span></div>
        </div>
        <div class="field">
          <div class="field-label">FOIR</div>
          <div class="field-value">${(cam.eligibility_analysis.foir * 100).toFixed(1)}%</div>
        </div>
        <div class="field">
          <div class="field-label">DTI Ratio</div>
          <div class="field-value">${(cam.eligibility_analysis.dti_ratio * 100).toFixed(1)}%</div>
        </div>
      </div>

      ${cam.risk_assessment.risk_factors.length > 0 ? `
      <div style="margin-top: 1rem;">
        <div class="field-label">Risk Factors</div>
        <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
          ${cam.risk_assessment.risk_factors.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- Recommendation -->
    <div class="section">
      <div class="section-title">Recommendation</div>
      <div class="recommendation">
        <div class="recommendation-title">${cam.recommendation.decision.replace(/_/g, ' ')}</div>
        <p>${cam.recommendation.summary}</p>
      </div>
      ${cam.recommendation.conditions.length > 0 ? `
      <div style="margin-top: 1rem;">
        <div class="field-label">Conditions</div>
        <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
          ${cam.recommendation.conditions.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>This Credit Appraisal Memo was generated by the Loanz360 Credit Appraisal Engine.</p>
      <p>Generated on ${new Date().toLocaleString()} | CAM ID: ${cam.cam_id}</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Generate PDF-optimized HTML (for server-side PDF generation)
 */
function generatePDFHTML(cam: CreditAppraisalMemo): string {
  // Same as HTML report but with print-optimized styles
  return generateHTMLReport(cam).replace(
    '</style>',
    `
    @media print {
      body { background: white; }
      .section { break-inside: avoid; }
    }
    @page { margin: 1cm; }
    </style>`
  )
}

/**
 * Generate CSV report for Excel export
 */
function generateCSVReport(cam: CreditAppraisalMemo): string {
  const rows: string[][] = [
    ['Credit Appraisal Memo'],
    ['CAM ID', cam.cam_id],
    ['Generated', new Date(cam.created_at).toLocaleString()],
    [''],
    ['DECISION SUMMARY'],
    ['Decision', cam.recommendation.decision],
    ['Credit Score', String(cam.credit_analysis.credit_score || 'N/A')],
    ['Risk Grade', cam.risk_assessment.risk_grade],
    ['Risk Score', String(cam.risk_assessment.risk_score)],
    ['Eligible Amount', String(cam.eligibility_analysis.eligible_amount)],
    [''],
    ['CUSTOMER PROFILE'],
    ['Name', cam.customer.name],
    ['PAN', cam.customer.pan || 'N/A'],
    ['Mobile', cam.customer.mobile || 'N/A'],
    ['Email', cam.customer.email || 'N/A'],
    ['Age', String(cam.customer.age || 'N/A')],
    ['Employment Type', cam.customer.employment_type || 'N/A'],
    ['Employer', cam.customer.employer_name || 'N/A'],
    [''],
    ['LOAN DETAILS'],
    ['Loan Type', cam.loan.loan_type],
    ['Requested Amount', String(cam.loan.requested_amount)],
    ['Eligible Amount', String(cam.eligibility_analysis.eligible_amount)],
    ['Recommended Tenure', String(cam.eligibility_analysis.recommended_tenure || 'N/A')],
    [''],
    ['INCOME ANALYSIS'],
    ['Gross Monthly Income', String(cam.income_analysis.gross_monthly_income)],
    ['Net Monthly Income', String(cam.income_analysis.net_monthly_income)],
    ['Income Stability Score', String(cam.income_analysis.income_stability_score)],
    ['Co-Applicant Income', String(cam.income_analysis.co_applicant_income || 0)],
    ['Total Considered Income', String(cam.income_analysis.total_income_considered)],
    [''],
    ['CREDIT ANALYSIS'],
    ['Credit Score', String(cam.credit_analysis.credit_score || 'N/A')],
    ['Credit Grade', cam.credit_analysis.credit_grade || 'N/A'],
    ['Existing EMIs', String(cam.credit_analysis.existing_emis)],
    ['Total Obligations', String(cam.credit_analysis.total_obligations)],
    [''],
    ['ELIGIBILITY'],
    ['FOIR', String((cam.eligibility_analysis.foir * 100).toFixed(2)) + '%'],
    ['DTI Ratio', String((cam.eligibility_analysis.dti_ratio * 100).toFixed(2)) + '%'],
    ['Is Eligible', cam.eligibility_analysis.is_eligible ? 'Yes' : 'No'],
    [''],
    ['RECOMMENDATION'],
    ['Summary', cam.recommendation.summary],
  ]

  // Add conditions
  if (cam.recommendation.conditions.length > 0) {
    rows.push(['Conditions'])
    cam.recommendation.conditions.forEach((c, i) => {
      rows.push([`  ${i + 1}. ${c}`])
    })
  }

  // Convert to CSV
  return rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}
