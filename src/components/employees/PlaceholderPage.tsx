'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import EmployeeSidebar from '@/components/employees/EmployeeSidebar'
import EmployeeHeader from '@/components/employees/EmployeeHeader'
import DashboardSkeleton from '@/components/employees/DashboardSkeleton'
import { type LucideIcon, Construction, AlertCircle } from 'lucide-react'

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
  comingSoonMessage?: string
}

export default function PlaceholderPage({
  icon: Icon,
  title,
  description,
  comingSoonMessage = 'This feature is currently under development and will be available soon.'
}: PlaceholderPageProps) {
  const { loading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(true)

  // Wait for auth to complete then show the page
  useEffect(() => {
    if (!authLoading) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [authLoading])

  // Timeout fallback - force load after 3 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false)
      }
    }, 3000)

    return () => clearTimeout(timeout)
  }, [isLoading])

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="min-h-screen bg-black font-poppins">
      <EmployeeHeader />

      <div className="flex pt-[108px] min-h-screen">
        <aside className="w-[20%] min-w-[280px] bg-black border-r border-gray-800/50 min-h-full">
          <EmployeeSidebar />
        </aside>

        <main className="w-[80%] bg-black p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3 font-poppins">
                <Icon className="w-8 h-8 text-orange-500" />
                {title}
              </h1>
              <p className="text-gray-400 mt-1">{description}</p>
            </div>
          </div>

          {/* Coming Soon Card */}
          <div className="frosted-card rounded-xl p-12">
            <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
              {/* Icon with Animation */}
              <div className="relative mb-8">
                <div className="w-32 h-32 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-full flex items-center justify-center">
                  <Construction className="w-16 h-16 text-orange-500" />
                </div>
                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl"></div>
              </div>

              {/* Title */}
              <h2 className="text-3xl font-bold mb-4 font-poppins">Coming Soon</h2>

              {/* Description */}
              <p className="text-gray-300 text-lg mb-8">
                {comingSoonMessage}
              </p>

              {/* Info Box */}
              <div className="w-full bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
                  <div className="text-left">
                    <h3 className="font-semibold mb-2 font-poppins">Under Development</h3>
                    <p className="text-gray-400 text-sm">
                      Our team is actively working on this feature. You'll be notified once it's ready to use.
                      Thank you for your patience!
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="mt-8 text-gray-500 text-sm">
                <p>Need immediate assistance? Contact your manager or IT support.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
