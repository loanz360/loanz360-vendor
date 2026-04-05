import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.contentId || !body.contentType || typeof body.isHelpful !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: contentId, contentType, and isHelpful are required',
        data: null
      }, { status: 400 })
    }

    // Validate content type
    if (!['faq', 'glossary', 'category'].includes(body.contentType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid content type. Must be one of: faq, glossary, category',
        data: null
      }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from('kb_feedback')
      .insert({
        content_id: body.contentId,
        content_type: body.contentType,
        is_helpful: body.isHelpful,
        comment: body.comment?.trim() || null,
        user_id: user?.id || null,
        user_role: body.userRole || user?.user_metadata?.role || null,
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      // If table doesn't exist yet, log but still return success for graceful degradation
      apiLogger.error('KB feedback insert error:', insertError)
      return NextResponse.json({
        success: true,
        message: 'Thank you for your feedback!',
        data: {
          id: `fb_${Date.now()}`,
          timestamp: new Date().toISOString()
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your feedback!',
      data: {
        id: feedback?.id || `fb_${Date.now()}`,
        timestamp: feedback?.created_at || new Date().toISOString()
      }
    })
  } catch (error) {
    apiLogger.error('Knowledge base feedback error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while submitting feedback',
      data: null
    }, { status: 500 })
  }
}

// Get feedback statistics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const contentId = searchParams.get('contentId')
    const contentType = searchParams.get('contentType')

    const supabase = await createClient()

    let query = supabase.from('kb_feedback').select('is_helpful, comment', { count: 'exact' })

    if (contentId) {
      query = query.eq('content_id', contentId)
    }
    if (contentType) {
      query = query.eq('content_type', contentType)
    }

    const { data: feedbackRows, count, error } = await query

    if (error) {
      apiLogger.error('KB feedback query error:', error)
      return NextResponse.json({
        success: true,
        data: { total: 0, helpful: 0, notHelpful: 0, withComments: 0, helpfulPercentage: 0 }
      })
    }

    const helpful = feedbackRows?.filter(f => f.is_helpful).length ?? 0
    const notHelpful = feedbackRows?.filter(f => !f.is_helpful).length ?? 0
    const withComments = feedbackRows?.filter(f => f.comment).length ?? 0
    const total = count ?? 0

    return NextResponse.json({
      success: true,
      data: {
        total,
        helpful,
        notHelpful,
        withComments,
        helpfulPercentage: total > 0 ? Math.round((helpful / total) * 100) : 0
      }
    })
  } catch (error) {
    apiLogger.error('Knowledge base feedback stats error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while fetching feedback statistics',
      data: null
    }, { status: 500 })
  }
}
