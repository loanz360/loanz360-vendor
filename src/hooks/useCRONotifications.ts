'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface CRONotification {
  id: string
  type: 'new_lead' | 'new_contact' | 'followup_due' | 'chat_message' | 'deal_update' | 'system'
  title: string
  message: string
  actionUrl?: string
  read: boolean
  created_at: string
}

export function useCRONotifications() {
  const supabase = useMemo(() => createClient(), [])
  const [notifications, setNotifications] = useState<CRONotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Fetch existing notifications
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, read, link, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        const typed = data as unknown as CRONotification[]
        setNotifications(typed)
        setUnreadCount(typed.filter(n => !n.read).length)
      }
    }

    fetchNotifications()

    // Subscribe to new notifications
    let channel: RealtimeChannel | null = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as CRONotification
            setNotifications(prev => [newNotification, ...prev].slice(0, 20))
            setUnreadCount(prev => prev + 1)

            // Play notification sound (optional)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(newNotification.title, {
                body: newNotification.message,
                icon: '/favicon.ico',
              })
            }
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase])

  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true } as never)
      .eq('id', notificationId)

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [supabase])

  const markAllAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('notifications')
      .update({ read: true } as never)
      .eq('user_id', user.id)
      .eq('read', false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [supabase])

  return { notifications, unreadCount, markAsRead, markAllAsRead }
}
