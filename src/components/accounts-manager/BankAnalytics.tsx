'use client'

import React from 'react'
import { Landmark } from 'lucide-react'

interface BankData {
  bank: string
  pending: number
  verified: number
  rejected: number
  total_amount: number
  total: number
  approval_rate: number
}

interface Props {
  bankAnalytics: BankData[]
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`
  return amount.toLocaleString('en-IN')
}

export default function BankAnalytics({ bankAnalytics }: Props) {
  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <Landmark className="w-5 h-5 text-orange-500" />
        Bank-wise Analytics
      </h2>

      {bankAnalytics.length > 0 ? (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {bankAnalytics.map((bank) => (
            <div key={bank.bank} className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white truncate mr-2">{bank.bank}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">{bank.total} apps</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-yellow-400">{bank.pending} pending</span>
                <span className="text-green-400">{bank.verified} verified</span>
                <span className="text-red-400">{bank.rejected} rejected</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                {/* Mini progress bar */}
                <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden mr-3">
                  {bank.total > 0 && (
                    <div className="h-full flex">
                      <div className="bg-green-500/60 h-full" style={{ width: `${(bank.verified / bank.total) * 100}%` }} />
                      <div className="bg-red-500/60 h-full" style={{ width: `${(bank.rejected / bank.total) * 100}%` }} />
                      <div className="bg-yellow-500/60 h-full" style={{ width: `${(bank.pending / bank.total) * 100}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium ${
                    bank.approval_rate >= 80 ? 'text-green-400' :
                    bank.approval_rate >= 60 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {bank.approval_rate}%
                  </span>
                  {bank.total_amount > 0 && (
                    <span className="text-xs text-gray-500">&#8377;{formatCurrency(bank.total_amount)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 text-sm py-4">No bank data available</p>
      )}
    </div>
  )
}
