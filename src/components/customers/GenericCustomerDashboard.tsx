'use client'

import React, { useMemo, useEffect } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import DashboardSkeleton from '@/components/employees/DashboardSkeleton'
import BannerCarousel from '@/components/shared/BannerCarousel'
import { getLoginBanner } from '@/lib/config/customer-banners'
import { useDashboardLoader } from '@/hooks/useDashboardLoader'
import {
  CreditCard,
  TrendingUp,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  LucideIcon
} from 'lucide-react'

interface GenericCustomerDashboardProps {
  title: string
  subtitle: string
  icon?: LucideIcon
  loanType1?: string
  loanType2?: string
}

export default function GenericCustomerDashboard({
  title,
  subtitle,
  icon: Icon,
  loanType1 = 'Business Term Loan',
  loanType2 = 'Working Capital Loan'
}: GenericCustomerDashboardProps) {
  const { user, loading: authLoading } = useAuth()

  // Unified loading coordination
  const { isLoading, registerLoader, unregisterLoader } = useDashboardLoader({
    minimumLoadTime: 800,
    authLoading
  })

  // Track banner loading
  useEffect(() => {
    const unregister = registerLoader('banner-carousel')
    return unregister
  }, [registerLoader])

  const handleBannerLoaded = () => {
    unregisterLoader('banner-carousel')
  }

  // Get dynamic banner (changes on each login)
  const bannerContent = useMemo(() => {
    if (!user?.sub_role) return null
    return getLoginBanner(user.sub_role)
  }, [user?.sub_role])

  // Show skeleton while coordinating all components
  if (isLoading) {
    return <DashboardSkeleton title={title} />
  }

  // Mock data - replace with actual API calls
  const loanStats = {
    activeLoans: 2,
    totalLoanAmount: 5000000,
    nextEmiAmount: 45000,
    nextEmiDate: '2025-10-15',
    creditScore: 750
  }

  return (
    <>
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
                    Welcome back, <span className="text-white font-semibold">{user?.full_name || user?.email?.split('@')[0] || 'Customer'}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Super Admin Managed Banner Carousel */}
          <BannerCarousel onLoadComplete={handleBannerLoaded} />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card-gradient-orange">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-orange-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-orange-300 text-sm mb-1 font-poppins">Active Loans</h3>
              <p className="text-white text-3xl font-bold">{loanStats.activeLoans}</p>
            </div>

            <div className="stat-card-gradient-blue">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <h3 className="text-blue-300 text-sm mb-1 font-poppins">Total Loan Amount</h3>
              <p className="text-white text-3xl font-bold">
                ₹{(loanStats.totalLoanAmount / 100000).toFixed(1)}L
              </p>
            </div>

            <div className="stat-card-gradient-yellow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-yellow-400" />
                </div>
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="text-yellow-300 text-sm mb-1 font-poppins">Next EMI</h3>
              <p className="text-white text-2xl font-bold">₹{(loanStats.nextEmiAmount / 1000).toFixed(0)}K</p>
              <p className="text-yellow-200/60 text-xs mt-1">{loanStats.nextEmiDate}</p>
            </div>

            <div className="stat-card-gradient-green">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
              </div>
              <h3 className="text-green-300 text-sm mb-1 font-poppins">Credit Score</h3>
              <p className="text-white text-3xl font-bold">{loanStats.creditScore}</p>
              <p className="text-green-400 text-xs mt-1">Excellent</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 frosted-card rounded-xl p-6 border border-gray-800/50">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 font-poppins">
                <CreditCard className="w-5 h-5 text-orange-400" />
                Active Loans
              </h2>
              <div className="space-y-4">
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold font-poppins">{loanType1}</h3>
                      <p className="text-gray-400 text-sm">Loan ID: L1-2025-001234</p>
                    </div>
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold">
                      Active
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs">Loan Amount</p>
                      <p className="text-white font-semibold">₹30,00,000</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">EMI</p>
                      <p className="text-white font-semibold">₹25,000/mo</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Balance</p>
                      <p className="text-white font-semibold">₹22,50,000</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Repayment Progress</span>
                      <span>25%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{ width: '25%' }}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold font-poppins">{loanType2}</h3>
                      <p className="text-gray-400 text-sm">Loan ID: L2-2025-005678</p>
                    </div>
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold">
                      Active
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs">Loan Amount</p>
                      <p className="text-white font-semibold">₹2,00,000</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">EMI</p>
                      <p className="text-white font-semibold">₹20,000/mo</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Balance</p>
                      <p className="text-white font-semibold">₹1,00,000</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Repayment Progress</span>
                      <span>50%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{ width: '50%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="frosted-card rounded-xl p-6 border border-gray-800/50">
                <h2 className="text-xl font-bold mb-4 font-poppins">Quick Actions</h2>
                <div className="space-y-3">
                  <button className="w-full bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                    <FileText className="w-5 h-5" />
                    Apply for Loan
                  </button>
                  <button className="w-full bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                    <DollarSign className="w-5 h-5" />
                    Pay EMI
                  </button>
                  <button className="w-full bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                    <FileText className="w-5 h-5" />
                    Upload Documents
                  </button>
                </div>
              </div>

              <div className="frosted-card rounded-xl p-6 border border-gray-800/50">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 font-poppins">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  Alerts
                </h2>
                <div className="space-y-3">
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                    <p className="text-orange-400 text-sm font-semibold mb-1">EMI Due Soon</p>
                    <p className="text-gray-400 text-xs">Your next EMI of ₹45,000 is due on Oct 15, 2025</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-blue-400 text-sm font-semibold mb-1">Document Verification</p>
                    <p className="text-gray-400 text-xs">Please upload your latest documents</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
    </>
  )
}
