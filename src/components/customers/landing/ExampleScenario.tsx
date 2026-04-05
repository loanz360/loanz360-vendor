'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Briefcase,
  Building2,
  Factory,
  Wheat,
  Home,
  CreditCard,
  ArrowRight,
  Sparkles
} from 'lucide-react'

interface ProfileItem {
  icon: React.ElementType
  title: string
  role: string
  color: string
  loans: { type: string; bank: string; amount: string }[]
  extraInfo?: string
}

const profiles: ProfileItem[] = [
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
      { type: 'Cash Credit', bank: 'SBI', amount: '₹15 Lakhs' },
      { type: 'GST Loan', bank: 'Axis', amount: '₹10 Lakhs' }
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
  },
  {
    icon: Wheat,
    title: 'As AGRICULTURE Land Owner',
    role: 'Agricultural Profile',
    color: 'green',
    loans: [
      { type: 'Kisan Credit Card', bank: 'SBI', amount: '₹5 Lakhs' },
      { type: 'Tractor Loan', bank: 'HDFC', amount: '₹8 Lakhs' }
    ]
  },
  {
    icon: Home,
    title: 'As RENTAL Property Owner',
    role: 'Rental Income',
    color: 'blue',
    loans: [
      { type: 'LAP', bank: 'ICICI', amount: '₹20 Lakhs' }
    ],
    extraInfo: 'Rental income tracked for loan eligibility'
  }
]

const colorClasses: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'text-orange-400', text: 'text-orange-300' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-400', text: 'text-blue-300' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'text-green-400', text: 'text-green-300' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400', text: 'text-purple-300' }
}

export default function ExampleScenario() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 mb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Real-World Example: Meet Rajesh</h3>
          <p className="text-sm text-gray-400">A typical LOANZ360 power user</p>
        </div>
      </div>

      {/* Profile List */}
      <div className="space-y-3">
        {profiles.map((profile, index) => {
          const colors = colorClasses[profile.color]
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
              className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg bg-gray-900/50 flex items-center justify-center flex-shrink-0`}>
                  <profile.icon className={`w-5 h-5 ${colors.icon}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-white">{profile.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded ${colors.text} bg-gray-900/50`}>
                      {profile.role}
                    </span>
                  </div>

                  {/* Loans */}
                  {profile.loans.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {profile.loans.map((loan, loanIndex) => (
                        <div key={loanIndex} className="flex items-center gap-2 text-xs">
                          <CreditCard className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-400">{loan.type} ({loan.bank})</span>
                          <ArrowRight className="w-3 h-3 text-gray-600" />
                          <span className="text-white font-medium">{loan.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extra Info */}
                  {profile.extraInfo && (
                    <div className="mt-2 text-xs text-gray-400 whitespace-pre-line">
                      {profile.extraInfo}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1 }}
        className="mt-5 pt-5 border-t border-gray-800 text-center"
      >
        <p className="text-sm text-gray-400">
          Rajesh manages <span className="text-white font-semibold">ALL of this</span> from{' '}
          <span className="text-orange-400 font-semibold">ONE LOANZ360 dashboard!</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Just click on any profile to switch instantly.
        </p>
      </motion.div>
    </motion.div>
  )
}
