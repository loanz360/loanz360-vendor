/**
 * API Route: DSE Bulk Lead Upload
 * POST /api/employees/dse/leads/bulk-upload
 *
 * Accepts an array of leads parsed from CSV/Excel on the client side.
 * Validates each lead, checks for duplicates, and inserts valid ones.
 * Returns detailed results for each row.
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import { encryptLeadPII } from '@/lib/security/encryption-pii'


const MOBILE_REGEX = /^[6-9]\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_BATCH_SIZE = 50

interface BulkLeadRow {
  row_number: number
  customer_name: string
  customer_mobile: string
  customer_email?: string
  customer_city?: string
  loan_type?: string
  loan_amount?: number
  remarks?: string
}

interface RowResult {
  row_number: number
  status: 'success' | 'error' | 'duplicate'
  lead_number?: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role and active status
    const { data: employee } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, role, is_active')
      .eq('user_id', user.id)
      .eq('role', 'DIRECT_SALES_EXECUTIVE')
      .maybeSingle()

    if (!employee) {
      return NextResponse.json({ success: false, error: 'DSE profile not found' }, { status: 404 })
    }

    if (employee.is_active === false) {
      return NextResponse.json({ success: false, error: 'Your account is inactive' }, { status: 403 })
    }

    let body: { leads: BulkLeadRow[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.leads || !Array.isArray(body.leads)) {
      return NextResponse.json({ success: false, error: 'leads array is required' }, { status: 400 })
    }

    if (body.leads.length === 0) {
      return NextResponse.json({ success: false, error: 'No leads to upload' }, { status: 400 })
    }

    if (body.leads.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_BATCH_SIZE} leads per batch. You sent ${body.leads.length}.` },
        { status: 400 }
      )
    }

    const results: RowResult[] = []
    let successCount = 0
    let errorCount = 0
    let duplicateCount = 0

    for (const row of body.leads) {
      // Validate required fields
      if (!row.customer_name?.trim()) {
        results.push({ row_number: row.row_number, status: 'error', error: 'Customer name is required' })
        errorCount++
        continue
      }

      if (!row.customer_mobile?.trim() || !MOBILE_REGEX.test(row.customer_mobile.trim())) {
        results.push({ row_number: row.row_number, status: 'error', error: 'Valid 10-digit mobile number required' })
        errorCount++
        continue
      }

      if (row.customer_email && !EMAIL_REGEX.test(row.customer_email.trim())) {
        results.push({ row_number: row.row_number, status: 'error', error: 'Invalid email format' })
        errorCount++
        continue
      }

      const normalizedMobile = `+91${row.customer_mobile.trim()}`

      // Check for duplicates
      const { data: existing } = await supabase
        .from('leads')
        .select('lead_number')
        .or(`customer_mobile.eq.${normalizedMobile},customer_mobile.eq.${row.customer_mobile.trim()}`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (existing) {
        results.push({
          row_number: row.row_number,
          status: 'duplicate',
          lead_number: existing.lead_number,
          error: `Duplicate — existing lead ${existing.lead_number}`,
        })
        duplicateCount++
        continue
      }

      // Generate lead ID
      const { data: leadIdResult } = await supabase.rpc('generate_lead_id')
      const userId = user.id
      const leadId = (leadIdResult as string) || `BULK-${Date.now()}-${userId.slice(0,8)}-${row.row_number}`

      // Insert lead
      const { data: lead, error: insertError } = await supabase
        .from('leads')
        .insert(encryptLeadPII({
          lead_id: leadId,
          customer_name: row.customer_name.trim(),
          customer_mobile: normalizedMobile,
          customer_email: row.customer_email?.trim() || null,
          customer_city: row.customer_city?.trim() || null,
          loan_type: row.loan_type?.trim() || 'Not Specified',
          required_loan_amount: row.loan_amount || null,
          loan_amount: row.loan_amount || null,
          remarks: row.remarks?.trim() || null,
          employee_id: employee.id,
          employee_type: 'DIRECT_SALES_EXECUTIVE',
          form_source: 'DSE_BULK_UPLOAD',
          form_status: 'SUBMITTED',
          form_completion_percentage: 30,
          lead_status: 'NEW',
          lead_priority: 'MEDIUM',
          assigned_bde_id: employee.id,
          assigned_bde_name: employee.full_name,
          assigned_at: new Date().toISOString(),
          cam_status: 'NOT_STARTED',
          is_active: true,
          collected_data: {
            submitted_by: 'DSE_BULK_UPLOAD',
            submitted_at: new Date().toISOString(),
            employee_name: employee.full_name,
            batch_row: row.row_number,
          },
        }))
        .select('id, lead_number')
        .maybeSingle()

      if (insertError || !lead) {
        apiLogger.error(`Bulk upload row ${row.row_number} error`, insertError)
        results.push({ row_number: row.row_number, status: 'error', error: 'Failed to create lead' })
        errorCount++
        continue
      }

      results.push({ row_number: row.row_number, status: 'success', lead_number: lead.lead_number || leadId })
      successCount++
    }

    return NextResponse.json({
      success: true,
      data: {
        total: body.leads.length,
        success_count: successCount,
        error_count: errorCount,
        duplicate_count: duplicateCount,
        results,
      },
      message: `Uploaded ${successCount} of ${body.leads.length} leads. ${duplicateCount} duplicates skipped, ${errorCount} errors.`,
    })
  } catch (error) {
    apiLogger.error('Bulk upload error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
