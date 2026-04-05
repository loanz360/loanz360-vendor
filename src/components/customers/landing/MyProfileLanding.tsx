'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  CreditCard,
  Bell,
  Calendar,
  Building2,
  TrendingUp,
  Lightbulb,
  User,
  Sparkles,
  Shield,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
  FileText,
  Target,
  RefreshCcw,
  BadgePercent,
  Building,
  Percent,
  ArrowUpDown,
  FolderOpen,
  Gift,
  FileCheck,
  Repeat,
  Search,
  Star
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

// Storage key to track if user has seen landing page
const LANDING_SEEN_KEY = 'loanz360_my_profile_landing_seen'

interface MyProfileLandingProps {
  onProceed?: () => void
  onSkip?: () => void
}

export default function MyProfileLanding({ onProceed, onSkip }: MyProfileLandingProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = 6

  const handleProceed = async () => {
    setIsLoading(true)
    try {
      await trackLandingAction('PROCEEDED')
      localStorage.setItem(LANDING_SEEN_KEY, 'true')

      if (onProceed) {
        onProceed()
      } else {
        router.push('/customers/my-profile?showForm=true')
      }
    } catch (error) {
      clientLogger.error('Error proceeding from landing', { error })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = async () => {
    try {
      await trackLandingAction('SKIPPED')
      localStorage.setItem(LANDING_SEEN_KEY, 'true')

      if (onSkip) {
        onSkip()
      } else {
        router.push('/customers/dashboard')
      }
    } catch (error) {
      clientLogger.error('Error skipping landing', { error })
      router.push('/customers/dashboard')
    }
  }

  const trackLandingAction = async (action: 'VIEWED' | 'SKIPPED' | 'PROCEEDED') => {
    try {
      await fetch('/api/customers/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_type: 'MY_PROFILE',
          action
        }),
        credentials: 'include'
      })
    } catch (error) {
      clientLogger.debug('Failed to track landing action', { error })
    }
  }

  // Track view on mount
  React.useEffect(() => {
    trackLandingAction('VIEWED')
  }, [])

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < totalSlides) {
      setCurrentSlide(index)
    }
  }, [totalSlides])

  const nextSlide = useCallback(() => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1)
    }
  }, [currentSlide, totalSlides])

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1)
    }
  }, [currentSlide])

  // Slide 1: Why Your Golden Profile Matters
  const renderSlide1 = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#B8860B]/10 border border-[#D4AF37]/30 flex items-center justify-center">
            <User className="w-7 h-7 text-[#D4AF37]" />
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2 golden-text">Create Your Golden Profile</h1>
        <div className="flex items-center justify-center gap-2 text-[#D4AF37] mb-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-base font-medium">Your Financial Identity on LOANZ360</span>
          <Sparkles className="w-4 h-4" />
        </div>
        <p className="text-gray-400 text-sm max-w-2xl mx-auto">
          Your Golden Profile unlocks powerful financial tools and personalized insights.
        </p>
      </div>

      {/* Why It Matters Card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
            <Target className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Why Your Golden Profile Matters</h3>
            <p className="text-xs text-gray-400">The gateway to financial freedom</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Without Profile */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-semibold text-red-400">Without Golden Profile</span>
            </div>
            <ul className="space-y-1">
              {[
                'Limited dashboard access',
                'No credit score tracking',
                'Manual loan management',
                'Miss better loan offers'
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-1.5 text-[10px] text-gray-400">
                  <span className="text-red-500">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* With Profile */}
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs font-semibold text-green-400">With Golden Profile</span>
            </div>
            <ul className="space-y-1">
              {[
                'Full dashboard unlocked',
                'Live credit score updates',
                'Auto-tracked all loans',
                'Personalized loan offers'
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-1.5 text-[10px] text-gray-300">
                  <span className="text-green-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Simple 3 Steps */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {[
          { step: '1', label: 'Upload PAN', icon: FileText },
          { step: '2', label: 'Verify OTP', icon: Shield },
          { step: '3', label: 'Done!', icon: CheckCircle2 }
        ].map((item, index) => (
          <React.Fragment key={index}>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-xs font-bold text-[#D4AF37]">
                {item.step}
              </div>
              <span className="text-xs text-gray-300">{item.label}</span>
            </div>
            {index < 2 && <ArrowRight className="w-3 h-3 text-gray-600 hidden sm:block" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  )

  // Slide 2: Auto Credit Bureau Pull
  const renderSlide2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">Auto Credit Bureau Pull</h2>
        <p className="text-gray-400 text-sm">Upload PAN, we fetch your credit reports automatically</p>
      </div>

      <div className="rounded-xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/10 to-[#B8860B]/5 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">All Major Credit Bureaus</h3>
            <p className="text-xs text-gray-400">One PAN, all your credit data</p>
          </div>
        </div>

        {/* Credit Bureau Logos */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { name: 'CIBIL', score: '750', color: 'blue' },
            { name: 'Experian', score: '742', color: 'purple' },
            { name: 'Equifax', score: '738', color: 'green' },
            { name: 'CRIF', score: '745', color: 'orange' }
          ].map((bureau, index) => (
            <div key={index} className="rounded-lg border border-gray-700 bg-gray-900/50 p-2 text-center">
              <TrendingUp className={`w-4 h-4 text-${bureau.color}-400 mx-auto mb-1`} />
              <p className="text-[10px] text-gray-500">{bureau.name}</p>
              <p className="text-sm font-bold text-white">{bureau.score}</p>
            </div>
          ))}
        </div>

        {/* What You Get */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: TrendingUp, text: 'Scores from all 4 bureaus' },
            { icon: FileText, text: 'Complete credit analysis' },
            { icon: RefreshCcw, text: 'Monthly auto-refresh' },
            { icon: AlertTriangle, text: 'Score change alerts' }
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/50 border border-gray-800">
              <item.icon className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
              <span className="text-[10px] text-gray-300">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <p className="text-[10px] text-gray-500">
          <Shield className="w-3 h-3 inline mr-1" />
          Your data is encrypted and secure. We never share without permission.
        </p>
      </div>
    </div>
  )

  // Slide 3: Smart Notifications & EMI Reminders
  const renderSlide3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">Smart Notifications & EMI Reminders</h2>
        <p className="text-gray-400 text-sm">Never miss a payment, never miss an opportunity</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Smart Notifications */}
        <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Smart Notifications</h3>
              <p className="text-[10px] text-gray-400">Real-time alerts that matter</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {[
              { text: 'New loan offers for you', icon: Zap },
              { text: 'Interest rate changes', icon: Percent },
              { text: 'Better deals available', icon: BadgePercent },
              { text: 'Score improvements', icon: TrendingUp }
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-900/50">
                <item.icon className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-gray-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* EMI Reminders */}
        <div className="rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">EMI Reminders</h3>
              <p className="text-[10px] text-gray-400">Never miss a payment</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {[
              { days: '15 days before', desc: 'Plan finances' },
              { days: '7 days before', desc: 'Ensure balance' },
              { days: '3 days before', desc: 'Final reminder' },
              { days: 'On due date', desc: 'Payment alert' }
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-900/50">
                <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Clock className="w-2.5 h-2.5 text-green-400" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-white">{item.days}</p>
                  <p className="text-[9px] text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-center">
        <p className="text-xs text-gray-400">
          <span className="text-green-400 font-semibold">94%</span> of users never miss an EMI with Golden Profile
        </p>
      </div>
    </div>
  )

  // Slide 4: All Loans One View & Rate Comparison
  const renderSlide4 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">All Loans, One Dashboard</h2>
        <p className="text-gray-400 text-sm">See all your loans from all banks in one place</p>
      </div>

      <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Unified Loan Dashboard</h3>
            <p className="text-xs text-gray-400">All your loans, all your banks, one view</p>
          </div>
        </div>

        {/* Sample Loans */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { bank: 'SBI', type: 'Home Loan', emi: '₹42,500', rate: '8.5%' },
            { bank: 'HDFC', type: 'Car Loan', emi: '₹15,200', rate: '9.2%' },
            { bank: 'ICICI', type: 'Personal', emi: '₹9,800', rate: '12.5%' },
            { bank: 'Axis', type: 'Credit Card', emi: '₹12,000', rate: '3.5%' }
          ].map((loan, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/50 border border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center">
                  <Building className="w-3 h-3 text-purple-400" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-white">{loan.type}</p>
                  <p className="text-[9px] text-gray-500">{loan.bank}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-white">{loan.emi}</p>
                <p className="text-[9px] text-gray-500">{loan.rate}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Rate Comparison Highlight */}
        <div className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3">
          <div className="flex items-start gap-2">
            <ArrowUpDown className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[#D4AF37] mb-0.5">Rate Comparison Alert!</p>
              <p className="text-[10px] text-gray-300">
                Personal Loan rate (12.5%) &gt; market avg (10.5%).
                <span className="text-[#D4AF37] font-medium"> Save ₹4,200/year!</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        {[
          { label: 'Banks', value: '50+' },
          { label: 'Loan Types', value: '12+' },
          { label: 'Auto-Sync', value: 'Daily' }
        ].map((stat, index) => (
          <div key={index} className="px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700 text-center">
            <p className="text-sm font-bold text-white">{stat.value}</p>
            <p className="text-[10px] text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // Slide 5: All Details in One Place
  const renderSlide5 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">All Details in One Place</h2>
        <p className="text-gray-400 text-sm">Submit once, use everywhere - no repetitive form filling</p>
      </div>

      <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Your Financial Data Vault</h3>
            <p className="text-xs text-gray-400">Store once, apply anywhere</p>
          </div>
        </div>

        {/* Problem vs Solution */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Traditional Way */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Repeat className="w-4 h-4 text-red-400" />
              <span className="text-xs font-semibold text-red-400">Traditional Way</span>
            </div>
            <ul className="space-y-1">
              {[
                'Fill same form every time',
                'Upload docs repeatedly',
                'Visit multiple websites',
                'Track apps separately'
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-1.5 text-[10px] text-gray-400">
                  <span className="text-red-500">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* With LOANZ360 */}
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs font-semibold text-green-400">With LOANZ360</span>
            </div>
            <ul className="space-y-1">
              {[
                'Fill details just ONCE',
                'Docs stored securely',
                'Apply to 50+ banks',
                'Track all in one place'
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-1.5 text-[10px] text-gray-300">
                  <span className="text-green-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Search, title: 'Check Eligibility', desc: 'Instant check for all loans' },
            { icon: Gift, title: 'Best Offers', desc: 'Compare 50+ banks' },
            { icon: FileCheck, title: 'Pre-Approved', desc: 'Based on your profile' }
          ].map((item, index) => (
            <div key={index} className="flex flex-col items-center p-2 rounded-lg bg-gray-900/50 border border-gray-800 text-center">
              <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                <item.icon className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <p className="text-[10px] font-medium text-white">{item.title}</p>
              <p className="text-[9px] text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stat highlight */}
      <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-center">
        <p className="text-xs text-gray-300">Users save an average of</p>
        <p className="text-xl font-bold text-purple-400">4+ hours</p>
        <p className="text-[10px] text-gray-500">per loan application with pre-filled details</p>
      </div>
    </div>
  )

  // Slide 6: Smart Bank Switching & Get Started
  const renderSlide6 = () => (
    <div className="space-y-4">
      <div className="text-center mb-3">
        <h2 className="text-xl font-bold mb-1">Smart Bank Switching</h2>
        <p className="text-gray-400 text-sm">Save thousands by switching to better rates</p>
      </div>

      <div className="rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Personalized Recommendations</h3>
            <p className="text-xs text-gray-400">AI-powered savings suggestions</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { title: 'Lower Rates', desc: 'Better rates for you', icon: Percent },
            { title: 'Better Service', desc: 'Compare ratings', icon: Star },
            { title: 'Cashback', desc: 'Exclusive offers', icon: BadgePercent },
            { title: 'Balance Transfer', desc: 'Easy switching', icon: RefreshCcw }
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/50 border border-gray-800">
              <div className="w-6 h-6 rounded bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-3 h-3 text-green-400" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-white">{item.title}</p>
                <p className="text-[9px] text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Savings Example */}
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
          <p className="text-xs text-gray-300">Average savings by LOANZ360 users</p>
          <p className="text-2xl font-bold text-green-400">₹18,500<span className="text-sm text-gray-400">/year</span></p>
          <p className="text-[10px] text-gray-500">through smart loan switching</p>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
        <div className="flex items-center justify-center gap-4">
          {[
            { icon: Shield, label: 'Bank-Grade Security' },
            { icon: CheckCircle2, label: 'RBI Compliant' },
            { icon: User, label: '50K+ Users' }
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <item.icon className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="pt-4 border-t border-gray-800">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleSkip}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 bg-transparent hover:bg-gray-800/50 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip for Now
          </button>
          <button
            onClick={handleProceed}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl text-white font-semibold bg-gradient-to-r from-[#B8860B] to-[#D4AF37] hover:from-[#8B6914] hover:to-[#8B6914] shadow-lg shadow-[#D4AF37]/25 hover:shadow-[#D4AF37]/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>Create My Golden Profile</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3 text-gray-500">
          <Clock className="w-3 h-3" />
          <span className="text-[10px]">Takes only 2 minutes • Your data is secure</span>
        </div>
      </div>
    </div>
  )

  const slides = [renderSlide1, renderSlide2, renderSlide3, renderSlide4, renderSlide5, renderSlide6]

  return (
    <div className="h-screen bg-gray-950 text-white overflow-hidden flex flex-col">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#B8860B]/3 pointer-events-none" />

      {/* Top Navigation Bar - Logo + Prev/Next buttons */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
        {/* Previous Button - Top Left */}
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            currentSlide === 0
              ? 'text-[#D4AF37]/70 cursor-not-allowed opacity-50'
              : 'bg-[#D4AF37] text-white hover:bg-[#B8860B]'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Skip Intro - Center */}
        <button
          onClick={handleProceed}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:text-white border border-gray-700 hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Skip Intro</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Next Button - Top Right */}
        {currentSlide < totalSlides - 1 ? (
          <button
            onClick={nextSlide}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] text-white hover:bg-[#B8860B] transition-all"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-[100px]" />
        )}
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Slide Content - Left/Center */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
              >
                {slides[currentSlide]()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Vertical Navigation Dots - Right Side */}
        <div className="flex flex-col items-center justify-center gap-3 px-4 border-l border-gray-800/50">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2.5 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'bg-[#D4AF37] h-8'
                  : index < currentSlide
                    ? 'bg-green-500 h-2.5'
                    : 'bg-gray-700 hover:bg-gray-600 h-2.5'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Export utility to check if landing was seen
export function hasSeenMyProfileLanding(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LANDING_SEEN_KEY) === 'true'
}

// Export utility to reset landing seen status (for testing)
export function resetMyProfileLandingSeen(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LANDING_SEEN_KEY)
}
