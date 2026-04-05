'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
  CheckCheck,
  X,
  User,
  ArrowRight,
  MessageSquare,
  Phone,
  Mail,
  Clock,
  Zap,
  ExternalLink
} from 'lucide-react'
import { useLeadsWebSocket, LeadUpdate, NotificationMessage } from '@/hooks/useLeadsWebSocket'

interface RealTimeUpdatesProps {
  showConnectionStatus?: boolean
  showRecentUpdates?: boolean
  maxUpdates?: number
}

export function RealTimeUpdates({
  showConnectionStatus = true,
  showRecentUpdates = true,
  maxUpdates = 10
}: RealTimeUpdatesProps) {
  const {
    isConnected,
    isConnecting,
    recentUpdates,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications
  } = useLeadsWebSocket()

  const [isOpen, setIsOpen] = useState(false)

  const getUpdateIcon = (type: LeadUpdate['type']) => {
    switch (type) {
      case 'lead_created': return <User className="h-4 w-4 text-green-500" />
      case 'lead_updated': return <RefreshCw className="h-4 w-4 text-blue-500" />
      case 'status_changed': return <ArrowRight className="h-4 w-4 text-orange-500" />
      case 'stage_changed': return <Zap className="h-4 w-4 text-purple-500" />
      case 'assignment_changed': return <User className="h-4 w-4 text-indigo-500" />
      case 'communication_added': return <MessageSquare className="h-4 w-4 text-teal-500" />
      default: return <RefreshCw className="h-4 w-4 text-gray-500" />
    }
  }

  const getUpdateLabel = (type: LeadUpdate['type']) => {
    switch (type) {
      case 'lead_created': return 'New Lead'
      case 'lead_updated': return 'Updated'
      case 'status_changed': return 'Status Change'
      case 'stage_changed': return 'Stage Change'
      case 'assignment_changed': return 'Assigned'
      case 'communication_added': return 'Communication'
      default: return 'Update'
    }
  }

  const getNotificationIcon = (type: NotificationMessage['type']) => {
    switch (type) {
      case 'success': return <Check className="h-4 w-4 text-green-500" />
      case 'warning': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'error': return <X className="h-4 w-4 text-red-500" />
      default: return <Bell className="h-4 w-4 text-blue-500" />
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Connection Status */}
      {showConnectionStatus && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
          {isConnecting ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin text-yellow-500" />
              <span className="text-xs">Connecting...</span>
            </>
          ) : isConnected ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-red-500" />
              <span className="text-xs text-red-600">Offline</span>
            </>
          )}
        </div>
      )}

      {/* Notifications Bell */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllNotificationsRead}
                >
                  <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="h-80">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.slice(0, 20).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{notification.title}</p>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                      {notification.actionUrl && (
                        <Button variant="ghost" size="sm" className="shrink-0">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {notifications.length > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={clearNotifications}
              >
                Clear all notifications
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Recent Updates Panel */}
      {showRecentUpdates && recentUpdates.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-yellow-500 text-white text-xs flex items-center justify-center">
                {recentUpdates.length > 9 ? '9+' : recentUpdates.length}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Recent Activity</h3>
              <p className="text-sm text-muted-foreground">Live updates from the system</p>
            </div>
            <ScrollArea className="h-64">
              <div className="divide-y">
                {recentUpdates.slice(0, maxUpdates).map((update, index) => (
                  <div key={`${update.leadId}-${index}`} className="p-3 hover:bg-muted/50">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getUpdateIcon(update.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getUpdateLabel(update.type)}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mt-1">
                          {(update.data.name as string) || update.leadId}
                        </p>
                        {update.data.status && (
                          <p className="text-xs text-muted-foreground">
                            Status: {update.data.status as string}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(update.timestamp)}
                          {update.userName && ` by ${update.userName}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

// Live Activity Feed Component
export function LiveActivityFeed({ maxItems = 10 }: { maxItems?: number }) {
  const { recentUpdates, isConnected } = useLeadsWebSocket()

  const getUpdateIcon = (type: LeadUpdate['type']) => {
    switch (type) {
      case 'lead_created': return <User className="h-4 w-4 text-green-500" />
      case 'lead_updated': return <RefreshCw className="h-4 w-4 text-blue-500" />
      case 'status_changed': return <ArrowRight className="h-4 w-4 text-orange-500" />
      case 'stage_changed': return <Zap className="h-4 w-4 text-purple-500" />
      case 'assignment_changed': return <User className="h-4 w-4 text-indigo-500" />
      case 'communication_added': return <MessageSquare className="h-4 w-4 text-teal-500" />
      default: return <RefreshCw className="h-4 w-4 text-gray-500" />
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" /> Live Activity
          </CardTitle>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
            {isConnected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Live</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {recentUpdates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Waiting for activity...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentUpdates.slice(0, maxItems).map((update, index) => (
              <div
                key={`${update.leadId}-${index}`}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="mt-0.5 p-1.5 rounded-full bg-muted">
                  {getUpdateIcon(update.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {(update.data.name as string) || 'Lead'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {update.type.replace(/_/g, ' ')}
                    {update.data.status && ` → ${update.data.status}`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(update.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default RealTimeUpdates
