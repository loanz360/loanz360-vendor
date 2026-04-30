import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Employee Email Single Draft API
 * Get, update, delete individual draft
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get single draft
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Get draft
    const { data: draft, error: draftError } = await serviceClient
      .from('email_drafts')
      .select('*')
      .eq('id', id)
      .eq('email_account_id', account.id)
      .maybeSingle()

    if (draftError) {
      if (draftError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
      }
      throw draftError
    }

    return NextResponse.json({ success: true, data: draft })
  } catch (error) {
    apiLogger.error('Get draft error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update draft
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      to: z.string().optional(),


      cc: z.string().optional(),


      bcc: z.string().optional(),


      subject: z.string().optional(),


      body_html: z.string().optional(),


      body_text: z.string().optional(),


      attachments: z.array(z.unknown()).optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      to,
      cc,
      bcc,
      subject,
      body_html,
      body_text,
      attachments,
    } = body

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Verify draft belongs to this account
    const { data: existing } = await serviceClient
      .from('email_drafts')
      .select('id')
      .eq('id', id)
      .eq('email_account_id', account.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
    }

    // Update draft
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (to !== undefined) updates.to_addresses = to
    if (cc !== undefined) updates.cc_addresses = cc
    if (bcc !== undefined) updates.bcc_addresses = bcc
    if (subject !== undefined) updates.subject = subject
    if (body_html !== undefined) updates.body_html = body_html
    if (body_text !== undefined) updates.body_text = body_text
    if (attachments !== undefined) updates.attachments = attachments

    const { data: draft, error: updateError } = await serviceClient
      .from('email_drafts')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) throw updateError

    // Log activity
    await serviceClient
      .from('email_activity_logs')
      .insert({
        email_account_id: account.id,
        action: 'draft_save',
        details: { draft_id: id, subject: draft.subject || '(No subject)' },
      })

    return NextResponse.json({
      success: true,
      data: draft,
      message: 'Draft updated successfully',
    })
  } catch (error) {
    apiLogger.error('Update draft error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete draft
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Delete draft
    const { error: deleteError } = await serviceClient
      .from('email_drafts')
      .delete()
      .eq('id', id)
      .eq('email_account_id', account.id)

    if (deleteError) throw deleteError

    // Log activity
    await serviceClient
      .from('email_activity_logs')
      .insert({
        email_account_id: account.id,
        action: 'draft_delete',
        details: { draft_id: id },
      })

    return NextResponse.json({
      success: true,
      message: 'Draft deleted successfully',
    })
  } catch (error) {
    apiLogger.error('Delete draft error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
