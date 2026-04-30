
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const unreadOnly = searchParams.get('unread') === 'true'
    const insightType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '10')

    let query = supabase
      .from('tele_sales_ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (insightType) {
      query = query.eq('insight_type', insightType)
    }

    const { data: insights, error } = await query

    if (error) {
      apiLogger.error('Error fetching AI insights', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch AI insights' }, { status: 500 })
    }

    return NextResponse.json(insights || [])
  } catch (error) {
    apiLogger.error('Error fetching AI insights', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch AI insights' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const { data, error } = await supabase
      .from('tele_sales_ai_insights')
      .insert({
        user_id: user.id,
        insight_type: body.insight_type,
        title: body.title,
        description: body.description,
        recommendation: body.recommendation,
        priority: body.priority || 'medium',
        data_points: body.data_points || {},
        is_read: false,
        is_actionable: body.is_actionable || true,
        action_url: body.action_url,
        expires_at: body.expires_at
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating AI insight', error)
      return NextResponse.json({ success: false, error: 'Failed to create AI insight' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    apiLogger.error('Error creating AI insight', error)
    return NextResponse.json({ success: false, error: 'Failed to create AI insight' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, is_read, is_dismissed } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Insight ID is required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (typeof is_read === 'boolean') updateData.is_read = is_read
    if (typeof is_dismissed === 'boolean') updateData.is_dismissed = is_dismissed

    const { data, error } = await supabase
      .from('tele_sales_ai_insights')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating AI insight', error)
      return NextResponse.json({ success: false, error: 'Failed to update AI insight' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    apiLogger.error('Error updating AI insight', error)
    return NextResponse.json({ success: false, error: 'Failed to update AI insight' }, { status: 500 })
  }
}
