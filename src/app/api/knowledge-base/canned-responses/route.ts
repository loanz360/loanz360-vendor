import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCannedResponses,
  getCannedResponseByShortcut,
  createCannedResponse,
  recordCannedResponseUsage,
  DEFAULT_CANNED_RESPONSES
} from '@/lib/tickets/knowledge-base'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/knowledge-base/canned-responses
 * Get canned responses
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shortcut = searchParams.get('shortcut')
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined
    const activeOnly = searchParams.get('active_only') !== 'false'

    // Get by shortcut
    if (shortcut) {
      const response = await getCannedResponseByShortcut(shortcut)
      if (!response) {
        return NextResponse.json({ success: false, error: 'Canned response not found' }, { status: 404 })
      }
      return NextResponse.json({ response })
    }

    // Get all with filters
    const responses = await getCannedResponses({ category, search, activeOnly })
    return NextResponse.json({ responses })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/knowledge-base/canned-responses
 * Create a new canned response
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      name: z.string().optional(),


      shortcut: z.string().optional(),


      content: z.string().optional(),


      category: z.string().optional(),


      tags: z.array(z.unknown()).optional(),


      id: z.string().uuid(),


      action: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { name, shortcut, content, category, tags } = body

    if (!name || !shortcut || !content) {
      return NextResponse.json(
        { error: 'name, shortcut, and content are required' },
        { status: 400 }
      )
    }

    // Check if shortcut already exists
    const existing = await getCannedResponseByShortcut(shortcut)
    if (existing) {
      return NextResponse.json(
        { error: 'Shortcut already exists' },
        { status: 400 }
      )
    }

    // Get author name
    const { data: employee } = await supabase
      .from('employees')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()

    const response = await createCannedResponse({
      name,
      shortcut,
      content,
      category,
      tags: tags || [],
      is_active: true,
      created_by_id: user.id,
      created_by_name: employee?.name
    })

    if (!response) {
      return NextResponse.json({ success: false, error: 'Failed to create canned response' }, { status: 500 })
    }

    return NextResponse.json({ response })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/knowledge-base/canned-responses
 * Update a canned response or record usage
 */
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema2 = z.object({


      action: z.string().optional(),


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id, action, ...updates } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    // Handle usage tracking
    if (action === 'use') {
      await recordCannedResponseUsage(id)
      return NextResponse.json({ success: true })
    }

    // Regular update
    const { data, error } = await supabase
      .from('canned_responses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ response: data })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/knowledge-base/canned-responses
 * Initialize default canned responses
 */
export async function PUT() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if responses exist
    const { data: existing } = await supabase
      .from('canned_responses')
      .select('id')
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Canned responses already exist'
      })
    }

    // Insert defaults
    for (const response of DEFAULT_CANNED_RESPONSES) {
      await supabase.from('canned_responses').insert({
        ...response,
        created_by_id: user.id
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Default canned responses initialized'
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/knowledge-base/canned-responses
 * Delete a canned response
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('canned_responses')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
