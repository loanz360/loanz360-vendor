'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import EmployeeSidebar from '@/components/employees/EmployeeSidebar'
import EmployeeHeader from '@/components/employees/EmployeeHeader'
import DashboardSkeleton from '@/components/employees/DashboardSkeleton'
import { useAuthGuard } from '@/hooks/useAuthGuard'

interface EmployeeDashboardLayoutProps {
  children: React.ReactNode
  title?: string
  requireAuth?: boolean
  className?: string
}

export default function EmployeeDashboardLayout({
  children,
  title,
  requireAuth = true,
  className = '',
}: EmployeeDashboardLayoutProps) {
  const { user, authLoading } = useAuthGuard({ redirectTo: requireAuth ? '/login' : undefined })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  if (authLoading) {
    return <DashboardSkeleton title={title} />
  }

  if (requireAuth && !user) {
    return <DashboardSkeleton title={title} />
  }

  return (
    <div className="min-h-screen bg-black font-poppins flex flex-col">
      <EmployeeHeader />

      <div className="flex flex-1">
        <aside className="hidden lg:block w-[20%] min-w-[280px] border-r-2 border-orange-500/30 shadow-[2px_0_10px_rgba(249,115,22,0.15)]">
          <EmployeeSidebar />
        </aside>

        <main className={`flex-1 lg:w-[80%] bg-black ${className}`}>
          <div className="p-4 md:p-6 pt-[108px] space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
