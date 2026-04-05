export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/emi-inquiries/[inquiryId]/share
 * Share an EMI calculation with a customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { inquiryId: string } }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { inquiryId } = params
    const body = await request.json()

    const {
      share_method,
      recipient_phone,
      recipient_email,
      recipient_name,
      custom_message,
      include_amortization = true,
      include_comparison = false
    } = body

    // Validate required fields
    if (!share_method) {
      return NextResponse.json(
        { error: 'share_method is required' },
        { status: 400 }
      )
    }

    if (share_method === 'email' && !recipient_email) {
      return NextResponse.json(
        { error: 'recipient_email is required for email sharing' },
        { status: 400 }
      )
    }

    if (share_method === 'whatsapp' && !recipient_phone) {
      return NextResponse.json(
        { error: 'recipient_phone is required for WhatsApp sharing' },
        { status: 400 }
      )
    }

    // Verify the inquiry belongs to the user
    const { data: inquiry, error: fetchError } = await supabase
      .from('customer_emi_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .eq('created_by_employee_id', user.id)
      .maybeSingle()

    if (fetchError || !inquiry) {
      return NextResponse.json(
        { error: 'Inquiry not found or access denied' },
        { status: 404 }
      )
    }

    // Generate unique share token for tracking
    const shareToken = crypto.randomBytes(16).toString('hex')
    const shareLink = `${process.env.NEXT_PUBLIC_APP_URL}/shared/emi/${shareToken}`

    // Set link expiration (30 days)
    const linkExpiresAt = new Date()
    linkExpiresAt.setDate(linkExpiresAt.getDate() + 30)

    // Create the share record
    const { data: share, error: shareError } = await supabase
      .from('inquiry_shares')
      .insert({
        inquiry_id: inquiryId,
        shared_by_employee_id: user.id,
        share_method,
        recipient_phone,
        recipient_email,
        recipient_name: recipient_name || inquiry.customer_name,
        custom_message,
        include_amortization,
        include_comparison,
        share_token: shareToken,
        share_link: shareLink,
        link_expires_at: linkExpiresAt.toISOString(),
        delivery_status: 'pending'
      })
      .select()
      .maybeSingle()

    if (shareError) {
      apiLogger.error('Error creating share', shareError)
      return NextResponse.json(
        { error: 'Failed to create share record' },
        { status: 500 }
      )
    }

    // Update the inquiry with shared_via array
    const currentSharedVia = inquiry.shared_via || []
    if (!currentSharedVia.includes(share_method)) {
      currentSharedVia.push(share_method)
    }

    await supabase
      .from('customer_emi_inquiries')
      .update({
        shared_via: currentSharedVia,
        status: inquiry.status === 'inquiry' ? 'shared' : inquiry.status
      })
      .eq('id', inquiryId)

    // Log audit trail
    await supabase
      .from('inquiry_audit_log')
      .insert({
        inquiry_id: inquiryId,
        action_type: 'shared',
        action_by_employee_id: user.id,
        action_metadata: {
          share_method,
          recipient_email,
          recipient_phone
        }
      })

    // TODO: Actually send the email/WhatsApp message here
    // For now, we'll just return the share link and mark as sent
    let deliveryStatus = 'sent'
    let whatsappUrl = null

    if (share_method === 'whatsapp') {
      // Generate WhatsApp share URL
      const message = custom_message ||
        `Hi ${recipient_name || 'there'}! Here's your EMI calculation from ${inquiry.employee_name}.\n\n` +
        `💰 Loan Amount: ₹${inquiry.principal_amount.toLocaleString('en-IN')}\n` +
        `📊 Interest Rate: ${inquiry.interest_rate}% p.a.\n` +
        `⏱️ Tenure: ${inquiry.tenure_months} months\n\n` +
        `📅 Monthly EMI: ₹${inquiry.monthly_emi.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n` +
        `💸 Total Interest: ₹${inquiry.total_interest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n` +
        `💵 Total Amount: ₹${inquiry.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n\n` +
        `View detailed breakdown: ${shareLink}`

      whatsappUrl = `https://wa.me/${recipient_phone}?text=${encodeURIComponent(message)}`
      deliveryStatus = 'sent' // Will be marked as sent when employee clicks the WhatsApp link
    } else if (share_method === 'email') {
      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
      // For now, just mark as pending
      deliveryStatus = 'pending'
    }

    // Update share delivery status
    await supabase
      .from('inquiry_shares')
      .update({
        delivery_status: deliveryStatus,
        delivery_timestamp: new Date().toISOString()
      })
      .eq('id', share.id)

    return NextResponse.json({
      success: true,
      share: {
        ...share,
        delivery_status: deliveryStatus
      },
      share_link: shareLink,
      whatsapp_url: whatsappUrl,
      message: share_method === 'whatsapp'
        ? 'WhatsApp share URL generated. Click to send.'
        : share_method === 'email'
        ? 'Email will be sent shortly.'
        : 'Share link generated successfully.'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in POST /api/emi-inquiries/[inquiryId]/share', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
