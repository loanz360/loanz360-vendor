export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

// Initialize Supabase with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Webhook verification (GET request from Meta)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Get verify token from environment or database
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 403 })
}

// Handle incoming webhooks (POST request)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Log webhook for debugging

    // Process each entry
    const entries = body.entry || []

    for (const entry of entries) {
      const changes = entry.changes || []

      for (const change of changes) {
        if (change.field !== 'messages') continue

        const value = change.value
        const phoneNumberId = value.metadata?.phone_number_id

        // Find the account by phone_number_id
        const { data: account } = await supabase
          .from('whatsapp_business_accounts')
          .select('id')
          .eq('phone_number_id', phoneNumberId)
          .maybeSingle()

        if (!account) {
          continue
        }

        // Process message status updates
        const statuses = value.statuses || []
        for (const status of statuses) {
          await processStatusUpdate(account.id, status)
        }

        // Process incoming messages
        const messages = value.messages || []
        for (const message of messages) {
          await processIncomingMessage(account.id, message, value.contacts?.[0])
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    apiLogger.error('WhatsApp webhook error', error)
    // Return 500 for retriable errors so Meta retries, 200 for non-retriable
    const isRetriable = error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.status === 503
    if (isRetriable) {
      return NextResponse.json({ success: false, error: 'Temporary error' }, { status: 500 })
    }
    // Non-retriable errors - acknowledge to prevent infinite retries
    return NextResponse.json({ success: true })
  }
}

async function processStatusUpdate(accountId: string, status: any) {
  const messageId = status.id
  const statusType = status.status // sent, delivered, read, failed
  const timestamp = status.timestamp
    ? new Date(parseInt(status.timestamp) * 1000).toISOString()
    : new Date().toISOString()

  const updateData: any = {
    status: statusType,
    updated_at: new Date().toISOString(),
  }

  switch (statusType) {
    case 'sent':
      updateData.sent_at = timestamp
      break
    case 'delivered':
      updateData.delivered_at = timestamp
      break
    case 'read':
      updateData.read_at = timestamp
      break
    case 'failed':
      updateData.error_code = status.errors?.[0]?.code?.toString()
      updateData.error_message = status.errors?.[0]?.message
      break
  }

  // Update message status
  await supabase
    .from('whatsapp_messages')
    .update(updateData)
    .eq('provider_message_id', messageId)

  // Also update campaign recipient if this was part of a campaign
  await supabase
    .from('whatsapp_campaign_recipients')
    .update({
      status: statusType,
      ...(statusType === 'delivered' && { delivered_at: timestamp }),
      ...(statusType === 'read' && { read_at: timestamp }),
      ...(statusType === 'failed' && {
        error_code: status.errors?.[0]?.code?.toString(),
        error_message: status.errors?.[0]?.message,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('message_id', messageId)
}

async function processIncomingMessage(
  accountId: string,
  message: any,
  contact: any
) {
  const phoneNumber = message.from
  const messageType = message.type
  const timestamp = message.timestamp
    ? new Date(parseInt(message.timestamp) * 1000).toISOString()
    : new Date().toISOString()

  // Get message content based on type
  let content = ''
  let mediaUrl = ''
  let mediaMimeType = ''

  switch (messageType) {
    case 'text':
      content = message.text?.body || ''
      break
    case 'image':
      mediaUrl = message.image?.id || ''
      mediaMimeType = message.image?.mime_type || ''
      content = message.image?.caption || ''
      break
    case 'video':
      mediaUrl = message.video?.id || ''
      mediaMimeType = message.video?.mime_type || ''
      content = message.video?.caption || ''
      break
    case 'audio':
      mediaUrl = message.audio?.id || ''
      mediaMimeType = message.audio?.mime_type || ''
      break
    case 'document':
      mediaUrl = message.document?.id || ''
      mediaMimeType = message.document?.mime_type || ''
      content = message.document?.filename || ''
      break
    case 'location':
      content = JSON.stringify({
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name,
        address: message.location?.address,
      })
      break
    case 'contacts':
      content = JSON.stringify(message.contacts)
      break
    case 'button':
      content = message.button?.text || message.button?.payload || ''
      break
    case 'interactive':
      if (message.interactive?.type === 'button_reply') {
        content = message.interactive.button_reply?.title || ''
      } else if (message.interactive?.type === 'list_reply') {
        content = message.interactive.list_reply?.title || ''
      }
      break
  }

  // Update or create conversation
  const { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .upsert({
      account_id: accountId,
      phone_number: phoneNumber,
      contact_name: contact?.profile?.name,
      window_start: timestamp,
      window_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      last_message_at: timestamp,
      last_message_direction: 'inbound',
    }, {
      onConflict: 'account_id,phone_number',
    })
    .select()
    .maybeSingle()

  // Increment messages received
  if (conversation) {
    await supabase
      .from('whatsapp_conversations')
      .update({
        messages_received: (conversation.messages_received || 0) + 1,
      })
      .eq('id', conversation.id)
  }

  // Log incoming message
  await supabase.from('whatsapp_messages').insert({
    account_id: accountId,
    conversation_id: conversation?.id,
    direction: 'inbound',
    message_type: messageType,
    phone_number: phoneNumber,
    content: content,
    media_url: mediaUrl,
    media_mime_type: mediaMimeType,
    status: 'received',
    provider_message_id: message.id,
    provider_timestamp: timestamp,
    created_at: timestamp,
  })

  // Check for chatbot triggers
  if (messageType === 'text' && content) {
    await processChatbotTriggers(accountId, phoneNumber, content.toLowerCase())
  }
}

async function processChatbotTriggers(
  accountId: string,
  phoneNumber: string,
  messageContent: string
) {
  // Get active chatbot flows for this account
  const { data: flows } = await supabase
    .from('whatsapp_chatbot_flows')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_active', true)

  if (!flows || flows.length === 0) return

  for (const flow of flows) {
    const keywords = flow.trigger_keywords || []
    const triggered = keywords.some((keyword: string) =>
      messageContent.includes(keyword.toLowerCase())
    )

    if (triggered) {
      // Update trigger count
      await supabase
        .from('whatsapp_chatbot_flows')
        .update({
          triggers_count: (flow.triggers_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', flow.id)

      // Execute flow (simplified - in production this would be more complex)
      // For now, just log that a flow was triggered

      // You would typically process flow_data here to send automated responses
      break // Only trigger first matching flow
    }
  }
}
