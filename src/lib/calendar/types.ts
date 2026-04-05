/**
 * Google Calendar Types
 * Shared types for calendar functionality (client & server safe)
 */

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
