import { createClient } from '@/lib/supabase/server'

// ============================================================================
// TYPES
// ============================================================================

export type ChannelType = 'email' | 'sms' | 'whatsapp' | 'web_chat' | 'phone' | 'portal'

export interface ChannelConfig {
  id: string
  channel_type: ChannelType
  name: string
  is_active: boolean
  config: Record<string, any>
  auto_create_ticket: boolean
  default_priority: string
  default_category?: string
  welcome_message?: string
  working_hours?: {
    enabled: boolean
    timezone: string
    schedule: Record<string, { start: string; end: string } | null>
  }
  created_at?: string
  updated_at?: string
}

export interface InboundMessage {
  id: string
  channel_type: ChannelType
  channel_id: string
  external_id?: string
  sender_id: string
  sender_name?: string
  sender_email?: string
  sender_phone?: string
  subject?: string
  content: string
  attachments?: Array<{
    name: string
    url: string
    type: string
    size: number
  }>
  metadata?: Record<string, any>
  ticket_id?: string
  ticket_source?: string
  status: 'pending' | 'processed' | 'failed' | 'ignored'
  processed_at?: string
  error_message?: string
  created_at: string
}

export interface OutboundMessage {
  id: string
  channel_type: ChannelType
  channel_id: string
  ticket_id: string
  ticket_source: string
  recipient_id: string
  recipient_email?: string
  recipient_phone?: string
  subject?: string
  content: string
  template_id?: string
  template_data?: Record<string, any>
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read'
  external_id?: string
  sent_at?: string
  delivered_at?: string
  read_at?: string
  error_message?: string
  created_at: string
}

export interface ChatSession {
  id: string
  channel_type: ChannelType
  channel_id: string
  visitor_id: string
  visitor_name?: string
  visitor_email?: string
  assigned_agent_id?: string
  assigned_agent_name?: string
  ticket_id?: string
  ticket_source?: string
  status: 'waiting' | 'active' | 'closed' | 'transferred'
  started_at: string
  ended_at?: string
  last_message_at?: string
  messages_count: number
  rating?: number
  feedback?: string
}

export interface ChatMessage {
  id: string
  session_id: string
  sender_type: 'visitor' | 'agent' | 'bot'
  sender_id?: string
  sender_name?: string
  message: string
  message_type: 'text' | 'image' | 'file' | 'system'
  attachment_url?: string
  created_at: string
  read_at?: string
}

// ============================================================================
// CHANNEL CONFIGURATION
// ============================================================================

/**
 * Get all channel configurations
 */
export async function getChannelConfigs(): Promise<ChannelConfig[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('channel_configs')
    .select('*')
    .order('channel_type')

  if (error) {
    console.error('Error fetching channel configs:', error)
    return []
  }

  return data || []
}

/**
 * Get channel configuration by type
 */
export async function getChannelConfig(channelType: ChannelType): Promise<ChannelConfig | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('channel_configs')
    .select('*')
    .eq('channel_type', channelType)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    return null
  }

  return data
}

/**
 * Create or update channel configuration
 */
export async function upsertChannelConfig(config: Omit<ChannelConfig, 'id' | 'created_at' | 'updated_at'>): Promise<ChannelConfig | null> {
  const supabase = await createClient()

  // Check if exists
  const { data: existing } = await supabase
    .from('channel_configs')
    .select('id')
    .eq('channel_type', config.channel_type)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('channel_configs')
      .update({
        ...config,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle()

    if (error) return null
    return data
  } else {
    const { data, error } = await supabase
      .from('channel_configs')
      .insert({
        ...config,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (error) return null
    return data
  }
}

// ============================================================================
// INBOUND MESSAGE PROCESSING
// ============================================================================

/**
 * Process an inbound message from any channel
 */
export async function processInboundMessage(message: Omit<InboundMessage, 'id' | 'created_at' | 'status'>): Promise<{
  success: boolean
  message_id?: string
  ticket_id?: string
  ticket_source?: string
  error?: string
}> {
  const supabase = await createClient()

  try {
    // Get channel config
    const channelConfig = await getChannelConfig(message.channel_type)
    if (!channelConfig || !channelConfig.is_active) {
      return { success: false, error: 'Channel not configured or inactive' }
    }

    // Save inbound message
    const { data: savedMessage, error: saveError } = await supabase
      .from('inbound_messages')
      .insert({
        ...message,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (saveError) {
      return { success: false, error: saveError.message }
    }

    // Try to find existing ticket
    let ticketId: string | undefined
    let ticketSource: string | undefined

    // Check if this is a reply to existing ticket
    if (message.metadata?.ticket_reference) {
      // Find by reference number
      const refMatch = message.subject?.match(/\[#([A-Z0-9-]+)\]/) ||
                       message.content?.match(/\[#([A-Z0-9-]+)\]/)
      if (refMatch) {
        const refNumber = refMatch[1]
        // Search across all ticket tables
        for (const source of ['CUSTOMER', 'PARTNER', 'EMPLOYEE'] as const) {
          const tableName = {
            CUSTOMER: 'customer_tickets',
            PARTNER: 'partner_tickets',
            EMPLOYEE: 'employee_tickets'
          }[source]

          const { data: ticket } = await supabase
            .from(tableName)
            .select('id')
            .eq('ticket_number', refNumber)
            .maybeSingle()

          if (ticket) {
            ticketId = ticket.id
            ticketSource = source
            break
          }
        }
      }
    }

    // Check by sender email/phone for recent open tickets
    if (!ticketId && (message.sender_email || message.sender_phone)) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data: recentTicket } = await supabase
        .from('customer_tickets')
        .select('id')
        .or(`customer_email.eq.${message.sender_email},customer_phone.eq.${message.sender_phone}`)
        .in('status', ['open', 'in_progress', 'pending'])
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentTicket) {
        ticketId = recentTicket.id
        ticketSource = 'CUSTOMER'
      }
    }

    // Create new ticket if auto_create is enabled and no existing ticket found
    if (!ticketId && channelConfig.auto_create_ticket) {
      const ticketData = {
        subject: message.subject || `${message.channel_type.toUpperCase()} inquiry`,
        description: message.content,
        priority: channelConfig.default_priority || 'medium',
        category: channelConfig.default_category || 'general_inquiry',
        status: 'open',
        source_channel: message.channel_type,
        customer_name: message.sender_name,
        customer_email: message.sender_email,
        customer_phone: message.sender_phone,
        created_at: new Date().toISOString()
      }

      const { data: newTicket, error: ticketError } = await supabase
        .from('customer_tickets')
        .insert(ticketData)
        .select()
        .maybeSingle()

      if (!ticketError && newTicket) {
        ticketId = newTicket.id
        ticketSource = 'CUSTOMER'

        // Send welcome message if configured
        if (channelConfig.welcome_message) {
          await sendOutboundMessage({
            channel_type: message.channel_type,
            channel_id: message.channel_id,
            ticket_id: ticketId,
            ticket_source: ticketSource,
            recipient_id: message.sender_id,
            recipient_email: message.sender_email,
            recipient_phone: message.sender_phone,
            content: channelConfig.welcome_message.replace('{ticket_number}', newTicket.ticket_number || ticketId)
          })
        }
      }
    }

    // If we have a ticket, add message to conversation
    if (ticketId && ticketSource) {
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        ticket_source: ticketSource,
        message: message.content,
        sender_type: 'customer',
        sender_name: message.sender_name || 'Customer',
        sender_id: message.sender_id,
        channel: message.channel_type,
        attachments: message.attachments,
        created_at: new Date().toISOString()
      })

      // Update inbound message with ticket info
      await supabase
        .from('inbound_messages')
        .update({
          ticket_id: ticketId,
          ticket_source: ticketSource,
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', savedMessage.id)
    }

    return {
      success: true,
      message_id: savedMessage.id,
      ticket_id: ticketId,
      ticket_source: ticketSource
    }
  } catch (error: unknown) {
    console.error('Error processing inbound message:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// OUTBOUND MESSAGE SENDING
// ============================================================================

/**
 * Send an outbound message
 */
export async function sendOutboundMessage(message: Omit<OutboundMessage, 'id' | 'created_at' | 'status'>): Promise<{
  success: boolean
  message_id?: string
  error?: string
}> {
  const supabase = await createClient()

  try {
    // Save outbound message
    const { data: savedMessage, error: saveError } = await supabase
      .from('outbound_messages')
      .insert({
        ...message,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (saveError) {
      return { success: false, error: saveError.message }
    }

    // Actually send the message based on channel type
    let sendResult: { success: boolean; external_id?: string; error?: string }

    switch (message.channel_type) {
      case 'email':
        sendResult = await sendEmailMessage(message)
        break
      case 'sms':
        sendResult = await sendSMSMessage(message)
        break
      case 'whatsapp':
        sendResult = await sendWhatsAppMessage(message)
        break
      default:
        sendResult = { success: true } // For web_chat and portal, just store
    }

    // Update message status
    await supabase
      .from('outbound_messages')
      .update({
        status: sendResult.success ? 'sent' : 'failed',
        external_id: sendResult.external_id,
        sent_at: sendResult.success ? new Date().toISOString() : undefined,
        error_message: sendResult.error
      })
      .eq('id', savedMessage.id)

    // Also add to ticket messages
    await supabase.from('ticket_messages').insert({
      ticket_id: message.ticket_id,
      ticket_source: message.ticket_source,
      message: message.content,
      sender_type: 'agent',
      sender_name: 'Support Team',
      channel: message.channel_type,
      created_at: new Date().toISOString()
    })

    return {
      success: sendResult.success,
      message_id: savedMessage.id,
      error: sendResult.error
    }
  } catch (error: unknown) {
    console.error('Error sending outbound message:', error)
    return { success: false, error: error.message }
  }
}

// Channel-specific sending functions (these would integrate with actual APIs)
async function sendEmailMessage(message: Omit<OutboundMessage, 'id' | 'created_at' | 'status'>): Promise<{ success: boolean; external_id?: string; error?: string }> {
  // In production, this would use nodemailer, SendGrid, etc.
  console.log('Sending email to:', message.recipient_email)
  return { success: true, external_id: `email_${Date.now()}` }
}

async function sendSMSMessage(message: Omit<OutboundMessage, 'id' | 'created_at' | 'status'>): Promise<{ success: boolean; external_id?: string; error?: string }> {
  // In production, this would use Twilio, MSG91, etc.
  console.log('Sending SMS to:', message.recipient_phone)
  return { success: true, external_id: `sms_${Date.now()}` }
}

async function sendWhatsAppMessage(message: Omit<OutboundMessage, 'id' | 'created_at' | 'status'>): Promise<{ success: boolean; external_id?: string; error?: string }> {
  // In production, this would use WhatsApp Business API
  console.log('Sending WhatsApp to:', message.recipient_phone)
  return { success: true, external_id: `wa_${Date.now()}` }
}

// ============================================================================
// LIVE CHAT MANAGEMENT
// ============================================================================

/**
 * Create a new chat session
 */
export async function createChatSession(session: Omit<ChatSession, 'id' | 'started_at' | 'messages_count'>): Promise<ChatSession | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      ...session,
      started_at: new Date().toISOString(),
      messages_count: 0
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error creating chat session:', error)
    return null
  }

  return data
}

/**
 * Get active chat sessions
 */
export async function getActiveChatSessions(agentId?: string): Promise<ChatSession[]> {
  const supabase = await createClient()

  let query = supabase
    .from('chat_sessions')
    .select('*')
    .in('status', ['waiting', 'active'])
    .order('started_at', { ascending: true })

  if (agentId) {
    query = query.eq('assigned_agent_id', agentId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching chat sessions:', error)
    return []
  }

  return data || []
}

/**
 * Assign chat session to agent
 */
export async function assignChatSession(sessionId: string, agentId: string, agentName: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('chat_sessions')
    .update({
      assigned_agent_id: agentId,
      assigned_agent_name: agentName,
      status: 'active'
    })
    .eq('id', sessionId)

  return !error
}

/**
 * Add message to chat session
 */
export async function addChatMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      ...message,
      created_at: new Date().toISOString()
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error adding chat message:', error)
    return null
  }

  // Update session last_message_at and message count
  await supabase
    .from('chat_sessions')
    .update({
      last_message_at: new Date().toISOString(),
      messages_count: supabase.raw('messages_count + 1')
    })
    .eq('id', message.session_id)

  return data
}

/**
 * Get chat messages for a session
 */
export async function getChatMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error fetching chat messages:', error)
    return []
  }

  return data || []
}

/**
 * Close chat session and optionally create ticket
 */
export async function closeChatSession(sessionId: string, createTicket: boolean = true): Promise<{
  success: boolean
  ticket_id?: string
}> {
  const supabase = await createClient()

  // Get session
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) {
    return { success: false }
  }

  let ticketId: string | undefined = session.ticket_id

  // Create ticket if requested and not already linked
  if (createTicket && !session.ticket_id) {
    const messages = await getChatMessages(sessionId)
    const transcript = messages.map(m => `[${m.sender_type}] ${m.message}`).join('\n')

    const { data: ticket } = await supabase
      .from('customer_tickets')
      .insert({
        subject: 'Chat conversation',
        description: `Chat transcript:\n\n${transcript}`,
        priority: 'medium',
        category: 'general_inquiry',
        status: 'open',
        source_channel: 'web_chat',
        customer_name: session.visitor_name,
        customer_email: session.visitor_email,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (ticket) {
      ticketId = ticket.id
    }
  }

  // Close session
  await supabase
    .from('chat_sessions')
    .update({
      status: 'closed',
      ended_at: new Date().toISOString(),
      ticket_id: ticketId,
      ticket_source: ticketId ? 'CUSTOMER' : undefined
    })
    .eq('id', sessionId)

  return { success: true, ticket_id: ticketId }
}

// ============================================================================
// CHANNEL STATISTICS
// ============================================================================

/**
 * Get channel statistics
 */
export async function getChannelStats(startDate: Date, endDate: Date): Promise<Record<ChannelType, {
  inbound_count: number
  outbound_count: number
  avg_response_time_hours: number
  tickets_created: number
}>> {
  const supabase = await createClient()

  const stats: Record<string, any> = {}

  const channels: ChannelType[] = ['email', 'sms', 'whatsapp', 'web_chat', 'phone', 'portal']

  for (const channel of channels) {
    // Get inbound count
    const { count: inboundCount } = await supabase
      .from('inbound_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel_type', channel)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Get outbound count
    const { count: outboundCount } = await supabase
      .from('outbound_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel_type', channel)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Get tickets created from this channel
    const { count: ticketsCount } = await supabase
      .from('customer_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('source_channel', channel)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    stats[channel] = {
      inbound_count: inboundCount || 0,
      outbound_count: outboundCount || 0,
      avg_response_time_hours: 2.5, // Would calculate from actual data
      tickets_created: ticketsCount || 0
    }
  }

  return stats as Record<ChannelType, any>
}

/**
 * Get default channel configurations
 */
export const DEFAULT_CHANNEL_CONFIGS: Omit<ChannelConfig, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    channel_type: 'email',
    name: 'Email Support',
    is_active: true,
    config: {
      inbound_email: 'support@loanz360.com',
      smtp_host: '',
      smtp_port: 587,
      smtp_user: '',
      smtp_pass: ''
    },
    auto_create_ticket: true,
    default_priority: 'medium',
    welcome_message: 'Thank you for contacting Loanz360 Support. Your ticket [#{ticket_number}] has been created. We will respond within 24 hours.'
  },
  {
    channel_type: 'sms',
    name: 'SMS Support',
    is_active: true,
    config: {
      provider: 'msg91',
      sender_id: 'LOANZ',
      api_key: ''
    },
    auto_create_ticket: true,
    default_priority: 'high',
    welcome_message: 'Loanz360: Your support request #{ticket_number} has been received. Reply to this message for updates.'
  },
  {
    channel_type: 'whatsapp',
    name: 'WhatsApp Business',
    is_active: false,
    config: {
      provider: 'whatsapp_business',
      phone_number_id: '',
      access_token: ''
    },
    auto_create_ticket: true,
    default_priority: 'medium'
  },
  {
    channel_type: 'web_chat',
    name: 'Live Chat',
    is_active: true,
    config: {
      widget_color: '#3B82F6',
      position: 'bottom-right',
      offline_message: 'Our team is currently offline. Leave a message and we will get back to you.'
    },
    auto_create_ticket: true,
    default_priority: 'medium',
    welcome_message: 'Hello! Welcome to Loanz360 Support. How can we help you today?',
    working_hours: {
      enabled: true,
      timezone: 'Asia/Kolkata',
      schedule: {
        monday: { start: '09:00', end: '18:00' },
        tuesday: { start: '09:00', end: '18:00' },
        wednesday: { start: '09:00', end: '18:00' },
        thursday: { start: '09:00', end: '18:00' },
        friday: { start: '09:00', end: '18:00' },
        saturday: { start: '10:00', end: '14:00' },
        sunday: null
      }
    }
  },
  {
    channel_type: 'portal',
    name: 'Customer Portal',
    is_active: true,
    config: {},
    auto_create_ticket: true,
    default_priority: 'medium'
  }
]

/**
 * Initialize default channel configurations
 */
export async function initializeChannelConfigs(): Promise<void> {
  for (const config of DEFAULT_CHANNEL_CONFIGS) {
    await upsertChannelConfig(config)
  }
}
