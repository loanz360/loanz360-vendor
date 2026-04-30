import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


// GET: Fetch single canned response
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: response, error } = await supabase
      .from('partner_support_canned_responses')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ response })
  } catch (error: unknown) {
    apiLogger.error('Error fetching canned response', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Failed to fetch canned response' },
      { status: 500 }
    )
  }
}

// PATCH: Update canned response
export async function PATCH(
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

    // Get user data to check role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const bodySchema = z.object({


      title: z.string().optional(),


      content: z.string().optional(),


      category: z.string().optional(),


      department: z.string().optional(),


      is_active: z.boolean().optional(),


      is_global: z.boolean().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { title, content, category, department, is_active, is_global } = body

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (title !== undefined) updates.title = title.trim()
    if (content !== undefined) updates.content = content.trim()
    if (category !== undefined) updates.category = category
    if (department !== undefined) updates.department = department
    if (is_active !== undefined) updates.is_active = is_active

    // Only Super Admin can set is_global
    if (userData?.role === 'SUPER_ADMIN' && is_global !== undefined) {
      updates.is_global = is_global
    }

    // Update canned response (RLS will check ownership)
    const { data: updated, error } = await supabase
      .from('partner_support_canned_responses')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ response: updated })
  } catch (error: unknown) {
    apiLogger.error('Error updating canned response', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Failed to update canned response' },
      { status: 500 }
    )
  }
}

// DELETE: Delete canned response
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

    // Delete canned response (RLS will check ownership)
    const { error } = await supabase
      .from('partner_support_canned_responses')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ message: 'Canned response deleted successfully' })
  } catch (error: unknown) {
    apiLogger.error('Error deleting canned response', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Failed to delete canned response' },
      { status: 500 }
    )
  }
}
