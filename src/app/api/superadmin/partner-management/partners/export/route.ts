import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { expensiveRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/partner-management/partners/export
 * Export partners data in various formats
 *
 * Rate Limit: 10 requests per hour (expensive operation)
 *
 * Query Parameters:
 * - format: csv | json | excel (default: csv)
 * - partner_type: Filter by type
 * - status: Filter by status
 * - state: Filter by state
 * - city: Filter by city
 * - month: Filter by joining month
 */
export async function GET(request: NextRequest) {
  return expensiveRateLimiter(request, async (req) => {
    return await exportPartnersHandler(req)
  })
}

async function exportPartnersHandler(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const partnerType = searchParams.get('partner_type')
    const status = searchParams.get('status')
    const state = searchParams.get('state')
    const city = searchParams.get('city')
    const month = searchParams.get('month')

    // Validate format
    if (!['csv', 'json', 'excel'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Must be csv, json, or excel' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Build query with filters
    let query = supabase
      .from('partners')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)

    if (partnerType) {
      query = query.eq('partner_type', partnerType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (state) {
      query = query.eq('state', state)
    }

    if (city) {
      query = query.eq('city', city)
    }

    if (month) {
      const startDate = new Date(month + '-01')
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)

      query = query
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
    }

    // Fetch all data (no pagination for export)
    const { data: partners, error } = await query.order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Export query error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partners for export' },
        { status: 500 }
      )
    }

    if (!partners || partners.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No partners found to export' },
        { status: 404 }
      )
    }

    // Format data for export
    const exportData = partners.map((partner: any) => ({
      partner_id: partner.partner_id,
      full_name: partner.full_name,
      partner_type: partner.partner_type,
      email: partner.work_email || partner.personal_email,
      mobile_number: partner.mobile_number,
      city: partner.city || '',
      state: partner.state || '',
      status: partner.status,
      total_logins: partner.total_logins || 0,
      total_leads: partner.total_leads || 0,
      leads_in_progress: partner.leads_in_progress || 0,
      leads_sanctioned: partner.leads_sanctioned || 0,
      leads_dropped: partner.leads_dropped || 0,
      estimated_payout: parseFloat(partner.estimated_payout || 0).toFixed(2),
      actual_payout: parseFloat(partner.actual_payout || 0).toFixed(2),
      lifetime_earnings: parseFloat(partner.lifetime_earnings || 0).toFixed(2),
      joining_date: partner.joining_date,
      last_login_at: partner.last_login_at,
      created_at: partner.created_at
    }))

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `partners_export_${timestamp}.${format === 'excel' ? 'xlsx' : format}`

    // Generate file content based on format
    let content: string
    let contentType: string

    switch (format) {
      case 'csv':
        content = generateCSV(exportData)
        contentType = 'text/csv'
        break

      case 'json':
        content = JSON.stringify(exportData, null, 2)
        contentType = 'application/json'
        break

      case 'excel':
        // Generate tab-separated for Excel
        content = generateTSV(exportData)
        contentType = 'application/vnd.ms-excel'
        break

      default:
        content = generateCSV(exportData)
        contentType = 'text/csv'
    }

    // Return file as download
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Count': String(exportData.length),
        'X-Export-Format': format
      }
    })

  } catch (error) {
    apiLogger.error('Export API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error during export' },
      { status: 500 }
    )
  }
}

/**
 * Generate CSV content
 */
function generateCSV(data: any[]): string {
  if (data.length === 0) return ''

  // Headers
  const headers = Object.keys(data[0])
  const headerRow = headers.join(',')

  // Rows
  const rows = data.map(row => {
    return headers.map(header => {
      const value = row[header]

      if (value === null || value === undefined) {
        return ''
      }

      const stringValue = String(value)

      // Escape quotes and wrap in quotes if contains comma or newline
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }

      return stringValue
    }).join(',')
  }).join('\n')

  return `${headerRow}\n${rows}`
}

/**
 * Generate TSV (Tab-Separated Values) for Excel
 */
function generateTSV(data: any[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const headerRow = headers.join('\t')

  const rows = data.map(row => {
    return headers.map(header => String(row[header] ?? '')).join('\t')
  }).join('\n')

  return `${headerRow}\n${rows}`
}
