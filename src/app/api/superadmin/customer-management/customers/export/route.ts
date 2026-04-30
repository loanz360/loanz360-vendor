import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/customer-management/customers/export
 * Export customers based on filters
 *
 * Rate Limit: 10 requests per minute (lower for exports)
 */
export async function GET(request: NextRequest) {
  // Lower rate limit for exports
  return readRateLimiter(request, async (req) => {
    return await exportCustomersHandler(req)
  }, 10) // 10 requests per minute
}

async function exportCustomersHandler(request: NextRequest) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Get export parameters
    const format = searchParams.get('format') || 'csv'
    const categoryFilter = searchParams.get('category')
    const statusFilter = searchParams.get('status')
    const kycStatusFilter = searchParams.get('kyc_status')
    const rawSearch = searchParams.get('search') || ''
    const includeDetails = searchParams.get('include_details') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 5000) // Max 5000 for export

    const supabase = createSupabaseAdmin()

    // Build query
    let query = supabase
      .from('customers')
      .select(`
        id,
        user_id,
        kyc_status,
        credit_score,
        created_at,
        updated_at,
        users!inner(
          email,
          full_name,
          sub_role,
          status,
          created_at,
          last_login,
          email_verified,
          mobile_verified
        ),
        profiles(
          mobile,
          date_of_birth,
          gender,
          pan_number,
          aadhaar_number,
          address_current,
          address_permanent
        )
        ${includeDetails ? `,
        income_details,
        employment_details,
        financial_information,
        loan_eligibility` : ''}
      `)

    // Apply filters
    if (categoryFilter && categoryFilter !== 'all') {
      const validCategories = ['INDIVIDUAL', 'SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'PROFESSIONAL']
      if (!validCategories.includes(categoryFilter)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid category filter'
        }, { status: 400 })
      }
      query = query.eq('users.sub_role', categoryFilter)
    }

    if (statusFilter && statusFilter !== 'all') {
      const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']
      if (!validStatuses.includes(statusFilter)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid status filter'
        }, { status: 400 })
      }
      query = query.eq('users.status', statusFilter)
    }

    if (kycStatusFilter && kycStatusFilter !== 'all') {
      const validKYCStatuses = ['PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED', 'EXPIRED']
      if (!validKYCStatuses.includes(kycStatusFilter)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid KYC status filter'
        }, { status: 400 })
      }
      query = query.eq('kyc_status', kycStatusFilter)
    }

    if (rawSearch) {
      const search = rawSearch.replace(/[%_'";\\]/g, '')
      query = query.or(`users.full_name.ilike.%${search}%,users.email.ilike.%${search}%,profiles.mobile.ilike.%${search}%`)
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(limit)

    const { data: customers, error: fetchError } = await query

    if (fetchError) {
      apiLogger.error('Error fetching customers for export', fetchError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch customers for export'
      }, { status: 500 })
    }

    // Transform data for export
    const exportData = customers.map((customer: unknown) => {
      const baseData = {
        id: customer.id,
        name: customer.users?.full_name || 'N/A',
        email: customer.users?.email || 'N/A',
        mobile: customer.profiles?.mobile || 'N/A',
        category: customer.users?.sub_role || 'INDIVIDUAL',
        status: customer.users?.status || 'PENDING_VERIFICATION',
        kyc_status: customer.kyc_status || 'PENDING',
        credit_score: customer.credit_score || 'N/A',
        email_verified: customer.users?.email_verified ? 'Yes' : 'No',
        mobile_verified: customer.users?.mobile_verified ? 'Yes' : 'No',
        date_of_birth: customer.profiles?.date_of_birth || 'N/A',
        gender: customer.profiles?.gender || 'N/A',
        pan_number: customer.profiles?.pan_number || 'N/A',
        joined_date: customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A',
        last_login: customer.users?.last_login ? new Date(customer.users.last_login).toLocaleString() : 'Never'
      }

      if (includeDetails) {
        return {
          ...baseData,
          current_address: customer.profiles?.address_current
            ? `${customer.profiles.address_current.street || ''}, ${customer.profiles.address_current.city || ''}, ${customer.profiles.address_current.state || ''} - ${customer.profiles.address_current.pincode || ''}`
            : 'N/A',
          permanent_address: customer.profiles?.address_permanent
            ? `${customer.profiles.address_permanent.street || ''}, ${customer.profiles.address_permanent.city || ''}, ${customer.profiles.address_permanent.state || ''} - ${customer.profiles.address_permanent.pincode || ''}`
            : 'N/A',
          annual_income: customer.income_details?.annual_income || 'N/A',
          employment_type: customer.employment_details?.employment_type || 'N/A',
          company_name: customer.employment_details?.company_name || 'N/A',
          total_assets: customer.financial_information?.total_assets || 'N/A',
          total_liabilities: customer.financial_information?.total_liabilities || 'N/A'
        }
      }

      return baseData
    })

    // Return based on format
    if (format === 'csv') {
      // Generate CSV
      const csv = convertToCSV(exportData)

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="customers-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: exportData,
        count: exportData.length,
        exported_at: new Date().toISOString(),
        filters: {
          category: categoryFilter,
          status: statusFilter,
          kyc_status: kycStatusFilter,
          search: rawSearch
        }
      }, {
        headers: {
          'Content-Disposition': `attachment; filename="customers-export-${new Date().toISOString().split('T')[0]}.json"`
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid export format. Use "csv" or "json"'
      }, { status: 400 })
    }

  } catch (error) {
    apiLogger.error('Error in export API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Helper function to convert JSON to CSV
function convertToCSV(data: unknown[]): string {
  if (data.length === 0) {
    return ''
  }

  // Get headers from first object
  const headers = Object.keys(data[0])

  // Create CSV header row
  const headerRow = headers.join(',')

  // Create CSV data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]

      // Handle null/undefined
      if (value === null || value === undefined) {
        return ''
      }

      // Convert to string and escape
      const stringValue = String(value)

      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }

      return stringValue
    }).join(',')
  })

  // Combine header and data
  return [headerRow, ...dataRows].join('\n')
}
