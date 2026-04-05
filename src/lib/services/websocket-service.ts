/**
 * WebSocket Real-Time Service
 * Provides real-time message delivery, typing indicators, and presence detection
 * Uses Supabase Realtime under the hood for serverless compatibility
 */

import { createClient } from '@/lib/supabase/server'
import { RealtimeChannel } from '@supabase/supabase-js'

// Event types
export type WebSocketEventType =
  | 'message'
  | 'typing_start'
  | 'typing_stop'
  | 'presence_join'
  | 'presence_leave'
  | 'session_start'
  | 'session_end'
  | 'lead_created'
  | 'agent_assigned'

export interface WebSocketMessage {
  event: WebSocketEventType
  channel: string
  payload: Record<string, unknown>
  timestamp: string
  sender_id?: string
  sender_type?: 'user' | 'bot' | 'agent'
}

export interface PresenceState {
  user_id: string
  online_at: string
  status: 'online' | 'away' | 'busy'
  metadata?: Record<string, unknown>
}

export interface TypingIndicator {
  session_id: string
  user_id: string
  is_typing: boolean
  started_at: string
}

// Channel naming conventions
export const CHANNEL_PREFIXES = {
  SESSION: 'session:',
  CHATBOT: 'chatbot:',
  AGENT: 'agent:',
  ORGANIZATION: 'org:'
}

/**
 * WebSocket Service Class
 * Note: For serverless environments, this uses Supabase Realtime
 * For dedicated servers, you can extend this with Socket.io
 */
export class WebSocketService {
  private static channels: Map<string, RealtimeChannel> = new Map()

  /**
   * Get channel name for a session
   */
  static getSessionChannel(sessionId: string): string {
    return `${CHANNEL_PREFIXES.SESSION}${sessionId}`
  }

  /**
   * Get channel name for a chatbot
   */
  static getChatbotChannel(chatbotId: string): string {
    return `${CHANNEL_PREFIXES.CHATBOT}${chatbotId}`
  }

  /**
   * Get channel name for an agent
   */
  static getAgentChannel(agentId: string): string {
    return `${CHANNEL_PREFIXES.AGENT}${agentId}`
  }

  /**
   * Broadcast a message to a channel via Supabase Realtime
   */
  static async broadcast(
    channelName: string,
    event: WebSocketEventType,
    payload: Record<string, unknown>,
    senderId?: string,
    senderType?: 'user' | 'bot' | 'agent'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      const message: WebSocketMessage = {
        event,
        channel: channelName,
        payload,
        timestamp: new Date().toISOString(),
        sender_id: senderId,
        sender_type: senderType
      }

      // Store message in database for persistence
      await supabase
        .from('realtime_messages')
        .insert({
          channel: channelName,
          event_type: event,
          payload: message,
          created_at: new Date().toISOString()
        })

      // Broadcast via Supabase Realtime
      const channel = supabase.channel(channelName)
      await channel.send({
        type: 'broadcast',
        event: event,
        payload: message
      })

      return { success: true }
    } catch (error) {
      console.error('Broadcast error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Broadcast failed'
      }
    }
  }

  /**
   * Send a chat message in real-time
   */
  static async sendMessage(
    sessionId: string,
    content: string,
    senderId: string,
    senderType: 'user' | 'bot' | 'agent',
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const supabase = await createClient()
      const channelName = this.getSessionChannel(sessionId)

      // Store message
      const { data: message, error } = await supabase
        .from('chatbot_messages')
        .insert({
          session_id: sessionId,
          content,
          sender_id: senderId,
          sender_type: senderType,
          metadata,
          created_at: new Date().toISOString()
        })
        .select('id')
        .maybeSingle()

      if (error) throw error

      // Broadcast to channel
      await this.broadcast(
        channelName,
        'message',
        {
          message_id: message.id,
          content,
          metadata
        },
        senderId,
        senderType
      )

      return { success: true, messageId: message.id }
    } catch (error) {
      console.error('Send message error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed'
      }
    }
  }

  /**
   * Update typing indicator
   */
  static async setTypingIndicator(
    sessionId: string,
    userId: string,
    isTyping: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const channelName = this.getSessionChannel(sessionId)

      await this.broadcast(
        channelName,
        isTyping ? 'typing_start' : 'typing_stop',
        {
          session_id: sessionId,
          user_id: userId,
          is_typing: isTyping
        },
        userId
      )

      return { success: true }
    } catch (error) {
      console.error('Typing indicator error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update typing indicator'
      }
    }
  }

  /**
   * Track presence join
   */
  static async trackPresenceJoin(
    channelName: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      // Update presence in database
      await supabase
        .from('user_presence')
        .upsert({
          user_id: userId,
          channel: channelName,
          status: 'online',
          last_seen: new Date().toISOString(),
          metadata
        }, {
          onConflict: 'user_id,channel'
        })

      // Broadcast presence
      await this.broadcast(
        channelName,
        'presence_join',
        {
          user_id: userId,
          status: 'online',
          metadata
        },
        userId
      )

      return { success: true }
    } catch (error) {
      console.error('Presence join error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track presence'
      }
    }
  }

  /**
   * Track presence leave
   */
  static async trackPresenceLeave(
    channelName: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient()

      // Update presence in database
      await supabase
        .from('user_presence')
        .update({
          status: 'offline',
          last_seen: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('channel', channelName)

      // Broadcast presence
      await this.broadcast(
        channelName,
        'presence_leave',
        {
          user_id: userId,
          status: 'offline'
        },
        userId
      )

      return { success: true }
    } catch (error) {
      console.error('Presence leave error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track presence'
      }
    }
  }

  /**
   * Get current presence for a channel
   */
  static async getChannelPresence(
    channelName: string
  ): Promise<{ success: boolean; presence?: PresenceState[]; error?: string }> {
    try {
      const supabase = await createClient()
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

      const { data, error } = await supabase
        .from('user_presence')
        .select('user_id, last_seen, status, metadata')
        .eq('channel', channelName)
        .gte('last_seen', fiveMinutesAgo.toISOString())

      if (error) throw error

      const presence: PresenceState[] = (data || []).map(p => ({
        user_id: p.user_id,
        online_at: p.last_seen,
        status: p.status || 'online',
        metadata: p.metadata
      }))

      return { success: true, presence }
    } catch (error) {
      console.error('Get presence error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get presence'
      }
    }
  }

  /**
   * Notify agent of new session
   */
  static async notifyAgentNewSession(
    agentId: string,
    sessionData: {
      session_id: string
      chatbot_id: string
      chatbot_name: string
      visitor_info?: Record<string, unknown>
    }
  ): Promise<{ success: boolean; error?: string }> {
    const channelName = this.getAgentChannel(agentId)

    return this.broadcast(
      channelName,
      'session_start',
      sessionData
    )
  }

  /**
   * Notify agent of lead creation
   */
  static async notifyAgentNewLead(
    agentId: string,
    leadData: {
      lead_id: string
      name?: string
      phone?: string
      email?: string
      chatbot_name: string
      lead_score?: number
      lead_quality?: string
    }
  ): Promise<{ success: boolean; error?: string }> {
    const channelName = this.getAgentChannel(agentId)

    return this.broadcast(
      channelName,
      'lead_created',
      leadData
    )
  }

  /**
   * Notify chatbot channel of agent assignment
   */
  static async notifyAgentAssigned(
    chatbotId: string,
    assignmentData: {
      session_id: string
      agent_id: string
      agent_name: string
    }
  ): Promise<{ success: boolean; error?: string }> {
    const channelName = this.getChatbotChannel(chatbotId)

    return this.broadcast(
      channelName,
      'agent_assigned',
      assignmentData
    )
  }

  /**
   * Get recent messages for a session
   */
  static async getRecentMessages(
    sessionId: string,
    limit: number = 50
  ): Promise<{
    success: boolean
    messages?: Array<{
      id: string
      content: string
      sender_id: string
      sender_type: string
      created_at: string
    }>
    error?: string
  }> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chatbot_messages')
        .select('id, content, sender_id, sender_type, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      // Reverse to get chronological order
      const messages = (data || []).reverse()

      return { success: true, messages }
    } catch (error) {
      console.error('Get messages error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get messages'
      }
    }
  }

  /**
   * Subscribe to session updates (client-side helper)
   * Returns subscription configuration for client-side use
   */
  static getSubscriptionConfig(
    sessionId: string
  ): {
    channel: string
    events: WebSocketEventType[]
  } {
    return {
      channel: this.getSessionChannel(sessionId),
      events: ['message', 'typing_start', 'typing_stop', 'agent_assigned', 'session_end']
    }
  }

  /**
   * Clean up old presence records
   */
  static async cleanupOldPresence(): Promise<{
    success: boolean
    cleaned: number
    error?: string
  }> {
    try {
      const supabase = await createClient()
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('user_presence')
        .delete()
        .lt('last_seen', oneHourAgo.toISOString())
        .select('id')

      if (error) throw error

      return { success: true, cleaned: data?.length || 0 }
    } catch (error) {
      console.error('Cleanup presence error:', error)
      return {
        success: false,
        cleaned: 0,
        error: error instanceof Error ? error.message : 'Cleanup failed'
      }
    }
  }

  /**
   * Clean up old realtime messages
   */
  static async cleanupOldMessages(): Promise<{
    success: boolean
    cleaned: number
    error?: string
  }> {
    try {
      const supabase = await createClient()
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('realtime_messages')
        .delete()
        .lt('created_at', oneDayAgo.toISOString())
        .select('id')

      if (error) throw error

      return { success: true, cleaned: data?.length || 0 }
    } catch (error) {
      console.error('Cleanup messages error:', error)
      return {
        success: false,
        cleaned: 0,
        error: error instanceof Error ? error.message : 'Cleanup failed'
      }
    }
  }
}

/**
 * Client-side WebSocket helper for React components
 * This is a lightweight wrapper for Supabase Realtime subscriptions
 */
export class WebSocketClient {
  private channel: RealtimeChannel | null = null
  private supabase: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null

  constructor(
    private channelName: string,
    private onMessage: (message: WebSocketMessage) => void,
    private onPresence?: (presence: PresenceState[]) => void
  ) {}

  /**
   * Connect to channel (call this from useEffect)
   */
  async connect(supabaseClient: ReturnType<typeof import('@supabase/supabase-js').createClient>) {
    this.supabase = supabaseClient

    this.channel = this.supabase
      .channel(this.channelName)
      .on('broadcast', { event: '*' }, (payload) => {
        this.onMessage(payload.payload as WebSocketMessage)
      })

    if (this.onPresence) {
      this.channel.on('presence', { event: 'sync' }, () => {
        const state = this.channel?.presenceState()
        if (state) {
          const presence = Object.values(state).flat() as PresenceState[]
          this.onPresence?.(presence)
        }
      })
    }

    await this.channel.subscribe()
  }

  /**
   * Disconnect from channel (call this from useEffect cleanup)
   */
  async disconnect() {
    if (this.channel) {
      await this.supabase?.removeChannel(this.channel)
      this.channel = null
    }
  }

  /**
   * Send a message
   */
  async send(event: WebSocketEventType, payload: Record<string, unknown>) {
    if (this.channel) {
      await this.channel.send({
        type: 'broadcast',
        event,
        payload
      })
    }
  }

  /**
   * Track presence
   */
  async trackPresence(userId: string, metadata?: Record<string, unknown>) {
    if (this.channel) {
      await this.channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        status: 'online',
        metadata
      })
    }
  }
}

export default WebSocketService
