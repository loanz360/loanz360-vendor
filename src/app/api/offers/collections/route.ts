export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET - Get User's Collections
 * Returns all favorite collections for the authenticated user
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
    const { data, error } = await supabase.rpc('get_user_collections', {
      p_user_id: user.id
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      collections: data || [],
      count: data?.length || 0
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching collections', error)
    logApiError(error as Error, request, { action: 'get_collections' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create or Update Collection
 *
 * Body:
 * @param collection_name - Name of the collection (required)
 * @param description - Description text (optional)
 * @param color - Hex color code (optional, default: #3B82F6)
 * @param icon - Icon name (optional, default: bookmark)
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
    const {
      collection_name,
      description = null,
      color = '#3B82F6',
      icon = 'bookmark'
    } = body

    if (!collection_name) {
      return NextResponse.json(
        { error: 'collection_name is required' },
        { status: 400 }
      )
    }

    // Validate collection name
    if (collection_name.length < 2 || collection_name.length > 100) {
      return NextResponse.json(
        { error: 'Collection name must be 2-100 characters' },
        { status: 400 }
      )
    }

    // Validate color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json(
        { error: 'Invalid color format. Use hex format: #RRGGBB' },
        { status: 400 }
      )
    }

    // Insert or update collection
    const { data, error } = await supabase
      .from('favorite_collections')
      .upsert({
        user_id: user.id,
        collection_name,
        description,
        color,
        icon,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,collection_name'
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      collection: data,
      message: 'Collection saved'
    })

  } catch (error: unknown) {
    apiLogger.error('Error creating collection', error)
    logApiError(error as Error, request, { action: 'create_collection' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete Collection
 * Deletes a collection (favorites in the collection will be moved to 'default')
 *
 * Query Parameters:
 * @param collection_name - Name of collection to delete
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
    const collectionName = searchParams.get('collection_name')

    if (!collectionName) {
      return NextResponse.json(
        { error: 'collection_name is required' },
        { status: 400 }
      )
    }

    // Prevent deleting default collection
    if (collectionName === 'default') {
      return NextResponse.json(
        { error: 'Cannot delete default collection' },
        { status: 400 }
      )
    }

    // Move favorites to default collection first
    await supabase
      .from('offer_favorites')
      .update({ collection_name: 'default' })
      .eq('user_id', user.id)
      .eq('collection_name', collectionName)

    // Delete the collection
    const { error } = await supabase
      .from('favorite_collections')
      .delete()
      .eq('user_id', user.id)
      .eq('collection_name', collectionName)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Collection deleted. Favorites moved to default collection.'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting collection', error)
    logApiError(error as Error, request, { action: 'delete_collection' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Share Collection
 * Generates a shareable link for a collection
 *
 * Body:
 * @param collection_name - Name of collection to share
 * @param expires_hours - Hours until link expires (default: 168 = 7 days)
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
    const body = await request.json()
    const { collection_name, expires_hours = 168 } = body

    if (!collection_name) {
      return NextResponse.json(
        { error: 'collection_name is required' },
        { status: 400 }
      )
    }

    // Generate share link
    const { data: shareToken, error } = await supabase.rpc('generate_collection_share_link', {
      p_user_id: user.id,
      p_collection_name: collection_name,
      p_expires_hours: expires_hours
    })

    if (error) throw error

    // Build share URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const shareUrl = `${baseUrl}/shared/collections/${shareToken}`

    return NextResponse.json({
      success: true,
      share_token: shareToken,
      share_url: shareUrl,
      expires_at: new Date(Date.now() + expires_hours * 60 * 60 * 1000).toISOString(),
      message: 'Share link generated'
    })

  } catch (error: unknown) {
    apiLogger.error('Error sharing collection', error)
    logApiError(error as Error, request, { action: 'share_collection' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
