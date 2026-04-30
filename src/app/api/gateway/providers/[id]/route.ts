import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

// Single Provider API
// GET: Get provider details
// PUT: Update provider
// DELETE: Delete provider

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: provider, error } = await supabase
      .from('communication_providers')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Provider not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, provider })
  } catch (error) {
    apiLogger.error('Error fetching provider', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    const allowedFields = [
      'display_name', 'config', 'is_active', 'priority',
      'rate_limit_per_minute', 'provider_name'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data: provider, error } = await supabase
      .from('communication_providers')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, provider })
  } catch (error) {
    apiLogger.error('Error updating provider', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('communication_providers')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Error deleting provider', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
