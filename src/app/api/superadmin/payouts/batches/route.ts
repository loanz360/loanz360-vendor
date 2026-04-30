
/**
 * API Route: Payout Batches Management
 * GET /api/superadmin/payouts/batches - List all batches
 * POST /api/superadmin/payouts/batches - Create new batch
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createInAppNotification } from '@/lib/notifications/notification-service'
import { apiLogger } from '@/lib/utils/logger'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'

export interface PayoutBatch {
  id: string
  batch_number: string
  batch_date: string
  partner_type: string
  total_leads: number
  total_amount: number
  status: string
  created_by: string
  created_at: string
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  remarks: string | null
}

export interface BatchesListResponse {
  success: boolean
  data?: PayoutBatch[]
  total?: number
  error?: string
}

export interface CreateBatchRequest {
  lead_ids: string[]
  partner_type: string
  remarks?: string
}

export interface CreateBatchResponse {
  success: boolean
  data?: {
    batch_id: string
    batch_number: string
    total_leads: number
    total_amount: number
  }
  error?: string
}

// GET - List all batches
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// H8 FIX: Use unified auth with consistent role check
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as BatchesListResponse,
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // 3. Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, APPROVED, PAID
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const from = (page - 1) * limit
    const to = from + limit - 1

    // 4. Query batches
    let query = supabase
      .from('payout_batches')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status && status !== 'ALL') {
      query = query.eq('status', status)
    }

    const { data: batches, error: batchesError, count } = await query.range(from, to)

    if (batchesError) {
      apiLogger.error('Error fetching batches', batchesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch batches' } as BatchesListResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: batches || [],
      total: count || 0,
    } as BatchesListResponse)
  } catch (error) {
    apiLogger.error('Get batches error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as BatchesListResponse,
      { status: 500 }
    )
  }
}

// POST - Create new batch
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // 1. Authenticate superadmin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as CreateBatchResponse,
        { status: 401 }
      )
    }

    // 2. Verify superadmin role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Superadmin access required' } as CreateBatchResponse,
        { status: 403 }
      )
    }

    // 3. Parse request body
    const body: CreateBatchRequest = await request.json()
    const { lead_ids, partner_type, remarks } = body

    if (!lead_ids || lead_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leads selected' } as CreateBatchResponse,
        { status: 400 }
      )
    }

    // 4. Verify all leads are CALCULATED status
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, commission_amount, commission_status')
      .in('id', lead_ids)

    if (leadsError) {
      apiLogger.error('Error fetching leads', leadsError)
      return NextResponse.json(
        { success: false, error: 'Failed to verify leads' } as CreateBatchResponse,
        { status: 500 }
      )
    }

    // Check if all leads are in CALCULATED status
    const invalidLeads = leads?.filter(l => l.commission_status !== 'CALCULATED')
    if (invalidLeads && invalidLeads.length > 0) {
      return NextResponse.json(
        { success: false, error: `${invalidLeads.length} leads are not in CALCULATED status` } as CreateBatchResponse,
        { status: 400 }
      )
    }

    // 5. Calculate total amount
    const total_amount = leads?.reduce((sum, l) => sum + (l.commission_amount || 0), 0) || 0

    // 6. Generate batch number using database function
    const { data: batchNumberData, error: batchNumberError } = await supabase
      .rpc('generate_payout_batch_number')
      .maybeSingle()

    if (batchNumberError) {
      apiLogger.error('Error generating batch number', batchNumberError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate batch number' } as CreateBatchResponse,
        { status: 500 }
      )
    }

    const batch_number = batchNumberData || `BATCH-${Date.now()}`

    // 7. Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .insert({
        batch_number,
        batch_date: new Date().toISOString().split('T')[0],
        partner_type,
        total_leads: lead_ids.length,
        total_amount,
        status: 'PENDING',
        created_by: user.id,
        remarks,
      })
      .select()
      .maybeSingle()

    if (batchError) {
      apiLogger.error('Error creating batch', batchError)
      return NextResponse.json(
        { success: false, error: 'Failed to create batch' } as CreateBatchResponse,
        { status: 500 }
      )
    }

    // 8. Update leads with batch_id and change status to APPROVED
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        payout_batch_id: batch.id,
        commission_status: 'APPROVED',
      })
      .in('id', lead_ids)

    if (updateError) {
      apiLogger.error('Error updating leads', updateError)
      // Rollback: delete the batch
      await supabase.from('payout_batches').delete().eq('id', batch.id)
      return NextResponse.json(
        { success: false, error: 'Failed to update leads with batch' } as CreateBatchResponse,
        { status: 500 }
      )
    }

    // 9. Send commission approval notifications to partners (non-blocking)
    const { data: batchLeads } = await supabase
      .from('leads')
      .select('id, partner_id')
      .in('id', lead_ids)

    if (batchLeads) {
      const uniquePartnerIds = [...new Set(batchLeads.map(l => l.partner_id).filter(Boolean))]
      // Look up partner types to route to correct portal URLs
      const { data: partnerTypes } = await supabase
        .from('partners')
        .select('id, partner_type')
        .in('id', uniquePartnerIds as string[])

      const partnerTypeMap = new Map(partnerTypes?.map(p => [p.id, p.partner_type]) || [])
      const typeToPath: Record<string, string> = {
        'BUSINESS_ASSOCIATE': '/partners/ba/payout-status',
        'BUSINESS_PARTNER': '/partners/bp/payout-status',
        'CHANNEL_PARTNER': '/partners/cp/payout-status',
      }

      for (const partnerId of uniquePartnerIds) {
        const pType = partnerTypeMap.get(partnerId as string) || 'BUSINESS_ASSOCIATE'
        createInAppNotification({
          adminId: partnerId as string,
          type: 'success',
          category: 'payouts',
          title: 'Commission Approved',
          message: `Your commission has been approved in batch ${batch.batch_number}. Payment will be processed soon.`,
          actionUrl: typeToPath[pType] || '/partners/ba/payout-status',
          actionLabel: 'View Payout',
          icon: '💰',
          metadata: { batch_id: batch.id, batch_number: batch.batch_number },
        }).catch(error => {
          apiLogger.error('Failed to send commission approval notification', error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        batch_id: batch.id,
        batch_number: batch.batch_number,
        total_leads: lead_ids.length,
        total_amount,
      },
    } as CreateBatchResponse)
  } catch (error) {
    apiLogger.error('Create batch error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as CreateBatchResponse,
      { status: 500 }
    )
  }
}
