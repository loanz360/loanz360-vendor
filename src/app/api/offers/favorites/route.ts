import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET - Get User's Favorites
 * Returns all favorited offers for the authenticated user
 *
 * Query Parameters:
 * @param collection - Filter by collection name (optional)
 * @param starred - Show only starred favorites (optional)
 * @param limit - Results per page (default: 50, max: 200)
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
    const collection = searchParams.get('collection')
    const starredOnly = searchParams.get('starred') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get favorites using SQL function
    const { data, error } = await supabase.rpc('get_user_favorites', {
      p_user_id: user.id,
      p_collection_name: collection,
      p_starred_only: starredOnly,
      p_limit: limit,
      p_offset: offset
    })

    if (error) throw error

    // Get collections summary
    const { data: collections } = await supabase.rpc('get_user_collections', {
      p_user_id: user.id
    })

    return NextResponse.json({
      success: true,
      favorites: data || [],
      count: data?.length || 0,
      collections: collections || [],
      pagination: {
        limit,
        offset,
        has_more: (data?.length || 0) === limit
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching favorites', error)
    logApiError(error as Error, request, { action: 'get_favorites' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Add to Favorites
 * Adds an offer to user's favorites
 *
 * Body:
 * @param offer_id - UUID of the offer to favorite
 * @param collection_name - Collection to add to (default: 'default')
 * @param notes - Optional notes about the favorite
 * @param tags - Optional tags array
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { offer_id, collection_name = 'default', notes = null, tags = [] } = body

    if (!offer_id) {
      return NextResponse.json(
        { error: 'offer_id is required' },
        { status: 400 }
      )
    }

    // Verify offer exists
    const { data: offer } = await supabase
      .from('offers')
      .select('id, offer_title')
      .eq('id', offer_id)
      .maybeSingle()

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    // Add to favorites
    const { data: favoriteId, error } = await supabase.rpc('add_to_favorites', {
      p_user_id: user.id,
      p_offer_id: offer_id,
      p_collection_name: collection_name,
      p_notes: notes,
      p_tags: tags
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      favorite_id: favoriteId,
      message: 'Added to favorites',
      offer_title: offer.offer_title,
      collection: collection_name
    })

  } catch (error: unknown) {
    apiLogger.error('Error adding to favorites', error)
    logApiError(error as Error, request, { action: 'add_to_favorites' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove from Favorites
 * Removes an offer from user's favorites
 *
 * Query Parameters:
 * @param offer_id - UUID of the offer to remove
 */
export async function DELETE(request: NextRequest) {
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

    // Remove from favorites
    const { data: removed, error } = await supabase.rpc('remove_from_favorites', {
      p_user_id: user.id,
      p_offer_id: offerId
    })

    if (error) throw error

    if (!removed) {
      return NextResponse.json(
        { error: 'Favorite not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Removed from favorites'
    })

  } catch (error: unknown) {
    apiLogger.error('Error removing from favorites', error)
    logApiError(error as Error, request, { action: 'remove_from_favorites' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update Favorite
 * Updates favorite metadata (star, notes, collection, etc.)
 *
 * Body:
 * @param offer_id - UUID of the offer
 * @param action - 'toggle_star' | 'update_notes' | 'move_collection' | 'track_access'
 * @param notes - New notes (for update_notes action)
 * @param collection_name - New collection (for move_collection action)
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { offer_id, action, notes, collection_name } = body

    if (!offer_id || !action) {
      return NextResponse.json(
        { error: 'offer_id and action are required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'toggle_star': {
        const { data: isStarred, error } = await supabase.rpc('toggle_favorite_star', {
          p_user_id: user.id,
          p_offer_id: offer_id
        })

        if (error) throw error

        return NextResponse.json({
          success: true,
          is_starred: isStarred,
          message: isStarred ? 'Starred' : 'Unstarred'
        })
      }

      case 'track_access': {
        await supabase.rpc('track_favorite_access', {
          p_user_id: user.id,
          p_offer_id: offer_id
        })

        return NextResponse.json({
          success: true,
          message: 'Access tracked'
        })
      }

      case 'update_notes': {
        const { error } = await supabase
          .from('offer_favorites')
          .update({ notes, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('offer_id', offer_id)

        if (error) throw error

        return NextResponse.json({
          success: true,
          message: 'Notes updated'
        })
      }

      case 'move_collection': {
        if (!collection_name) {
          return NextResponse.json(
            { error: 'collection_name is required' },
            { status: 400 }
          )
        }

        const { error } = await supabase
          .from('offer_favorites')
          .update({
            collection_name,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('offer_id', offer_id)

        if (error) throw error

        return NextResponse.json({
          success: true,
          message: `Moved to ${collection_name}`,
          collection: collection_name
        })
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error: unknown) {
    apiLogger.error('Error updating favorite', error)
    logApiError(error as Error, request, { action: 'update_favorite' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
