/**
 * Admin Leads List API
 * Fetches all leads with filtering, search, and pagination
 * Super Admin access only
 *
 * Rate Limit: 60 requests per minute
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


interface Lead {
  id: string
  lead_id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  customer_email: string
  loan_type: string
  loan_amount: number
  status: string
  form_status: string
  progress_percentage: number
  referral_id: string
  referral_name: string
  referral_type: string
  assigned_bde_id: string | null
  assigned_bde_name: string | null
  commission_amount: number | null
  commission_status: string | null
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getAdminLeadsHandler(req)
  })
}

async function getAdminLeadsHandler(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION (UNIFIED)
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Super Admin access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // =====================================================
    // 2. GET QUERY PARAMETERS WITH VALIDATION
    // =====================================================

    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') || 'ACTIVE'
    const loanType = searchParams.get('loan_type') || 'all'
    const referralType = searchParams.get('referral_type') || 'all'
    const search = searchParams.get('search') || ''

    // Validate and sanitize pagination parameters
    let page = parseInt(searchParams.get('page') || '1')
    let limit = parseInt(searchParams.get('limit') || '50')

    if (isNaN(page) || page < 1) page = 1
    if (isNaN(limit) || limit < 1) limit = 50
    if (limit > 100) limit = 100 // Maximum 100 items per page to prevent DoS

    // =====================================================
    // 3. BUILD QUERY CONDITIONS
    // =====================================================

    let query = supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        loan_type,
        loan_amount,
        lead_status,
        form_status,
        progress_percentage,
        referral_id,
        partner_type,
        assigned_bde_id,
        commission_amount,
        commission_status,
        created_at,
        updated_at
      `, { count: 'exact' })

    // Status filter: ACTIVE or CLOSED
    if (status === 'ACTIVE') {
      query = query.in('lead_status', [
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
      ])
    } else if (status === 'CLOSED') {
      query = query.in('lead_status', [
        'APPROVED',
        'SANCTIONED',
        'REJECTED',
        'CLOSED',
        'CANCELLED',
        'CUSTOMER_DROPPED',
      ])
    }

    // Loan type filter
    if (loanType && loanType !== 'all') {
      query = query.eq('loan_type', loanType)
    }

    // Referral type filter
    if (referralType && referralType !== 'all') {
      if (referralType === 'CUSTOMER') {
        query = query.eq('referral_id', 'LOANZ360')
      } else {
        query = query.eq('partner_type', referralType)
      }
    }

    // Search filter with SQL injection prevention
    if (search) {
      // Sanitize search input - remove special characters that could be used for SQL injection
      const sanitizedSearch = search.replace(/[%_'";\\]/g, '')
      query = query.or(`lead_id.ilike.%${sanitizedSearch}%,customer_name.ilike.%${sanitizedSearch}%,customer_phone.ilike.%${sanitizedSearch}%,customer_email.ilike.%${sanitizedSearch}%`)
    }

    // Pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    // Order by
    query = query.order('created_at', { ascending: false })

    // =====================================================
    // 4. EXECUTE QUERY
    // =====================================================

    const { data: leads, error: leadsError, count } = await query

    if (leadsError) {
      apiLogger.error('Leads fetch error', leadsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch leads',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 5. ENRICH LEADS WITH REFERRAL AND BDE NAMES (OPTIMIZED - BATCH QUERIES)
    // =====================================================

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        leads: [],
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0,
        },
        filters: {
          status,
          loan_type: loanType,
          referral_type: referralType,
          search,
        },
      })
    }

    // Collect all unique IDs for batch fetching
    const referralIdsByType: Record<string, Set<string>> = {
      BA: new Set(),
      BP: new Set(),
      CP: new Set(),
      EMPLOYEE: new Set()
    }
    const bdeIds = new Set<string>()
    const customerIds = new Set<string>()

    for (const lead of leads) {
      if (lead.referral_id && lead.referral_id !== 'LOANZ360' && lead.partner_type) {
        referralIdsByType[lead.partner_type]?.add(lead.referral_id)
      }
      if (lead.assigned_bde_id) {
        bdeIds.add(lead.assigned_bde_id)
      }
      if (lead.customer_id) {
        customerIds.add(lead.customer_id)
      }
    }

    // Batch fetch all referral names
    const referralNames: Record<string, string> = {}

    if (referralIdsByType.BA.size > 0) {
      const { data: baData } = await supabase
        .from('business_associate')
        .select('referral_id, name')
        .in('referral_id', Array.from(referralIdsByType.BA))

      if (baData) {
        baData.forEach(ba => {
          referralNames[ba.referral_id] = ba.name
        })
      }
    }

    if (referralIdsByType.BP.size > 0) {
      const { data: bpData } = await supabase
        .from('business_partner')
        .select('referral_id, name')
        .in('referral_id', Array.from(referralIdsByType.BP))

      if (bpData) {
        bpData.forEach(bp => {
          referralNames[bp.referral_id] = bp.name
        })
      }
    }

    if (referralIdsByType.CP.size > 0) {
      const { data: cpData } = await supabase
        .from('channel_partner')
        .select('referral_id, name')
        .in('referral_id', Array.from(referralIdsByType.CP))

      if (cpData) {
        cpData.forEach(cp => {
          referralNames[cp.referral_id] = cp.name
        })
      }
    }

    if (referralIdsByType.EMPLOYEE.size > 0) {
      const { data: empData } = await supabase
        .from('employee_profile')
        .select('employee_id, name')
        .in('employee_id', Array.from(referralIdsByType.EMPLOYEE))

      if (empData) {
        empData.forEach(emp => {
          referralNames[emp.employee_id] = emp.name
        })
      }
    }

    // Batch fetch all BDE names
    const bdeNames: Record<string, string> = {}
    if (bdeIds.size > 0) {
      const { data: bdeData } = await supabase
        .from('employee_profile')
        .select('id, name')
        .in('id', Array.from(bdeIds))

      if (bdeData) {
        bdeData.forEach(bde => {
          bdeNames[bde.id] = bde.name
        })
      }
    }

    // Batch fetch all customer IDs
    const customerIdMap: Record<string, string> = {}
    if (customerIds.size > 0) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, customer_id')
        .in('id', Array.from(customerIds))

      if (customerData) {
        customerData.forEach(customer => {
          customerIdMap[customer.id] = customer.customer_id
        })
      }
    }

    // Build enriched leads array
    const enrichedLeads: Lead[] = leads.map(lead => {
      let referralName = 'LOANZ360 (Direct)'
      let referralType = 'CUSTOMER'

      if (lead.referral_id && lead.referral_id !== 'LOANZ360') {
        referralType = lead.partner_type
        referralName = referralNames[lead.referral_id] || referralName
      }

      return {
        id: lead.id,
        lead_id: lead.lead_id,
        customer_id: customerIdMap[lead.customer_id] || lead.customer_id,
        customer_name: lead.customer_name,
        customer_phone: lead.customer_phone,
        customer_email: lead.customer_email,
        loan_type: lead.loan_type,
        loan_amount: lead.loan_amount,
        status: lead.lead_status,
        form_status: lead.form_status,
        progress_percentage: lead.progress_percentage || 0,
        referral_id: lead.referral_id,
        referral_name: referralName,
        referral_type: referralType,
        assigned_bde_id: lead.assigned_bde_id,
        assigned_bde_name: lead.assigned_bde_id ? bdeNames[lead.assigned_bde_id] || null : null,
        commission_amount: lead.commission_amount,
        commission_status: lead.commission_status,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      }
    })

    // =====================================================
    // 6. RETURN RESPONSE WITH PAGINATION
    // =====================================================

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      leads: enrichedLeads,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: totalPages,
      },
      filters: {
        status,
        loan_type: loanType,
        referral_type: referralType,
        search,
      },
    })
  } catch (error) {
    apiLogger.error('Admin Leads List API Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
