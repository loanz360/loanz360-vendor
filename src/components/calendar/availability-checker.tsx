'use client'

/**
 * Availability Checker Component
 * Check user availability and find free time slots
 * Features:
 * - Check availability for specific time range
 * - Find available slots for a given duration
 * - Multi-user availability comparison
 * - Visual representation of free/busy times
 * - Quick scheduling suggestions
 */

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AvailabilitySlot } from '@/lib/calendar/types'
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus
} from 'lucide-react'

// ==================== TYPES ====================

interface User {
  id: string
  name: string
  email: string
  provider_id?: string
}

interface AvailabilityResult {
  user: User
  available: boolean
  availableSlots?: AvailabilitySlot[]
  conflictingEvents?: number
}

// ==================== COMPONENT ====================

export default function AvailabilityChecker({
  onSchedule
}: {
  onSchedule?: (slot: AvailabilitySlot, users: User[]) => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Users
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // Search parameters
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0])
  const [duration, setDuration] = useState(30) // minutes
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')

  // Results
  const [availabilityResults, setAvailabilityResults] = useState<AvailabilityResult[]>([])
  const [commonSlots, setCommonSlots] = useState<AvailabilitySlot[]>([])

  // ==================== LOAD USERS ====================

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      // Load users with calendar providers
      const { data: providers, error } = await supabase
        .from('calendar_providers')
        .select(`
          id,
          user_id,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('is_active', true)

      if (error) throw error

      const userList: User[] = providers
        .filter(p => p.profiles)
        .map(p => ({
          id: p.user_id,
          name: (p.profiles as unknown).full_name || 'Unknown',
          email: (p.profiles as unknown).email || '',
          provider_id: p.id
        }))

      setUsers(userList)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  // ==================== USER SELECTION ====================

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAllUsers = () => {
    setSelectedUsers(users.map(u => u.id))
  }

  const clearAllUsers = () => {
    setSelectedUsers([])
  }

  // ==================== AVAILABILITY CHECK ====================

  const checkAvailability = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user')
      return
    }

    setLoading(true)
    setError(null)
    setAvailabilityResults([])
    setCommonSlots([])

    try {
      const results: AvailabilityResult[] = []
      const allSlots: AvailabilitySlot[][] = []

      for (const userId of selectedUsers) {
        const user = users.find(u => u.id === userId)
        if (!user || !user.provider_id) continue

        try {
          // Get available slots for this user
          const slots = await googleCalendarService.getAvailableSlots(
            userId,
            searchDate,
            duration
          )

          // Filter slots by time range
          const filteredSlots = slots.filter(slot => {
            const slotTime = new Date(slot.start_time).toTimeString().slice(0, 5)
            return slotTime >= startTime && slotTime <= endTime
          })

          results.push({
            user,
            available: filteredSlots.length > 0,
            availableSlots: filteredSlots,
            conflictingEvents: slots.length - filteredSlots.length
          })

          allSlots.push(filteredSlots)
        } catch (error: unknown) {
          results.push({
            user,
            available: false,
            availableSlots: [],
            conflictingEvents: 0
          })
        }
      }

      setAvailabilityResults(results)

      // Find common slots (slots available for all users)
      if (allSlots.length > 0) {
        const common = findCommonSlots(allSlots)
        setCommonSlots(common)
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const findCommonSlots = (allSlots: AvailabilitySlot[][]): AvailabilitySlot[] => {
    if (allSlots.length === 0) return []
    if (allSlots.length === 1) return allSlots[0]

    // Find slots that exist in all users' availability
    const firstUserSlots = allSlots[0]
    const commonSlots: AvailabilitySlot[] = []

    for (const slot of firstUserSlots) {
      const isCommon = allSlots.slice(1).every(userSlots =>
        userSlots.some(
          s =>
            Math.abs(new Date(s.start_time).getTime() - new Date(slot.start_time).getTime()) <
            1000 * 60 * 5 // Within 5 minutes
        )
      )

      if (isCommon) {
        commonSlots.push(slot)
      }
    }

    return commonSlots
  }

  // ==================== QUICK ACTIONS ====================

  const handleQuickSchedule = (slot: AvailabilitySlot) => {
    const selectedUserObjects = users.filter(u => selectedUsers.includes(u.id))
    onSchedule?.(slot, selectedUserObjects)
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Check Availability</h2>
        <p className="text-gray-600">Find available time slots for team members</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Search Parameters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Parameters</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={searchDate}
                onChange={e => setSearchDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Duration (minutes)
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* User Selection */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Team Members
          </label>
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-gray-400" />
                <span className="text-gray-700">
                  {selectedUsers.length === 0
                    ? 'Select users...'
                    : `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} selected`}
                </span>
              </div>
              {showUserDropdown ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showUserDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                <div className="p-2 border-b border-gray-200 flex space-x-2">
                  <button
                    onClick={selectAllUsers}
                    className="flex-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearAllUsers}
                    className="flex-1 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded"
                  >
                    Clear All
                  </button>
                </div>
                <div className="p-2">
                  {users.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-600">{user.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Check Button */}
        <div className="mt-6">
          <button
            onClick={checkAvailability}
            disabled={loading || selectedUsers.length === 0}
            className="w-full px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
                Checking Availability...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 inline mr-2" />
                Check Availability
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {availabilityResults.length > 0 && (
        <>
          {/* Common Slots */}
          {commonSlots.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                Available Time Slots (All Users)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {commonSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="p-4 border-2 border-green-200 bg-green-50 rounded-lg hover:bg-green-100 cursor-pointer transition-colors"
                    onClick={() => handleQuickSchedule(slot)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-900">
                        {new Date(slot.start_time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                      <button className="text-xs text-green-600 hover:text-green-700 flex items-center">
                        <Plus className="w-3 h-3 mr-1" />
                        Schedule
                      </button>
                    </div>
                    <div className="text-xs text-green-700">
                      {new Date(slot.end_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual Availability */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Availability</h3>
            <div className="space-y-4">
              {availabilityResults.map((result, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          result.available ? 'bg-green-100' : 'bg-red-100'
                        }`}
                      >
                        {result.available ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{result.user.name}</div>
                        <div className="text-sm text-gray-600">{result.user.email}</div>
                      </div>
                    </div>
                    <div className="text-sm">
                      {result.available ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                          Available
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                          Busy
                        </span>
                      )}
                    </div>
                  </div>

                  {result.availableSlots && result.availableSlots.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 mb-2">
                        {result.availableSlots.length} available slot{result.availableSlots.length > 1 ? 's' : ''}:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.availableSlots.slice(0, 5).map((slot, slotIndex) => (
                          <span
                            key={slotIndex}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            {new Date(slot.start_time).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        ))}
                        {result.availableSlots.length > 5 && (
                          <span className="px-2 py-1 text-xs text-gray-600">
                            +{result.availableSlots.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
