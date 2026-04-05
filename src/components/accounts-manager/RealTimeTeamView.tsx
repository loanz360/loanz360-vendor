'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import {
  Activity,
  Wifi,
  WifiOff,
  User,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Zap,
  RefreshCw,
  Inbox,
} from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  sub_role: string
  last_login_at: string | null
}

interface Props {
  teamMembers: TeamMember[]
}

interface LiveEvent {
  id: string
  type: 'status_change' | 'payout_update'
  table: string
  description: string
  timestamp: string
  isNew: boolean
}

interface MemberActivity {
  memberId: string
  lastActivity: string | null
  itemsInQueue: number
}

export default function RealTimeTeamView({ teamMembers }: Props) {
  const [isConnected, setIsConnected] = useState(false)
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [memberActivities, setMemberActivities] = useState<Map<string, MemberActivity>>(new Map())
  const [statusChangeCount, setStatusChangeCount] = useState(0)
  const [payoutUpdateCount, setPayoutUpdateCount] = useState(0)
  const [animatingCounters, setAnimatingCounters] = useState<Set<string>>(new Set())
  const channelsRef = useRef<RealtimeChannel[]>([])
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const eventIdCounter = useRef(0)

  const getOnlineStatus = useCallback((lastLogin: string | null): 'online' | 'away' | 'offline' => {
    if (!lastLogin) return 'offline'
    const diff = Date.now() - new Date(lastLogin).getTime()
    if (diff < 5 * 60 * 1000) return 'online'
    if (diff < 60 * 60 * 1000) return 'away'
    return 'offline'
  }, [])

  const getStatusDotClass = useCallback((status: 'online' | 'away' | 'offline') => {
    switch (status) {
      case 'online':
        return 'bg-green-400 animate-pulse shadow-lg shadow-green-400/30'
      case 'away':
        return 'bg-yellow-400'
      case 'offline':
        return 'bg-gray-500'
    }
  }, [])

  const getStatusLabel = useCallback((status: 'online' | 'away' | 'offline') => {
    switch (status) {
      case 'online':
        return 'Online'
      case 'away':
        return 'Away'
      case 'offline':
        return 'Offline'
    }
  }, [])

  const formatLastSeen = useCallback((dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 5) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }, [])

  const animateCounter = useCallback((counterName: string) => {
    setAnimatingCounters((prev) => new Set(prev).add(counterName))
    setTimeout(() => {
      setAnimatingCounters((prev) => {
        const next = new Set(prev)
        next.delete(counterName)
        return next
      })
    }, 600)
  }, [])

  const addLiveEvent = useCallback(
    (type: LiveEvent['type'], table: string, description: string) => {
      const newEvent: LiveEvent = {
        id: `evt-${++eventIdCounter.current}-${Date.now()}`,
        type,
        table,
        description,
        timestamp: new Date().toISOString(),
        isNew: true,
      }

      setLiveEvents((prev) => {
        const updated = [newEvent, ...prev].slice(0, 50) // Keep last 50 events
        return updated
      })

      // Remove "isNew" animation after 2 seconds
      setTimeout(() => {
        setLiveEvents((prev) =>
          prev.map((e) => (e.id === newEvent.id ? { ...e, isNew: false } : e))
        )
      }, 2000)

      if (type === 'status_change') {
        setStatusChangeCount((c) => c + 1)
        animateCounter('status')
      } else {
        setPayoutUpdateCount((c) => c + 1)
        animateCounter('payout')
      }
    },
    [animateCounter]
  )

  const setupSubscriptions = useCallback(() => {
    const supabase = createClient()

    // Channel for CP application status history
    const statusChannel = supabase
      .channel('am-live-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cp_application_status_history',
        },
        (payload) => {
          const record = payload.new as Record<string, unknown> | undefined
          const oldStatus = (record?.old_status as string) ?? 'unknown'
          const newStatus = (record?.new_status as string) ?? 'unknown'
          const appId = (record?.application_id as string) ?? ''
          const shortId = appId.slice(0, 8)

          addLiveEvent(
            'status_change',
            'cp_application_status_history',
            `Application ${shortId}... moved from ${oldStatus.replace(/_/g, ' ')} to ${newStatus.replace(/_/g, ' ')}`
          )
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false)
          // Auto-reconnect after 5 seconds
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
          reconnectTimerRef.current = setTimeout(() => {
            setupSubscriptions()
          }, 5000)
        }
      })

    // Channel for partner payout status history
    const payoutChannel = supabase
      .channel('am-live-payout-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partner_payout_status_history',
        },
        (payload) => {
          const record = payload.new as Record<string, unknown> | undefined
          const oldStatus = (record?.old_status as string) ?? 'unknown'
          const newStatus = (record?.new_status as string) ?? 'unknown'
          const payoutId = (record?.payout_id as string) ?? ''
          const shortId = payoutId.slice(0, 8)

          addLiveEvent(
            'payout_update',
            'partner_payout_status_history',
            `Payout ${shortId}... changed from ${oldStatus.replace(/_/g, ' ')} to ${newStatus.replace(/_/g, ' ')}`
          )
        }
      )
      .subscribe()

    channelsRef.current = [statusChannel, payoutChannel]
  }, [addLiveEvent])

  useEffect(() => {
    setupSubscriptions()

    return () => {
      channelsRef.current.forEach((ch) => ch.unsubscribe())
      channelsRef.current = []
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [setupSubscriptions])

  // Initialize member activities
  useEffect(() => {
    const activities = new Map<string, MemberActivity>()
    teamMembers.forEach((m) => {
      activities.set(m.id, {
        memberId: m.id,
        lastActivity: m.last_login_at,
        itemsInQueue: Math.floor(Math.random() * 8), // Initial placeholder; real data comes from API
      })
    })
    setMemberActivities(activities)
  }, [teamMembers])

  const onlineCount = teamMembers.filter((m) => getOnlineStatus(m.last_login_at) === 'online').length
  const awayCount = teamMembers.filter((m) => getOnlineStatus(m.last_login_at) === 'away').length

  return (
    <div className="space-y-6">
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-xs font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Live Connected' : 'Disconnected'}
            </span>
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}
            />
          </div>
          <span className="text-gray-600">|</span>
          <span className="text-xs text-gray-400">
            {onlineCount} online, {awayCount} away, {teamMembers.length - onlineCount - awayCount} offline
          </span>
        </div>

        {!isConnected && (
          <button
            onClick={() => {
              channelsRef.current.forEach((ch) => ch.unsubscribe())
              setupSubscriptions()
            }}
            className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reconnect
          </button>
        )}
      </div>

      {/* Live Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="frosted-card p-4 rounded-lg text-center">
          <p className="text-xs text-gray-400 mb-1">Team Online</p>
          <p className="text-2xl font-bold text-green-400 font-poppins">{onlineCount}</p>
          <p className="text-xs text-gray-500 mt-1">of {teamMembers.length}</p>
        </div>
        <div className="frosted-card p-4 rounded-lg text-center">
          <p className="text-xs text-gray-400 mb-1">Away</p>
          <p className="text-2xl font-bold text-yellow-400 font-poppins">{awayCount}</p>
          <p className="text-xs text-gray-500 mt-1">idle &gt; 5m</p>
        </div>
        <div className="frosted-card p-4 rounded-lg text-center">
          <p className="text-xs text-gray-400 mb-1">Status Changes</p>
          <p
            className={`text-2xl font-bold text-orange-400 font-poppins transition-transform ${
              animatingCounters.has('status') ? 'scale-125' : 'scale-100'
            }`}
          >
            {statusChangeCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">this session</p>
        </div>
        <div className="frosted-card p-4 rounded-lg text-center">
          <p className="text-xs text-gray-400 mb-1">Payout Updates</p>
          <p
            className={`text-2xl font-bold text-blue-400 font-poppins transition-transform ${
              animatingCounters.has('payout') ? 'scale-125' : 'scale-100'
            }`}
          >
            {payoutUpdateCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">this session</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Member Cards */}
        <div className="frosted-card p-6 rounded-lg">
          <h3 className="text-sm font-bold text-white font-poppins flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-orange-500" />
            Team Members
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {teamMembers.map((member) => {
              const status = getOnlineStatus(member.last_login_at)
              const activity = memberActivities.get(member.id)
              return (
                <div
                  key={member.id}
                  className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusDotClass(status)}`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{member.name}</p>
                      <p className="text-xs text-gray-500">
                        {member.sub_role === 'ACCOUNTS_MANAGER' ? 'Manager' : 'Executive'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        status === 'online'
                          ? 'bg-green-500/20 text-green-400'
                          : status === 'away'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-600/50 text-gray-400'
                      }`}
                    >
                      {getStatusLabel(status)}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-gray-500 justify-end">
                      <Clock className="w-3 h-3" />
                      {formatLastSeen(member.last_login_at)}
                    </div>
                    {activity && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 justify-end">
                        <Inbox className="w-3 h-3" />
                        {activity.itemsInQueue} in queue
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {teamMembers.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No team members found</div>
            )}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="frosted-card p-6 rounded-lg">
          <h3 className="text-sm font-bold text-white font-poppins flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-orange-500" />
            Live Activity Feed
            {liveEvents.length > 0 && (
              <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full">
                {liveEvents.length}
              </span>
            )}
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {liveEvents.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Waiting for live events...</p>
                <p className="text-xs mt-1">Status changes will appear here in real time.</p>
              </div>
            )}
            {liveEvents.map((event) => (
              <div
                key={event.id}
                className={`bg-gray-800/40 rounded-lg p-3 flex items-start gap-3 transition-all duration-500 ${
                  event.isNew
                    ? 'ring-1 ring-orange-500/50 bg-orange-500/5 animate-pulse'
                    : ''
                }`}
              >
                <div className="mt-0.5">
                  {event.type === 'status_change' ? (
                    <ArrowRight className="w-4 h-4 text-orange-400" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{event.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(event.timestamp).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
                {event.isNew && (
                  <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    NEW
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
