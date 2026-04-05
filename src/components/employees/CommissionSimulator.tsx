'use client'

import React, { useState, useMemo } from 'react'
import {
  IndianRupee, TrendingUp, Award, Zap
} from 'lucide-react'

interface CommissionTier {
  name: string
  minDeals: number
  maxDeals: number | null
  rate: number
  bonus: number
}

const COMMISSION_TIERS: CommissionTier[] = [
  { name: 'Bronze', minDeals: 0, maxDeals: 4, rate: 0.50, bonus: 0 },
  { name: 'Silver', minDeals: 5, maxDeals: 9, rate: 0.75, bonus: 5000 },
  { name: 'Gold', minDeals: 10, maxDeals: 19, rate: 1.00, bonus: 15000 },
  { name: 'Platinum', minDeals: 20, maxDeals: 34, rate: 1.25, bonus: 35000 },
  { name: 'Diamond', minDeals: 35, maxDeals: null, rate: 1.50, bonus: 75000 },
]

const LOAN_TYPE_COMMISSION: Record<string, { base: number; label: string }> = {
  home_loan: { base: 0.50, label: 'Home Loan' },
  personal_loan: { base: 1.50, label: 'Personal Loan' },
  car_loan: { base: 0.75, label: 'Car Loan' },
  business_loan: { base: 1.00, label: 'Business Loan' },
  education_loan: { base: 0.40, label: 'Education Loan' },
  gold_loan: { base: 0.30, label: 'Gold Loan' },
  loan_against_property: { base: 0.75, label: 'Loan Against Property' },
  two_wheeler_loan: { base: 1.00, label: 'Two Wheeler Loan' },
  consumer_durable_loan: { base: 2.00, label: 'Consumer Durable' },
}

const MAX_AMOUNT = 10000000000 // 1000 Cr
const MAX_DEALS = 999

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (absAmount >= 10000000) return `${sign}\u20B9${(absAmount / 10000000).toFixed(2)} Cr`
  if (absAmount >= 100000) return `${sign}\u20B9${(absAmount / 100000).toFixed(2)} L`
  return `${sign}\u20B9${Math.round(absAmount).toLocaleString('en-IN')}`
}

export default function CommissionSimulator() {
  const [loanType, setLoanType] = useState('home_loan')
  const [disbursementAmount, setDisbursementAmount] = useState('')
  const [dealsThisMonth, setDealsThisMonth] = useState('')
  const [dealsPipeline, setDealsPipeline] = useState('')

  const calculation = useMemo(() => {
    const amount = Math.min(Math.max(parseFloat(disbursementAmount) || 0, 0), MAX_AMOUNT)
    const currentDeals = Math.min(Math.max(parseInt(dealsThisMonth, 10) || 0, 0), MAX_DEALS)
    const pipelineDeals = Math.min(Math.max(parseInt(dealsPipeline, 10) || 0, 0), MAX_DEALS)

    if (amount === 0) return null

    const loanConfig = LOAN_TYPE_COMMISSION[loanType]
    if (!loanConfig) return null

    // Find current tier
    const currentTier = COMMISSION_TIERS.find(t =>
      currentDeals >= t.minDeals && (t.maxDeals === null || currentDeals <= t.maxDeals)
    ) || COMMISSION_TIERS[0]

    // Find next tier
    const currentTierIndex = COMMISSION_TIERS.indexOf(currentTier)
    const nextTier = currentTierIndex < COMMISSION_TIERS.length - 1
      ? COMMISSION_TIERS[currentTierIndex + 1]
      : null

    // Calculate per-deal commission
    const effectiveRate = loanConfig.base + currentTier.rate
    const dealCommission = (amount * effectiveRate) / 100

    // Monthly tier bonus (earned once per month, NOT per deal)
    const monthlyTierBonus = currentTier.bonus

    // Projected if pipeline converts
    const projectedDeals = currentDeals + pipelineDeals
    const projectedTier = COMMISSION_TIERS.find(t =>
      projectedDeals >= t.minDeals && (t.maxDeals === null || projectedDeals <= t.maxDeals)
    ) || COMMISSION_TIERS[0]
    const projectedRate = loanConfig.base + projectedTier.rate
    const projectedDealCommission = (amount * projectedRate) / 100

    // Deals needed for next tier
    const dealsToNextTier = nextTier ? nextTier.minDeals - currentDeals : 0

    return {
      dealCommission,
      effectiveRate,
      monthlyTierBonus,
      currentTier,
      nextTier,
      dealsToNextTier,
      projectedTierName: projectedTier.name,
      projectedRate,
      projectedDealCommission,
      projectedMonthlyBonus: projectedTier.bonus,
      loanConfig,
      currentTierName: currentTier.name,
      projectedTierIsDifferent: projectedTier.name !== currentTier.name,
    }
  }, [loanType, disbursementAmount, dealsThisMonth, dealsPipeline])

  const preventKeys = (e: React.KeyboardEvent) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }
  const inputClass = "w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2 font-poppins">
          <IndianRupee className="w-6 h-6 text-orange-500" />
          Commission Simulator
        </h3>
        <p className="text-gray-400 text-sm mb-6">Calculate your potential earnings from loan disbursements</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cs-loan-type" className="block text-sm font-semibold text-gray-300 mb-2">Loan Type</label>
            <select
              id="cs-loan-type"
              value={loanType}
              onChange={(e) => setLoanType(e.target.value)}
              className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              aria-label="Select loan type"
            >
              {Object.entries(LOAN_TYPE_COMMISSION).map(([key, config]) => (
                <option key={key} value={key} className="bg-black text-white">{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cs-amount" className="block text-sm font-semibold text-gray-300 mb-2">Disbursement Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{'\u20B9'}</span>
              <input
                id="cs-amount"
                type="number"
                min="0"
                max={MAX_AMOUNT}
                value={disbursementAmount}
                onChange={(e) => setDisbursementAmount(e.target.value)}
                onKeyDown={preventKeys}
                placeholder="e.g., 5000000"
                className="w-full pl-8 pr-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Disbursement amount"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cs-deals" className="block text-sm font-semibold text-gray-300 mb-2">Deals Closed This Month</label>
            <input
              id="cs-deals"
              type="number"
              min="0"
              max={MAX_DEALS}
              value={dealsThisMonth}
              onChange={(e) => setDealsThisMonth(e.target.value)}
              onKeyDown={preventKeys}
              placeholder="0"
              className={inputClass}
              aria-label="Number of deals closed this month"
            />
          </div>

          <div>
            <label htmlFor="cs-pipeline" className="block text-sm font-semibold text-gray-300 mb-2">Deals in Pipeline</label>
            <input
              id="cs-pipeline"
              type="number"
              min="0"
              max={MAX_DEALS}
              value={dealsPipeline}
              onChange={(e) => setDealsPipeline(e.target.value)}
              onKeyDown={preventKeys}
              placeholder="0"
              className={inputClass}
              aria-label="Number of deals in pipeline"
            />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!calculation && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
          <IndianRupee className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Enter a disbursement amount to see your potential commission</p>
        </div>
      )}

      {/* Results */}
      {calculation && (
        <>
          {/* Main Commission Card */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium opacity-90">Commission on This Deal</p>
                <p className="text-4xl font-bold mt-1">{formatCurrency(calculation.dealCommission)}</p>
                <p className="text-sm opacity-80 mt-1">
                  {calculation.loanConfig.label} @ {calculation.effectiveRate.toFixed(2)}%
                  ({calculation.loanConfig.base}% base + {calculation.currentTier.rate}% tier)
                </p>
              </div>
              <div className="bg-white/20 rounded-xl p-4 text-center">
                <Award className="w-8 h-8 mx-auto mb-1" />
                <p className="text-xs font-semibold">{calculation.currentTierName}</p>
                <p className="text-xs opacity-80">Tier</p>
              </div>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Per-Deal Commission</p>
              <p className="text-xl font-bold text-white">{formatCurrency(calculation.dealCommission)}</p>
              <p className="text-xs text-gray-500 mt-1">Earned on each deal</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Monthly Tier Bonus</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(calculation.monthlyTierBonus)}</p>
              <p className="text-xs text-gray-500 mt-1">Earned once per month</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-orange-500/30">
              <p className="text-xs text-gray-400 mb-1">Effective Rate</p>
              <p className="text-xl font-bold text-orange-400">{calculation.effectiveRate.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 mt-1">Base + tier bonus rate</p>
            </div>
          </div>

          {/* Next Tier Motivation */}
          {calculation.nextTier && calculation.dealsToNextTier > 0 && (
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-400">
                    {calculation.dealsToNextTier} more deal{calculation.dealsToNextTier > 1 ? 's' : ''} to reach {calculation.nextTier.name} tier!
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    At {calculation.nextTier.name}, this same deal would earn{' '}
                    <span className="text-green-400 font-semibold">
                      {formatCurrency((Math.min(parseFloat(disbursementAmount) || 0, MAX_AMOUNT) * (calculation.loanConfig.base + calculation.nextTier.rate)) / 100)}
                    </span>
                    {' '}+ {'\u20B9'}{calculation.nextTier.bonus.toLocaleString('en-IN')}/month tier bonus
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pipeline Projection */}
          {(parseInt(dealsPipeline, 10) || 0) > 0 && calculation.projectedTierIsDifferent && (
            <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-400">
                    Pipeline Projection: {calculation.projectedTierName} Tier
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    If pipeline converts, this deal would earn{' '}
                    <span className="text-green-400 font-semibold">{formatCurrency(calculation.projectedDealCommission)}</span>
                    {' '}(up from {formatCurrency(calculation.dealCommission)}) + {'\u20B9'}{calculation.projectedMonthlyBonus.toLocaleString('en-IN')}/month bonus
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Commission Tier Table */}
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 bg-white/5 border-b border-white/10">
              <h4 className="text-sm font-semibold text-gray-300">Commission Tier Structure</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Commission tier structure">
                <thead className="bg-white/5">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left text-gray-400">Tier</th>
                    <th scope="col" className="px-4 py-2 text-center text-gray-400">Deals/Month</th>
                    <th scope="col" className="px-4 py-2 text-center text-gray-400">Bonus Rate</th>
                    <th scope="col" className="px-4 py-2 text-center text-gray-400">Monthly Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {COMMISSION_TIERS.map((tier) => (
                    <tr
                      key={tier.name}
                      className={tier.name === calculation.currentTierName ? 'bg-orange-500/10 border-l-4 border-orange-500' : 'border-l-4 border-transparent'}
                    >
                      <td className="px-4 py-2 font-semibold text-white">{tier.name}</td>
                      <td className="px-4 py-2 text-center text-gray-300">
                        {tier.minDeals}-{tier.maxDeals ?? '\u221E'}
                      </td>
                      <td className="px-4 py-2 text-center text-orange-400">+{tier.rate}%</td>
                      <td className="px-4 py-2 text-center text-green-400">{'\u20B9'}{tier.bonus.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
