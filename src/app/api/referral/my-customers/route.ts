
/**
 * My Customers API for Referrals
 * Shows Active and Old customers for BP/CP/Employee referrals
 *
 * Active Customers: Leads currently being referred by this referral
 * Old Customers: Previously referred leads (now closed or referred by someone else)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

// Define active lead statuses
const ACTIVE_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'UNDER_REVIEW',
  'DOCUMENTS_PENDING',
  'VERIFICATION_PENDING',
  'APPROVAL_PENDING',
  'ASSIGNED_TO_BDE',
  'IN_PROCESS',
  'CONTACTED',
  'QUALIFIED',
  'DOCUMENT_PENDING',
]

const CLOSED_STATUSES = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'WITHDRAWN',
  'CLOSED',
  'SANCTIONED',
  'CONVERTED',
  'DROPPED',
]

interface ActiveCustomer {
  lead_id: string
  lead_uuid: string
  customer_id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  loan_type: string
  loan_amount: number
  status: string
  applied_at: string
  last_updated: string
  progress_percentage: number
  assigned_bde_name?: string
}

interface OldCustomer {
  lead_id: string
  lead_uuid: string
  customer_id: string
  customer_name: string
  customer_phone: string
  loan_type: string
  loan_amount: number
  status: string
  closed_at: string
  closure_reason: 'CONVERTED' | 'REJECTED' | 'REFERRAL_CHANGED' | 'CLOSED' | 'OTHER'
}

export async function GET(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      )
    }

    let userId: string
    let referralId: string | null = null

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      userId = payload.sub as string

      // Get referral ID based on user type
      // Check if BP
      const { data: bpData } = await supabase
        .from('business_partner')
        .select('referral_id, is_active')
        .eq('user_id', userId)
        .maybeSingle()

      if (bpData && bpData.is_active) {
        referralId = bpData.referral_id
      } else {
        // Check if CP
        const { data: cpData } = await supabase
          .from('channel_partner')
          .select('referral_id, is_active')
          .eq('user_id', userId)
          .maybeSingle()

        if (cpData && cpData.is_active) {
          referralId = cpData.referral_id
        } else {
          // Check if Employee
          const { data: empData } = await supabase
            .from('employee_profile')
            .select('employee_id, is_active')
            .eq('id', userId)
            .maybeSingle()

          if (empData && empData.is_active) {
            referralId = empData.employee_id
          }
        }
      }

      if (!referralId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Referral ID not found or account inactive',
          },
          { status: 403 }
        )
      }
    } catch (error) {
      apiLogger.error('JWT verification error', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 401 }
      )
    }

    // =====================================================
    // 2. FETCH ACTIVE CUSTOMERS
    // =====================================================

    const { data: activeLeads, error: activeError } = await supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        customer_id,
        customer_customer_id,
        customer_name,
        customer_mobile,
        customer_email,
        loan_type,
        loan_amount,
        lead_status,
        progress_percentage,
        created_at,
        updated_at,
        assigned_bde_id
      `)
      .eq('referral_id', referralId)
      .in('lead_status', ACTIVE_STATUSES)
      .order('updated_at', { ascending: false })

    if (activeError) {
      apiLogger.error('Active leads fetch error', activeError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch active customers',
        },
        { status: 500 }
      )
    }

    // Get BDE names for active leads
    const bdeIds = activeLeads
      ?.map((lead) => lead.assigned_bde_id)
      .filter((id): id is string => id !== null) || []

    let bdeMap: Record<string, string> = {}
    if (bdeIds.length > 0) {
      const { data: bdeData } = await supabase
        .from('employee_profile')
        .select('id, name')
        .in('id', bdeIds)

      if (bdeData) {
        bdeMap = bdeData.reduce((acc, bde) => {
          acc[bde.id] = bde.name
          return acc
        }, {} as Record<string, string>)
      }
    }

    const activeCustomers: ActiveCustomer[] = (activeLeads || []).map((lead) => ({
      lead_id: lead.lead_id,
      lead_uuid: lead.id,
      customer_id: lead.customer_customer_id,
      customer_name: lead.customer_name,
      customer_phone: lead.customer_mobile,
      customer_email: lead.customer_email,
      loan_type: lead.loan_type,
      loan_amount: lead.loan_amount,
      status: lead.lead_status,
      applied_at: lead.created_at,
      last_updated: lead.updated_at,
      progress_percentage: lead.progress_percentage || 0,
      assigned_bde_name: lead.assigned_bde_id ? bdeMap[lead.assigned_bde_id] : undefined,
    }))

    // =====================================================
    // 3. FETCH OLD CUSTOMERS
    // =====================================================

    // Get leads that were previously referred by this referral but are now closed
    // OR leads where referral was changed
    const { data: oldLeads, error: oldError } = await supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        customer_id,
        customer_customer_id,
        customer_name,
        customer_mobile,
        loan_type,
        loan_amount,
        lead_status,
        updated_at
      `)
      .or(`and(referral_id.eq.${referralId},lead_status.in.(${CLOSED_STATUSES.join(',')}))`)
      .order('updated_at', { ascending: false })

    // Also check referral_change_history for leads where referral was changed away from this referral
    const { data: changedLeads, error: changedError } = await supabase
      .from('referral_change_history')
      .select(`
        lead_id,
        new_referral_id,
        changed_at
      `)
      .eq('old_referral_id', referralId)
      .order('changed_at', { ascending: false })

    const changedLeadIds = changedLeads?.map((c) => c.lead_id) || []

    // Fetch details for changed leads
    let changedLeadDetails: any[] = []
    if (changedLeadIds.length > 0) {
      const { data: changedDetails } = await supabase
        .from('leads')
        .select(`
          id,
          lead_id,
          customer_id,
          customer_customer_id,
          customer_name,
          customer_mobile,
          loan_type,
          loan_amount,
          lead_status,
          updated_at
        `)
        .in('id', changedLeadIds)

      changedLeadDetails = changedDetails || []
    }

    // Combine old leads and changed leads
    const combinedOldLeads = [...(oldLeads || []), ...changedLeadDetails]

    const oldCustomers: OldCustomer[] = combinedOldLeads.map((lead) => {
      let closure_reason: OldCustomer['closure_reason'] = 'OTHER'

      if (lead.lead_status === 'SANCTIONED' || lead.lead_status === 'CONVERTED') {
        closure_reason = 'CONVERTED'
      } else if (lead.lead_status === 'REJECTED') {
        closure_reason = 'REJECTED'
      } else if (changedLeadIds.includes(lead.id)) {
        closure_reason = 'REFERRAL_CHANGED'
      } else if (CLOSED_STATUSES.includes(lead.lead_status)) {
        closure_reason = 'CLOSED'
      }

      return {
        lead_id: lead.lead_id,
        lead_uuid: lead.id,
        customer_id: lead.customer_customer_id,
        customer_name: lead.customer_name,
        customer_phone: lead.customer_mobile,
        loan_type: lead.loan_type,
        loan_amount: lead.loan_amount,
        status: lead.lead_status,
        closed_at: lead.updated_at,
        closure_reason,
      }
    })

    // =====================================================
    // 4. RETURN RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      referral_id: referralId,
      active_customers: activeCustomers,
      old_customers: oldCustomers,
      stats: {
        active_count: activeCustomers.length,
        old_count: oldCustomers.length,
        total_referred: activeCustomers.length + oldCustomers.length,
      },
    })
  } catch (error) {
    apiLogger.error('My Customers API Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
