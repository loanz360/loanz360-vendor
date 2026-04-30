import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/cpe/recruitment/send-reminder
 *
 * Send a reminder for a pending recruitment invite
 *
 * Body:
 *   - inviteId: string (required) - UUID of the invite
 *   - channel: string (optional) - WHATSAPP | SMS | EMAIL (default: same as original)
 *
 * Returns:
 *   - success: boolean
 *   - whatsappUrl: string (if channel is WHATSAPP)
 *   - reminderCount: number
 *   - message: string
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a Channel Partner Executive
    const isCPE = await verifyCPERole(supabase, user)

    if (!isCPE) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Channel Partner Executive role required.' },
        { status: 403 }
      )
    }

    // Parse request body
    const bodySchema = z.object({

      inviteId: z.string().uuid(),

      channel: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { inviteId, channel } = body

    // Validation
    if (!inviteId) {
      return NextResponse.json(
        { success: false, error: 'Invite ID is required' },
        { status: 400 }
      )
    }

    // Fetch the invite
    const { data: invite, error: inviteError } = await supabase
      .from('partner_recruitment_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('created_by_cpe', user.id) // Ensure CPE owns this invite
      .maybeSingle()

    if (inviteError || !invite) {
      apiLogger.error('Error fetching invite', inviteError)
      return NextResponse.json(
        { success: false, error: 'Invite not found or access denied' },
        { status: 404 }
      )
    }

    // Check if invite is still active
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Invite has expired. Please generate a new link.' },
        { status: 400 }
      )
    }

    // Check if already completed
    if (invite.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Registration already completed. No reminder needed.' },
        { status: 400 }
      )
    }

    // Check reminder limit (max 5 reminders)
    const currentReminderCount = invite.reminder_count || 0
    if (currentReminderCount >= 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum reminder limit (5) reached for this invite.' },
        { status: 400 }
      )
    }

    // Determine channel to use
    const reminderChannel = channel || invite.channel || 'WHATSAPP'

    // Update invite with reminder information
    const { data: updatedInvite, error: updateError } = await supabase
      .from('partner_recruitment_invites')
      .update({
        reminder_count: currentReminderCount + 1,
        last_reminder_at: new Date().toISOString(),
        reminder_channel: reminderChannel,
      })
      .eq('id', inviteId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating invite reminder', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update reminder information' },
        { status: 500 }
      )
    }

    // Generate reminder message based on status
    let reminderMessage = ''
    const partnerTypeDisplay = invite.partner_type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')

    const recipientName = invite.recipient_name || ''

    if (invite.status === 'SENT') {
      // Never clicked the link
      reminderMessage = encodeURIComponent(
        `Hi${recipientName ? ` ${recipientName}` : ''}! 👋\n\n` +
        `This is a friendly reminder about your invitation to join Loanz360 as a *${partnerTypeDisplay}*.\n\n` +
        `We noticed you haven't opened the registration link yet. Don't miss this opportunity!\n\n` +
        `🚀 Complete your registration here:\n${invite.short_link}\n\n` +
        `Link expires in ${Math.ceil((new Date(invite.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days.`
      )
    } else if (invite.status === 'CLICKED' || invite.status === 'OPENED') {
      // Clicked but not filled
      reminderMessage = encodeURIComponent(
        `Hi${recipientName ? ` ${recipientName}` : ''}! 👋\n\n` +
        `We noticed you started but haven't completed your registration as a *${partnerTypeDisplay}*.\n\n` +
        `It only takes a few minutes to finish! 📝\n\n` +
        `🔗 Continue your registration:\n${invite.short_link}\n\n` +
        `Your link expires in ${Math.ceil((new Date(invite.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days.`
      )
    } else if (invite.status === 'FILLED') {
      // Filled but not completed
      reminderMessage = encodeURIComponent(
        `Hi${recipientName ? ` ${recipientName}` : ''}! 👋\n\n` +
        `You're almost there! Your registration as a *${partnerTypeDisplay}* is nearly complete.\n\n` +
        `Please submit your application to finalize the process. ✅\n\n` +
        `🔗 Complete final step:\n${invite.short_link}\n\n` +
        `Don't let this opportunity slip away!`
      )
    }

    // Generate WhatsApp URL
    const whatsappUrl = `https://wa.me/${invite.mobile_number.replace('+', '')}?text=${reminderMessage}`

    // Prepare response
    const response = {
      success: true,
      data: {
        inviteId: updatedInvite.id,
        reminderCount: updatedInvite.reminder_count,
        lastReminderAt: updatedInvite.last_reminder_at,
        channel: reminderChannel,
        whatsappUrl: reminderChannel === 'WHATSAPP' ? whatsappUrl : undefined,
        recipientName: invite.recipient_name,
        mobileNumber: invite.mobile_number,
        partnerType: invite.partner_type,
        status: invite.status,
        daysUntilExpiry: Math.ceil(
          (new Date(invite.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
      message: `Reminder sent successfully (${updatedInvite.reminder_count} of 5)`,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    apiLogger.error('Error in send reminder API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
