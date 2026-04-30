
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

// Initialize Supabase with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Meta WhatsApp Cloud API base URL
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'

interface SendMessageRequest {
  accountId: string
  phoneNumber: string
  messageType: 'text' | 'template' | 'image' | 'document' | 'video'
  content?: string
  templateName?: string
  templateLanguage?: string
  templateComponents?: any[]
  mediaUrl?: string
  mediaCaption?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json()
    const {
      accountId,
      phoneNumber,
      messageType,
      content,
      templateName,
      templateLanguage = 'en',
      templateComponents,
      mediaUrl,
      mediaCaption,
    } = body

    if (!accountId || !phoneNumber) {
      return NextResponse.json(
        { error: 'Account ID and phone number are required' },
        { status: 400 }
      )
    }

    // Get WhatsApp business account
    const { data: account, error: accountError } = await supabase
      .from('whatsapp_business_accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'WhatsApp account not found' }, { status: 404 })
    }

    if (account.status !== 'active') {
      return NextResponse.json(
        { error: 'WhatsApp account is not active' },
        { status: 400 }
      )
    }

    // Check daily limit
    if (account.messages_sent_today >= account.daily_limit) {
      return NextResponse.json(
        { error: 'Daily message limit reached' },
        { status: 429 }
      )
    }

    // Format phone number (remove any non-numeric characters except +)
    const formattedPhone = phoneNumber.replace(/[^0-9]/g, '')

    // Build message payload based on type
    let messagePayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
    }

    switch (messageType) {
      case 'text':
        if (!content) {
          return NextResponse.json({ success: false, error: 'Message content is required' }, { status: 400 })
        }
        messagePayload.type = 'text'
        messagePayload.text = { body: content, preview_url: true }
        break

      case 'template':
        if (!templateName) {
          return NextResponse.json({ success: false, error: 'Template name is required' }, { status: 400 })
        }
        messagePayload.type = 'template'
        messagePayload.template = {
          name: templateName,
          language: { code: templateLanguage },
        }
        if (templateComponents && templateComponents.length > 0) {
          messagePayload.template.components = templateComponents
        }
        break

      case 'image':
        if (!mediaUrl) {
          return NextResponse.json({ success: false, error: 'Media URL is required' }, { status: 400 })
        }
        messagePayload.type = 'image'
        messagePayload.image = { link: mediaUrl }
        if (mediaCaption) {
          messagePayload.image.caption = mediaCaption
        }
        break

      case 'document':
        if (!mediaUrl) {
          return NextResponse.json({ success: false, error: 'Media URL is required' }, { status: 400 })
        }
        messagePayload.type = 'document'
        messagePayload.document = { link: mediaUrl }
        if (mediaCaption) {
          messagePayload.document.caption = mediaCaption
        }
        break

      case 'video':
        if (!mediaUrl) {
          return NextResponse.json({ success: false, error: 'Media URL is required' }, { status: 400 })
        }
        messagePayload.type = 'video'
        messagePayload.video = { link: mediaUrl }
        if (mediaCaption) {
          messagePayload.video.caption = mediaCaption
        }
        break

      default:
        return NextResponse.json({ success: false, error: 'Invalid message type' }, { status: 400 })
    }

    // Send message via WhatsApp Cloud API
    const response = await fetch(
      `${WHATSAPP_API_URL}/${account.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      }
    )

    const responseData = await response.json()

    if (!response.ok) {
      apiLogger.error('WhatsApp API error', responseData)

      // Log failed message
      await supabase.from('whatsapp_messages').insert({
        account_id: accountId,
        direction: 'outbound',
        message_type: messageType,
        phone_number: formattedPhone,
        content: content || templateName,
        template_name: templateName,
        media_url: mediaUrl,
        status: 'failed',
        error_code: responseData.error?.code?.toString(),
        error_message: responseData.error?.message,
      })

      return NextResponse.json(
        {
          error: responseData.error?.message || 'Failed to send message',
          code: responseData.error?.code,
        },
        { status: response.status }
      )
    }

    const messageId = responseData.messages?.[0]?.id

    // Update or create conversation
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .upsert({
        account_id: accountId,
        phone_number: formattedPhone,
        window_start: new Date().toISOString(),
        window_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        last_message_at: new Date().toISOString(),
        last_message_direction: 'outbound',
        messages_sent: 1,
      }, {
        onConflict: 'account_id,phone_number',
      })
      .select()
      .maybeSingle()

    // Log successful message
    await supabase.from('whatsapp_messages').insert({
      account_id: accountId,
      conversation_id: conversation?.id,
      direction: 'outbound',
      message_type: messageType,
      phone_number: formattedPhone,
      content: content || templateName,
      template_name: templateName,
      media_url: mediaUrl,
      status: 'sent',
      provider_message_id: messageId,
      sent_at: new Date().toISOString(),
    })

    // Update daily count
    await supabase
      .from('whatsapp_business_accounts')
      .update({
        messages_sent_today: account.messages_sent_today + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)

    return NextResponse.json({
      success: true,
      messageId,
      to: formattedPhone,
    })
  } catch (error: unknown) {
    apiLogger.error('WhatsApp send error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
