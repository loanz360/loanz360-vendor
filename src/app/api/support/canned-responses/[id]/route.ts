import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/support/canned-responses/[id] - Get single canned response
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: responseId } = await params

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is HR or Super Admin
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only HR and Super Admin can view canned responses' },
        { status: 403 }
      )
    }

    // Get canned response
    const { data: response, error } = await supabase
      .from('ticket_canned_responses')
      .select('*')
      .eq('id', responseId)
      .maybeSingle()

    if (error || !response) {
      return NextResponse.json(
        { error: 'Canned response not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ response })
  } catch (error) {
    apiLogger.error('Error in GET /api/support/canned-responses/[id]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/support/canned-responses/[id] - Update canned response
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: responseId } = await params

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is HR or Super Admin
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only HR and Super Admin can update canned responses' },
        { status: 403 }
      )
    }

    // Parse update data
    const bodySchema = z.object({

      title: z.string().optional(),

      category: z.string().optional(),

      response_text: z.string().optional(),

      is_active: z.boolean().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) updates.title = body.title
    if (body.category !== undefined) updates.category = body.category
    if (body.response_text !== undefined) updates.response_text = body.response_text
    if (body.is_active !== undefined) updates.is_active = body.is_active

    updates.updated_at = new Date().toISOString()

    // Update canned response
    const { data: updatedResponse, error: updateError } = await supabase
      .from('ticket_canned_responses')
      .update(updates)
      .eq('id', responseId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating canned response', updateError)
      return NextResponse.json(
        { error: 'Failed to update canned response' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      response: updatedResponse,
      message: 'Canned response updated successfully'
    })
  } catch (error) {
    apiLogger.error('Error in PATCH /api/support/canned-responses/[id]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/support/canned-responses/[id] - Delete canned response
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: responseId } = await params

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is HR or Super Admin
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only HR and Super Admin can delete canned responses' },
        { status: 403 }
      )
    }

    // Delete canned response (soft delete by marking as inactive)
    const { error: deleteError } = await supabase
      .from('ticket_canned_responses')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', responseId)

    if (deleteError) {
      apiLogger.error('Error deleting canned response', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete canned response' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Canned response deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/support/canned-responses/[id]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/support/canned-responses/[id]/use - Increment usage count
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: responseId } = await params

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Increment usage count via RPC
    const { error } = await supabase.rpc('increment_canned_response_usage', {
      response_id: responseId
    })

    if (error) {
      // Fallback if RPC function doesn't exist: read current count and increment
      const { data: current } = await supabase
        .from('ticket_canned_responses')
        .select('usage_count')
        .eq('id', responseId)
        .maybeSingle()

      await supabase
        .from('ticket_canned_responses')
        .update({
          usage_count: (current?.usage_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', responseId)
    }

    return NextResponse.json({
      success: true,
      message: 'Usage count incremented'
    })
  } catch (error) {
    apiLogger.error('Error in POST /api/support/canned-responses/[id]/use', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
