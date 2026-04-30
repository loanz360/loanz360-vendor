/**
 * Advanced Analytics Dashboard
 * Real-time charts, custom reports, and predictive analytics
 */

'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Award,
  DollarSign,
  Calendar,
  Download,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ===================================
// TYPE DEFINITIONS
// ===================================

interface AnalyticsData {
  overview: {
    totalIncentives: number;
    activeIncentives: number;
    totalParticipants: number;
    achievementRate: number;
    totalAllocated: number;
    totalEarned: number;
    totalClaimed: number;
    totalPaid: number;
  };
  trends: {
    date: string;
    participants: number;
    earned: number;
    achieved: number;
  }[];
  distribution: {
    tier: string;
    count: number;
    percentage: number;
  }[];
  topPerformers: {
    name: string;
    earned: number;
    achievements: number;
    tier: string;
  }[];
  incentivePerformance: {
    title: string;
    participants: number;
    achievers: number;
    totalEarned: number;
    avgProgress: number;
  }[];
  predictions: {
    expectedAchievers: number;
    expectedPayout: number;
    churnRisk: number;
    recommendedTargets: unknown[];
  };
}

// ===================================
// COLORS
// ===================================

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6',
  pink: '#ec4899',
  indigo: '#6366f1',
};

const TIER_COLORS: Record<string, string> = {
  Bronze: '#cd7f32',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Platinum: '#e5e4e2',
  Diamond: '#b9f2ff',
};

// ===================================
// COMPONENT
// ===================================

export default function AdvancedAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v2/analytics?range=${dateRange}`);
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const handleExport = () => {
    // Export analytics data to CSV/Excel
    const csvData = generateCSV(data);
    downloadFile(csvData, 'incentives-analytics.csv', 'text/csv');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="text-gray-600 mt-1">Real-time insights and predictive analytics</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as unknown)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Participants"
          value={data.overview.totalParticipants}
          change={12.5}
          icon={<Users className="w-6 h-6" />}
          color="blue"
        />
        <KPICard
          title="Achievement Rate"
          value={`${data.overview.achievementRate.toFixed(1)}%`}
          change={5.3}
          icon={<Target className="w-6 h-6" />}
          color="green"
        />
        <KPICard
          title="Total Earned"
          value={`₹${(data.overview.totalEarned / 1000).toFixed(0)}K`}
          change={18.2}
          icon={<DollarSign className="w-6 h-6" />}
          color="purple"
        />
        <KPICard
          title="Total Paid"
          value={`₹${(data.overview.totalPaid / 1000).toFixed(0)}K`}
          change={-2.4}
          icon={<Award className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.trends}>
              <defs>
                <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="earned"
                stroke={COLORS.primary}
                fillOpacity={1}
                fill="url(#colorEarned)"
              />
              <Area
                type="monotone"
                dataKey="participants"
                stroke={COLORS.success}
                fillOpacity={0.3}
                fill={COLORS.success}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Tier Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.distribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {data.distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TIER_COLORS[entry.tier] || COLORS.primary} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incentive Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Incentive Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.incentivePerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="participants" fill={COLORS.primary} />
              <Bar dataKey="achievers" fill={COLORS.success} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performers</h3>
          <div className="space-y-3">
            {data.topPerformers.slice(0, 5).map((performer, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{performer.name}</p>
                    <p className="text-sm text-gray-500">{performer.tier} Tier</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    ₹{performer.earned.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {performer.achievements} achievements
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Predictive Analytics */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow p-6 text-white">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          AI-Powered Predictions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm font-medium opacity-90">Expected Achievers (Next Month)</p>
            <p className="text-3xl font-bold mt-2">{data.predictions.expectedAchievers}</p>
            <p className="text-sm opacity-75 mt-1">Based on current trends</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm font-medium opacity-90">Predicted Payout</p>
            <p className="text-3xl font-bold mt-2">
              ₹{(data.predictions.expectedPayout / 1000).toFixed(0)}K
            </p>
            <p className="text-sm opacity-75 mt-1">85% confidence</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm font-medium opacity-90">Churn Risk</p>
            <p className="text-3xl font-bold mt-2">{data.predictions.churnRisk}%</p>
            <p className="text-sm opacity-75 mt-1">Of active participants</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================
// SUB-COMPONENTS
// ===================================

interface KPICardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function KPICard({ title, value, change, icon, color }: KPICardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  const isPositive = change >= 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div
          className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {Math.abs(change)}%
        </div>
      </div>
      <p className="text-gray-600 text-sm mt-4">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

// ===================================
// HELPER FUNCTIONS
// ===================================

function renderCustomizedLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: unknown) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-semibold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function generateCSV(data: AnalyticsData | null): string {
  if (!data) return '';

  const csv: string[] = [];

  // Overview
  csv.push('Overview');
  csv.push('Metric,Value');
  csv.push(`Total Incentives,${data.overview.totalIncentives}`);
  csv.push(`Active Incentives,${data.overview.activeIncentives}`);
  csv.push(`Total Participants,${data.overview.totalParticipants}`);
  csv.push(`Achievement Rate,${data.overview.achievementRate}%`);
  csv.push(`Total Allocated,${data.overview.totalAllocated}`);
  csv.push(`Total Earned,${data.overview.totalEarned}`);
  csv.push(`Total Claimed,${data.overview.totalClaimed}`);
  csv.push(`Total Paid,${data.overview.totalPaid}`);
  csv.push('');

  // Trends
  csv.push('Trends');
  csv.push('Date,Participants,Earned,Achieved');
  data.trends.forEach((trend) => {
    csv.push(`${trend.date},${trend.participants},${trend.earned},${trend.achieved}`);
  });
  csv.push('');

  // Tier Distribution
  csv.push('Tier Distribution');
  csv.push('Tier,Count,Percentage');
  data.distribution.forEach((tier) => {
    csv.push(`${tier.tier},${tier.count},${tier.percentage}%`);
  });

  return csv.join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
