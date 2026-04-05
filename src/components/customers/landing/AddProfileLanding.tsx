'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  Building2,
  Users,
  CreditCard,
  MousePointerClick,
  FileText,
  Mail,
  MessageSquare,
  Bell,
  ArrowRight,
  Sparkles,
  Briefcase,
  Store,
  Factory,
  Wheat,
  Home,
  GraduationCap,
  UserCircle,
  User,
  TrendingUp,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

// Storage key to track if user has seen landing page
const LANDING_SEEN_KEY = 'loanz360_add_profile_landing_seen'

interface AddProfileLandingProps {
  onProceed?: () => void
  onSkip?: () => void
}

const profileTypes = [
  { icon: UserCircle, label: 'Salaried', color: 'blue' },
  { icon: Briefcase, label: 'Professional', color: 'purple' },
  { icon: Store, label: 'Trader', color: 'green' },
  { icon: Factory, label: 'Manufacturer', color: 'orange' },
  { icon: Wheat, label: 'Agriculture', color: 'green' },
  { icon: Home, label: 'Rental', color: 'blue' },
  { icon: GraduationCap, label: 'Student', color: 'purple' },
  { icon: Building2, label: 'Business', color: 'orange' }
]

const entityTypes = [
  'Private Limited',
  'Partnership',
  'Sole Proprietor',
  'LLP',
  'HUF',
  'Trust',
  'Society',
  'OPC'
]

// Example profiles for scenario
const exampleProfiles = [
  {
    icon: User,
    title: 'As INDIVIDUAL',
    role: 'Personal Finance',
    color: 'orange',
    loans: [
      { type: 'Home Loan', bank: 'SBI', amount: '₹45 Lakhs' },
      { type: 'Credit Card', bank: 'HDFC', amount: '₹2 Lakh limit' },
      { type: 'Personal Loan', bank: 'Bajaj', amount: '₹3 Lakhs' }
    ]
  },
  {
    icon: Briefcase,
    title: 'As SALARIED at TCS',
    role: 'Employment',
    color: 'blue',
    loans: [],
    extraInfo: 'Salary credited to ICICI account\nUsed for EMI auto-debit tracking'
  },
  {
    icon: Building2,
    title: 'As PARTNER at Kumar & Sons Trading',
    role: 'Partnership Firm',
    color: 'green',
    loans: [
      { type: 'Business Loan', bank: 'ICICI', amount: '₹25 Lakhs' },
      { type: 'Cash Credit', bank: 'SBI', amount: '₹15 Lakhs' }
    ],
    extraInfo: 'CIBIL Score: 680 (firm-specific)'
  },
  {
    icon: Factory,
    title: 'As DIRECTOR at RK Exports Pvt Ltd',
    role: 'Private Limited Company',
    color: 'purple',
    loans: [
      { type: 'Working Capital', bank: 'Axis', amount: '₹1 Crore' },
      { type: 'Term Loan', bank: 'HDFC', amount: '₹50 Lakhs' }
    ],
    extraInfo: 'Corporate Credit Rating: A-'
  }
]

const colorClasses: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'text-orange-400', text: 'text-orange-300' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-400', text: 'text-blue-300' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'text-green-400', text: 'text-green-300' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400', text: 'text-purple-300' }
}

export default function AddProfileLanding({ onProceed, onSkip }: AddProfileLandingProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = 5

  const handleProceed = async () => {
    setIsLoading(true)
    try {
      await trackLandingAction('PROCEEDED')
      localStorage.setItem(LANDING_SEEN_KEY, 'true')

      if (onProceed) {
        onProceed()
      } else {
        router.push('/customers/add-profile?showWizard=true')
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
          page_type: 'ADD_PROFILE',
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

  // Slide content components
  const renderSlide1 = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-green-400" />
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2">Add a New Profile</h1>
        <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-base font-medium">Manage All Your Financial Identities</span>
          <Sparkles className="w-4 h-4" />
        </div>
        <p className="text-gray-400 text-sm max-w-2xl mx-auto">
          Director? Partner? Business owner? Manage ALL your financial identities in one place!
        </p>
      </div>

      {/* How Multi-Profile Works */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">How Multi-Profile Works</h3>
            <p className="text-xs text-gray-400">Each profile = Each PAN = Separate financial identity</p>
          </div>
        </div>

        {/* Profile Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Individual */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Your Individual</span>
            </div>
            <div className="relative rounded-lg border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-orange-600/5 p-3 ring-2 ring-orange-500/50">
              <div className="absolute -top-2 -right-2">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-medium">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Active
                </div>
              </div>
              <div className="flex items-start gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Rahul Sharma</h4>
                  <p className="text-[10px] text-gray-500 font-mono">PAN: ABCDE1234F</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2 p-1.5 rounded-lg bg-gray-900/50">
                <TrendingUp className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-gray-400">Score:</span>
                <span className="text-xs font-semibold text-white">750</span>
              </div>
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Home Loan</span>
                  <span className="text-white font-medium">₹45L</span>
                </div>
              </div>
            </div>
          </div>

          {/* Business Profiles */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Your Business Profiles</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-600/5 p-3">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">RS Traders</h4>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-300">Partner</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-900/50">
                  <TrendingUp className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] text-gray-400">Score:</span>
                  <span className="text-xs font-semibold text-white">680</span>
                </div>
              </div>
              <div className="rounded-lg border border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-600/5 p-3">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">SK Exports</h4>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-300">Director</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-900/50">
                  <TrendingUp className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] text-gray-400">Rating:</span>
                  <span className="text-xs font-semibold text-white">A-</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-4 pt-3 border-t border-gray-800">
          <p className="text-[10px] text-gray-500 mb-2">Each profile has its OWN:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: TrendingUp, label: 'Credit Score' },
              { icon: CreditCard, label: 'Running Loans' },
              { icon: Calendar, label: 'EMI Calendar' },
              { icon: FileText, label: 'Documents' }
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800/50 border border-gray-700/50">
                <item.icon className="w-3 h-3 text-green-400" />
                <span className="text-[10px] text-gray-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderSlide2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">Real-World Example</h2>
        <p className="text-gray-400 text-sm">See how Rajesh manages multiple financial identities</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Meet Rajesh</h3>
            <p className="text-xs text-gray-400">A typical LOANZ360 power user</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {exampleProfiles.map((profile, index) => {
            const colors = colorClasses[profile.color]
            return (
              <div key={index} className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-900/50 flex items-center justify-center flex-shrink-0">
                    <profile.icon className={`w-4 h-4 ${colors.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate">{profile.title}</h4>
                    <span className={`text-[10px] ${colors.text}`}>{profile.role}</span>
                    {profile.loans.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {profile.loans.slice(0, 2).map((loan, loanIndex) => (
                          <div key={loanIndex} className="flex items-center gap-1 text-[10px]">
                            <CreditCard className="w-2.5 h-2.5 text-gray-500" />
                            <span className="text-gray-400 truncate">{loan.type}</span>
                            <span className="text-white font-medium">{loan.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-800 text-center">
          <p className="text-xs text-gray-400">
            Rajesh manages <span className="text-white font-semibold">ALL of this</span> from{' '}
            <span className="text-orange-400 font-semibold">ONE dashboard!</span>
          </p>
        </div>
      </div>
    </div>
  )

  const renderSlide3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">Profile Switching</h2>
        <p className="text-gray-400 text-sm">Switch between profiles with a single click</p>
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <MousePointerClick className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">How Profile Switching Works</h3>
            <p className="text-xs text-gray-400">Seamless transition between identities</p>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">MY PROFILES (Sidebar)</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-xs text-white">Rahul Sharma (Individual)</span>
              <span className="ml-auto text-[10px] text-orange-400">← Active</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-xs text-gray-300">Kumar & Sons Trading (Partner)</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-xs text-gray-300">RK Exports Pvt Ltd (Director)</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30 border-dashed">
              <span className="text-xs text-green-400">+ Add New Profile</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3 text-center">
          Click any profile → Dashboard updates with that profile&apos;s loans, EMIs, and credit score!
        </p>
      </div>
    </div>
  )

  const renderSlide4 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">Team Collaboration</h2>
        <p className="text-gray-400 text-sm">Add partners, directors, or co-owners to your business profiles</p>
      </div>

      <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Invite Your Team Members</h3>
            <p className="text-xs text-gray-400">Multiple ways to add team members</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/50 border border-gray-800">
            <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-3 h-3 text-purple-400" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-white">Email</h4>
              <p className="text-[10px] text-gray-400">Professional invites</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/50 border border-gray-800">
            <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-3 h-3 text-purple-400" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-white">SMS</h4>
              <p className="text-[10px] text-gray-400">Quick secure link</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/50 border border-gray-800">
            <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-3 h-3 text-purple-400" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-white">In-App</h4>
              <p className="text-[10px] text-gray-400">Instant notification</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-900/50 border border-gray-800">
            <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-3 h-3 text-purple-400" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-white">Shared</h4>
              <p className="text-[10px] text-gray-400">View loans & apply</p>
            </div>
          </div>
        </div>

        {/* Sample Invitation */}
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-3 h-3 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-300">
                &quot;You&apos;ve been added to <span className="text-white font-medium">Kumar & Sons Trading</span> on LOANZ360
                by <span className="text-white font-medium">Rajesh Kumar</span>.&quot;
              </p>
              <div className="flex gap-2 mt-2">
                <button className="px-3 py-1 rounded-lg bg-purple-500 text-white text-[10px] font-medium">
                  Accept
                </button>
                <button className="px-3 py-1 rounded-lg bg-gray-700 text-gray-300 text-[10px] font-medium">
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSlide5 = () => (
    <div className="space-y-4">
      <div className="text-center mb-3">
        <h2 className="text-xl font-bold mb-1">Apply Loans Seamlessly</h2>
        <p className="text-gray-400 text-sm">Apply for loans under the right identity</p>
      </div>

      {/* Apply Loans Section */}
      <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-600/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Apply Loans from Any Profile</h3>
            <p className="text-xs text-gray-400">Simple 4-step process</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            'Switch to firm profile',
            'Click "Apply for Loan"',
            'Auto-linked to firm PAN',
            'Track under that profile'
          ].map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400">
                {index + 1}
              </div>
              <span className="text-xs text-gray-300">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Profile Types */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Profile Types You Can Add</h3>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {profileTypes.map((type, index) => (
            <div key={index} className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <type.icon className={`w-3 h-3 text-${type.color}-400`} />
              <span className="text-[10px] text-gray-300">{type.label}</span>
            </div>
          ))}
        </div>
        <h4 className="text-xs font-semibold text-gray-400 mb-2">Entity Types</h4>
        <div className="flex flex-wrap gap-1.5">
          {entityTypes.map((type, index) => (
            <span key={index} className="px-2 py-1 rounded-full bg-gray-800/50 border border-gray-700/50 text-[10px] text-gray-300">
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Skip/Proceed Buttons */}
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
            className="px-6 py-2.5 rounded-xl text-white font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>Add New Profile</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3 text-gray-500">
          <Clock className="w-3 h-3" />
          <span className="text-[10px]">Takes only 5 minutes • Your progress is auto-saved</span>
        </div>
      </div>
    </div>
  )

  const slides = [renderSlide1, renderSlide2, renderSlide3, renderSlide4, renderSlide5]

  return (
    <div className="h-screen bg-gray-950 text-white overflow-hidden flex flex-col">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5 pointer-events-none" />

      {/* Top Navigation Bar - Logo + Prev/Next buttons */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
        {/* Previous Button - Top Left */}
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            currentSlide === 0
              ? 'text-orange-300 cursor-not-allowed opacity-50'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Skip Intro - Center */}
        <button
          onClick={handleProceed}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:text-white border border-gray-700 hover:border-orange-500/50 hover:bg-orange-500/10 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Skip Intro</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Next Button - Top Right */}
        {currentSlide < totalSlides - 1 ? (
          <button
            onClick={nextSlide}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-all"
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
                  ? 'bg-orange-500 h-8'
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
export function hasSeenAddProfileLanding(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LANDING_SEEN_KEY) === 'true'
}

// Export utility to reset landing seen status (for testing)
export function resetAddProfileLandingSeen(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LANDING_SEEN_KEY)
}
