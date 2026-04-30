import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { validatePagination } from '@/lib/validations/dse-validation'


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Validation schema for creating an update
const updateSchema = z.object({
  notes: z.string().min(1, 'Notes are required').max(5000),
  activity_type: z.enum([
    'customer_call', 'bank_visit', 'document_collection', 'document_submission',
    'internal_review', 'customer_meeting', 'banker_meeting', 'verification_call',
    'follow_up', 'status_check', 'other'
  ]).default('follow_up'),
  interaction_with: z.string().max(255).optional().nullable(),
  interaction_mode: z.string().max(100).optional().nullable(),
  customer_response: z.string().max(2000).optional().nullable(),
  next_action: z.string().max(1000).optional().nullable(),
  next_action_date: z.string().optional().nullable(),
})

/**
 * Helper to verify the DSE owns this deal
 */
async function verifyDealOwnership(supabase: unknown, dealId: string, userId: string) {
  const { data: deal, error } = await supabase
    .from('crm_deals')
    .select('id, stage, status')
    .eq('id', dealId)
    .eq('source_employee_id', userId)
    .eq('source_type', 'dse')
    .maybeSingle()

  return { deal, error }
}

/**
 * GET - Fetch updates for a deal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { dealId } = await params

    if (!UUID_REGEX.test(dealId)) {
      return NextResponse.json({ success: false, error: 'Invalid deal ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    // Verify deal ownership
    const { deal, error: dealError } = await verifyDealOwnership(supabase, dealId, user.id)
    if (dealError) {
      apiLogger.error('Error verifying deal ownership', dealError)
      return NextResponse.json({ success: false, error: 'Failed to verify deal access' }, { status: 500 })
    }
    if (!deal) {
      return NextResponse.json({ success: false, error: 'Deal not found or access denied' }, { status: 404 })
    }

    // Parse pagination
    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = validatePagination(searchParams.get('page'), searchParams.get('limit'))

    // Fetch updates
    const { data: updates, error: updatesError, count } = await supabase
      .from('deal_updates')
      .select(`
        id,
        bde_id,
        stage_at_update,
        status_at_update,
        stage_changed_to,
        status_changed_to,
        notes_original,
        notes_translated,
        original_language,
        target_language,
        activity_type,
        activity_description,
        interaction_with,
        interaction_mode,
        interaction_summary,
        customer_response,
        banker_feedback,
        pending_items,
        next_action,
        next_action_date,
        attachments,
        update_source,
        is_overdue,
        hours_since_last_update,
        created_at
      `, { count: 'exact' })
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (updatesError) {
      apiLogger.error('Error fetching deal updates', updatesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch updates' }, { status: 500 })
    }

    // Fetch BDE names
    const bdeIds = [...new Set((updates?.map(u => u.bde_id) || []).filter(Boolean))]
    let bdeMap: Record<string, string> = {}
    if (bdeIds.length > 0) {
      const { data: bdes } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', bdeIds)

      if (bdes) {
        bdeMap = bdes.reduce((acc: Record<string, string>, bde: { id: string; full_name: string }) => {
          acc[bde.id] = bde.full_name
          return acc
        }, {} as Record<string, string>)
      }
    }

    const formattedUpdates = updates?.map(update => ({
      ...update,
      bde_name: (update.bde_id && bdeMap[update.bde_id]) || 'Unknown'
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        updates: formattedUpdates,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
          has_more: offset + limit < (count || 0)
        }
      }
    })

  } catch (error) {
    apiLogger.error('Error in deal updates GET', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Submit a progress update for a deal (as DSE)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const { dealId } = await params

    if (!UUID_REGEX.test(dealId)) {
      return NextResponse.json({ success: false, error: 'Invalid deal ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    // Verify deal ownership
    const { deal, error: dealError } = await verifyDealOwnership(supabase, dealId, user.id)
    if (dealError) {
      apiLogger.error('Error verifying deal ownership', dealError)
      return NextResponse.json({ success: false, error: 'Failed to verify deal access' }, { status: 500 })
    }
    if (!deal) {
      return NextResponse.json({ success: false, error: 'Deal not found or access denied' }, { status: 404 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = updateSchema.parse(body)

    // Insert the update into deal_updates
    const { data: update, error: insertError } = await supabase
      .from('deal_updates')
      .insert({
        deal_id: dealId,
        bde_id: user.id,
        stage_at_update: deal.stage,
        status_at_update: deal.status,
        notes_original: validatedData.notes,
        original_language: 'en',
        activity_type: validatedData.activity_type,
        interaction_with: validatedData.interaction_with || null,
        interaction_mode: validatedData.interaction_mode || null,
        customer_response: validatedData.customer_response || null,
        next_action: validatedData.next_action || null,
        next_action_date: validatedData.next_action_date || null,
        update_source: 'dse_portal',
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error inserting deal update', insertError)
      return NextResponse.json({ success: false, error: 'Failed to submit update' }, { status: 500 })
    }

    if (!update) {
      return NextResponse.json({ success: false, error: 'Failed to create update' }, { status: 500 })
    }

    // Update the deal's last_updated_by_bde_at timestamp
    const { error: dealUpdateError } = await supabase
      .from('crm_deals')
      .update({ last_updated_by_bde_at: new Date().toISOString() })
      .eq('id', dealId)

    if (dealUpdateError) {
      apiLogger.error('Error updating deal timestamp', dealUpdateError)
      // Non-critical, don't fail the request
    }

    return NextResponse.json({
      success: true,
      data: update,
      message: 'Update submitted successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    apiLogger.error('Error in deal updates POST', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
