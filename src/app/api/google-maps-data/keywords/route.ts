import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch all keywords
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('google_maps_keywords')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, count, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count,
        limit,
        offset
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching keywords', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add new keyword(s)
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      keywords: z.string().optional(),

      id: z.string().uuid(),

      status: z.string().optional(),

      error_message: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { keywords } = body

    // Handle single or bulk keywords
    const keywordsArray = Array.isArray(keywords) ? keywords : [keywords]

    const entries = keywordsArray.map((k: { keyword: string; pincode: string }) => ({
      keyword: k.keyword.trim(),
      pincode: k.pincode.trim(),
      status: 'pending'
    }))

    // Validate pincodes
    for (const entry of entries) {
      if (!/^\d{6}$/.test(entry.pincode)) {
        return NextResponse.json(
          { success: false, error: `Invalid pincode: ${entry.pincode}` },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('google_maps_keywords')
      .upsert(entries, { onConflict: 'keyword,pincode', ignoreDuplicates: true })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: `${entries.length} keyword(s) added successfully`
    })
  } catch (error: unknown) {
    apiLogger.error('Error adding keywords', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete keyword(s)
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const ids = searchParams.get('ids')

    if (ids) {
      // Bulk delete
      const idArray = ids.split(',')
      const { error } = await supabase
        .from('google_maps_keywords')
        .delete()
        .in('id', idArray)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: `${idArray.length} keywords deleted`
      })
    } else if (id) {
      // Single delete
      const { error } = await supabase
        .from('google_maps_keywords')
        .delete()
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Keyword deleted'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'No ID provided' },
        { status: 400 }
      )
    }
  } catch (error: unknown) {
    apiLogger.error('Error deleting keywords', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update keyword status
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema2 = z.object({

      status: z.string().optional(),

      error_message: z.string().optional(),

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id, status, error_message } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { status }
    if (error_message) {
      updateData.error_message = error_message
    }
    if (status === 'scraping') {
      updateData.last_scraped_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('google_maps_keywords')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('Error updating keyword', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
