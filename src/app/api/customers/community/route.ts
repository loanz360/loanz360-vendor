import { parseBody } from '@/lib/utils/parse-body'
/**
 * Customer Community Stories API
 * CRUD for customer_community_stories + likes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mine = searchParams.get('mine') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const offset = (page - 1) * limit

    let query = supabase
      .from('customer_community_stories')
      .select('*', { count: 'exact' })

    if (mine) {
      query = query.eq('user_id', user.id)
    } else {
      query = query.eq('is_published', true)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: stories, error, count } = await query

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })

    // Get user's likes for these stories
    const storyIds = (stories || []).map((s) => s.id)
    let userLikes: string[] = []
    if (storyIds.length > 0) {
      const { data: likes } = await supabase
        .from('customer_community_likes')
        .select('story_id')
        .eq('user_id', user.id)
        .in('story_id', storyIds)

      userLikes = (likes || []).map((l) => l.story_id)
    }

    const enriched = (stories || []).map((s) => ({
      ...s,
      user_has_liked: userLikes.includes(s.id),
    }))

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { action } = body

    if (action === 'like') {
      const { story_id } = body
      if (!story_id) return NextResponse.json({ success: false, error: 'story_id is required' }, { status: 400 })

      // Check if already liked
      const { data: existing } = await supabase
        .from('customer_community_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('story_id', story_id)
        .maybeSingle()

      if (existing) {
        // Unlike
        await supabase
          .from('customer_community_likes')
          .delete()
          .eq('id', existing.id)

        return NextResponse.json({ success: true, data: { liked: false } })
      } else {
        // Like
        await supabase
          .from('customer_community_likes')
          .insert({ user_id: user.id, story_id })

        return NextResponse.json({ success: true, data: { liked: true } })
      }
    }

    // Create story
    const { author_name, loan_type, amount, story, rating, location } = body
    if (!author_name || !loan_type || !amount || !story) {
      return NextResponse.json({ success: false, error: 'author_name, loan_type, amount, and story are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('customer_community_stories')
      .insert({
        user_id: user.id,
        author_name,
        loan_type,
        amount,
        story,
        rating: rating || null,
        location: location || null,
        is_published: false, // Needs admin approval
      })
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })

    const allowed: Record<string, unknown> = {}
    for (const key of ['story', 'rating', 'loan_type', 'amount', 'location']) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }

    const { data, error } = await supabase
      .from('customer_community_stories')
      .update(allowed)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })

    const { error } = await supabase
      .from('customer_community_stories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
