import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { csrfProtection } from '@/lib/middleware/csrf'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

const shareOfferSchema = z.object({
  offer_id: z.string().uuid('Invalid offer ID'),
  share_method: z.enum(['whatsapp', 'sms', 'email', 'copy']),
  recipient: z.string().optional(),
  lead_id: z.string().uuid().optional(),
  customer_name: z.string().optional(),
  notes: z.string().max(500).optional()
})

/**
 * POST - Record offer share by CRO
 * Tracks when a CRO shares an offer with a customer/lead
 */
export async function POST(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  // Apply rate limiting - 30 shares per minute
  const rateLimitResponse = await rateLimit(request, {
    limit: 30,
    window: 60
  })
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Role verification via DB lookup - only CRO roles can access this endpoint
  const { data: userDataPost } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', user.id)
    .maybeSingle()

  const userRolePost = (userDataPost?.sub_role || userDataPost?.role || '').toUpperCase().trim()
  const allowedRolesPost = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
  if (!allowedRolesPost.some(r => userRolePost === r)) {
    return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
  }

  try {
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = shareOfferSchema.parse(body)

    // Verify offer exists and is active
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('id, offer_title, rolled_out_by, status')
      .eq('id', validatedData.offer_id)
      .maybeSingle()

    if (offerError || !offer) {
      return NextResponse.json({ success: false, error: 'Offer not found' }, { status: 404 })
    }

    if (offer.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Cannot share inactive offer' }, { status: 400 })
    }

    // Record the share
    const { data: shareRecord, error: shareError } = await supabase
      .from('offer_shares')
      .insert({
        offer_id: validatedData.offer_id,
        shared_by: user.id,
        share_method: validatedData.share_method,
        recipient: validatedData.recipient || null,
        lead_id: validatedData.lead_id || null,
        customer_name: validatedData.customer_name || null,
        notes: validatedData.notes || null,
        shared_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (shareError) throw shareError

    // If lead_id is provided, create attribution record
    if (validatedData.lead_id) {
      await supabase
        .from('offer_lead_attribution')
        .insert({
          offer_id: validatedData.offer_id,
          lead_id: validatedData.lead_id,
          cro_id: user.id,
          attributed_at: new Date().toISOString(),
          converted: false
        })
        .select()
    }

    return NextResponse.json({
      success: true,
      share: shareRecord,
      message: 'Offer shared successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues.map((err: z.ZodIssue) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    apiLogger.error('Error recording offer share', error)
    logApiError(error as Error, request, { action: 'share_offer' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET - Get CRO's share history
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, {
    limit: 60,
    window: 60
  })
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Role verification via DB lookup - only CRO roles can access this endpoint
  const { data: userDataGet } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', user.id)
    .maybeSingle()

  const userRole = (userDataGet?.sub_role || userDataGet?.role || '').toUpperCase().trim()
  const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
  if (!allowedRoles.some(r => userRole === r)) {
    return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const offerId = searchParams.get('offer_id')

    let query = supabase
      .from('offer_shares')
      .select(`
        *,
        offers (
          offer_title,
          rolled_out_by,
          offer_image_url
        ),
        leads (
          customer_name,
          phone,
          email
        )
      `, { count: 'exact' })
      .eq('shared_by', user.id)
      .order('shared_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (offerId) {
      query = query.eq('offer_id', offerId)
    }

    const { data: shares, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      shares: shares || [],
      total: count || 0,
      limit,
      offset
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching share history', error)
    logApiError(error as Error, request, { action: 'get_share_history' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
