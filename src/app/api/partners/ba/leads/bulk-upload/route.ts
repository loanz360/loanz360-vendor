import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import { createInAppNotification } from '@/lib/notifications/notification-service'


const CSV_TEMPLATE = 'customer_name,customer_mobile,customer_email,customer_city,customer_pincode,loan_type,estimated_amount\nJohn Doe,9876543210,john@email.com,Mumbai,400001,New Personal Loan,500000\n'

const VALID_LOAN_TYPES = [
  'New Personal Loan', 'Top-up Loan', 'Balance Transfer', 'Business Loan', 'MSME Loan',
  'Home Loan', 'Home Loan Balance Transfer', 'Plot Loan', 'Construction Loan',
  'Loan Against Property', 'Car Loan', 'Two Wheeler Loan', 'Used Car Loan',
  'Education Loan', 'Working Capital', 'Professional Loan', 'Gold Loan',
]

/**
 * GET /api/partners/ba/leads/bulk-upload
 * Returns CSV template for bulk lead upload
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  return new NextResponse(CSV_TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename=lead-upload-template.csv',
    },
  })
}

interface ParsedRow {
  customer_name: string
  customer_mobile: string
  customer_email: string
  customer_city?: string
  customer_pincode?: string
  loan_type: string
  estimated_amount?: string
}

/**
 * POST /api/partners/ba/leads/bulk-upload
 * Processes CSV data for bulk lead creation
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify partner is BA
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, full_name')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json({ success: false, error: 'BA profile not found' }, { status: 404 })
    }

    // Parse request body (expecting JSON array of rows)
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const rows: ParsedRow[] = body.rows

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No data rows provided' }, { status: 400 })
    }

    if (rows.length > 100) {
      return NextResponse.json({ success: false, error: 'Maximum 100 rows per upload' }, { status: 400 })
    }

    const results: { row: number; status: 'success' | 'error'; message: string; lead_id?: string }[] = []
    let successCount = 0
    let errorCount = 0

    // Phase 1: Validate all rows first (no DB calls)
    const validRows: { rowNum: number; data: Record<string, unknown> }[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 1

      if (!row.customer_name?.trim()) {
        results.push({ row: rowNum, status: 'error', message: 'Customer name is required' })
        errorCount++
        continue
      }

      // Normalize mobile number: strip +91, 91 prefix, or leading 0
      let mobile = (row.customer_mobile || '').trim().replace(/[\s\-]/g, '')
      if (mobile.startsWith('+91')) mobile = mobile.slice(3)
      else if (mobile.startsWith('91') && mobile.length === 12) mobile = mobile.slice(2)
      else if (mobile.startsWith('0') && mobile.length === 11) mobile = mobile.slice(1)

      if (!mobile || !/^\d{10}$/.test(mobile)) {
        results.push({ row: rowNum, status: 'error', message: 'Valid 10-digit mobile number required' })
        errorCount++
        continue
      }

      if (!row.loan_type?.trim()) {
        results.push({ row: rowNum, status: 'error', message: 'Loan type is required' })
        errorCount++
        continue
      }

      const matchedType = VALID_LOAN_TYPES.find(t =>
        t.toLowerCase().includes(row.loan_type.trim().toLowerCase()) ||
        row.loan_type.trim().toLowerCase().includes(t.toLowerCase())
      )

      validRows.push({
        rowNum,
        data: {
          customer_name: row.customer_name.trim(),
          customer_mobile: mobile,
          customer_email: row.customer_email?.trim() || null,
          customer_city: row.customer_city?.trim() || null,
          customer_pincode: row.customer_pincode?.trim() || null,
          loan_type: matchedType || row.loan_type.trim(),
          estimated_amount: row.estimated_amount ? parseFloat(row.estimated_amount) || null : null,
          partner_id: partner.id,
          partner_name: partner.full_name,
          source_type: 'BA',
          form_source: 'BULK_UPLOAD',
          status: 'NEW',
          application_phase: 1,
          created_at: new Date().toISOString(),
        },
      })
    }

    // Phase 2: Batch insert all valid rows in a single DB call
    if (validRows.length > 0) {
      const insertPayloads = validRows.map(r => r.data)
      const { data: insertedLeads, error: batchError } = await supabase
        .from('leads')
        .insert(insertPayloads)
        .select('id, lead_id')

      if (batchError) {
        // Entire batch failed — mark all valid rows as errors
        apiLogger.error('BA bulk upload batch insert failed', batchError)
        for (const row of validRows) {
          results.push({ row: row.rowNum, status: 'error', message: 'Batch insert failed' })
          errorCount++
        }
      } else {
        // Batch succeeded — map results back to row numbers
        for (let i = 0; i < validRows.length; i++) {
          const lead = insertedLeads?.[i]
          results.push({
            row: validRows[i].rowNum,
            status: 'success',
            message: 'Lead created',
            lead_id: lead?.lead_id || lead?.id,
          })
          successCount++
        }
      }
    }

    // Sort results by row number for consistent output
    results.sort((a, b) => a.row - b.row)

    // Send bulk upload completion notification (non-blocking)
    if (successCount > 0) {
      createInAppNotification({
        adminId: partner.id,
        type: 'success',
        category: 'leads',
        title: 'Bulk Upload Complete',
        message: `${successCount} lead${successCount > 1 ? 's' : ''} uploaded successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
        actionUrl: '/partners/ba/leads',
        actionLabel: 'View Leads',
        icon: '📤',
        metadata: { total: rows.length, success: successCount, failed: errorCount },
      }).catch(error => {
        apiLogger.error('Failed to send bulk upload notification', error)
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        total: rows.length,
        success: successCount,
        failed: errorCount,
        results,
      },
    })

  } catch (error: unknown) {
    apiLogger.error('Bulk upload error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
