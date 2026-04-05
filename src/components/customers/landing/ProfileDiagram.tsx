'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Building2,
  CreditCard,
  TrendingUp,
  FileText,
  Calendar,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'

interface ProfileCardProps {
  type: 'individual' | 'entity'
  name: string
  pan: string
  role?: string
  creditScore: string | number
  loans: { name: string; amount: string }[]
  isActive?: boolean
  delay?: number
}

function ProfileCard({
  type,
  name,
  pan,
  role,
  creditScore,
  loans,
  isActive = false,
  delay = 0
}: ProfileCardProps) {
  const isIndividual = type === 'individual'
  const borderColor = isIndividual ? 'border-orange-500/30' : 'border-green-500/30'
  const bgColor = isIndividual ? 'from-orange-500/10 to-orange-600/5' : 'from-green-500/10 to-green-600/5'
  const iconBg = isIndividual ? 'bg-orange-500/20' : 'bg-green-500/20'
  const iconColor = isIndividual ? 'text-orange-400' : 'text-green-400'
  const badgeColor = isIndividual ? 'bg-orange-500/20 text-orange-300' : 'bg-green-500/20 text-green-300'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className={`
        relative rounded-xl border ${borderColor} bg-gradient-to-br ${bgColor} p-4
        ${isActive ? 'ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/10' : ''}
      `}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -top-2 -right-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {isIndividual ? (
            <User className={`w-5 h-5 ${iconColor}`} />
          ) : (
            <Building2 className={`w-5 h-5 ${iconColor}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white truncate">{name}</h4>
          <p className="text-xs text-gray-500 font-mono">PAN: {pan}</p>
          {role && (
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${badgeColor}`}>
              {role}
            </span>
          )}
        </div>
      </div>

      {/* Credit Score */}
      <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-gray-900/50">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <span className="text-xs text-gray-400">Credit Score:</span>
        <span className="text-sm font-semibold text-white">{creditScore}</span>
      </div>

      {/* Loans */}
      <div className="space-y-1.5">
        <span className="text-xs text-gray-500">Loans:</span>
        {loans.map((loan, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{loan.name}</span>
            <span className="text-white font-medium">{loan.amount}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default function ProfileDiagram() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 mb-8"
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">How Multi-Profile Works</h3>
          <p className="text-sm text-gray-400">Each profile = Each PAN = Separate financial identity</p>
        </div>
      </div>

      {/* Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Individual Profile */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Your Individual</span>
          </div>
          <ProfileCard
            type="individual"
            name="Rahul Sharma"
            pan="ABCDE1234F"
            creditScore={750}
            loans={[
              { name: 'Home Loan (SBI)', amount: '₹45L' },
              { name: 'Credit Card (HDFC)', amount: '₹2L' }
            ]}
            isActive={true}
            delay={0.3}
          />
        </div>

        {/* Entity Profiles */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-green-400" />
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Your Business Profiles</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileCard
              type="entity"
              name="RS Traders"
              pan="AARFR1234A"
              role="Partner"
              creditScore={680}
              loans={[
                { name: 'Business Loan (ICICI)', amount: '₹25L' },
                { name: 'OD (SBI)', amount: '₹10L' }
              ]}
              delay={0.4}
            />
            <ProfileCard
              type="entity"
              name="SK Exports Pvt Ltd"
              pan="AABCS5678K"
              role="Director"
              creditScore="A-"
              loans={[
                { name: 'Term Loan (Axis)', amount: '₹1Cr' },
                { name: 'Working Capital (HDFC)', amount: '₹50L' }
              ]}
              delay={0.5}
            />
          </div>
        </div>
      </div>

      {/* Features List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-5 pt-5 border-t border-gray-800"
      >
        <p className="text-xs text-gray-500 mb-3">Each profile has its OWN:</p>
        <div className="flex flex-wrap gap-3">
          {[
            { icon: TrendingUp, label: 'Credit Score (CIBIL)' },
            { icon: CreditCard, label: 'Running Loans' },
            { icon: Calendar, label: 'EMI Calendar' },
            { icon: FileText, label: 'Documents' }
          ].map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50"
            >
              <item.icon className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-gray-300">{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
