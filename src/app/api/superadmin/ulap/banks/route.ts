import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * ULAP Banks Management API
 * CRUD operations for banks and NBFCs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch all banks
export async function GET() {
  try {

    const { data: banks, error } = await supabase
      .from('ulap_banks')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching banks', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch banks' }, { status: 500 })
    }

    return NextResponse.json({ banks })
  } catch (error) {
    apiLogger.error('Banks API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new bank
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      name: z.string().optional(),

      short_code: z.string().optional(),

      logo_url: z.string().optional(),

      type: z.string().optional(),

      website_url: z.string().optional(),

      display_order: z.string().optional(),

      id: z.string().uuid(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { name, short_code, logo_url, type, website_url, display_order } = body

    if (!name || !short_code || !type) {
      return NextResponse.json({ success: false, error: 'Name, short code, and type are required' }, { status: 400 })
    }

    const { data: bank, error } = await supabase
      .from('ulap_banks')
      .insert({
        name,
        short_code: short_code.toUpperCase(),
        logo_url,
        type,
        website_url,
        display_order: display_order || 0,
        is_active: true
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating bank', error)
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'Bank with this short code already exists' }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: 'Failed to create bank' }, { status: 500 })
    }

    return NextResponse.json({ bank }, { status: 201 })
  } catch (error) {
    apiLogger.error('Banks API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update bank
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema2 = z.object({

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2

    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Bank ID is required' }, { status: 400 })
    }

    const { data: bank, error } = await supabase
      .from('ulap_banks')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating bank', error)
      return NextResponse.json({ success: false, error: 'Failed to update bank' }, { status: 500 })
    }

    return NextResponse.json({ bank })
  } catch (error) {
    apiLogger.error('Banks API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete bank
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Bank ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ulap_banks')
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('Error deleting bank', error)
      return NextResponse.json({ success: false, error: 'Failed to delete bank' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Banks API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
