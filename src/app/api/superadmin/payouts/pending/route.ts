
/**
 * API Route: Get Pending Commissions for Payout
 * GET /api/superadmin/payouts/pending
 * Returns all calculated commissions awaiting payout batch creation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export interface PendingCommission {
  id: string
  lead_id: string
  partner_id: string
  partner_name: string
  partner_type: string
  customer_name: string
  loan_type: string
  bank_name: string | null
  location: string | null
  required_loan_amount: number
  commission_percentage: number
  commission_amount: number
  commission_calculated_at: string
  created_at: string
}

export interface PendingCommissionsResponse {
  success: boolean
  data?: {
    commissions: PendingCommission[]
    summary: {
      total_count: number
      total_amount: number
      ba_count: number
      ba_amount: number
      bp_count: number
      bp_amount: number
    }
  }
  error?: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate superadmin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as PendingCommissionsResponse,
        { status: 401 }
      )
    }

    // 2. Verify superadmin role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || profile?.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Superadmin access required' } as PendingCommissionsResponse,
        { status: 403 }
      )
    }

    // 3. Get query parameters
    const { searchParams } = new URL(request.url)
    const partnerType = searchParams.get('partner_type') // Filter: BA, BP, or ALL
    const limit = parseInt(searchParams.get('limit') || '100')

    // 4. Build query for CALCULATED commissions (ready for batch)
    let query = supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        partner_id,
        partner_type,
        customer_name,
        loan_type,
        bank_name,
        location,
        required_loan_amount,
        commission_percentage,
        commission_amount,
        commission_calculated_at,
        created_at,
        partners!inner (
          full_name
        )
      `)
      .eq('commission_status', 'CALCULATED')
      .not('commission_amount', 'is', null)
      .order('commission_calculated_at', { ascending: true })
      .limit(limit)

    // Apply partner type filter
    if (partnerType && partnerType !== 'ALL') {
      const typeMap: Record<string, string> = {
        'BA': 'BUSINESS_ASSOCIATE',
        'BP': 'BUSINESS_PARTNER',
      }
      const fullType = typeMap[partnerType] || partnerType
      query = query.eq('partner_type', fullType)
    }

    const { data: leads, error: leadsError } = await query

    if (leadsError) {
      apiLogger.error('Error fetching pending commissions', leadsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pending commissions' } as PendingCommissionsResponse,
        { status: 500 }
      )
    }

    // 5. Format response data
    const commissions: PendingCommission[] = (leads || []).map((lead: unknown) => ({
      id: lead.id,
      lead_id: lead.lead_id,
      partner_id: lead.partner_id,
      partner_name: lead.partners?.full_name || 'Unknown',
      partner_type: lead.partner_type,
      customer_name: lead.customer_name,
      loan_type: lead.loan_type,
      bank_name: lead.bank_name,
      location: lead.location,
      required_loan_amount: lead.required_loan_amount,
      commission_percentage: lead.commission_percentage,
      commission_amount: lead.commission_amount,
      commission_calculated_at: lead.commission_calculated_at,
      created_at: lead.created_at,
    }))

    // 6. Calculate summary statistics
    const summary = {
      total_count: commissions.length,
      total_amount: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
      ba_count: commissions.filter(c => c.partner_type === 'BUSINESS_ASSOCIATE').length,
      ba_amount: commissions
        .filter(c => c.partner_type === 'BUSINESS_ASSOCIATE')
        .reduce((sum, c) => sum + c.commission_amount, 0),
      bp_count: commissions.filter(c => c.partner_type === 'BUSINESS_PARTNER').length,
      bp_amount: commissions
        .filter(c => c.partner_type === 'BUSINESS_PARTNER')
        .reduce((sum, c) => sum + c.commission_amount, 0),
    }

    return NextResponse.json({
      success: true,
      data: {
        commissions,
        summary,
      },
    } as PendingCommissionsResponse)
  } catch (error) {
    apiLogger.error('Get pending commissions error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as PendingCommissionsResponse,
      { status: 500 }
    )
  }
}
