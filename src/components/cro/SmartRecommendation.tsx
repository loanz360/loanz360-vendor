'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle,
  XCircle,
  Star,
  ArrowRight,
  MessageCircle,
  Scale,
  IndianRupee,
  TrendingUp,
} from 'lucide-react'
import { CARD_COLORS } from '@/lib/constants/theme'
import { calculateEMI, formatIndianCurrency } from '@/lib/utils/emi-calculations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EligibilityResult {
  productId: string
  productName: string
  bankName: string
  interestRate: string
  processingFee: string
  maxAmount: number
  maxTenure: string
  eligibilityScore: number
  isEligible: boolean
  suggestedAmount: number
  estimatedEMI: number
  emiToIncomeRatio: string
  reasons: string[]
  warnings: string[]
}

interface SmartRecommendationProps {
  results: EligibilityResult[]
  customerIncome: number
  loanAmount: number
  onApplyNow?: (productId: string, productName: string, bankName: string) => void
  onCompare?: (productId: string) => void
  onShareWhatsApp?: (productName: string, bankName: string, emi: number) => void
}

// ---------------------------------------------------------------------------
// Scoring & ranking helpers
// ---------------------------------------------------------------------------

interface ScoredResult extends EligibilityResult {
  compositeScore: number
  badge: 'best-overall' | 'best-rate' | 'best-limit' | null
}

function parseTenureMonths(tenure: string): number {
  const yearMatch = tenure.match(/(\d+)\s*y/i)
  const monthMatch = tenure.match(/(\d+)\s*m/i)
  const years = yearMatch ? parseInt(yearMatch[1], 10) : 0
  const months = monthMatch ? parseInt(monthMatch[1], 10) : 0
  if (years === 0 && months === 0) {
    const num = parseInt(tenure, 10)
    return isNaN(num) ? 0 : num
  }
  return years * 12 + months
}

function scoreResults(
  results: EligibilityResult[],
  requestedAmount: number
): ScoredResult[] {
  if (results.length === 0) return []

  const eligible = results.filter((r) => r.isEligible)
  const pool = eligible.length > 0 ? eligible : results

  // Normalise helpers – avoid division by zero
  const scores = pool.map((r) => r.eligibilityScore)
  const rates = pool.map((r) => parseFloat(r.interestRate))
  const amounts = pool.map((r) => r.maxAmount)
  const tenures = pool.map((r) => parseTenureMonths(r.maxTenure))

  const maxScore = Math.max(...scores, 1)
  const minRate = Math.min(...rates)
  const maxRate = Math.max(...rates)
  const rateRange = maxRate - minRate || 1
  const maxAmount = Math.max(...amounts, 1)
  const maxTenure = Math.max(...tenures, 1)

  const scored: ScoredResult[] = pool.map((r) => {
    const eligNorm = r.eligibilityScore / maxScore // higher is better
    const rateNorm = 1 - (parseFloat(r.interestRate) - minRate) / rateRange // lower rate = higher score
    const amountNorm = Math.min(r.maxAmount, requestedAmount) / requestedAmount // how close to requested
    const tenureNorm = parseTenureMonths(r.maxTenure) / maxTenure

    const compositeScore =
      eligNorm * 0.4 + rateNorm * 0.3 + amountNorm * 0.2 + tenureNorm * 0.1

    return { ...r, compositeScore, badge: null }
  })

  // Sort descending by composite score
  scored.sort((a, b) => b.compositeScore - a.compositeScore)

  // Assign badges
  if (scored.length > 0) scored[0].badge = 'best-overall'

  // Best rate – lowest interest among top results
  const bestRate = [...scored].sort(
    (a, b) => parseFloat(a.interestRate) - parseFloat(b.interestRate)
  )[0]
  const bestRateItem = scored.find((s) => s.productId === bestRate.productId)
  if (bestRateItem && bestRateItem.badge === null) bestRateItem.badge = 'best-rate'

  // Best limit – highest max amount
  const bestLimit = [...scored].sort((a, b) => b.maxAmount - a.maxAmount)[0]
  const bestLimitItem = scored.find((s) => s.productId === bestLimit.productId)
  if (bestLimitItem && bestLimitItem.badge === null) bestLimitItem.badge = 'best-limit'

  return scored.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Badge component
// ---------------------------------------------------------------------------

const BADGE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  'best-overall': {
    label: 'Best Overall',
    bg: 'bg-orange-500/20 border-orange-500/40',
    text: 'text-orange-400',
    icon: <Star className="h-3.5 w-3.5" />,
  },
  'best-rate': {
    label: 'Best Rate',
    bg: 'bg-emerald-500/20 border-emerald-500/40',
    text: 'text-emerald-400',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
  'best-limit': {
    label: 'Best Limit',
    bg: 'bg-blue-500/20 border-blue-500/40',
    text: 'text-blue-400',
    icon: <IndianRupee className="h-3.5 w-3.5" />,
  },
}

function Badge({ type }: { type: string }) {
  const config = BADGE_CONFIG[type]
  if (!config) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.text}`}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Recommendation card
// ---------------------------------------------------------------------------

function RecommendationCard({
  item,
  loanAmount,
  onApplyNow,
  onCompare,
  onShareWhatsApp,
}: {
  item: ScoredResult
  loanAmount: number
  onApplyNow?: SmartRecommendationProps['onApplyNow']
  onCompare?: SmartRecommendationProps['onCompare']
  onShareWhatsApp?: SmartRecommendationProps['onShareWhatsApp']
}) {
  const rate = parseFloat(item.interestRate)
  const tenureMonths = parseTenureMonths(item.maxTenure)
  const emi =
    item.estimatedEMI > 0
      ? item.estimatedEMI
      : calculateEMI(Math.min(loanAmount, item.maxAmount), rate, tenureMonths)

  const isBestOverall = item.badge === 'best-overall'

  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-zinc-900/80 p-5 transition-shadow hover:shadow-lg ${
        isBestOverall
          ? 'border-orange-500/50 ring-1 ring-orange-500/20'
          : 'border-zinc-700/60'
      }`}
    >
      {/* Badge */}
      {item.badge && (
        <div className="mb-3">
          <Badge type={item.badge} />
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{item.productName}</h3>
        <p className="text-sm text-zinc-400">{item.bankName}</p>
      </div>

      {/* Key metrics grid */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className={`rounded-lg border p-3 ${CARD_COLORS.success.bg} ${CARD_COLORS.success.border}`}>
          <p className="text-xs text-zinc-400">Interest Rate</p>
          <p className={`text-lg font-bold ${CARD_COLORS.success.text}`}>{rate}% p.a.</p>
        </div>
        <div className={`rounded-lg border p-3 ${CARD_COLORS.info.bg} ${CARD_COLORS.info.border}`}>
          <p className="text-xs text-zinc-400">Estimated EMI</p>
          <p className={`text-lg font-bold ${CARD_COLORS.info.text}`}>
            {formatIndianCurrency(Math.round(emi))}
          </p>
        </div>
        <div className={`rounded-lg border p-3 ${CARD_COLORS.purple.bg} ${CARD_COLORS.purple.border}`}>
          <p className="text-xs text-zinc-400">Max Amount</p>
          <p className={`text-sm font-semibold ${CARD_COLORS.purple.text}`}>
            {formatIndianCurrency(item.maxAmount)}
          </p>
        </div>
        <div className={`rounded-lg border p-3 ${CARD_COLORS.teal.bg} ${CARD_COLORS.teal.border}`}>
          <p className="text-xs text-zinc-400">Max Tenure</p>
          <p className={`text-sm font-semibold ${CARD_COLORS.teal.text}`}>{item.maxTenure}</p>
        </div>
      </div>

      {/* Eligibility factors */}
      <div className="mb-4 space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Eligibility Factors
        </p>
        {item.reasons.map((reason, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span className="text-zinc-300">{reason}</span>
          </div>
        ))}
        {item.warnings.map((warning, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span className="text-zinc-400">{warning}</span>
          </div>
        ))}
      </div>

      {/* Processing fee & EMI-to-income */}
      <div className="mb-5 flex items-center justify-between text-xs text-zinc-500">
        <span>Processing fee: {item.processingFee}</span>
        <span>EMI/Income: {item.emiToIncomeRatio}</span>
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap gap-2">
        <button
          onClick={() => onApplyNow?.(item.productId, item.productName, item.bankName)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          Apply Now
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onCompare?.(item.productId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          title="Add to comparison"
        >
          <Scale className="h-4 w-4" />
          <span className="hidden sm:inline">Compare</span>
        </button>
        <button
          onClick={() => onShareWhatsApp?.(item.productName, item.bankName, Math.round(emi))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-emerald-600 hover:text-emerald-400"
          title="Share via WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary section
// ---------------------------------------------------------------------------

function SummarySection({
  results,
  loanAmount,
}: {
  results: EligibilityResult[]
  loanAmount: number
}) {
  const eligibleProducts = results.filter((r) => r.isEligible)
  const eligibleCount = eligibleProducts.length
  const totalCount = results.length

  const avgRate =
    eligibleProducts.length > 0
      ? eligibleProducts.reduce((sum, r) => sum + parseFloat(r.interestRate), 0) /
        eligibleProducts.length
      : 0

  const amounts = eligibleProducts.map((r) => r.maxAmount)
  const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0

  return (
    <div className="mb-6 rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5">
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
        Eligibility Summary
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Qualification count */}
        <div className={`rounded-lg border p-4 ${CARD_COLORS.primary.bg} ${CARD_COLORS.primary.border}`}>
          <div className="flex items-center gap-2">
            <CheckCircle className={`h-5 w-5 ${CARD_COLORS.primary.icon}`} />
            <p className="text-sm text-zinc-400">Products Qualified</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-white">
            {eligibleCount}{' '}
            <span className="text-base font-normal text-zinc-500">of {totalCount}</span>
          </p>
        </div>

        {/* Average rate */}
        <div className={`rounded-lg border p-4 ${CARD_COLORS.success.bg} ${CARD_COLORS.success.border}`}>
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-5 w-5 ${CARD_COLORS.success.icon}`} />
            <p className="text-sm text-zinc-400">Avg. Eligible Rate</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-white">
            {avgRate > 0 ? `${avgRate.toFixed(2)}%` : 'N/A'}
          </p>
        </div>

        {/* Amount range */}
        <div className={`rounded-lg border p-4 ${CARD_COLORS.info.bg} ${CARD_COLORS.info.border}`}>
          <div className="flex items-center gap-2">
            <IndianRupee className={`h-5 w-5 ${CARD_COLORS.info.icon}`} />
            <p className="text-sm text-zinc-400">Eligible Loan Range</p>
          </div>
          <p className="mt-1 text-lg font-bold text-white">
            {minAmount > 0
              ? `${formatIndianCurrency(minAmount)} - ${formatIndianCurrency(maxAmount)}`
              : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SmartRecommendation({
  results,
  customerIncome,
  loanAmount,
  onApplyNow,
  onCompare,
  onShareWhatsApp,
}: SmartRecommendationProps) {
  const topPicks = useMemo(() => scoreResults(results, loanAmount), [results, loanAmount])

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-8 text-center">
        <Star className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
        <h3 className="text-lg font-semibold text-white">No Products to Recommend</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Run an eligibility check first to see smart recommendations.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-orange-500" />
        <h2 className="text-xl font-bold text-white">Smart Recommendations</h2>
      </div>

      {/* Summary */}
      <SummarySection results={results} loanAmount={loanAmount} />

      {/* Top picks */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {topPicks.map((item) => (
          <RecommendationCard
            key={item.productId}
            item={item}
            loanAmount={loanAmount}
            onApplyNow={onApplyNow}
            onCompare={onCompare}
            onShareWhatsApp={onShareWhatsApp}
          />
        ))}
      </div>
    </section>
  )
}
