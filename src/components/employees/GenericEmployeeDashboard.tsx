'use client'

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import EmployeeSidebar from '@/components/employees/EmployeeSidebar'
import EmployeeHeader from '@/components/employees/EmployeeHeader'
import DashboardSkeleton from '@/components/employees/DashboardSkeleton'
import BannerCarousel from '@/components/shared/BannerCarousel'
import { clientLogger } from '@/lib/utils/client-logger'
import { getLoginBanner } from '@/lib/config/employee-banners'
import { useDashboardLoader } from '@/hooks/useDashboardLoader'
import {
  Users,
  TrendingUp,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  Target,
  Award,
  AlertCircle,
  RefreshCw,
  LucideIcon
} from 'lucide-react'

interface DashboardStats {
  completedToday: number
  pendingTasks: number
  monthlyTarget: number
  currentProgress: number
  teamRanking: number
  totalAssigned: number
}

interface Task {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  due_date?: string
}

interface GenericEmployeeDashboardProps {
  title: string
  subtitle: string
  icon?: LucideIcon
  primaryMetric?: string
  secondaryMetric?: string
}

function GenericEmployeeDashboard({
  title,
  subtitle,
  icon: Icon,
  primaryMetric = 'Leads Assigned',
  secondaryMetric = 'Applications Processed'
}: GenericEmployeeDashboardProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalAssigned: 0,
    completedToday: 0,
    pendingTasks: 0,
    monthlyTarget: 100,
    currentProgress: 0,
    teamRanking: 0
  })
  const [tasks, setTasks] = useState<Task[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Unified loading coordination - NO ARTIFICIAL DELAYS
  const { isLoading, registerLoader, unregisterLoader } = useDashboardLoader({
    authLoading
  })

  // Fetch dashboard data from API
  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return

    setDataLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/employees/dashboard')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch dashboard data')
      }

      if (data.success && data.data) {
        setDashboardStats(data.data.stats)
        setTasks(data.data.tasks || [])
      }
    } catch (err) {
      clientLogger.error('Error fetching dashboard data', { error: err instanceof Error ? err.message : String(err) })
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      // Set default values on error
      setDashboardStats({
        totalAssigned: 0,
        completedToday: 0,
        pendingTasks: 0,
        monthlyTarget: 100,
        currentProgress: 0,
        teamRanking: 0
      })
    } finally {
      setDataLoading(false)
    }
  }, [user?.id])

  // Fetch data when user is available
  useEffect(() => {
    if (user?.id && !authLoading) {
      fetchDashboardData()
    }
  }, [user?.id, authLoading, fetchDashboardData])

  // Banner loading is now NON-BLOCKING - don't wait for banner
  const handleBannerLoaded = useCallback(() => {
    // Banner loaded callback (for future use)
  }, [])

  // Get dynamic banner (changes on each login)
  const bannerContent = useMemo(() => {
    if (!user?.sub_role) return null
    return getLoginBanner(user.sub_role)
  }, [user?.sub_role])

  // Default tasks if none returned from API
  const displayTasks = tasks.length > 0 ? tasks : [
    { id: '1', title: 'No tasks assigned yet', status: 'pending' as const, priority: 'medium' as const }
  ]

  // Show skeleton while coordinating all components
  if (isLoading) {
    return <DashboardSkeleton title={title} />
  }

  return (
    <div className="min-h-screen bg-black font-poppins flex flex-col">
      <EmployeeHeader />

      <div className="flex flex-1">
        {/* Sidebar - Scrolls with page */}
        <aside className="w-[20%] min-w-[280px] border-r-2 border-orange-500/30 shadow-[2px_0_10px_rgba(249,115,22,0.15)]">
          <EmployeeSidebar />
        </aside>

        {/* Main Content Area - Scrolls with page */}
        <main className="w-[80%] bg-black">
          <div className="px-8 pt-[86px] pb-8">
            <div className="space-y-6">
          {/* Dynamic Welcome Banner with Professional Image */}
          <div className="rounded-xl overflow-hidden relative h-[280px]">
            {/* Background Image - Natural colors only */}
            {bannerContent && (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${bannerContent.image})`,
                }}
              />
            )}

            {/* Black overlay for readability - uniform across banner */}
            <div className="absolute inset-0 bg-black/60" />

            {/* Content */}
            <div className="relative z-10 h-full flex items-center px-8">
              <div className="w-full">
                {/* Text content */}
                <div className="max-w-4xl">
                  <h1 className="text-5xl font-bold mb-3 drop-shadow-2xl font-poppins">
                    {title}
                  </h1>
                  <p className="text-gray-100 text-lg mb-4 drop-shadow-lg">{subtitle}</p>

                  {/* Motivational Quote */}
                  {bannerContent && (
                    <div className="bg-black/50 backdrop-blur-sm border-l-4 border-white pl-4 pr-6 py-3 rounded-r-lg mb-4">
                      <p className="text-white text-base italic font-medium drop-shadow-lg">
                        "{bannerContent.quote}"
                      </p>
                    </div>
                  )}

                  <p className="text-gray-200 text-sm drop-shadow-lg">
                    Welcome back, <span className="text-white font-semibold">{user?.full_name || user?.email?.split('@')[0]}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Super Admin Managed Banner Carousel */}
          <BannerCarousel onLoadComplete={handleBannerLoaded} />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stat Card 1 - Dark Blue */}
          <div className="bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-700/30 p-6 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-blue-900/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <Target className="w-8 h-8 text-blue-400" />
              <span className="px-3 py-1 text-xs text-blue-300 bg-blue-500/20 rounded-full">TODAY</span>
            </div>
            <h3 className="text-3xl font-bold mb-1 font-poppins">{dashboardStats.completedToday}</h3>
            <p className="text-sm text-blue-300">{primaryMetric}</p>
          </div>

          {/* Stat Card 2 - Dark Yellow/Gold */}
          <div className="bg-gradient-to-br from-yellow-900 to-yellow-950 border border-yellow-700/30 p-6 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-yellow-900/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-yellow-400" />
              <span className="px-3 py-1 text-xs text-yellow-300 bg-yellow-500/20 rounded-full">PENDING</span>
            </div>
            <h3 className="text-3xl font-bold mb-1 font-poppins">{dashboardStats.pendingTasks}</h3>
            <p className="text-sm text-yellow-300">Pending Tasks</p>
          </div>

          {/* Stat Card 3 - Dark Green */}
          <div className="bg-gradient-to-br from-green-900 to-green-950 border border-green-700/30 p-6 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-green-900/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <span className="px-3 py-1 text-xs text-green-300 bg-green-500/20 rounded-full">PROGRESS</span>
            </div>
            <h3 className="text-3xl font-bold mb-1 font-poppins">{dashboardStats.currentProgress}</h3>
            <p className="text-sm text-green-300">Monthly Progress</p>
          </div>

          {/* Stat Card 4 - Cyan/Teal */}
          <div className="bg-gradient-to-br from-cyan-900 to-cyan-950 border border-cyan-700/30 p-6 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-cyan-900/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <Award className="w-8 h-8 text-cyan-400" />
              <span className="px-3 py-1 text-xs text-cyan-300 bg-cyan-500/20 rounded-full">RANK</span>
            </div>
            <h3 className="text-3xl font-bold mb-1 font-poppins">#{dashboardStats.teamRanking}</h3>
            <p className="text-sm text-cyan-300">Team Ranking</p>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Tasks */}
          <div className="frosted-card p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 font-poppins">
                <FileText className="w-5 h-5 text-orange-500" />
                Today's Tasks
              </h2>
              <span className="text-sm text-gray-400">{dashboardStats.pendingTasks} pending</span>
            </div>
            <div className="space-y-3">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                  <button onClick={fetchDashboardData} className="ml-auto hover:text-red-300">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
              {displayTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle
                      className={`w-5 h-5 ${
                        task.status === 'completed' ? 'text-green-400' : 'text-gray-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm text-white">{task.title}</p>
                      <p className="text-xs text-gray-400">
                        Priority: <span className={task.priority === 'high' ? 'text-red-400' : 'text-yellow-400'}>{task.priority}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Overview */}
          <div className="frosted-card p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 font-poppins">
                <Target className="w-5 h-5 text-orange-500" />
                Performance Overview
              </h2>
              <span className="text-sm text-gray-400">This Month</span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Target Achievement</span>
                  <span className="text-white font-semibold">
                    {dashboardStats.currentProgress}/{dashboardStats.monthlyTarget}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-yellow-500 h-3 rounded-full transition-all"
                    style={{ width: `${(dashboardStats.currentProgress / dashboardStats.monthlyTarget) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-400">98%</p>
                  <p className="text-xs text-gray-400">Success Rate</p>
                </div>
                <div className="text-center p-3 bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-400">4.8</p>
                  <p className="text-xs text-gray-400">Avg Rating</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="frosted-card p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 font-poppins">
            <Calendar className="w-5 h-5 text-orange-500" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/employees/customers')}
              className="p-4 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-lg transition-all text-white hover:scale-105"
              aria-label="New Lead"
            >
              <Users className="w-6 h-6 mb-2 mx-auto" />
              <span className="text-sm">New Lead</span>
            </button>
            <button
              onClick={() => router.push('/employees/applications')}
              className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg transition-all text-white hover:scale-105"
              aria-label="View Applications"
            >
              <FileText className="w-6 h-6 mb-2 mx-auto" />
              <span className="text-sm">View Applications</span>
            </button>
            <button
              onClick={() => router.push('/employees/approvals')}
              className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg transition-all text-white hover:scale-105"
              aria-label="Approve Documents"
            >
              <CheckCircle className="w-6 h-6 mb-2 mx-auto" />
              <span className="text-sm">Approve Documents</span>
            </button>
            <button
              onClick={() => router.push('/employees/attendance')}
              className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg transition-all text-white hover:scale-105"
              aria-label="View Attendance"
            >
              <Calendar className="w-6 h-6 mb-2 mx-auto" />
              <span className="text-sm">Attendance</span>
            </button>
          </div>
        </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// Memoize to prevent unnecessary re-renders when parent re-renders
export default memo(GenericEmployeeDashboard)
