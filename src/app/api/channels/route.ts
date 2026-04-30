
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getChannelConfigs,
  getChannelConfig,
  upsertChannelConfig,
  processInboundMessage,
  sendOutboundMessage,
  getActiveChatSessions,
  createChatSession,
  assignChatSession,
  addChatMessage,
  getChatMessages,
  closeChatSession,
  getChannelStats,
  initializeChannelConfigs
} from '@/lib/tickets/multichannel-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/channels
 * Get channel configurations, chat sessions, or statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'configs'

    // Mode: Get channel configurations
    if (mode === 'configs') {
      const configs = await getChannelConfigs()
      return NextResponse.json({ configs })
    }

    // Mode: Get single channel config
    if (mode === 'config') {
      const channelType = searchParams.get('channel_type') as any
      if (!channelType) {
        return NextResponse.json({ success: false, error: 'channel_type required' }, { status: 400 })
      }
      const config = await getChannelConfig(channelType)
      return NextResponse.json({ config })
    }

    // Mode: Get active chat sessions (requires auth)
    if (mode === 'chat_sessions') {
      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const agentId = searchParams.get('agent_id') || undefined
      const sessions = await getActiveChatSessions(agentId)
      return NextResponse.json({ sessions })
    }

    // Mode: Get chat messages
    if (mode === 'chat_messages') {
      const sessionId = searchParams.get('session_id')
      if (!sessionId) {
        return NextResponse.json({ success: false, error: 'session_id required' }, { status: 400 })
      }

      const limit = parseInt(searchParams.get('limit') || '50')
      const messages = await getChatMessages(sessionId, limit)
      return NextResponse.json({ messages })
    }

    // Mode: Get channel statistics (requires auth)
    if (mode === 'stats') {
      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const days = parseInt(searchParams.get('days') || '7')
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const stats = await getChannelStats(startDate, endDate)
      return NextResponse.json({ stats })
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Channels API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/channels
 * Process messages, manage chat sessions, or update configs
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action } = body

    // Action: Process inbound message (from webhooks - no auth required)
    if (action === 'inbound') {
      const { channel_type, channel_id, sender_id, sender_name, sender_email, sender_phone, subject, content, attachments, metadata } = body

      if (!channel_type || !sender_id || !content) {
        return NextResponse.json(
          { error: 'channel_type, sender_id, and content are required' },
          { status: 400 }
        )
      }

      const result = await processInboundMessage({
        channel_type,
        channel_id: channel_id || 'default',
        sender_id,
        sender_name,
        sender_email,
        sender_phone,
        subject,
        content,
        attachments,
        metadata
      })

      return NextResponse.json(result)
    }

    // Action: Send outbound message (requires auth)
    if (action === 'outbound') {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const { channel_type, channel_id, ticket_id, ticket_source, recipient_id, recipient_email, recipient_phone, subject, content, template_id, template_data } = body

      if (!channel_type || !ticket_id || !ticket_source || !content) {
        return NextResponse.json(
          { error: 'channel_type, ticket_id, ticket_source, and content are required' },
          { status: 400 }
        )
      }

      const result = await sendOutboundMessage({
        channel_type,
        channel_id: channel_id || 'default',
        ticket_id,
        ticket_source,
        recipient_id: recipient_id || '',
        recipient_email,
        recipient_phone,
        subject,
        content,
        template_id,
        template_data
      })

      return NextResponse.json(result)
    }

    // Action: Start chat session (for visitors - no auth required)
    if (action === 'start_chat') {
      const { channel_type, channel_id, visitor_id, visitor_name, visitor_email } = body

      if (!visitor_id) {
        return NextResponse.json({ success: false, error: 'visitor_id required' }, { status: 400 })
      }

      const session = await createChatSession({
        channel_type: channel_type || 'web_chat',
        channel_id: channel_id || 'default',
        visitor_id,
        visitor_name,
        visitor_email,
        status: 'waiting'
      })

      if (!session) {
        return NextResponse.json({ success: false, error: 'Failed to create chat session' }, { status: 500 })
      }

      return NextResponse.json({ session })
    }

    // Action: Assign chat to agent (requires auth)
    if (action === 'assign_chat') {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const { session_id, agent_id, agent_name } = body
      if (!session_id || !agent_id) {
        return NextResponse.json({ success: false, error: 'session_id and agent_id required' }, { status: 400 })
      }

      const success = await assignChatSession(session_id, agent_id, agent_name || 'Agent')
      return NextResponse.json({ success })
    }

    // Action: Send chat message
    if (action === 'chat_message') {
      const { session_id, sender_type, sender_id, sender_name, message, message_type, attachment_url } = body

      if (!session_id || !message) {
        return NextResponse.json({ success: false, error: 'session_id and message required' }, { status: 400 })
      }

      const chatMessage = await addChatMessage({
        session_id,
        sender_type: sender_type || 'visitor',
        sender_id,
        sender_name,
        message,
        message_type: message_type || 'text',
        attachment_url
      })

      if (!chatMessage) {
        return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 })
      }

      return NextResponse.json({ message: chatMessage })
    }

    // Action: Close chat session
    if (action === 'close_chat') {
      const { session_id, create_ticket } = body
      if (!session_id) {
        return NextResponse.json({ success: false, error: 'session_id required' }, { status: 400 })
      }

      const result = await closeChatSession(session_id, create_ticket !== false)
      return NextResponse.json(result)
    }

    // Action: Initialize channel configs (requires auth)
    if (action === 'initialize') {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      await initializeChannelConfigs()
      return NextResponse.json({ success: true, message: 'Channel configurations initialized' })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Channels API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/channels
 * Update channel configuration
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channel_type, ...updates } = body

    if (!channel_type) {
      return NextResponse.json({ success: false, error: 'channel_type required' }, { status: 400 })
    }

    // Get existing config
    const existing = await getChannelConfig(channel_type)
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Channel not found' }, { status: 404 })
    }

    const config = await upsertChannelConfig({
      ...existing,
      ...updates,
      channel_type
    })

    if (!config) {
      return NextResponse.json({ success: false, error: 'Failed to update configuration' }, { status: 500 })
    }

    return NextResponse.json({ config })
  } catch (error) {
    apiLogger.error('Channels API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
