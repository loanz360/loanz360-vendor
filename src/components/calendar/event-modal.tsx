'use client'

/**
 * Event Modal Component
 * Create and edit calendar events
 * Features:
 * - Event creation with title, description, location
 * - Date/time selection
 * - Attendee management
 * - Google Meet integration
 * - Event status (confirmed/tentative/cancelled)
 * - Validation and error handling
 */

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent } from '@/lib/calendar/types'
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  FileText,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
  Plus,
  Minus
} from 'lucide-react'

// ==================== TYPES ====================

interface EventFormData {
  title: string
  description: string
  location: string
  start_time: string
  end_time: string
  attendees: string[]
  has_google_meet: boolean
  status: 'confirmed' | 'tentative' | 'cancelled'
}

// ==================== COMPONENT ====================

export default function EventModal({
  event,
  initialDate,
  onClose,
  onSave,
  onDelete
}: {
  event?: CalendarEvent | null
  initialDate?: Date
  onClose: () => void
  onSave?: (event: CalendarEvent) => void
  onDelete?: (eventId: string) => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerId, setProviderId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
    attendees: [],
    has_google_meet: false,
    status: 'confirmed'
  })

  const [newAttendee, setNewAttendee] = useState('')

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    loadProvider()
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        location: event.location || '',
        start_time: new Date(event.start_time).toISOString().slice(0, 16),
        end_time: new Date(event.end_time).toISOString().slice(0, 16),
        attendees: event.attendees || [],
        has_google_meet: event.has_google_meet || false,
        status: event.status as any || 'confirmed'
      })
    } else if (initialDate) {
      const start = new Date(initialDate)
      const end = new Date(start)
      end.setHours(start.getHours() + 1)

      setFormData(prev => ({
        ...prev,
        start_time: start.toISOString().slice(0, 16),
        end_time: end.toISOString().slice(0, 16)
      }))
    }
  }, [event, initialDate])

  const loadProvider = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('calendar_providers')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      setProviderId(data.id)
    } catch (error: unknown) {
      setError('No active calendar provider found. Please connect your Google Calendar.')
    }
  }

  // ==================== FORM HANDLING ====================

  const handleInputChange = (field: keyof EventFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleAddAttendee = () => {
    if (!newAttendee.trim()) return

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newAttendee)) {
      setError('Please enter a valid email address')
      return
    }

    if (formData.attendees.includes(newAttendee)) {
      setError('Attendee already added')
      return
    }

    handleInputChange('attendees', [...formData.attendees, newAttendee])
    setNewAttendee('')
    setError(null)
  }

  const handleRemoveAttendee = (email: string) => {
    handleInputChange(
      'attendees',
      formData.attendees.filter(a => a !== email)
    )
  }

  // ==================== VALIDATION ====================

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError('Event title is required')
      return false
    }

    if (!formData.start_time) {
      setError('Start time is required')
      return false
    }

    if (!formData.end_time) {
      setError('End time is required')
      return false
    }

    const start = new Date(formData.start_time)
    const end = new Date(formData.end_time)

    if (end <= start) {
      setError('End time must be after start time')
      return false
    }

    return true
  }

  // ==================== ACTIONS ====================

  const handleSave = async () => {
    if (!validateForm()) return
    if (!providerId) {
      setError('No calendar provider found')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let result
      if (event) {
        // Update existing event
        result = await googleCalendarService.updateEvent(event.id, {
          title: formData.title,
          description: formData.description,
          location: formData.location,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: new Date(formData.end_time).toISOString(),
          attendees: formData.attendees,
          has_google_meet: formData.has_google_meet,
          status: formData.status
        })
      } else {
        // Create new event
        result = await googleCalendarService.createEvent(providerId, {
          title: formData.title,
          description: formData.description,
          location: formData.location,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: new Date(formData.end_time).toISOString(),
          attendees: formData.attendees,
          has_google_meet: formData.has_google_meet,
          status: formData.status
        })
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to save event')
      }

      onSave?.(result.event!)
      onClose()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!event) return

    if (!confirm('Are you sure you want to delete this event?')) return

    setLoading(true)
    setError(null)

    try {
      const result = await googleCalendarService.deleteEvent(event.id)
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete event')
      }

      onDelete?.(event.id)
      onClose()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  // ==================== RENDER ====================

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {event ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => handleInputChange('title', e.target.value)}
              placeholder="Team meeting, Client call, etc."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={e => handleInputChange('start_time', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={e => handleInputChange('end_time', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                placeholder="Add event details..."
                rows={4}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.location}
                onChange={e => handleInputChange('location', e.target.value)}
                placeholder="Meeting room, address, or online"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attendees
            </label>
            <div className="flex space-x-2 mb-3">
              <div className="relative flex-1">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={newAttendee}
                  onChange={e => setNewAttendee(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddAttendee()}
                  placeholder="Add attendee email"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleAddAttendee}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {formData.attendees.length > 0 && (
              <div className="space-y-2">
                {formData.attendees.map(email => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm text-gray-700">{email}</span>
                    <button
                      onClick={() => handleRemoveAttendee(email)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Google Meet */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="googleMeet"
              checked={formData.has_google_meet}
              onChange={e => handleInputChange('has_google_meet', e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="googleMeet" className="flex items-center text-sm font-medium text-gray-700">
              <Video className="w-5 h-5 mr-2 text-green-600" />
              Add Google Meet video conferencing
            </label>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={e => handleInputChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="confirmed">Confirmed</option>
              <option value="tentative">Tentative</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div>
            {event && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 inline mr-2" />
                Delete Event
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 inline mr-2" />
                  {event ? 'Update Event' : 'Create Event'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
