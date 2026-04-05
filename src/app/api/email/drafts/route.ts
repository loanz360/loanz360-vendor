export const dynamic = 'force-dynamic'

/**
 * Employee Email Drafts API
 * List and create drafts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

// GET - Get all drafts
export async function GET() {
  try {
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

    // Get drafts
    const { data: drafts, error: draftsError } = await serviceClient
      .from('email_drafts')
      .select('*')
      .eq('email_account_id', account.id)
      .order('updated_at', { ascending: false })

    if (draftsError) throw draftsError

    return NextResponse.json({
      success: true,
      data: drafts || [],
    })
  } catch (error) {
    apiLogger.error('Get drafts error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new draft
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      to,
      cc,
      bcc,
      subject,
      body_html,
      body_text,
      attachments,
      reply_to_message_id,
      thread_id,
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

    // Create draft
    const { data: draft, error: draftError } = await serviceClient
      .from('email_drafts')
      .insert({
        email_account_id: account.id,
        to_addresses: to || [],
        cc_addresses: cc || [],
        bcc_addresses: bcc || [],
        subject: subject || '',
        body_html: body_html || '',
        body_text: body_text || '',
        attachments: attachments || [],
        reply_to_message_id,
        thread_id,
      })
      .select()
      .maybeSingle()

    if (draftError) throw draftError

    // Log activity
    await serviceClient
      .from('email_activity_logs')
      .insert({
        email_account_id: account.id,
        action: 'draft_save',
        details: { draft_id: draft.id, subject: subject || '(No subject)' },
      })

    return NextResponse.json({
      success: true,
      data: draft,
      message: 'Draft created successfully',
    })
  } catch (error) {
    apiLogger.error('Create draft error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
