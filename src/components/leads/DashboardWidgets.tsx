'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Users,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Target,
  Clock,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Settings2,
  GripVertical,
  X,
  Plus,
  MoreVertical,
  RefreshCw,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff
} from 'lucide-react'

interface WidgetConfig {
  id: string
  type: string
  title: string
  size: 'small' | 'medium' | 'large'
  visible: boolean
  position: number
  refreshInterval?: number
  settings?: Record<string, unknown>
}

interface DashboardWidgetsProps {
  editable?: boolean
  onConfigChange?: (config: WidgetConfig[]) => void
}

const defaultWidgets: WidgetConfig[] = [
  { id: 'w1', type: 'stats_overview', title: 'Overview Stats', size: 'large', visible: true, position: 1 },
  { id: 'w2', type: 'conversion_funnel', title: 'Conversion Funnel', size: 'medium', visible: true, position: 2 },
  { id: 'w3', type: 'recent_leads', title: 'Recent Leads', size: 'medium', visible: true, position: 3 },
  { id: 'w4', type: 'team_performance', title: 'Team Performance', size: 'medium', visible: true, position: 4 },
  { id: 'w5', type: 'activity_timeline', title: 'Activity Timeline', size: 'small', visible: true, position: 5 },
  { id: 'w6', type: 'upcoming_tasks', title: 'Upcoming Tasks', size: 'small', visible: true, position: 6 },
  { id: 'w7', type: 'source_breakdown', title: 'Lead Sources', size: 'small', visible: true, position: 7 },
  { id: 'w8', type: 'target_progress', title: 'Target Progress', size: 'small', visible: true, position: 8 },
]

const availableWidgets = [
  { type: 'stats_overview', title: 'Overview Stats', icon: BarChart3, description: 'Key metrics at a glance' },
  { type: 'conversion_funnel', title: 'Conversion Funnel', icon: TrendingUp, description: 'Lead conversion stages' },
  { type: 'recent_leads', title: 'Recent Leads', icon: Users, description: 'Latest leads added' },
  { type: 'team_performance', title: 'Team Performance', icon: Target, description: 'Team metrics & rankings' },
  { type: 'activity_timeline', title: 'Activity Timeline', icon: Activity, description: 'Recent activities' },
  { type: 'upcoming_tasks', title: 'Upcoming Tasks', icon: Calendar, description: 'Tasks due soon' },
  { type: 'source_breakdown', title: 'Lead Sources', icon: PieChart, description: 'Lead source distribution' },
  { type: 'target_progress', title: 'Target Progress', icon: Target, description: 'Monthly targets' },
  { type: 'communication_stats', title: 'Communication Stats', icon: Phone, description: 'Calls, emails, SMS stats' },
  { type: 'pipeline_value', title: 'Pipeline Value', icon: IndianRupee, description: 'Total pipeline worth' },
]

// Widget Components
function StatsOverviewWidget() {
  const stats = [
    { label: 'Total Leads', value: '2,456', change: 12.5, icon: Users, color: 'text-blue-600 bg-blue-100' },
    { label: 'Converted', value: '387', change: 8.3, icon: CheckCircle2, color: 'text-green-600 bg-green-100' },
    { label: 'Pipeline Value', value: '₹24.5 Cr', change: 15.2, icon: IndianRupee, color: 'text-purple-600 bg-purple-100' },
    { label: 'Avg Response', value: '2.4 hrs', change: -5.1, icon: Clock, color: 'text-orange-600 bg-orange-100' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${stat.color}`}>
            <stat.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className={`text-xs flex items-center ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stat.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(stat.change)}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ConversionFunnelWidget() {
  const stages = [
    { name: 'New Leads', count: 2456, percentage: 100, color: 'bg-blue-500' },
    { name: 'Contacted', count: 1842, percentage: 75, color: 'bg-purple-500' },
    { name: 'Qualified', count: 1105, percentage: 45, color: 'bg-indigo-500' },
    { name: 'Proposal', count: 663, percentage: 27, color: 'bg-teal-500' },
    { name: 'Converted', count: 387, percentage: 16, color: 'bg-green-500' },
  ]

  return (
    <div className="space-y-3">
      {stages.map((stage, index) => (
        <div key={index}>
          <div className="flex justify-between text-sm mb-1">
            <span>{stage.name}</span>
            <span className="font-medium">{stage.count}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${stage.color} rounded-full transition-all`}
              style={{ width: `${stage.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentLeadsWidget() {
  const leads = [
    { name: 'Priya Sharma', type: 'Home Loan', amount: '₹50L', time: '5m ago', status: 'new' },
    { name: 'Rahul Verma', type: 'Personal Loan', amount: '₹8L', time: '12m ago', status: 'new' },
    { name: 'Anita Patel', type: 'Business Loan', amount: '₹25L', time: '28m ago', status: 'contacted' },
    { name: 'Suresh Kumar', type: 'Car Loan', amount: '₹12L', time: '45m ago', status: 'qualified' },
    { name: 'Meera Joshi', type: 'Home Loan', amount: '₹75L', time: '1h ago', status: 'new' },
  ]

  return (
    <div className="space-y-3">
      {leads.map((lead, index) => (
        <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{lead.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{lead.name}</p>
              <p className="text-xs text-muted-foreground">{lead.type} • {lead.amount}</p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={lead.status === 'new' ? 'default' : 'secondary'} className="text-xs">
              {lead.status}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">{lead.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function TeamPerformanceWidget() {
  const team = [
    { name: 'Suresh Kumar', conversions: 28, target: 30, avatar: 'SK' },
    { name: 'Meera Joshi', conversions: 24, target: 25, avatar: 'MJ' },
    { name: 'Arun Nair', conversions: 19, target: 25, avatar: 'AN' },
    { name: 'Kavita Singh', conversions: 22, target: 20, avatar: 'KS' },
  ]

  return (
    <div className="space-y-3">
      {team.map((member, index) => (
        <div key={index} className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{member.avatar}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span>{member.name}</span>
              <span className={member.conversions >= member.target ? 'text-green-600' : ''}>
                {member.conversions}/{member.target}
              </span>
            </div>
            <Progress value={(member.conversions / member.target) * 100} className="h-1.5" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityTimelineWidget() {
  const activities = [
    { action: 'New lead added', user: 'System', time: '2m ago', icon: Users },
    { action: 'Call completed', user: 'Suresh', time: '15m ago', icon: Phone },
    { action: 'Email sent', user: 'Meera', time: '32m ago', icon: Mail },
    { action: 'Lead converted', user: 'Arun', time: '1h ago', icon: CheckCircle2 },
  ]

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-start gap-3">
          <div className="p-1.5 bg-muted rounded">
            <activity.icon className="h-3 w-3" />
          </div>
          <div className="flex-1">
            <p className="text-sm">{activity.action}</p>
            <p className="text-xs text-muted-foreground">{activity.user} • {activity.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function UpcomingTasksWidget() {
  const tasks = [
    { title: 'Follow-up call with Rajesh', time: 'In 30 mins', priority: 'high' },
    { title: 'Document verification', time: 'In 2 hours', priority: 'medium' },
    { title: 'Team meeting', time: 'Tomorrow 10 AM', priority: 'low' },
    { title: 'Monthly report', time: 'Due in 2 days', priority: 'medium' },
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500'
      case 'medium': return 'border-l-yellow-500'
      default: return 'border-l-green-500'
    }
  }

  return (
    <div className="space-y-2">
      {tasks.map((task, index) => (
        <div key={index} className={`p-2 border-l-2 ${getPriorityColor(task.priority)} bg-muted/50 rounded-r`}>
          <p className="text-sm font-medium">{task.title}</p>
          <p className="text-xs text-muted-foreground">{task.time}</p>
        </div>
      ))}
    </div>
  )
}

function SourceBreakdownWidget() {
  const sources = [
    { name: 'Website', value: 45, color: 'bg-blue-500' },
    { name: 'Referral', value: 25, color: 'bg-green-500' },
    { name: 'Social Media', value: 15, color: 'bg-purple-500' },
    { name: 'Direct', value: 10, color: 'bg-orange-500' },
    { name: 'Others', value: 5, color: 'bg-gray-500' },
  ]

  return (
    <div className="space-y-2">
      {sources.map((source, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${source.color}`} />
          <span className="text-sm flex-1">{source.name}</span>
          <span className="text-sm font-medium">{source.value}%</span>
        </div>
      ))}
    </div>
  )
}

function TargetProgressWidget() {
  const targets = [
    { name: 'Leads', current: 2456, target: 3000, unit: '' },
    { name: 'Conversions', current: 387, target: 450, unit: '' },
    { name: 'Disbursement', current: 24.5, target: 30, unit: 'Cr' },
  ]

  return (
    <div className="space-y-4">
      {targets.map((target, index) => (
        <div key={index}>
          <div className="flex justify-between text-sm mb-1">
            <span>{target.name}</span>
            <span className="font-medium">
              {target.current}{target.unit} / {target.target}{target.unit}
            </span>
          </div>
          <Progress value={(target.current / target.target) * 100} className="h-2" />
        </div>
      ))}
    </div>
  )
}

// Widget renderer
function renderWidget(type: string) {
  switch (type) {
    case 'stats_overview': return <StatsOverviewWidget />
    case 'conversion_funnel': return <ConversionFunnelWidget />
    case 'recent_leads': return <RecentLeadsWidget />
    case 'team_performance': return <TeamPerformanceWidget />
    case 'activity_timeline': return <ActivityTimelineWidget />
    case 'upcoming_tasks': return <UpcomingTasksWidget />
    case 'source_breakdown': return <SourceBreakdownWidget />
    case 'target_progress': return <TargetProgressWidget />
    default: return <div className="text-center text-muted-foreground py-4">Widget not found</div>
  }
}

export function DashboardWidgets({ editable = false, onConfigChange }: DashboardWidgetsProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgets)
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null)

  const toggleWidgetVisibility = (widgetId: string) => {
    setWidgets(widgets.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    ))
  }

  const refreshWidget = async (widgetId: string) => {
    setIsRefreshing(widgetId)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(null)
  }

  const getWidgetSize = (size: string) => {
    switch (size) {
      case 'large': return 'col-span-2 lg:col-span-4'
      case 'medium': return 'col-span-2'
      default: return 'col-span-1'
    }
  }

  const visibleWidgets = widgets.filter(w => w.visible).sort((a, b) => a.position - b.position)

  return (
    <div className="space-y-4">
      {/* Header */}
      {editable && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <Button variant="outline" size="sm" onClick={() => setIsCustomizing(true)}>
            <Settings2 className="h-4 w-4 mr-1" /> Customize
          </Button>
        </div>
      )}

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleWidgets.map(widget => (
          <Card key={widget.id} className={getWidgetSize(widget.size)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => refreshWidget(widget.id)}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                    </DropdownMenuItem>
                    {editable && (
                      <DropdownMenuItem onClick={() => toggleWidgetVisibility(widget.id)}>
                        <EyeOff className="h-4 w-4 mr-2" /> Hide
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              {isRefreshing === widget.id ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                renderWidget(widget.type)
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customization Dialog */}
      <Dialog open={isCustomizing} onOpenChange={setIsCustomizing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customize Dashboard</DialogTitle>
            <DialogDescription>
              Choose which widgets to display on your dashboard
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {widgets.map(widget => {
              const widgetInfo = availableWidgets.find(w => w.type === widget.type)
              return (
                <div key={widget.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded">
                      {widgetInfo && <widgetInfo.icon className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{widget.title}</p>
                      <p className="text-sm text-muted-foreground">{widgetInfo?.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={widget.visible}
                    onCheckedChange={() => toggleWidgetVisibility(widget.id)}
                  />
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWidgets(defaultWidgets)}>
              Reset to Default
            </Button>
            <Button onClick={() => setIsCustomizing(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DashboardWidgets
