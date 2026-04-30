'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  UserPlus,
  Phone,
  FileText,
  ArrowRight,
  CheckCircle,
  Award,
  Clock,
} from 'lucide-react'

interface Activity {
  id: string
  bdeId: string
  bdeName: string
  activityType: string
  activityDescription: string
  entityType: string
  entityId: string
  metadata: unknown  createdAt: string
}

interface ActivityListProps {
  activities: Activity[]
}

export default function ActivityList({ activities }: ActivityListProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lead_assigned':
        return <UserPlus className="h-4 w-4" />
      case 'lead_contacted':
        return <Phone className="h-4 w-4" />
      case 'document_uploaded':
        return <FileText className="h-4 w-4" />
      case 'stage_changed':
        return <ArrowRight className="h-4 w-4" />
      case 'conversion':
        return <CheckCircle className="h-4 w-4" />
      case 'achievement_earned':
        return <Award className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'lead_assigned':
        return 'bg-blue-100 text-blue-600'
      case 'lead_contacted':
        return 'bg-purple-100 text-purple-600'
      case 'document_uploaded':
        return 'bg-indigo-100 text-indigo-600'
      case 'stage_changed':
        return 'bg-yellow-100 text-yellow-600'
      case 'conversion':
        return 'bg-green-100 text-green-600'
      case 'achievement_earned':
        return 'bg-orange-100 text-orange-600'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const formatActivityType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMins = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMins < 1) return 'Just now'
    if (diffInMins < 60) return `${diffInMins}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays}d ago`
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="space-y-3">
      {activities.map(activity => (
        <Card key={activity.id} className="hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(activity.bdeName)}
                </AvatarFallback>
              </Avatar>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.bdeName}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.activityDescription}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(activity.createdAt)}
                  </span>
                </div>

                {/* Metadata */}
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {activity.metadata.loan_type && (
                      <Badge variant="secondary" className="text-xs">
                        {activity.metadata.loan_type}
                      </Badge>
                    )}
                    {activity.metadata.amount && (
                      <Badge variant="secondary" className="text-xs">
                        ₹{(activity.metadata.amount / 100000).toFixed(1)}L
                      </Badge>
                    )}
                    {activity.metadata.stage && (
                      <Badge variant="secondary" className="text-xs">
                        {activity.metadata.stage}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Activity Type Badge */}
              <div className={`p-2 rounded-lg ${getActivityColor(activity.activityType)}`}>
                {getActivityIcon(activity.activityType)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
