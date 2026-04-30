'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  Clock,
  Activity,
  Phone,
  UserCheck,
  DollarSign,
  Users,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface PerformanceDashboardProps {
  userId?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface CRMMetrics {
  leads_assigned: number;
  leads_created: number;
  leads_contacted: number;
  leads_converted: number;
  calls_made: number;
  positive_calls: number;
  average_call_sentiment: number;
  conversion_rate: number;
  deals_assigned: number;
  deals_in_progress: number;
  deals_won: number;
  deals_lost: number;
  total_loan_amount: number;
  disbursed_amount: number;
  revenue_generated: number;
  partners_recruited: number;
  partner_leads_generated: number;
  partner_leads_converted: number;
  partner_revenue: number;
  direct_customer_acquisitions: number;
  field_visits: number;
  direct_revenue: number;
  last_updated_at: string | null;
}

interface IncentiveProgress {
  allocation_id: string;
  incentive_id: string;
  title: string;
  target_value: number;
  current_value: number;
  progress_percentage: number;
  current_tier: string | null;
  current_tier_reward: number;
  next_tier: string | null;
  next_tier_requirement: number | null;
  remaining_to_next_tier: number | null;
  projected_earnings: number;
  days_remaining: number;
  start_date: string;
  end_date: string;
  all_tiers: unknown[];
}

interface PerformanceData {
  user_id: string;
  user_name: string;
  sub_role: string;
  period: string;
  period_start: string;
  period_end: string;
  crm_metrics: CRMMetrics;
  incentive_progress: IncentiveProgress[];
  recent_events: unknown[];
}

export default function PerformanceDashboard({
  userId,
  period = 'monthly',
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
}: PerformanceDashboardProps) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchPerformanceData = async () => {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('user_id', userId);
      params.append('period', period);

      const response = await fetch(`/api/crm/performance/summary?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching performance data:', err);
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();

    if (autoRefresh) {
      const interval = setInterval(fetchPerformanceData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [userId, period, autoRefresh, refreshInterval]);

  if (loading) {
    return <PerformanceDashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No performance data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            {data.user_name} • {data.sub_role} • {formatPeriod(period)}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          <Activity className="inline h-4 w-4 mr-1" />
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {/* CRM Metrics Section */}
      <CRMMetricsSection
        metrics={data.crm_metrics}
        subRole={data.sub_role}
        period={data.period}
      />

      {/* Incentive Progress Section */}
      {data.incentive_progress.length > 0 && (
        <IncentiveProgressSection incentives={data.incentive_progress} />
      )}

      {/* Recent Activity Feed */}
      {data.recent_events.length > 0 && (
        <RecentActivitySection events={data.recent_events} />
      )}
    </div>
  );
}

// CRM Metrics Section
function CRMMetricsSection({
  metrics,
  subRole,
  period,
}: {
  metrics: CRMMetrics;
  subRole: string;
  period: string;
}) {
  const roleMetrics = getRoleSpecificMetrics(metrics, subRole);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">CRM Activity ({formatPeriod(period)})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roleMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  label: string;
  value: number | string;
  icon: unknown; color: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

function MetricCard({ label, value, icon: Icon, color, trend, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatMetricValue(value)}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Incentive Progress Section
function IncentiveProgressSection({ incentives }: { incentives: IncentiveProgress[] }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Incentive Progress</h2>
      <div className="space-y-4">
        {incentives.map((incentive) => (
          <IncentiveCard key={incentive.allocation_id} incentive={incentive} />
        ))}
      </div>
    </div>
  );
}

// Incentive Card Component
function IncentiveCard({ incentive }: { incentive: IncentiveProgress }) {
  const progressColor = getProgressColor(incentive.progress_percentage);
  const isOnTrack = incentive.progress_percentage >= 50; // Simple on-track logic

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{incentive.title}</CardTitle>
            <CardDescription>
              {incentive.current_value} / {incentive.target_value} completed
            </CardDescription>
          </div>
          <div className="text-right">
            {incentive.current_tier && (
              <Badge className="mb-2" variant={getTierVariant(incentive.current_tier)}>
                <Award className="h-3 w-3 mr-1" />
                {incentive.current_tier} Tier
              </Badge>
            )}
            <div className="text-2xl font-bold text-green-600">
              ₹{(incentive.current_tier_reward || 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Current Earnings</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className={`font-bold ${progressColor}`}>
              {incentive.progress_percentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={Math.min(incentive.progress_percentage, 100)} className="h-3" />
        </div>

        {/* Next Tier Information */}
        {incentive.next_tier && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium text-sm">Next: {incentive.next_tier} Tier</div>
                <div className="text-xs text-muted-foreground">
                  {incentive.remaining_to_next_tier} more to unlock
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-600">
                ₹{(incentive.next_tier_requirement || 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Reward</div>
            </div>
          </div>
        )}

        {/* Tier Visualization */}
        <div className="grid grid-cols-5 gap-2">
          {incentive.all_tiers.slice(0, 5).map((tier: unknown) => {
            const achieved = incentive.progress_percentage >= tier.target_percentage;
            return (
              <div
                key={tier.tier_level}
                className={`p-2 rounded text-center text-xs ${
                  achieved ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100 border border-gray-300'
                }`}
              >
                {achieved ? (
                  <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
                ) : (
                  <div className="h-4 w-4 mx-auto mb-1 rounded-full border-2 border-gray-400" />
                )}
                <div className="font-semibold">{tier.tier_level}</div>
                <div className="text-[10px] text-muted-foreground">
                  {tier.target_percentage}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Remaining */}
        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <span>{incentive.days_remaining} days remaining</span>
          </div>
          <Badge variant={isOnTrack ? 'default' : 'destructive'}>
            {isOnTrack ? 'On Track' : 'Behind Schedule'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// Recent Activity Section
function RecentActivitySection({ events }: { events: unknown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Recent Activity
        </CardTitle>
        <CardDescription>Latest performance updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.slice(0, 5).map((event, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex-shrink-0">
                {event.tier_changed ? (
                  <Award className="h-5 w-5 text-yellow-500" />
                ) : (
                  <Activity className="h-5 w-5 text-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{event.description}</p>
                {event.tier_changed && (
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    Tier upgraded: {event.old_tier} → {event.new_tier}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
              {event.delta && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm font-bold text-green-600">+{event.delta}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton Loader
function PerformanceDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// Helper Functions
function getRoleSpecificMetrics(metrics: CRMMetrics, subRole: string) {
  const role = subRole.toLowerCase();

  if (role.includes('cro') || role.includes('relationship')) {
    return [
      {
        label: 'Leads Assigned',
        value: metrics.leads_assigned,
        icon: UserCheck,
        color: 'text-blue-600',
      },
      {
        label: 'Leads Converted',
        value: metrics.leads_converted,
        icon: CheckCircle2,
        color: 'text-green-600',
        subtitle: `${metrics.conversion_rate.toFixed(1)}% conversion rate`,
      },
      {
        label: 'Calls Made',
        value: metrics.calls_made,
        icon: Phone,
        color: 'text-purple-600',
      },
      {
        label: 'Positive Calls',
        value: metrics.positive_calls,
        icon: TrendingUp,
        color: 'text-green-600',
        subtitle: `${((metrics.positive_calls / metrics.calls_made) * 100 || 0).toFixed(1)}% positive`,
      },
    ];
  }

  if (role.includes('bde') || role.includes('business development')) {
    return [
      {
        label: 'Deals Assigned',
        value: metrics.deals_assigned,
        icon: Target,
        color: 'text-blue-600',
      },
      {
        label: 'Deals Won',
        value: metrics.deals_won,
        icon: CheckCircle2,
        color: 'text-green-600',
      },
      {
        label: 'Revenue Generated',
        value: `₹${(metrics.revenue_generated / 100000).toFixed(1)}L`,
        icon: DollarSign,
        color: 'text-green-600',
      },
      {
        label: 'In Progress',
        value: metrics.deals_in_progress,
        icon: Activity,
        color: 'text-orange-600',
      },
    ];
  }

  if (role.includes('channel partner') || role.includes('cp')) {
    return [
      {
        label: 'Partners Recruited',
        value: metrics.partners_recruited,
        icon: Users,
        color: 'text-blue-600',
      },
      {
        label: 'Partner Leads Generated',
        value: metrics.partner_leads_generated,
        icon: TrendingUp,
        color: 'text-purple-600',
      },
      {
        label: 'Partner Leads Converted',
        value: metrics.partner_leads_converted,
        icon: CheckCircle2,
        color: 'text-green-600',
      },
      {
        label: 'Partner Revenue',
        value: `₹${(metrics.partner_revenue / 100000).toFixed(1)}L`,
        icon: DollarSign,
        color: 'text-green-600',
      },
    ];
  }

  if (role.includes('direct sales')) {
    return [
      {
        label: 'Field Visits',
        value: metrics.field_visits,
        icon: MapPin,
        color: 'text-blue-600',
      },
      {
        label: 'Customer Acquisitions',
        value: metrics.direct_customer_acquisitions,
        icon: UserCheck,
        color: 'text-green-600',
      },
      {
        label: 'Direct Revenue',
        value: `₹${(metrics.direct_revenue / 100000).toFixed(1)}L`,
        icon: DollarSign,
        color: 'text-green-600',
      },
      {
        label: 'Active This Period',
        value: metrics.field_visits > 0 ? 'Yes' : 'No',
        icon: Activity,
        color: 'text-purple-600',
      },
    ];
  }

  // Default metrics
  return [
    {
      label: 'Total Activity',
      value: metrics.leads_converted + metrics.deals_won,
      icon: Activity,
      color: 'text-blue-600',
    },
  ];
}

function formatMetricValue(value: number | string): string {
  if (typeof value === 'string') return value;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function formatPeriod(period: string): string {
  const map: Record<string, string> = {
    daily: 'Today',
    weekly: 'This Week',
    monthly: 'This Month',
    quarterly: 'This Quarter',
    yearly: 'This Year',
  };
  return map[period] || period;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'text-green-600';
  if (percentage >= 75) return 'text-blue-600';
  if (percentage >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getTierVariant(tier: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const tierLower = tier.toLowerCase();
  if (tierLower.includes('diamond') || tierLower.includes('platinum')) return 'default';
  if (tierLower.includes('gold')) return 'default';
  if (tierLower.includes('silver')) return 'secondary';
  return 'outline';
}
