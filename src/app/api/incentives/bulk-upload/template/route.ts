
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/incentives/bulk-upload/template
 * Download Excel template for bulk target upload
 * Query params: ?type=incentive_targets (default)
 * Access: HR, Superadmin
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role
    const { data: employee } = await supabase
      .from('employees')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const allowedRoles = ['HR_EXECUTIVE', 'HR_MANAGER', 'ADMIN_EXECUTIVE', 'ADMIN_MANAGER']
    if (!employee || !allowedRoles.includes(employee.sub_role)) {
      return NextResponse.json({ success: false, error: 'Forbidden: HR or Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const templateType = searchParams.get('type') || 'incentive_targets'

    // Fetch template from database
    const { data: template, error: templateError } = await supabase
      .from('bulk_upload_templates')
      .select('*')
      .eq('template_type', templateType)
      .eq('is_active', true)
      .maybeSingle()

    if (templateError || !template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    // Generate Excel file
    const workbook = new ExcelJS.Workbook()

    // Sheet 1: Instructions
    const instructionsSheet = workbook.addWorksheet('Instructions')
    const instructions = [
      ['BULK TARGET UPLOAD TEMPLATE'],
      [''],
      ['Instructions:'],
      ['1. Fill in the data starting from row 2 of the "Data" sheet'],
      ['2. Do not modify column headers'],
      ['3. Required fields are marked with * in the description'],
      ['4. Refer to "Column Descriptions" sheet for details'],
      ['5. See "Sample Data" sheet for examples'],
      [''],
      ['Important Notes:'],
      ['- Employee ID can be email address or employee code'],
      ['- Incentive ID must be a valid UUID from an active incentive program'],
      ['- Target value must be a positive number'],
      ['- All dates should be in YYYY-MM-DD format'],
      [''],
      ['Upload Process:'],
      ['1. Save this file after filling in your data'],
      ['2. Go to Incentives Management > Bulk Upload'],
      ['3. Upload the completed Excel file'],
      ['4. Review validation results'],
      ['5. Confirm to process the upload'],
    ]
    instructions.forEach((row, index) => {
      instructionsSheet.addRow(row)
    })

    // Sheet 2: Column Descriptions
    const columns = template.columns as unknown[]
    const descriptionsSheet = workbook.addWorksheet('Column Descriptions')
    descriptionsSheet.addRow(['Column Name', 'Label', 'Type', 'Required', 'Description', 'Example'])
    columns.forEach((col: unknown) => {
      descriptionsSheet.addRow([
        col.name,
        col.label,
        col.type,
        col.required ? 'Yes*' : 'No',
        col.description || '',
        col.example || '',
      ])
    })

    // Sheet 3: Data (empty template with headers)
    const dataSheet = workbook.addWorksheet('Data')
    const headers = columns.map((col: unknown) => col.label)
    dataSheet.addRow(headers)

    // Sheet 4: Sample Data
    if (template.sample_data && Array.isArray(template.sample_data) && template.sample_data.length > 0) {
      const sampleSheet = workbook.addWorksheet('Sample Data')
      const sampleHeaders = columns.map((col: unknown) => col.label)
      sampleSheet.addRow(sampleHeaders)
      ;(template.sample_data as unknown[]).forEach((sample: unknown) => {
        const row = columns.map((col: unknown) => sample[col.name] || '')
        sampleSheet.addRow(row)
      })
    }

    // Generate Excel buffer
    const excelBuffer = await workbook.xlsx.writeBuffer()

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${template.template_name.replace(/\s+/g, '_')}_Template.xlsx"`,
      },
    })
  } catch (error) {
    apiLogger.error('Error generating template', error)
    return NextResponse.json({ success: false, error: 'Failed to generate template' }, { status: 500 })
  }
}
