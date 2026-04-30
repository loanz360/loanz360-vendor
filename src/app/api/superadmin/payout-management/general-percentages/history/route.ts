import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/payout-management/general-percentages/history
 * Get version history for a specific payout entry
 *
 * Query Parameters:
 * - bank_name (required): Bank name
 * - location (required): Location
 * - loan_type (required): Loan type
 * OR
 * - id (required): ID of any version to get all versions
 */
export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getHistoryHandler(req)
  })
}

async function getHistoryHandler(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const id = searchParams.get('id')
    const bankName = searchParams.get('bank_name')
    const location = searchParams.get('location')
    const loanType = searchParams.get('loan_type')

    let queryBankName = bankName
    let queryLocation = location
    let queryLoanType = loanType

    // If ID is provided, get the entry details first
    if (id) {
      const { data: entry, error } = await supabase
        .from('payout_general_percentages')
        .select('bank_name, location, loan_type')
        .eq('id', id)
        .maybeSingle()

      if (error || !entry) {
        return NextResponse.json(
          { success: false, error: 'Entry not found' },
          { status: 404 }
        )
      }

      queryBankName = entry.bank_name
      queryLocation = entry.location
      queryLoanType = entry.loan_type
    }

    if (!queryBankName || !queryLocation || !queryLoanType) {
      return NextResponse.json(
        { success: false, error: 'Either id OR (bank_name, location, loan_type) is required' },
        { status: 400 }
      )
    }

    // Get all versions for this entry
    const { data: versions, error: versionsError } = await supabase
      .from('payout_general_percentages')
      .select('*')
      .eq('bank_name', queryBankName)
      .eq('location', queryLocation)
      .eq('loan_type', queryLoanType)
      .order('version', { ascending: false })

    if (versionsError) {
      apiLogger.error('Error fetching versions', versionsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch version history' },
        { status: 500 }
      )
    }

    // Get audit log entries
    const { data: auditLogs } = await supabase
      .from('payout_rate_history')
      .select('*')
      .eq('bank_name', queryBankName)
      .eq('location', queryLocation)
      .eq('loan_type', queryLoanType)
      .order('created_at', { ascending: false })
      .limit(50)

    // Format the response
    const formattedVersions = versions?.map(v => ({
      id: v.id,
      version: v.version,
      commission_percentage: v.commission_percentage,
      effective_from: v.effective_from,
      effective_to: v.effective_to,
      is_current: v.is_current,
      change_reason: v.change_reason,
      created_at: v.created_at,
      updated_at: v.updated_at,
      replaced_by: v.replaced_by
    })) || []

    return NextResponse.json({
      success: true,
      entry: {
        bank_name: queryBankName,
        location: queryLocation,
        loan_type: queryLoanType
      },
      versions: formattedVersions,
      total_versions: formattedVersions.length,
      current_version: formattedVersions.find(v => v.is_current),
      audit_log: auditLogs || []
    })

  } catch (error) {
    apiLogger.error('Error in GET history', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
