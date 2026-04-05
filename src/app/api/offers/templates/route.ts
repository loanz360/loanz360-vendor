export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET - Fetch offer templates
 * Query params:
 *   - category: Filter by category (optional)
 *   - popular: Get popular templates (optional, boolean)
 *   - limit: Number of templates (optional, default 50)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const popular = searchParams.get('popular') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (popular) {
      // Get popular templates using SQL function
      const { data, error } = await supabase.rpc('get_popular_templates', {
        limit_count: limit
      })

      if (error) throw error

      return NextResponse.json({
        templates: data || [],
        count: data?.length || 0
      })
    } else if (category) {
      // Get templates by category
      const { data, error } = await supabase.rpc('get_templates_by_category', {
        p_category: category
      })

      if (error) throw error

      return NextResponse.json({
        templates: data || [],
        count: data?.length || 0,
        category
      })
    } else {
      // Get all templates
      const { data, error, count } = await supabase
        .from('offer_templates')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .order('template_name', { ascending: true })
        .limit(limit)

      if (error) throw error

      return NextResponse.json({
        templates: data || [],
        count: count || 0
      })
    }
  } catch (error: unknown) {
    apiLogger.error('Error fetching templates', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create offer from template
 * Body:
 *   - template_id: UUID
 *   - bank_name: string
 *   - overrides: object (optional)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { template_id, bank_name, overrides = {} } = body

    if (!template_id || !bank_name) {
      return NextResponse.json(
        { error: 'Missing required fields: template_id, bank_name' },
        { status: 400 }
      )
    }

    // Call SQL function to create offer from template
    const { data, error } = await supabase.rpc('create_offer_from_template', {
      p_template_id: template_id,
      p_user_id: user.id,
      p_bank_name: bank_name,
      p_overrides: overrides
    })

    if (error) throw error

    // Fetch the created offer
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', data)
      .maybeSingle()

    if (offerError) throw offerError

    return NextResponse.json({
      success: true,
      offer,
      message: 'Offer created from template successfully'
    }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error creating offer from template', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
