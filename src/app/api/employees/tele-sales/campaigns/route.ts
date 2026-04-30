import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get campaigns
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const status = searchParams.get('status')
    const campaign_id = searchParams.get('id')

    // Get single campaign
    if (campaign_id) {
      const { data: campaign, error } = await supabase
        .from('ts_campaigns')
        .select('*')
        .eq('id', campaign_id)
        .maybeSingle()

      if (error) throw error

      // Get campaign stats
      const { data: leadStats } = await supabase
        .from('ts_campaign_leads')
        .select('status, final_outcome')
        .eq('campaign_id', campaign_id)

      const statusCounts: Record<string, number> = {}
      let conversions = 0
      leadStats?.forEach(lead => {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1
        if (lead.final_outcome === 'CONVERTED') conversions++
      })

      return NextResponse.json({
        success: true,
        data: {
          campaign,
          stats: {
            total_leads: leadStats?.length || 0,
            by_status: statusCounts,
            conversions,
            conversion_rate: leadStats && leadStats.length > 0
              ? Math.round((conversions / leadStats.length) * 100 * 10) / 10
              : 0
          }
        }
      })
    }

    // Get all campaigns
    let query = supabase
      .from('ts_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['ACTIVE', 'PAUSED', 'APPROVED'])
    }

    const { data: campaigns, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: campaigns || []
    })
  } catch (error) {
    apiLogger.error('Get campaigns error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

// POST - Create campaign (admin only in production)
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema = z.object({

      name: z.string(),

      description: z.string().optional(),

      campaign_type: z.string().optional().default('OUTBOUND'),

      product_type: z.string().optional(),

      target_segment: z.string().optional(),

      start_date: z.string().optional(),

      end_date: z.string().optional(),

      calling_hours_start: z.string().optional().default('09:00'),

      calling_hours_end: z.string().optional().default('18:00'),

      calling_days: z.string().optional(),

      2: z.string().optional(),

      3: z.string().optional(),

      4: z.string().optional(),

      total_leads_target: z.string().optional(),

      daily_calls_target: z.string().optional(),

      conversion_target_percentage: z.string().optional(),

      script_id: z.string().uuid().optional(),

      max_attempts_per_lead: z.number().optional().default(5),

      requires_consent: z.boolean().optional().default(true),

      campaign_id: z.string().uuid(),

      action: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const {
      name,
      description,
      campaign_type = 'OUTBOUND',
      product_type,
      target_segment,
      start_date,
      end_date,
      calling_hours_start = '09:00',
      calling_hours_end = '18:00',
      calling_days = [1, 2, 3, 4, 5],
      total_leads_target,
      daily_calls_target,
      conversion_target_percentage,
      script_id,
      max_attempts_per_lead = 5,
      requires_consent = true
    } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Campaign name is required'
      }, { status: 400 })
    }

    const { data: campaign, error } = await supabase
      .from('ts_campaigns')
      .insert({
        name,
        description,
        campaign_type,
        product_type,
        target_segment,
        start_date,
        end_date,
        calling_hours_start,
        calling_hours_end,
        calling_days,
        total_leads_target,
        daily_calls_target,
        conversion_target_percentage,
        script_id,
        max_attempts_per_lead,
        requires_consent,
        status: 'DRAFT',
        created_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: campaign
    })
  } catch (error) {
    apiLogger.error('Create campaign error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}

// PUT - Update campaign
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema2 = z.object({

      action: z.string().optional(),

      campaign_id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { campaign_id, action, ...updates } = body

    if (!campaign_id) {
      return NextResponse.json({
        success: false,
        error: 'Campaign ID is required'
      }, { status: 400 })
    }

    let updateData: any = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'ACTIVATE':
        updateData.status = 'ACTIVE'
        break
      case 'PAUSE':
        updateData.status = 'PAUSED'
        break
      case 'COMPLETE':
        updateData.status = 'COMPLETED'
        break
      case 'CANCEL':
        updateData.status = 'CANCELLED'
        break
      default:
        Object.assign(updateData, updates)
    }

    const { data: campaign, error } = await supabase
      .from('ts_campaigns')
      .update(updateData)
      .eq('id', campaign_id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: campaign
    })
  } catch (error) {
    apiLogger.error('Update campaign error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}
