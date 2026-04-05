import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// GET /api/crm/export - Export leads to CSV
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const loanType = searchParams.get('loan_type') || ''
    const assignedTo = searchParams.get('assigned_to') || ''
    const fromDate = searchParams.get('from_date') || ''
    const toDate = searchParams.get('to_date') || ''
    const format = searchParams.get('format') || 'csv' // csv or json

    // Build query based on role
    let query = supabase
      .from('crm_leads')
      .select('*')
      .is('deleted_at', null) // Exclude soft-deleted leads

    // Role-based filtering: CROs see only their assigned leads
    if (profile.subrole === 'cro') {
      query = query.eq('cro_id', user.id)
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (loanType) {
      query = query.eq('loan_type', loanType)
    }
    if (assignedTo && (profile.role === 'superadmin' || profile.role === 'hr')) {
      query = query.eq('cro_id', assignedTo)
    }
    if (fromDate) {
      query = query.gte('created_at', fromDate)
    }
    if (toDate) {
      query = query.lte('created_at', toDate)
    }

    // Apply sorting
    query = query.order('created_at', { ascending: false })

    // Limit to 10,000 rows for safety
    query = query.limit(10000)

    // Execute query
    const { data: leads, error: leadsError } = await query

    if (leadsError) {
      apiLogger.error('Error fetching leads for export', leadsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 })
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ success: false, error: 'No leads found to export' }, { status: 404 })
    }

    // Format based on requested format
    if (format === 'json') {
      // Return JSON format
      return NextResponse.json({
        success: true,
        count: leads.length,
        data: leads
      })
    } else {
      // Convert to CSV format
      const csvHeaders = [
        'ID', 'Customer Name', 'Phone', 'Email',
        'Loan Type', 'Loan Amount', 'Status', 'Stage',
        'Source', 'Location', 'Created At',
        'Last Updated', 'Next Follow-up'
      ]

      const csvRows = leads.map(lead => [
        lead.id || '',
        lead.customer_name || '',
        lead.phone || '',
        lead.email || '',
        lead.loan_type || '',
        lead.loan_amount || '',
        lead.status || '',
        lead.stage || '',
        lead.source || '',
        lead.location || '',
        lead.created_at || '',
        lead.updated_at || '',
        lead.next_follow_up_date || '',
      ].map(field => {
        // Escape fields containing commas or quotes
        const stringField = String(field)
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`
        }
        return stringField
      }).join(','))

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows
      ].join('\n')

      // Return CSV file
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="leads_export_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/crm/export', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/crm/export - Export specific leads by IDs
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { lead_ids, format = 'csv' } = body

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'lead_ids array is required' }, { status: 400 })
    }

    // Build query based on role
    let query = supabase
      .from('crm_leads')
      .select('*')
      .in('id', lead_ids)
      .is('deleted_at', null)

    // Role-based filtering: CROs see only their assigned leads
    if (profile.subrole === 'cro') {
      query = query.eq('cro_id', user.id)
    }

    // Execute query
    const { data: leads, error: leadsError } = await query

    if (leadsError) {
      apiLogger.error('Error fetching leads for export', leadsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 })
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ success: false, error: 'No accessible leads found to export' }, { status: 404 })
    }

    // Format based on requested format
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        count: leads.length,
        data: leads
      })
    } else {
      // Convert to CSV format
      const csvHeaders = [
        'ID', 'Customer Name', 'Phone', 'Email',
        'Loan Type', 'Loan Amount', 'Status', 'Stage',
        'Source', 'Location', 'Created At',
        'Last Updated', 'Next Follow-up'
      ]

      const csvRows = leads.map(lead => [
        lead.id || '',
        lead.customer_name || '',
        lead.phone || '',
        lead.email || '',
        lead.loan_type || '',
        lead.loan_amount || '',
        lead.status || '',
        lead.stage || '',
        lead.source || '',
        lead.location || '',
        lead.created_at || '',
        lead.updated_at || '',
        lead.next_follow_up_date || '',
      ].map(field => {
        const stringField = String(field)
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`
        }
        return stringField
      }).join(','))

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows
      ].join('\n')

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="leads_export_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/export', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
