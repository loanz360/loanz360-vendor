/**
 * Bank Payout Sheet Entries API
 * GET: List entries for a specific sheet
 * PUT: Manual match/unmatch an entry
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// =====================================================
// GET: List entries for a specific sheet
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id: sheetId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify SA or staff
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isStaff = userData?.role === 'SUPER_ADMIN' ||
      (userData?.role === 'EMPLOYEE' && ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER', 'FINANCE_EXECUTIVE', 'FINANCE_MANAGER'].includes(userData?.sub_role || ''))

    if (!isStaff) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const matchStatus = searchParams.get('match_status') || 'ALL'
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    let query = supabase
      .from('bank_payout_sheet_entries')
      .select('*', { count: 'exact' })
      .eq('sheet_id', sheetId)
      .order('row_number', { ascending: true })

    if (matchStatus !== 'ALL') {
      query = query.eq('match_status', matchStatus)
    }
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,loan_account_number.ilike.%${search}%,bank_reference.ilike.%${search}%`)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: entries, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching entries:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch entries' }, { status: 500 })
    }

    // Get sheet info
    const { data: sheet } = await supabase
      .from('bank_payout_sheets')
      .select('id, sheet_number, bank_name, total_entries, matched_count, unmatched_count, discrepancy_count, status')
      .eq('id', sheetId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      sheet,
      entries: entries || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    apiLogger.error('Error in sheet entries GET:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// PUT: Manual match/unmatch an entry
// =====================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id: sheetId } = await params
    const supabase = await createClient()
    const adminSupabase = createSupabaseAdmin()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify SA
    const { data: userData } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { entryId, action, applicationId, applicationType, notes } = body

    if (!entryId) {
      return NextResponse.json({ success: false, error: 'Entry ID is required' }, { status: 400 })
    }

    // Verify entry belongs to this sheet
    const { data: entry } = await supabase
      .from('bank_payout_sheet_entries')
      .select('*')
      .eq('id', entryId)
      .eq('sheet_id', sheetId)
      .maybeSingle()

    if (!entry) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 })
    }

    if (action === 'match') {
      // Manual match
      if (!applicationId || !applicationType) {
        return NextResponse.json({ success: false, error: 'Application ID and type are required for matching' }, { status: 400 })
      }

      // Verify the application exists
      let app = null
      if (applicationType === 'BA' || applicationType === 'BP') {
        const { data } = await supabase
          .from('partner_payout_applications')
          .select('id, expected_commission_amount')
          .eq('id', applicationId)
          .maybeSingle()
        app = data
      } else if (applicationType === 'CP') {
        const { data } = await supabase
          .from('cp_applications')
          .select('id, expected_payout_amount')
          .eq('id', applicationId)
          .maybeSingle()
        app = data ? { ...data, expected_commission_amount: data.expected_payout_amount } : null
      }

      if (!app) {
        return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 })
      }

      const amountDiff = entry.payout_amount && app.expected_commission_amount
        ? Math.round((entry.payout_amount - app.expected_commission_amount) * 100) / 100
        : null
      const hasDiscrepancy = amountDiff !== null && Math.abs(amountDiff) > 1

      // Update entry
      await adminSupabase
        .from('bank_payout_sheet_entries')
        .update({
          match_status: hasDiscrepancy ? 'DISCREPANCY' : 'MATCHED',
          matched_application_id: applicationId,
          matched_application_type: applicationType,
          amount_discrepancy: amountDiff,
          matched_at: new Date().toISOString(),
          matched_by: user.id,
          match_notes: notes || `Manually matched by ${userData.full_name}`,
        })
        .eq('id', entryId)

      // Update the payout application
      if (applicationType === 'BA' || applicationType === 'BP') {
        await adminSupabase
          .from('partner_payout_applications')
          .update({
            bank_sheet_entry_id: entryId,
            bank_sheet_matched: true,
            bank_sheet_matched_at: new Date().toISOString(),
            bank_sheet_matched_by: user.id,
            bank_confirmed_amount: entry.payout_amount,
          })
          .eq('id', applicationId)
      }

      // Update sheet stats
      await updateSheetStats(adminSupabase, sheetId)

      return NextResponse.json({ success: true, message: 'Entry matched successfully' })

    } else if (action === 'unmatch') {
      // Remove match
      if (entry.matched_application_id) {
        if (entry.matched_application_type === 'BA' || entry.matched_application_type === 'BP') {
          await adminSupabase
            .from('partner_payout_applications')
            .update({
              bank_sheet_entry_id: null,
              bank_sheet_matched: false,
              bank_sheet_matched_at: null,
              bank_sheet_matched_by: null,
              bank_confirmed_amount: null,
            })
            .eq('id', entry.matched_application_id)
        }
      }

      await adminSupabase
        .from('bank_payout_sheet_entries')
        .update({
          match_status: 'UNMATCHED',
          matched_application_id: null,
          matched_application_type: null,
          amount_discrepancy: null,
          matched_at: null,
          matched_by: null,
          match_notes: notes || `Unmatched by ${userData.full_name}`,
        })
        .eq('id', entryId)

      await updateSheetStats(adminSupabase, sheetId)

      return NextResponse.json({ success: true, message: 'Entry unmatched successfully' })

    } else if (action === 'skip') {
      // Mark as "no match needed"
      await adminSupabase
        .from('bank_payout_sheet_entries')
        .update({
          match_status: 'SKIPPED',
          match_notes: notes || `Skipped by ${userData.full_name} - no match needed`,
        })
        .eq('id', entryId)

      await updateSheetStats(adminSupabase, sheetId)

      return NextResponse.json({ success: true, message: 'Entry marked as skipped' })

    } else {
      return NextResponse.json({ success: false, error: 'Invalid action. Use match, unmatch, or skip.' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Error in sheet entries PUT:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// Helper: Update sheet match stats
// =====================================================
async function updateSheetStats(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  sheetId: string
) {
  const [matchedResult, unmatchedResult, discrepancyResult] = await Promise.all([
    supabase.from('bank_payout_sheet_entries').select('id', { count: 'exact', head: true }).eq('sheet_id', sheetId).eq('match_status', 'MATCHED'),
    supabase.from('bank_payout_sheet_entries').select('id', { count: 'exact', head: true }).eq('sheet_id', sheetId).eq('match_status', 'UNMATCHED'),
    supabase.from('bank_payout_sheet_entries').select('id', { count: 'exact', head: true }).eq('sheet_id', sheetId).eq('match_status', 'DISCREPANCY'),
  ])

  await supabase
    .from('bank_payout_sheets')
    .update({
      matched_count: matchedResult.count || 0,
      unmatched_count: unmatchedResult.count || 0,
      discrepancy_count: discrepancyResult.count || 0,
    })
    .eq('id', sheetId)
}
