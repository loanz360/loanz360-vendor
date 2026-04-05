'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, Filter } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ActivityList from './activity-feed/ActivityList'
import ActivityStats from './activity-feed/ActivityStats'

interface Activity {
  id: string
  bdeId: string
  bdeName: string
  activityType: string
  activityDescription: string
  entityType: string
  entityId: string
  metadata: any
  createdAt: string
}

interface ActivityStatsData {
  totalActivities: number
  mostActiveBDE: {
    name: string
    count: number
  }
  activityBreakdown: Record<string, number>
}

export default function ActivityFeedTab() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [stats, setStats] = useState<ActivityStatsData | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const { toast } = useToast()

  // Filters
  const [bdeFilter, setBdeFilter] = useState<string>('all')
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('all')

  // Fetch activities
  const fetchActivities = async (isRefresh = false, pageNum = 1) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else if (pageNum === 1) {
        setLoading(true)
      }

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
      })

      if (bdeFilter !== 'all') {
        params.append('bdeId', bdeFilter)
      }

      if (activityTypeFilter !== 'all') {
        params.append('activityType', activityTypeFilter)
      }

      const response = await fetch(`/api/bdm/team-management/activity-feed?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch activity feed')
      }

      const result = await response.json()

      if (pageNum === 1) {
        setActivities(result.activities || [])
      } else {
        setActivities(prev => [...prev, ...(result.activities || [])])
      }

      setStats(result.stats)
      setHasMore(result.pagination.page < result.pagination.totalPages)

      if (isRefresh) {
        toast({
          title: 'Activity feed refreshed',
          description: 'Latest activities loaded successfully',
        })
      }
    } catch (error: unknown) {
      console.error('Error fetching activity feed:', error)
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to load activity feed',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load more
  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchActivities(false, nextPage)
  }

  // Reset and fetch when filters change
  useEffect(() => {
    setPage(1)
    fetchActivities(false, 1)
  }, [bdeFilter, activityTypeFilter])

  // Initial load
  useEffect(() => {
    fetchActivities()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading activity feed...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Activity Feed</h2>
          <p className="text-sm text-muted-foreground">
            Real-time updates from your team
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchActivities(true, 1)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && <ActivityStats stats={stats} />}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <Select value={bdeFilter} onValueChange={setBdeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Team Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                </SelectContent>
              </Select>

              <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Activities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="lead_assigned">Lead Assigned</SelectItem>
                  <SelectItem value="lead_contacted">Lead Contacted</SelectItem>
                  <SelectItem value="document_uploaded">Document Uploaded</SelectItem>
                  <SelectItem value="stage_changed">Stage Changed</SelectItem>
                  <SelectItem value="conversion">Conversion</SelectItem>
                  <SelectItem value="achievement_earned">Achievement Earned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <ActivityList activities={activities} />

      {/* Load More */}
      {hasMore && activities.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore}>
            Load More
          </Button>
        </div>
      )}

      {/* Empty State */}
      {activities.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <Filter className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No activities found</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBdeFilter('all')
                  setActivityTypeFilter('all')
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
