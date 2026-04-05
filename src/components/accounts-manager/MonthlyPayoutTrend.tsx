'use client'

import React, { useState } from 'react'
import { TrendingUp, IndianRupee } from 'lucide-react'

interface Props {
  monthlyTrend: {
    month: string
    monthLabel: string
    cp_amount: number
    ba_amount: number
    bp_amount: number
    total_amount: number
    cp_count: number
    ba_count: number
    bp_count: number
    total_count: number
  }[]
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`
  return amount.toLocaleString('en-IN')
}

export default function MonthlyPayoutTrend({ monthlyTrend }: Props) {
  const [view, setView] = useState<'amount' | 'count'>('amount')

  const maxValue = Math.max(
    ...monthlyTrend.map(m => view === 'amount' ? m.total_amount : m.total_count),
    1
  )

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          Monthly Payout Trend
        </h2>
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setView('amount')}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
              view === 'amount' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <IndianRupee className="w-3 h-3 inline" /> Amount
          </button>
          <button
            onClick={() => setView('count')}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
              view === 'count' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            # Count
          </button>
        </div>
      </div>

      <div className="flex items-end gap-3 h-48">
        {monthlyTrend.map((month) => {
          const cpVal = view === 'amount' ? month.cp_amount : month.cp_count
          const baVal = view === 'amount' ? month.ba_amount : month.ba_count
          const bpVal = view === 'amount' ? month.bp_amount : month.bp_count
          const totalVal = view === 'amount' ? month.total_amount : month.total_count

          const cpHeight = (cpVal / maxValue) * 100
          const baHeight = (baVal / maxValue) * 100
          const bpHeight = (bpVal / maxValue) * 100

          return (
            <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center justify-end h-40 relative group">
                {/* Tooltip */}
                <div className="absolute -top-12 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white whitespace-nowrap">
                  <p className="font-medium mb-1">{month.monthLabel}</p>
                  {view === 'amount' ? (
                    <>
                      <p className="text-yellow-400">CP: &#8377;{formatCurrency(month.cp_amount)}</p>
                      <p className="text-orange-400">BA: &#8377;{formatCurrency(month.ba_amount)}</p>
                      <p className="text-amber-400">BP: &#8377;{formatCurrency(month.bp_amount)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-yellow-400">CP: {month.cp_count}</p>
                      <p className="text-orange-400">BA: {month.ba_count}</p>
                      <p className="text-amber-400">BP: {month.bp_count}</p>
                    </>
                  )}
                </div>

                {/* Stacked bar */}
                <div className="w-full max-w-[40px] flex flex-col items-center justify-end h-full">
                  {bpVal > 0 && (
                    <div
                      className="w-full bg-amber-500/60 rounded-t-sm transition-all"
                      style={{ height: `${bpHeight}%`, minHeight: 4 }}
                    />
                  )}
                  {baVal > 0 && (
                    <div
                      className={`w-full bg-orange-500/60 ${bpVal === 0 ? 'rounded-t-sm' : ''} transition-all`}
                      style={{ height: `${baHeight}%`, minHeight: 4 }}
                    />
                  )}
                  {cpVal > 0 && (
                    <div
                      className={`w-full bg-yellow-500/60 ${bpVal === 0 && baVal === 0 ? 'rounded-t-sm' : ''} rounded-b-sm transition-all`}
                      style={{ height: `${cpHeight}%`, minHeight: 4 }}
                    />
                  )}
                  {totalVal === 0 && (
                    <div className="w-full bg-gray-700/30 rounded-sm" style={{ height: '4px' }} />
                  )}
                </div>
              </div>
              {/* Value label */}
              <span className="text-[10px] text-gray-400 font-medium">
                {view === 'amount' ? `₹${formatCurrency(totalVal)}` : totalVal}
              </span>
              <span className="text-xs text-gray-500">{month.monthLabel}</span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-500/60" /> CP</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-orange-500/60" /> BA</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-500/60" /> BP</div>
      </div>
    </div>
  )
}
