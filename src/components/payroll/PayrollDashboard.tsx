'use client'

// =====================================================
// ADVANCED PAYROLL DASHBOARD
// Enterprise-grade analytics and reporting
// =====================================================

import React, { useState, useEffect } from 'react'
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  Download,
  Filter,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/cn'
import { clientLogger } from '@/lib/utils/client-logger'

interface PayrollStats {
  currentMonth: {
    totalPayroll: number
    totalEmployees: number
    avgSalary: number
    totalDeductions: number
  }
  ytd: {
    totalPayroll: number
    totalDeductions: number
    avgMonthlyPayroll: number
  }
  trends: {
    payrollGrowth: number
    employeeGrowth: number
    deductionRate: number
  }
}

interface DepartmentWiseData {
  department: string
  employeeCount: number
  totalPayroll: number
  avgSalary: number
  percentage: number
}

interface MonthlyTrend {
  month: string
  gross: number
  deductions: number
  net: number
}

export default function PayrollDashboard() {
  const [stats, setStats] = useState<PayrollStats | null>(null)
  const [departmentData, setDepartmentData] = useState<DepartmentWiseData[]>([])
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('current_month')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [selectedPeriod])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // Fetch dashboard data
      const response = await fetch(`/api/hr/payroll/dashboard?period=${selectedPeriod}`)
      const result = await response.json()

      if (result.success) {
        setStats(result.data.stats)
        setDepartmentData(result.data.departmentWise || [])
        setMonthlyTrends(result.data.monthlyTrends || [])
      }
    } catch (error) {
      clientLogger.error('Failed to load dashboard data:', { error })
    } finally {
      setIsLoading(false)
    }
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-800 h-32 rounded-lg"></div>
          ))}
        </div>
        <div className="bg-gray-800 h-64 rounded-lg"></div>
      </div>
    )
  }

  if (!stats) {
    return <div>No data available</div>
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Payroll Analytics</h2>
        <div className="flex gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700/50 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="current_month">Current Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="ytd">Year to Date</option>
            <option value="last_year">Last Year</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Payroll */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className={`flex items-center gap-1 text-sm ${stats.trends.payrollGrowth >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {stats.trends.payrollGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {formatPercentage(stats.trends.payrollGrowth)}
            </span>
          </div>
          <div className="text-3xl font-bold">{formatCurrency(stats.currentMonth.totalPayroll)}</div>
          <div className="text-sm opacity-90 mt-1">Total Payroll</div>
        </div>

        {/* Total Employees */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
            <span className={`flex items-center gap-1 text-sm ${stats.trends.employeeGrowth >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {stats.trends.employeeGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {formatPercentage(stats.trends.employeeGrowth)}
            </span>
          </div>
          <div className="text-3xl font-bold">{stats.currentMonth.totalEmployees}</div>
          <div className="text-sm opacity-90 mt-1">Active Employees</div>
        </div>

        {/* Average Salary */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 opacity-80" />
            <span className="text-sm text-green-200">Monthly</span>
          </div>
          <div className="text-3xl font-bold">{formatCurrency(stats.currentMonth.avgSalary)}</div>
          <div className="text-sm opacity-90 mt-1">Average Salary</div>
        </div>

        {/* Total Deductions */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 opacity-80" />
            <span className="text-sm text-orange-200">{stats.trends.deductionRate.toFixed(1)}%</span>
          </div>
          <div className="text-3xl font-bold">{formatCurrency(stats.currentMonth.totalDeductions)}</div>
          <div className="text-sm opacity-90 mt-1">Total Deductions</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-[var(--customer-card-bg)] rounded-lg border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Monthly Payroll Trend
          </h3>
          <div className="space-y-3">
            {monthlyTrends.slice(0, 6).map((trend, index) => {
              const maxNet = monthlyTrends.length > 0 ? Math.max(...monthlyTrends.map(t => t.net)) : 1
              return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-white">{trend.month}</span>
                  <span className="text-gray-300">{formatCurrency(trend.net)}</span>
                </div>
                <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    style={{
                      width: `${maxNet > 0 ? (trend.net / maxNet) * 100 : 0}%`
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Gross: {formatCurrency(trend.gross)}</span>
                  <span>Deductions: {formatCurrency(trend.deductions)}</span>
                </div>
              </div>
              )
            })}
          </div>
        </div>

        {/* Department-wise Distribution */}
        <div className="bg-[var(--customer-card-bg)] rounded-lg border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-400" />
            Department-wise Distribution
          </h3>
          <div className="space-y-4">
            {departmentData.map((dept, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm text-white">{dept.department}</div>
                    <div className="text-xs text-gray-400">
                      {dept.employeeCount} employees • Avg: {formatCurrency(dept.avgSalary)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm text-white">{formatCurrency(dept.totalPayroll)}</div>
                    <div className="text-xs text-gray-400">{dept.percentage.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full rounded-full"
                    style={{
                      width: `${dept.percentage}%`,
                      background: `hsl(${index * 60}, 70%, 50%)`
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Year-to-Date Summary */}
      <div className="bg-[var(--customer-card-bg)] rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-green-400" />
          Year-to-Date Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Payroll (YTD)</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(stats.ytd.totalPayroll)}</div>
          </div>
          <div className="border border-gray-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Deductions (YTD)</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(stats.ytd.totalDeductions)}</div>
          </div>
          <div className="border border-gray-700/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Average Monthly Payroll</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(stats.ytd.avgMonthlyPayroll)}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[var(--customer-card-bg)] rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-500/10 transition-colors">
            <FileText className="w-6 h-6 text-blue-400 mb-2" />
            <span className="text-sm font-medium text-gray-300">Generate Payroll</span>
          </button>
          <button className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-500/10 transition-colors">
            <Download className="w-6 h-6 text-green-400 mb-2" />
            <span className="text-sm font-medium text-gray-300">Export Reports</span>
          </button>
          <button className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-500/10 transition-colors">
            <Users className="w-6 h-6 text-purple-400 mb-2" />
            <span className="text-sm font-medium text-gray-300">Manage Salaries</span>
          </button>
          <button className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-orange-500 hover:bg-orange-500/10 transition-colors">
            <BarChart3 className="w-6 h-6 text-orange-400 mb-2" />
            <span className="text-sm font-medium text-gray-300">View Analytics</span>
          </button>
        </div>
      </div>
    </div>
  )
}
