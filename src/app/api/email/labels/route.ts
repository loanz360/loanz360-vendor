import { parseBody } from '@/lib/utils/parse-body'

/**
 * Employee Email Labels API
 * Create, update, and delete custom email labels
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import DOMPurify from 'isomorphic-dompurify'
import { z } from 'zod'

const createLabelSchema = z.object({
  name: z.string().min(1, 'Label name is required').max(50, 'Label name too long'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional().default('#6b7280'),
})

const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// GET - List all labels for current user
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!account) {
      return NextResponse.json({
        success: false,
        error: 'No email account found',
        code: 'NO_EMAIL_ACCOUNT'
      }, { status: 404 })
    }

    const { data: labels, error: labelsError } = await supabase
      .from('email_labels')
      .select('*')
      .eq('email_account_id', account.id)
      .eq('is_system', false)
      .order('name')

    if (labelsError) {
      // Handle table not existing
      if (labelsError.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'Email system not configured',
          code: 'EMAIL_NOT_CONFIGURED'
        }, { status: 503 })
      }
      throw labelsError
    }

    return NextResponse.json({
      success: true,
      data: labels || []
    })
  } catch (error) {
    apiLogger.error('Get email labels error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new label
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!account) {
      return NextResponse.json({
        success: false,
        error: 'No email account found',
        code: 'NO_EMAIL_ACCOUNT'
      }, { status: 404 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const parsed = createLabelSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Validation failed'
      }, { status: 400 })
    }

    const sanitizedName = DOMPurify.sanitize(parsed.data.name.trim(), { ALLOWED_TAGS: [] })

    if (!sanitizedName) {
      return NextResponse.json({ success: false, error: 'Invalid label name' }, { status: 400 })
    }

    // Check for duplicate label name
    const { data: existing } = await supabase
      .from('email_labels')
      .select('id')
      .eq('email_account_id', account.id)
      .ilike('name', sanitizedName)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'A label with this name already exists'
      }, { status: 409 })
    }

    // Count existing labels (limit to 50 per account)
    const { count } = await supabase
      .from('email_labels')
      .select('*', { count: 'exact', head: true })
      .eq('email_account_id', account.id)
      .eq('is_system', false)

    if ((count || 0) >= 50) {
      return NextResponse.json({
        success: false,
        error: 'Maximum label limit reached (50). Please delete unused labels.'
      }, { status: 400 })
    }

    const { data: label, error: insertError } = await supabase
      .from('email_labels')
      .insert({
        email_account_id: account.id,
        name: sanitizedName,
        color: parsed.data.color,
        is_system: false,
        unread_count: 0,
        total_count: 0,
      })
      .select()
      .single()

    if (insertError) {
      // Handle table not existing
      if (insertError.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'Email system not configured',
          code: 'EMAIL_NOT_CONFIGURED'
        }, { status: 503 })
      }
      throw insertError
    }

    return NextResponse.json({
      success: true,
      data: label,
      message: `Label "${sanitizedName}" created successfully`
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Create email label error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a label
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('id')

    if (!labelId) {
      return NextResponse.json({ success: false, error: 'Label ID required' }, { status: 400 })
    }

    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Verify label exists and belongs to user, and is not system label
    const { data: label, error: fetchError } = await supabase
      .from('email_labels')
      .select('id, is_system')
      .eq('id', labelId)
      .eq('email_account_id', account.id)
      .maybeSingle()

    if (fetchError || !label) {
      return NextResponse.json({ success: false, error: 'Label not found' }, { status: 404 })
    }

    if (label.is_system) {
      return NextResponse.json({ success: false, error: 'Cannot delete system labels' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('email_labels')
      .delete()
      .eq('id', labelId)

    if (deleteError) throw deleteError

    return NextResponse.json({
      success: true,
      message: 'Label deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Delete email label error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update a label
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Label ID required' }, { status: 400 })
    }

    const parsed = updateLabelSchema.safeParse(updates)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Validation failed' }, { status: 400 })
    }

    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Verify ownership and not system label
    const { data: label } = await supabase
      .from('email_labels')
      .select('id, is_system')
      .eq('id', id)
      .eq('email_account_id', account.id)
      .maybeSingle()

    if (!label) {
      return NextResponse.json({ success: false, error: 'Label not found' }, { status: 404 })
    }

    if (label.is_system) {
      return NextResponse.json({ success: false, error: 'Cannot modify system labels' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.name) {
      updateData.name = DOMPurify.sanitize(parsed.data.name.trim(), { ALLOWED_TAGS: [] })
    }
    if (parsed.data.color) {
      updateData.color = parsed.data.color
    }

    const { data: updated, error: updateError } = await supabase
      .from('email_labels')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    apiLogger.error('Update email label error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
