export const dynamic = 'force-dynamic'

/**
 * Employee Email Account API
 * Get employee's email account info and update settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - Get current user's email account
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
      .select(`
        *,
        email_signatures (
          id,
          name,
          signature_html,
          signature_text,
          is_default
        )
      `)
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
      if (accountError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'No email account found',
          code: 'NO_EMAIL_ACCOUNT'
        }, { status: 404 })
      }
      throw accountError
    }

    // Get today's quota usage
    const today = new Date().toISOString().split('T')[0]
    const { data: quotaUsage } = await supabase
      .from('email_quota_usage')
      .select('emails_sent, last_reset_at')
      .eq('email_account_id', account.id)
      .eq('usage_date', today)
      .maybeSingle()

    // Get folder stats
    const { data: folders } = await supabase
      .from('email_labels')
      .select('id, name, color, unread_count, total_count')
      .eq('email_account_id', account.id)
      .order('name')

    return NextResponse.json({
      success: true,
      data: {
        account: {
          id: account.id,
          email_address: account.email_address,
          display_name: account.display_name,
          status: account.status,
          daily_quota: account.daily_quota,
          auto_reply_enabled: account.auto_reply_enabled,
          auto_reply_message: account.auto_reply_message,
          auto_reply_start: account.auto_reply_start,
          auto_reply_end: account.auto_reply_end,
          created_at: account.created_at,
        },
        signature: account.email_signatures?.[0] || null,
        quota: {
          used: quotaUsage?.emails_sent || 0,
          limit: account.daily_quota,
          remaining: account.daily_quota - (quotaUsage?.emails_sent || 0),
          percentage: Math.round(((quotaUsage?.emails_sent || 0) / account.daily_quota) * 100),
        },
        folders: folders || [],
      }
    })
  } catch (error) {
    apiLogger.error('Get email account error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update account settings (auto-reply, etc.)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      auto_reply_enabled,
      auto_reply_message,
      auto_reply_start,
      auto_reply_end,
      signature_id,
    } = body

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

    // Build update object
    const updates: Record<string, unknown> = {}

    if (auto_reply_enabled !== undefined) {
      updates.auto_reply_enabled = auto_reply_enabled
    }
    if (auto_reply_message !== undefined) {
      updates.auto_reply_message = auto_reply_message
    }
    if (auto_reply_start !== undefined) {
      updates.auto_reply_start = auto_reply_start
    }
    if (auto_reply_end !== undefined) {
      updates.auto_reply_end = auto_reply_end
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('email_accounts')
        .update(updates)
        .eq('id', account.id)

      if (updateError) throw updateError
    }

    // Update signature assignment if provided
    if (signature_id !== undefined) {
      // Remove existing assignment
      await supabase
        .from('email_account_signatures')
        .delete()
        .eq('email_account_id', account.id)

      // Add new assignment
      if (signature_id) {
        await supabase
          .from('email_account_signatures')
          .insert({
            email_account_id: account.id,
            signature_id: signature_id,
          })
      }
    }

    return NextResponse.json({ success: true, message: 'Settings updated successfully' })
  } catch (error) {
    apiLogger.error('Update email account error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
