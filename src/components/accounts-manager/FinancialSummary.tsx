'use client'

import React from 'react'
import { IndianRupee, TrendingUp, FileText, Users, Building2 } from 'lucide-react'

interface FinancialData {
  cp_pending_amount: number
  ba_pending_amount: number
  bp_pending_amount: number
  total_pending_amount: number
}

interface Props {
  financial: FinancialData
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`
  return amount.toLocaleString('en-IN')
}

export default function FinancialSummary({ financial }: Props) {
  const items = [
    { label: 'CP Payouts', amount: financial.cp_pending_amount, icon: FileText, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'BA Commission', amount: financial.ba_pending_amount, icon: Users, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'BP Commission', amount: financial.bp_pending_amount, icon: Building2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ]

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <IndianRupee className="w-5 h-5 text-orange-500" />
        Pending Payouts
      </h2>
      <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-orange-600/20 to-orange-500/10 border border-orange-500/20">
        <p className="text-xs text-gray-400 uppercase tracking-wider">Total Pending Amount</p>
        <p className="text-3xl font-bold text-white mt-1">
          <span className="text-orange-400">&#8377;</span> {formatCurrency(financial.total_pending_amount)}
        </p>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-800">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bg}`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <span className="text-sm text-gray-300">{item.label}</span>
              </div>
              <span className="text-sm font-bold text-white">&#8377; {formatCurrency(item.amount)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
