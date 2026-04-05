/**
 * Google Calendar Integration Service
 * OAuth2 authentication, event management, and sync
 */

import { createClient } from '@/lib/supabase/client'
import { google } from 'googleapis'

// ==================== TYPES ====================

export interface CalendarProvider {
  id: string
  user_id: string
  provider: 'google' | 'microsoft' | 'apple'
  provider_account_id?: string
  provider_email?: string
  access_token: string
  refresh_token?: string
  token_expires_at?: string
  is_active: boolean
  is_primary: boolean
  last_sync_at?: string
  sync_status: 'connected' | 'syncing' | 'error' | 'disconnected'
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  calendar_provider_id: string
  provider_event_id?: string
  title: string
  description?: string
  location?: string
  start_time: string
  end_time: string
  timezone?: string
  is_all_day: boolean
  recurrence_rule?: string
  attendees?: Array<{
    email: string
    name?: string
    status: 'accepted' | 'declined' | 'tentative'
  }>
  organizer_email?: string
  meeting_link?: string
  meeting_platform?: string
  lead_id?: string
  interaction_type?: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  reminder_minutes?: number[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface AvailabilitySlot {
  slot_start: string
  slot_end: string
}

// ==================== GOOGLE CALENDAR SERVICE ====================

export class GoogleCalendarService {
  private supabase = createClient()

  // OAuth2 configuration
  private getOAuth2Client(userId?: string) {
    return new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    )
  }

  // ==================== OAUTH2 AUTHENTICATION ====================

  /**
   * Generate Google OAuth2 authorization URL
   */
  async getAuthorizationURL(userId: string, state?: string): Promise<string> {
    const oauth2Client = this.getOAuth2Client(userId)

    const scopes = [
      'https://www.googleapis.com/auth/calendar', // Full calendar access
      'https://www.googleapis.com/auth/calendar.events', // Event management
      'https://www.googleapis.com/auth/userinfo.email' // Email for identification
    ]

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: scopes,
      state: state || userId, // Pass user ID in state
      prompt: 'consent' // Force consent to get refresh token
    })

    return authUrl
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    userId: string,
    code: string
  ): Promise<{ success: boolean; provider?: CalendarProvider; error?: string }> {
    try {
      const oauth2Client = this.getOAuth2Client(userId)

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code)

      if (!tokens.access_token) {
        return { success: false, error: 'No access token received' }
      }

      // Set credentials
      oauth2Client.setCredentials(tokens)

      // Get user's email from Google
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data: userInfo } = await oauth2.userinfo.get()

      // Calculate token expiry
      const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined

      // Store provider connection
      const { data: provider, error } = await this.supabase
        .from('calendar_providers')
        .insert({
          user_id: userId,
          provider: 'google',
          provider_account_id: userInfo.id,
          provider_email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          scope: tokens.scope,
          is_active: true,
          is_primary: true, // First calendar is primary
          sync_status: 'connected'
        })
        .select()
        .maybeSingle()

      if (error) throw error

      return { success: true, provider }
    } catch (error: unknown) {
      console.error('Error exchanging code for tokens:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(provider: CalendarProvider): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    try {
      if (!provider.refresh_token) {
        return { success: false, error: 'No refresh token available' }
      }

      const oauth2Client = this.getOAuth2Client(provider.user_id)
      oauth2Client.setCredentials({
        refresh_token: provider.refresh_token
      })

      // Refresh token
      const { credentials } = await oauth2Client.refreshAccessToken()

      if (!credentials.access_token) {
        return { success: false, error: 'Failed to refresh token' }
      }

      // Update provider with new access token
      const expiresAt = credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : undefined

      await this.supabase
        .from('calendar_providers')
        .update({
          access_token: credentials.access_token,
          token_expires_at: expiresAt
        })
        .eq('id', provider.id)

      return { success: true, accessToken: credentials.access_token }
    } catch (error: unknown) {
      console.error('Error refreshing access token:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get authenticated calendar client
   */
  private async getCalendarClient(providerId: string) {
    // Get provider
    const { data: provider } = await this.supabase
      .from('calendar_providers')
      .select('*')
      .eq('id', providerId)
      .maybeSingle()

    if (!provider) {
      throw new Error('Calendar provider not found')
    }

    // Check if token needs refresh
    if (provider.token_expires_at && new Date(provider.token_expires_at) < new Date()) {
      const refreshResult = await this.refreshAccessToken(provider)
      if (!refreshResult.success) {
        throw new Error('Failed to refresh access token')
      }
      provider.access_token = refreshResult.accessToken!
    }

    // Create OAuth2 client
    const oauth2Client = this.getOAuth2Client(provider.user_id)
    oauth2Client.setCredentials({
      access_token: provider.access_token,
      refresh_token: provider.refresh_token
    })

    // Return Google Calendar API client
    return google.calendar({ version: 'v3', auth: oauth2Client })
  }

  // ==================== EVENT MANAGEMENT ====================

  /**
   * Create calendar event
   */
  async createEvent(
    providerId: string,
    event: {
      title: string
      description?: string
      location?: string
      start_time: string
      end_time: string
      timezone?: string
      attendees?: Array<{ email: string; name?: string }>
      lead_id?: string
      interaction_type?: string
      reminder_minutes?: number[]
    },
    userId?: string
  ): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
    try {
      const calendar = await this.getCalendarClient(providerId)

      // Format event for Google Calendar
      const googleEvent = {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.start_time,
          timeZone: event.timezone || 'UTC'
        },
        end: {
          dateTime: event.end_time,
          timeZone: event.timezone || 'UTC'
        },
        attendees: event.attendees?.map(a => ({ email: a.email, displayName: a.name })),
        reminders: event.reminder_minutes
          ? {
              useDefault: false,
              overrides: event.reminder_minutes.map(m => ({ method: 'email', minutes: m }))
            }
          : { useDefault: true },
        conferenceData: {
          createRequest: {
            requestId: `${Date.now()}`, // Unique request ID
            conferenceSolutionKey: { type: 'hangoutsMeet' } // Google Meet
          }
        }
      }

      // Create event in Google Calendar
      const { data: googleEventData } = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: googleEvent,
        conferenceDataVersion: 1 // Enable Google Meet
      })

      // Store event in database
      const { data: dbEvent, error } = await this.supabase
        .from('calendar_events')
        .insert({
          calendar_provider_id: providerId,
          provider_event_id: googleEventData.id,
          title: event.title,
          description: event.description,
          location: event.location,
          start_time: event.start_time,
          end_time: event.end_time,
          timezone: event.timezone || 'UTC',
          is_all_day: false,
          attendees: event.attendees as any,
          organizer_email: googleEventData.organizer?.email,
          meeting_link: googleEventData.hangoutLink,
          meeting_platform: 'google_meet',
          lead_id: event.lead_id,
          interaction_type: event.interaction_type,
          status: 'confirmed',
          reminder_minutes: event.reminder_minutes,
          created_by: userId,
          synced_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) throw error

      // Schedule reminders
      await this.scheduleReminders(dbEvent.id)

      return { success: true, event: dbEvent }
    } catch (error: unknown) {
      console.error('Error creating event:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update calendar event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEvent>
  ): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
    try {
      // Get existing event
      const { data: existingEvent } = await this.supabase
        .from('calendar_events')
        .select('*, calendar_providers!inner(*)')
        .eq('id', eventId)
        .maybeSingle()

      if (!existingEvent || !existingEvent.provider_event_id) {
        return { success: false, error: 'Event not found' }
      }

      const calendar = await this.getCalendarClient(existingEvent.calendar_provider_id)

      // Format updates for Google Calendar
      const googleUpdates: any = {}
      if (updates.title) googleUpdates.summary = updates.title
      if (updates.description) googleUpdates.description = updates.description
      if (updates.location) googleUpdates.location = updates.location
      if (updates.start_time) {
        googleUpdates.start = {
          dateTime: updates.start_time,
          timeZone: updates.timezone || 'UTC'
        }
      }
      if (updates.end_time) {
        googleUpdates.end = {
          dateTime: updates.end_time,
          timeZone: updates.timezone || 'UTC'
        }
      }

      // Update in Google Calendar
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: existingEvent.provider_event_id,
        requestBody: googleUpdates
      })

      // Update in database
      const { data: updatedEvent, error } = await this.supabase
        .from('calendar_events')
        .update({ ...updates, synced_at: new Date().toISOString() })
        .eq('id', eventId)
        .select()
        .maybeSingle()

      if (error) throw error

      return { success: true, event: updatedEvent }
    } catch (error: unknown) {
      console.error('Error updating event:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Cancel calendar event
   */
  async cancelEvent(eventId: string, cancellationReason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get event
      const { data: event } = await this.supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle()

      if (!event || !event.provider_event_id) {
        return { success: false, error: 'Event not found' }
      }

      const calendar = await this.getCalendarClient(event.calendar_provider_id)

      // Cancel in Google Calendar
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: event.provider_event_id,
        sendUpdates: 'all' // Notify attendees
      })

      // Update in database
      await this.supabase
        .from('calendar_events')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: cancellationReason
        })
        .eq('id', eventId)

      return { success: true }
    } catch (error: unknown) {
      console.error('Error cancelling event:', error)
      return { success: false, error: error.message }
    }
  }

  // ==================== SYNC ====================

  /**
   * Sync events from Google Calendar
   */
  async syncEvents(providerId: string): Promise<{ success: boolean; syncedCount?: number; error?: string }> {
    try {
      // Update sync status
      await this.supabase
        .from('calendar_providers')
        .update({ sync_status: 'syncing' })
        .eq('id', providerId)

      // Create sync log
      const { data: syncLog } = await this.supabase
        .from('calendar_sync_log')
        .insert({
          calendar_provider_id: providerId,
          sync_status: 'running'
        })
        .select()
        .maybeSingle()

      const calendar = await this.getCalendarClient(providerId)

      // Get last sync time
      const { data: provider } = await this.supabase
        .from('calendar_providers')
        .select('last_sync_at')
        .eq('id', providerId)
        .maybeSingle()

      // Fetch events from Google Calendar
      const { data: googleEvents } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: provider?.last_sync_at || new Date().toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime'
      })

      let created = 0
      let updated = 0

      // Sync each event
      for (const googleEvent of googleEvents.items || []) {
        if (!googleEvent.id) continue

        // Check if event exists
        const { data: existing } = await this.supabase
          .from('calendar_events')
          .select('id')
          .eq('calendar_provider_id', providerId)
          .eq('provider_event_id', googleEvent.id)
          .maybeSingle()

        const eventData = {
          calendar_provider_id: providerId,
          provider_event_id: googleEvent.id,
          title: googleEvent.summary || 'Untitled Event',
          description: googleEvent.description,
          location: googleEvent.location,
          start_time: googleEvent.start?.dateTime || googleEvent.start?.date,
          end_time: googleEvent.end?.dateTime || googleEvent.end?.date,
          timezone: googleEvent.start?.timeZone || 'UTC',
          is_all_day: !googleEvent.start?.dateTime,
          attendees: googleEvent.attendees?.map(a => ({
            email: a.email!,
            name: a.displayName,
            status: a.responseStatus
          })) as any,
          organizer_email: googleEvent.organizer?.email,
          meeting_link: googleEvent.hangoutLink,
          status: googleEvent.status === 'cancelled' ? 'cancelled' : 'confirmed',
          synced_at: new Date().toISOString()
        }

        if (existing) {
          await this.supabase
            .from('calendar_events')
            .update(eventData)
            .eq('id', existing.id)
          updated++
        } else {
          await this.supabase.from('calendar_events').insert(eventData)
          created++
        }
      }

      // Update sync log
      await this.supabase
        .from('calendar_sync_log')
        .update({
          sync_status: 'success',
          sync_completed_at: new Date().toISOString(),
          events_fetched: googleEvents.items?.length || 0,
          events_created: created,
          events_updated: updated
        })
        .eq('id', syncLog!.id)

      // Update provider
      await this.supabase
        .from('calendar_providers')
        .update({
          sync_status: 'connected',
          last_sync_at: new Date().toISOString()
        })
        .eq('id', providerId)

      return { success: true, syncedCount: created + updated }
    } catch (error: unknown) {
      console.error('Error syncing events:', error)

      // Update sync status
      await this.supabase
        .from('calendar_providers')
        .update({
          sync_status: 'error',
          sync_error_message: error.message
        })
        .eq('id', providerId)

      return { success: false, error: error.message }
    }
  }

  // ==================== AVAILABILITY ====================

  /**
   * Get available time slots for a user
   */
  async getAvailableSlots(userId: string, date: string, durationMinutes = 30): Promise<AvailabilitySlot[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_available_slots', {
        p_user_id: userId,
        p_date: date,
        p_duration_minutes: durationMinutes
      })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting available slots:', error)
      return []
    }
  }

  /**
   * Check if time slot is available
   */
  async checkAvailability(userId: string, startTime: string, endTime: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('check_availability', {
        p_user_id: userId,
        p_start_time: startTime,
        p_end_time: endTime
      })

      if (error) throw error
      return data || false
    } catch (error) {
      console.error('Error checking availability:', error)
      return false
    }
  }

  // ==================== UTILITY METHODS ====================

  private async scheduleReminders(eventId: string): Promise<void> {
    try {
      await this.supabase.rpc('schedule_event_reminders', { p_event_id: eventId })
    } catch (error) {
      console.error('Error scheduling reminders:', error)
    }
  }

  /**
   * Disconnect calendar provider
   */
  async disconnectProvider(providerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.supabase
        .from('calendar_providers')
        .update({
          is_active: false,
          sync_status: 'disconnected'
        })
        .eq('id', providerId)

      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService()
