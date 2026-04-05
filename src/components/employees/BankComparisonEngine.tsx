'use client'

import React, { useState, useCallback } from 'react'
import {
  Building2, Calculator, Award, Clock,
  Loader2, AlertCircle, Share2
} from 'lucide-react'
import type { LoanType } from '@/types/emi-calculator'
import { LOAN_TYPE_CONFIG } from '@/types/emi-calculator'

interface BankComparison {
  bank_name: string
  bank_code: string
  interest_rate: number
  monthly_emi: number
  total_interest: number
  total_amount: number
  processing_fee: number
  total_cost: number
  min_credit_score: number
  max_foir: number
  min_income_monthly: number
  avg_turnaround_days: number
  approval_rate: number
}

interface ComparisonSummary {
  banks_compared: number
  cheapest_bank: string | null
  cheapest_emi: number
  max_savings: number
  loan_type: string
  principal_amount: number
  tenure_months: number
  credit_score_range: string
}

const CREDIT_SCORE_OPTIONS = [
  { value: 'excellent', label: '750+ (Excellent)' },
  { value: 'good', label: '700-749 (Good)' },
  { value: 'fair', label: '650-699 (Fair)' },
  { value: 'below', label: 'Below 650' },
]

const MAX_PRINCIPAL = 500000000 // 50 Cr
const MAX_TENURE_YEARS = 40
const MAX_TENURE_MONTHS = 480

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (absAmount >= 10000000) return `${sign}\u20B9${(absAmount / 10000000).toFixed(2)} Cr`
  if (absAmount >= 100000) return `${sign}\u20B9${(absAmount / 100000).toFixed(2)} L`
  return `${sign}\u20B9${Math.round(absAmount).toLocaleString('en-IN')}`
}

function formatCurrencyFull(amount: number): string {
  if (amount == null || isNaN(amount)) return '\u20B90'
  return `\u20B9${Math.round(amount).toLocaleString('en-IN')}`
}

export default function BankComparisonEngine() {
  const [loanType, setLoanType] = useState<LoanType>('home_loan')
  const [principal, setPrincipal] = useState('')
  const [tenure, setTenure] = useState('')
  const [tenureType, setTenureType] = useState<'years' | 'months'>('years')
  const [creditScore, setCreditScore] = useState('good')

  const [comparisons, setComparisons] = useState<BankComparison[]>([])
  const [summary, setSummary] = useState<ComparisonSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedBank, setExpandedBank] = useState<string | null>(null)

  const handleCompare = useCallback(async () => {
    const principalVal = parseFloat(principal)
    const tenureVal = parseInt(tenure, 10)

    if (!principalVal || principalVal <= 0 || isNaN(principalVal)) {
      setError('Please enter a valid loan amount greater than 0')
      return
    }
    if (principalVal > MAX_PRINCIPAL) {
      setError(`Loan amount cannot exceed ${formatCurrency(MAX_PRINCIPAL)}`)
      return
    }
    if (!tenureVal || tenureVal <= 0 || isNaN(tenureVal)) {
      setError('Please enter a valid tenure greater than 0')
      return
    }
    const maxTenure = tenureType === 'years' ? MAX_TENURE_YEARS : MAX_TENURE_MONTHS
    if (tenureVal > maxTenure) {
      setError(`Tenure cannot exceed ${maxTenure} ${tenureType}`)
      return
    }

    setLoading(true)
    setError('')
    setComparisons([])
    setSummary(null)

    try {
      const tenureMonths = tenureType === 'years' ? tenureVal * 12 : tenureVal
      const response = await fetch('/api/bank-products/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_type: loanType,
          principal_amount: principalVal,
          tenure_months: tenureMonths,
          credit_score_range: creditScore,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Comparison failed')

      setComparisons(data.comparisons || [])
      setSummary(data.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare banks')
    } finally {
      setLoading(false)
    }
  }, [loanType, principal, tenure, tenureType, creditScore])

  const shareComparison = useCallback(() => {
    if (!summary || comparisons.length === 0) return

    const top3 = comparisons.slice(0, 3)
    let msg = `*Multi-Bank Loan Comparison*\n`
    msg += `Loan: ${formatCurrency(summary.principal_amount)} | ${Math.floor(summary.tenure_months / 12)}Y ${summary.tenure_months % 12}M\n\n`

    top3.forEach((bank, i) => {
      msg += `${i + 1}. ${bank.bank_name}\n`
      msg += `   Rate: ${bank.interest_rate}% | EMI: ${formatCurrencyFull(bank.monthly_emi)}\n`
      msg += `   Total Cost: ${formatCurrency(bank.total_cost)}\n\n`
    })

    if (summary.max_savings > 0) {
      msg += `Potential savings: ${formatCurrency(summary.max_savings)}\n`
    }
    msg += `\nCompared via Loanz360`

    // Use navigator.share if available, otherwise WhatsApp
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'Bank Comparison - Loanz360', text: msg }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
      })
    } else {
      const win = window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
      if (!win) {
        navigator.clipboard.writeText(msg).catch(() => {})
      }
    }
  }, [comparisons, summary])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, bankCode: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setExpandedBank(expandedBank === bankCode ? null : bankCode)
    }
  }

  const preventKeys = (e: React.KeyboardEvent) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }
  const inputClass = "bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2 font-poppins">
          <Building2 className="w-6 h-6 text-orange-500" />
          Multi-Bank Comparison
        </h3>
        <p className="text-gray-400 text-sm mb-6">Compare EMI, rates, and total cost across banks instantly</p>

        <form onSubmit={(e) => { e.preventDefault(); handleCompare() }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="bc-loan-type" className="block text-sm font-semibold text-gray-300 mb-2">Loan Type</label>
            <select
              id="bc-loan-type"
              value={loanType}
              onChange={(e) => { setLoanType(e.target.value as LoanType); setError('') }}
              className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              aria-label="Select loan type"
            >
              {Object.entries(LOAN_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key} className="bg-black text-white">{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bc-amount" className="block text-sm font-semibold text-gray-300 mb-2">Loan Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{'\u20B9'}</span>
              <input
                id="bc-amount"
                type="number"
                min="1"
                max={MAX_PRINCIPAL}
                value={principal}
                onChange={(e) => { setPrincipal(e.target.value); setError('') }}
                onKeyDown={preventKeys}
                placeholder="e.g., 5000000"
                className={`w-full pl-8 pr-4 py-3 ${inputClass}`}
                aria-label="Loan amount"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bc-tenure" className="block text-sm font-semibold text-gray-300 mb-2">Tenure</label>
            <div className="flex gap-2">
              <input
                id="bc-tenure"
                type="number"
                min="1"
                max={tenureType === 'years' ? MAX_TENURE_YEARS : MAX_TENURE_MONTHS}
                value={tenure}
                onChange={(e) => { setTenure(e.target.value); setError('') }}
                onKeyDown={preventKeys}
                placeholder="20"
                className={`flex-1 px-4 py-3 ${inputClass}`}
                aria-label="Loan tenure"
              />
              <select
                id="bc-tenure-type"
                value={tenureType}
                onChange={(e) => setTenureType(e.target.value as 'years' | 'months')}
                className="px-3 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white min-w-[90px]"
                aria-label="Tenure type"
              >
                <option value="years" className="bg-black text-white">Years</option>
                <option value="months" className="bg-black text-white">Months</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="bc-credit" className="block text-sm font-semibold text-gray-300 mb-2">Credit Score</label>
            <select
              id="bc-credit"
              value={creditScore}
              onChange={(e) => setCreditScore(e.target.value)}
              className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              aria-label="Credit score range"
            >
              {CREDIT_SCORE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-black text-white">{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex gap-3 mt-2">
            <button
              type="submit"
              disabled={loading || !principal || !tenure}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
              {loading ? 'Comparing...' : 'Compare Banks'}
            </button>
            {comparisons.length > 0 && (
              <button
                type="button"
                onClick={shareComparison}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center gap-2"
                aria-label="Share comparison"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Summary Card */}
      {summary && comparisons.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/10 via-orange-600/5 to-green-500/10 rounded-2xl border border-orange-500/30 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Banks Compared</p>
              <p className="text-2xl font-bold text-white">{summary.banks_compared}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Best Rate</p>
              <p className="text-2xl font-bold text-green-400">{comparisons[0]?.interest_rate ?? 'N/A'}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Lowest EMI</p>
              <p className="text-2xl font-bold text-orange-400">{formatCurrencyFull(summary.cheapest_emi)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Max Savings</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(summary.max_savings)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {comparisons.length > 0 && (
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Bank comparison results">
              <thead>
                <tr className="bg-white/10 border-b border-white/10">
                  <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Rank</th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Bank</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Rate</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Monthly EMI</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Total Interest</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Processing Fee</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Total Cost</th>
                  <th scope="col" className="px-4 py-3 text-center text-sm font-semibold text-gray-300">Approval %</th>
                  <th scope="col" className="px-4 py-3 text-center text-sm font-semibold text-gray-300">TAT</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((bank, index) => {
                  const isExpanded = expandedBank === bank.bank_code
                  const isCheapest = index === 0
                  const savingsVsCheapest = bank.total_cost - comparisons[0].total_cost

                  return (
                    <React.Fragment key={bank.bank_code}>
                      <tr
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedBank(isExpanded ? null : bank.bank_code)}
                        onKeyDown={(e) => handleKeyDown(e, bank.bank_code)}
                        className={`cursor-pointer transition-colors ${
                          isCheapest
                            ? 'bg-green-500/10 hover:bg-green-500/15 border-l-4 border-green-500'
                            : 'hover:bg-white/5 border-l-4 border-transparent'
                        }`}
                      >
                        <td className="px-4 py-4">
                          {isCheapest ? (
                            <div className="flex items-center gap-1">
                              <Award className="w-5 h-5 text-yellow-400" />
                              <span className="text-yellow-400 font-bold text-sm">BEST</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-semibold">#{index + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">{bank.bank_name}</div>
                          {savingsVsCheapest > 0 && (
                            <div className="text-xs text-red-400 mt-0.5">
                              +{formatCurrency(savingsVsCheapest)} more
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-bold ${isCheapest ? 'text-green-400' : 'text-white'}`}>
                            {bank.interest_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-white">
                          {formatCurrencyFull(bank.monthly_emi)}
                        </td>
                        <td className="px-4 py-4 text-right text-orange-400">
                          {formatCurrency(bank.total_interest)}
                        </td>
                        <td className="px-4 py-4 text-right text-gray-300">
                          {formatCurrencyFull(bank.processing_fee)}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-white">
                          {formatCurrency(bank.total_cost)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            (bank.approval_rate ?? 0) >= 80 ? 'bg-green-500/20 text-green-400' :
                            (bank.approval_rate ?? 0) >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {bank.approval_rate ?? 'N/A'}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-gray-300 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          {bank.avg_turnaround_days ?? 'N/A'}d
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-white/5">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-400">Min Credit Score</span>
                                <p className="font-semibold text-white">{bank.min_credit_score || 'No minimum'}</p>
                              </div>
                              <div>
                                <span className="text-gray-400">Max FOIR</span>
                                <p className="font-semibold text-white">
                                  {bank.max_foir != null ? `${(bank.max_foir * 100).toFixed(0)}%` : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-400">Min Monthly Income</span>
                                <p className="font-semibold text-white">
                                  {bank.min_income_monthly != null ? formatCurrencyFull(bank.min_income_monthly) : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-400">Total Interest Payable</span>
                                <p className="font-semibold text-orange-400">{formatCurrencyFull(bank.total_interest)}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && comparisons.length === 0 && summary === null && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Enter loan details and click Compare to see bank-wise EMI breakdown</p>
        </div>
      )}
    </div>
  )
}
