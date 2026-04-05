'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'

interface PerformanceChartProps {
  data: Array<{
    month: string
    conversions: number
    revenue: number
    leads: number
  }>
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  // Format revenue to Crores
  const formattedData = data.map(item => ({
    ...item,
    revenueCr: parseFloat((item.revenue / 10000000).toFixed(2)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trends</CardTitle>
        <CardDescription>Monthly team performance over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* Conversions & Leads Chart */}
          <div>
            <h4 className="text-sm font-medium mb-4">Conversions & Lead Volume</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Bar dataKey="leads" fill="hsl(var(--primary))" name="Total Leads" opacity={0.6} />
                <Bar dataKey="conversions" fill="hsl(var(--primary))" name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Chart */}
          <div>
            <h4 className="text-sm font-medium mb-4">Revenue Trend</h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Revenue (Cr)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: number) => [`₹${value}Cr`, 'Revenue']}
                />
                <Line
                  type="monotone"
                  dataKey="revenueCr"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
