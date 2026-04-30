import { parseBody } from '@/lib/utils/parse-body'

/**
 * Employee Email Folders API
 * Get folders/labels and manage them
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - Get email folders/labels
export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError) {
      // Handle table doesn't exist error
      if (accountError.code === '42P01' || accountError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Email system not configured. Please contact administrator.',
          code: 'EMAIL_SYSTEM_NOT_CONFIGURED'
        }, { status: 503 })
      }
    }

    if (!account) {
      return NextResponse.json({
        success: false,
        error: 'No email account found',
        code: 'NO_EMAIL_ACCOUNT'
      }, { status: 404 })
    }

    // Get labels/folders
    const { data: labels, error: labelsError } = await supabase
      .from('email_labels')
      .select('*')
      .eq('email_account_id', account.id)
      .order('is_system', { ascending: false })
      .order('name')

    if (labelsError) throw labelsError

    // Add standard folders (these map to IMAP folders, not labels)
    const standardFolders = [
      { id: 'inbox', name: 'Inbox', icon: 'inbox', is_system: true, unread_count: 0 },
      { id: 'sent', name: 'Sent', icon: 'send', is_system: true, unread_count: 0 },
      { id: 'drafts', name: 'Drafts', icon: 'file-edit', is_system: true, unread_count: 0 },
      { id: 'starred', name: 'Starred', icon: 'star', is_system: true, unread_count: 0 },
      { id: 'trash', name: 'Trash', icon: 'trash', is_system: true, unread_count: 0 },
      { id: 'spam', name: 'Spam', icon: 'alert-triangle', is_system: true, unread_count: 0 },
    ]

    return NextResponse.json({
      success: true,
      data: {
        folders: standardFolders,
        labels: labels || [],
      }
    })
  } catch (error) {
    apiLogger.error('Get email folders error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new label
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { name, color } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Label name is required' }, { status: 400 })
    }

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('email_labels')
      .select('id')
      .eq('email_account_id', account.id)
      .eq('name', name)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: 'A label with this name already exists' }, { status: 400 })
    }

    // Create label
    const { data: label, error: createError } = await supabase
      .from('email_labels')
      .insert({
        email_account_id: account.id,
        name,
        color: color || '#6B7280',
        is_system: false,
      })
      .select()
      .maybeSingle()

    if (createError) throw createError

    return NextResponse.json({
      success: true,
      data: label,
      message: 'Label created successfully'
    })
  } catch (error) {
    apiLogger.error('Create label error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a label
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('id')

    if (!labelId) {
      return NextResponse.json({ success: false, error: 'Label ID is required' }, { status: 400 })
    }

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Check if label exists and is not system
    const { data: label, error: labelError } = await supabase
      .from('email_labels')
      .select('id, is_system')
      .eq('id', labelId)
      .eq('email_account_id', account.id)
      .maybeSingle()

    if (labelError || !label) {
      return NextResponse.json({ success: false, error: 'Label not found' }, { status: 404 })
    }

    if (label.is_system) {
      return NextResponse.json({ success: false, error: 'Cannot delete system labels' }, { status: 400 })
    }

    // Delete the label (will cascade delete email_message_labels entries)
    const { error: deleteError } = await supabase
      .from('email_labels')
      .delete()
      .eq('id', labelId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, message: 'Label deleted successfully' })
  } catch (error) {
    apiLogger.error('Delete label error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
