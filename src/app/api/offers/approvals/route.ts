export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logger } from '@/lib/utils/logger'
import {
  sendApprovalNotification,
  sendRejectionNotification
} from '@/lib/services/offer-notifications'

interface ApprovalItem {
  days_pending: number
  offer_id: string
  offer_title: string
  submitted_by: string
}

/**
 * GET - Get Pending Approvals
 * Returns offers pending approval for the authenticated user
 *
 * Query Parameters:
 * @param limit - Results per page (default: 20, max: 100)
 * @param offset - Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get pending approvals for this user
    const { data, error } = await supabase.rpc('get_pending_approvals', {
      p_user_id: user.id,
      p_limit: limit,
      p_offset: offset
    })

    if (error) throw error

    // Get approval statistics with proper typing
    const typedData = (data || []) as ApprovalItem[]
    const stats = {
      total_pending: typedData.length,
      urgent_count: typedData.filter((a) => a.days_pending > 3).length,
      overdue_count: typedData.filter((a) => a.days_pending > 7).length
    }

    return NextResponse.json({
      success: true,
      pending_approvals: data || [],
      count: data?.length || 0,
      stats,
      pagination: {
        limit,
        offset,
        has_more: (data?.length || 0) === limit
      }
    })

  } catch (error: unknown) {
    logger.error('Error fetching pending approvals', error as Error)
    logApiError(error as Error, request, { action: 'get_pending_approvals' })
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending approvals'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * POST - Submit Offer for Approval or Approve/Reject Offer
 *
 * Action: 'submit' | 'approve' | 'reject'
 *
 * Body for Submit:
 * @param action - 'submit'
 * @param offer_id - UUID of offer to submit
 * @param comments - Optional submission comments
 *
 * Body for Approve:
 * @param action - 'approve'
 * @param offer_id - UUID of offer to approve
 * @param comments - Optional approval comments
 *
 * Body for Reject:
 * @param action - 'reject'
 * @param offer_id - UUID of offer to reject
 * @param rejection_reason - Required rejection reason
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, offer_id, comments, rejection_reason } = body

    if (!action || !offer_id) {
      return NextResponse.json(
        { error: 'action and offer_id are required' },
        { status: 400 }
      )
    }

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    switch (action) {
      case 'submit': {
        // Submit offer for approval
        const { data, error } = await supabase.rpc('submit_offer_for_approval', {
          p_offer_id: offer_id,
          p_submitted_by: user.id,
          p_comments: comments || null
        })

        if (error) throw error

        return NextResponse.json({
          success: true,
          ...data,
          user_name: userData.full_name
        })
      }

      case 'approve': {
        // Check if user has permission
        if (!['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
          return NextResponse.json(
            { error: 'Only admins can approve offers' },
            { status: 403 }
          )
        }

        // Get offer details for notification
        const { data: offerData } = await supabase
          .from('offers')
          .select('offer_title, created_by')
          .eq('id', offer_id)
          .maybeSingle()

        // Approve offer
        const { data, error } = await supabase.rpc('approve_offer', {
          p_offer_id: offer_id,
          p_approver_id: user.id,
          p_comments: comments || null
        })

        if (error) throw error

        // Send notification to submitter
        if (offerData?.created_by) {
          sendApprovalNotification(
            offer_id,
            offerData.offer_title || 'Offer',
            offerData.created_by,
            user.id
          ).catch((notifError) => {
            // Log but don't fail the approval if notification fails
            logger.warn('Failed to send approval notification', { error: notifError })
          })
        }

        return NextResponse.json({
          success: true,
          ...data,
          approver_name: userData.full_name,
          approver_role: userData.role
        })
      }

      case 'reject': {
        // Check if user has permission
        if (!['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
          return NextResponse.json(
            { error: 'Only admins can reject offers' },
            { status: 403 }
          )
        }

        if (!rejection_reason) {
          return NextResponse.json(
            { error: 'rejection_reason is required' },
            { status: 400 }
          )
        }

        // Get offer details for notification
        const { data: offerDataReject } = await supabase
          .from('offers')
          .select('offer_title, created_by')
          .eq('id', offer_id)
          .maybeSingle()

        // Reject offer
        const { data, error } = await supabase.rpc('reject_offer', {
          p_offer_id: offer_id,
          p_approver_id: user.id,
          p_rejection_reason: rejection_reason
        })

        if (error) throw error

        // Send rejection notification to submitter
        if (offerDataReject?.created_by) {
          sendRejectionNotification(
            offer_id,
            offerDataReject.offer_title || 'Offer',
            offerDataReject.created_by,
            user.id,
            rejection_reason
          ).catch((notifError) => {
            // Log but don't fail the rejection if notification fails
            logger.warn('Failed to send rejection notification', { error: notifError })
          })
        }

        return NextResponse.json({
          success: true,
          ...data,
          approver_name: userData.full_name,
          approver_role: userData.role
        })
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error: unknown) {
    logger.error('Error processing approval action', error as Error)
    logApiError(error as Error, request, { action: 'approval_action' })
    const errorMessage = error instanceof Error ? error.message : 'Failed to process approval action'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * GET (with offer_id) - Get Approval History for Specific Offer
 * Returns complete approval history for an offer
 *
 * Query Parameters:
 * @param offer_id - UUID of offer
 */
export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const offerId = searchParams.get('offer_id')

    if (!offerId) {
      return NextResponse.json(
        { error: 'offer_id is required' },
        { status: 400 }
      )
    }

    // Get approval history
    const { data, error } = await supabase.rpc('get_approval_history', {
      p_offer_id: offerId
    })

    if (error) throw error

    // Get current offer approval status
    const { data: offer } = await supabase
      .from('offers')
      .select(`
        approval_status,
        current_approval_level,
        approval_level_required,
        submitted_for_approval_at,
        final_approved_at,
        rejected_at,
        rejection_reason
      `)
      .eq('id', offerId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      history: data || [],
      current_status: offer || {},
      timeline: {
        submitted_at: offer?.submitted_for_approval_at,
        approved_at: offer?.final_approved_at,
        rejected_at: offer?.rejected_at,
        total_steps: data?.length || 0
      }
    })

  } catch (error: unknown) {
    logger.error('Error fetching approval history', error as Error)
    logApiError(error as Error, request, { action: 'get_approval_history' })
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch approval history'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
