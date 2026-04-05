import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface NotificationUpdate {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  notification: any
}

interface UseNotificationSubscriptionOptions {
  userId?: string
  enabled?: boolean
  onNewNotification?: (notification: any) => void
  onNotificationUpdate?: (notification: any) => void
  onNotificationDelete?: (notificationId: string) => void
}

export function useNotificationSubscription({
  userId,
  enabled = true,
  onNewNotification,
  onNotificationUpdate,
  onNotificationDelete
}: UseNotificationSubscriptionOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled || !userId) {
      return
    }

    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const setupSubscription = async () => {
      try {
        // Subscribe to notification_recipients table for this user
        channel = supabase
          .channel(`notifications:${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notification_recipients',
              filter: `user_id=eq.${userId}`
            },
            async (payload) => {
              console.log('[Realtime] New notification received:', payload)

              // Fetch the full notification details
              if (payload.new && 'notification_id' in payload.new) {
                const { data: notification } = await supabase
                  .from('system_notifications')
                  .select(`
                    *,
                    sent_by:users!system_notifications_sent_by_fkey(
                      id,
                      full_name,
                      email
                    )
                  `)
                  .eq('id', payload.new.notification_id)
                  .maybeSingle()

                if (notification && onNewNotification) {
                  onNewNotification({
                    ...notification,
                    sent_by_name: notification.sent_by?.full_name || notification.sent_by?.email,
                    recipient_data: payload.new
                  })
                }
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notification_recipients',
              filter: `user_id=eq.${userId}`
            },
            async (payload) => {
              console.log('[Realtime] Notification updated:', payload)

              // Fetch updated notification
              if (payload.new && 'notification_id' in payload.new) {
                const { data: notification } = await supabase
                  .from('system_notifications')
                  .select(`
                    *,
                    sent_by:users!system_notifications_sent_by_fkey(
                      id,
                      full_name,
                      email
                    )
                  `)
                  .eq('id', payload.new.notification_id)
                  .maybeSingle()

                if (notification && onNotificationUpdate) {
                  onNotificationUpdate({
                    ...notification,
                    sent_by_name: notification.sent_by?.full_name || notification.sent_by?.email,
                    recipient_data: payload.new
                  })
                }
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'notification_recipients',
              filter: `user_id=eq.${userId}`
            },
            (payload) => {
              console.log('[Realtime] Notification deleted:', payload)

              if (payload.old && 'notification_id' in payload.old && onNotificationDelete) {
                onNotificationDelete(payload.old.notification_id as string)
              }
            }
          )
          .subscribe((status) => {
            console.log('[Realtime] Subscription status:', status)

            if (status === 'SUBSCRIBED') {
              setIsSubscribed(true)
              setError(null)
            } else if (status === 'CHANNEL_ERROR') {
              setError(new Error('Failed to subscribe to notifications'))
              setIsSubscribed(false)
            } else if (status === 'TIMED_OUT') {
              setError(new Error('Subscription timed out'))
              setIsSubscribed(false)
            }
          })
      } catch (err) {
        console.error('[Realtime] Subscription error:', err)
        setError(err instanceof Error ? err : new Error('Unknown subscription error'))
        setIsSubscribed(false)
      }
    }

    setupSubscription()

    // Cleanup function
    return () => {
      if (channel) {
        console.log('[Realtime] Unsubscribing from notifications')
        supabase.removeChannel(channel)
        setIsSubscribed(false)
      }
    }
  }, [userId, enabled, onNewNotification, onNotificationUpdate, onNotificationDelete])

  return { isSubscribed, error }
}
