import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
/**
 * Customer Segments Management API
 * SuperAdmin endpoint for managing customer segments for marketing
 *
 * GET  - Fetch all segments with statistics
 * POST - Create new segment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schemas
const createSegmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  segment_type: z.enum(['STATIC', 'DYNAMIC']),
  filter_criteria: z.record(z.unknown()).optional().nullable(),
  is_active: z.boolean().optional().default(true),
})

const querySchema = z.object({
  type: z.enum(['all', 'STATIC', 'DYNAMIC']).optional(),
  status: z.enum(['all', 'active', 'inactive']).optional(),
  search: z.string().optional(),
})

/**
 * GET /api/superadmin/customer-management/segments
 * Fetch all customer segments with member counts
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = querySchema.parse({
      type: searchParams.get('type') || 'all',
      status: searchParams.get('status') || 'all',
      search: searchParams.get('search'),
    })

    // Build query
    let query = supabaseAdmin
      .from('customer_segments')
      .select(`
        *,
        segment_members(count)
      `)
      .order('created_at', { ascending: false })

    // Apply type filter
    if (params.type && params.type !== 'all') {
      query = query.eq('segment_type', params.type)
    }

    // Apply status filter
    if (params.status === 'active') {
      query = query.eq('is_active', true)
    } else if (params.status === 'inactive') {
      query = query.eq('is_active', false)
    }

    // Apply search filter
    if (params.search) {
      query = query.or(`name.ilike.%${params.search}%,description.ilike.%${params.search}%`)
    }

    const { data: segments, error } = await query

    if (error) {
      apiLogger.error('Error fetching segments', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch segments' },
        { status: 500 }
      )
    }

    // Transform data with member counts
    const segmentsWithCounts = segments?.map(segment => ({
      ...segment,
      member_count: segment.segment_members?.[0]?.count || 0,
    })) || []

    // Calculate statistics
    const statistics = {
      total_segments: segmentsWithCounts.length,
      active_segments: segmentsWithCounts.filter(s => s.is_active).length,
      static_segments: segmentsWithCounts.filter(s => s.segment_type === 'STATIC').length,
      dynamic_segments: segmentsWithCounts.filter(s => s.segment_type === 'DYNAMIC').length,
      total_members: segmentsWithCounts.reduce((sum, s) => sum + s.member_count, 0),
      avg_members_per_segment: segmentsWithCounts.length
        ? Math.round(segmentsWithCounts.reduce((sum, s) => sum + s.member_count, 0) / segmentsWithCounts.length)
        : 0,
    }

    return NextResponse.json({
      success: true,
      data: segmentsWithCounts,
      statistics,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    apiLogger.error('Segments GET error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/customer-management/segments
 * Create a new customer segment
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = createSegmentSchema.parse(body)

    // Check for duplicate name
    const { data: existing } = await supabaseAdmin
      .from('customer_segments')
      .select('id')
      .eq('name', validatedData.name)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Segment name already exists' },
        { status: 409 }
      )
    }

    // Create segment
    const { data: newSegment, error: insertError } = await supabaseAdmin
      .from('customer_segments')
      .insert({
        name: validatedData.name,
        description: validatedData.description || null,
        segment_type: validatedData.segment_type,
        filter_criteria: validatedData.filter_criteria || null,
        is_active: validatedData.is_active,
        created_by: auth.userId,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating segment', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create segment' },
        { status: 500 }
      )
    }

    // Log to audit
    await supabaseAdmin
      .from('config_audit_log')
      .insert({
        action: 'CREATE',
        entity_type: 'CUSTOMER_SEGMENT',
        entity_id: newSegment.id,
        entity_name: newSegment.name,
        new_value: newSegment,
        changed_by: auth.userId,
        changed_by_email: auth.email,
      })

    return NextResponse.json({
      success: true,
      data: newSegment,
      message: 'Segment created successfully',
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Segments POST error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
