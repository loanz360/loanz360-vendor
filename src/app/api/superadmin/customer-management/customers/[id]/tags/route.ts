import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/customer-management/customers/[id]/tags
 * Fetch all tags for a customer
 *
 * Rate Limit: 60 requests per minute
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return readRateLimiter(request, async (req) => {
    return await getCustomerTagsHandler(req, params.id)
  })
}

/**
 * POST /api/superadmin/customer-management/customers/[id]/tags
 * Add a tag to a customer
 *
 * Rate Limit: 30 requests per minute
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return writeRateLimiter(request, async (req) => {
    return await addCustomerTagHandler(req, params.id)
  })
}

/**
 * DELETE /api/superadmin/customer-management/customers/[id]/tags
 * Remove a tag from a customer
 *
 * Rate Limit: 30 requests per minute
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return writeRateLimiter(request, async (req) => {
    return await removeCustomerTagHandler(req, params.id)
  })
}

async function getCustomerTagsHandler(request: NextRequest, customerId: string) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch all tags for the customer
    const { data: tags, error: tagsError } = await supabase
      .from('customer_tags')
      .select(`
        id,
        tag_name,
        tag_category,
        tag_source,
        tag_value,
        confidence_score,
        expires_at,
        created_at,
        created_by,
        users!customer_tags_created_by_fkey(full_name)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (tagsError) {
      apiLogger.error('Error fetching customer tags', tagsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch customer tags'
      }, { status: 500 })
    }

    // Fetch customer tier
    const { data: tierData } = await supabase
      .from('customer_tiers')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle()

    // Fetch customer segments
    const { data: segmentsData } = await supabase
      .from('customer_segment_memberships')
      .select(`
        id,
        segment_id,
        joined_at,
        customer_segments(
          segment_name,
          segment_description,
          segment_category
        )
      `)
      .eq('customer_id', customerId)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      tags: tags || [],
      tier: tierData || null,
      segments: segmentsData || []
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in customer tags API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function addCustomerTagHandler(request: NextRequest, customerId: string) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { tag_name, tag_category, tag_value, confidence_score, expires_at } = body

    // Validation
    if (!tag_name || typeof tag_name !== 'string' || tag_name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tag name is required and must be a non-empty string'
      }, { status: 400 })
    }

    // Sanitize tag name
    const sanitizedTagName = tag_name.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_')

    // Validate tag category
    const validCategories = ['BEHAVIORAL', 'FINANCIAL', 'RISK', 'LIFECYCLE', 'CUSTOM']
    if (tag_category && !validCategories.includes(tag_category)) {
      return NextResponse.json({
        success: false,
        error: `Invalid tag category. Must be one of: ${validCategories.join(', ')}`
      }, { status: 400 })
    }

    // Validate confidence score
    if (confidence_score !== undefined && (confidence_score < 0 || confidence_score > 100)) {
      return NextResponse.json({
        success: false,
        error: 'Confidence score must be between 0 and 100'
      }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Verify customer exists
    const { data: customerExists, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .maybeSingle()

    if (customerError || !customerExists) {
      return NextResponse.json({
        success: false,
        error: 'Customer not found'
      }, { status: 404 })
    }

    // Use the database function to add tag
    const { data: result, error: addError } = await supabase
      .rpc('add_customer_tag', {
        p_customer_id: customerId,
        p_tag_name: sanitizedTagName,
        p_tag_category: tag_category || 'CUSTOM',
        p_tag_value: tag_value || null,
        p_confidence_score: confidence_score || 100,
        p_expires_at: expires_at || null
      })

    if (addError) {
      apiLogger.error('Error adding customer tag', addError)

      // Check for unique constraint violation
      if (addError.code === '23505') {
        return NextResponse.json({
          success: false,
          error: 'This tag already exists for the customer'
        }, { status: 409 })
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to add customer tag'
      }, { status: 500 })
    }

    // Fetch the newly created tag
    const { data: newTag } = await supabase
      .from('customer_tags')
      .select(`
        id,
        tag_name,
        tag_category,
        tag_source,
        tag_value,
        confidence_score,
        expires_at,
        created_at,
        users!customer_tags_created_by_fkey(full_name)
      `)
      .eq('id', result)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      message: 'Tag added successfully',
      tag: newTag
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in add customer tag API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function removeCustomerTagHandler(request: NextRequest, customerId: string) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const tagName = searchParams.get('tag_name')

    if (!tagName) {
      return NextResponse.json({
        success: false,
        error: 'Tag name is required'
      }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Use the database function to remove tag
    const { data: result, error: removeError } = await supabase
      .rpc('remove_customer_tag', {
        p_customer_id: customerId,
        p_tag_name: tagName
      })

    if (removeError) {
      apiLogger.error('Error removing customer tag', removeError)
      return NextResponse.json({
        success: false,
        error: 'Failed to remove customer tag'
      }, { status: 500 })
    }

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Tag not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Tag removed successfully'
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in remove customer tag API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
