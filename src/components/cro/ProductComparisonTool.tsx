'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  X,
  Trash2,
  Calculator,
  TrendingDown,
  Building2,
  IndianRupee,
  Percent,
  Calendar,
  CreditCard,
  Briefcase,
  Award,
  ArrowDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { calculateEMI, formatIndianCurrency } from '@/lib/utils/emi-calculations'
import { CARD_COLORS } from '@/lib/constants/theme'

// ── Types ────────────────────────────────────────────────────────────────────────

interface ComparisonProduct {
  id: string
  name: string
  bank_name: string
  loan_type: string
  min_amount: number
  max_amount: number
  min_interest_rate: number
  max_interest_rate: number
  processing_fee: string
  min_tenure: number
  max_tenure: number
  min_cibil: number
  min_income: number
  employment_types: string[]
}

interface ProductComparisonToolProps {
  products: ComparisonProduct[]
  onRemove: (id: string) => void
  onClear: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

type BestDirection = 'lowest' | 'highest'

function findBestIndex(
  values: number[],
  direction: BestDirection
): number {
  if (values.length === 0) return -1
  let bestIdx = 0
  for (let i = 1; i < values.length; i++) {
    if (direction === 'lowest' && values[i] < values[bestIdx]) bestIdx = i
    if (direction === 'highest' && values[i] > values[bestIdx]) bestIdx = i
  }
  return bestIdx
}

function formatEmploymentTypes(types: string[]): string {
  return types
    .map((t) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(', ')
}

// ── Component ────────────────────────────────────────────────────────────────────

function ProductComparisonTool({
  products,
  onRemove,
  onClear,
}: ProductComparisonToolProps) {
  const [customAmount, setCustomAmount] = useState<string>('')
  const [customTenure, setCustomTenure] = useState<string>('240')
  const [showEmiSection, setShowEmiSection] = useState(true)

  const parsedAmount = useMemo(() => {
    const val = parseFloat(customAmount.replace(/,/g, ''))
    return isNaN(val) || val <= 0 ? 0 : val
  }, [customAmount])

  const parsedTenure = useMemo(() => {
    const val = parseInt(customTenure, 10)
    return isNaN(val) || val <= 0 ? 240 : val
  }, [customTenure])

  const emiValues = useMemo(() => {
    if (parsedAmount <= 0) return products.map(() => 0)
    return products.map((p) =>
      calculateEMI(parsedAmount, p.min_interest_rate, parsedTenure)
    )
  }, [products, parsedAmount, parsedTenure])

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, '')
      setCustomAmount(raw)
    },
    []
  )

  if (products.length === 0) {
    return null
  }

  // Pre-calculate best indices for each comparison row
  const bestInterest = findBestIndex(
    products.map((p) => p.min_interest_rate),
    'lowest'
  )
  const bestMaxAmount = findBestIndex(
    products.map((p) => p.max_amount),
    'highest'
  )
  const bestMaxTenure = findBestIndex(
    products.map((p) => p.max_tenure),
    'highest'
  )
  const bestCibil = findBestIndex(
    products.map((p) => p.min_cibil),
    'lowest'
  )
  const bestIncome = findBestIndex(
    products.map((p) => p.min_income),
    'lowest'
  )
  const bestEmi = findBestIndex(
    emiValues.filter((v) => v > 0),
    'lowest'
  )

  const highlightClass = `${CARD_COLORS.success.bg} ${CARD_COLORS.success.text} font-semibold rounded px-2 py-0.5`

  // Column colors for each product
  const columnColors = [CARD_COLORS.primary, CARD_COLORS.info, CARD_COLORS.purple]

  // ── Comparison rows definition ──
  const rows: {
    label: string
    icon: React.ReactNode
    values: string[]
    bestIdx: number
  }[] = [
    {
      label: 'Interest Rate',
      icon: <Percent className="h-4 w-4" />,
      values: products.map(
        (p) => `${p.min_interest_rate}% - ${p.max_interest_rate}%`
      ),
      bestIdx: bestInterest,
    },
    {
      label: 'Loan Amount Range',
      icon: <IndianRupee className="h-4 w-4" />,
      values: products.map(
        (p) =>
          `${formatIndianCurrency(p.min_amount)} - ${formatIndianCurrency(p.max_amount)}`
      ),
      bestIdx: bestMaxAmount,
    },
    {
      label: 'Tenure Range',
      icon: <Calendar className="h-4 w-4" />,
      values: products.map(
        (p) => `${p.min_tenure} - ${p.max_tenure} months`
      ),
      bestIdx: bestMaxTenure,
    },
    {
      label: 'Min CIBIL Score',
      icon: <CreditCard className="h-4 w-4" />,
      values: products.map((p) => `${p.min_cibil}`),
      bestIdx: bestCibil,
    },
    {
      label: 'Min Income Required',
      icon: <Award className="h-4 w-4" />,
      values: products.map((p) => formatIndianCurrency(p.min_income)),
      bestIdx: bestIncome,
    },
    {
      label: 'Processing Fee',
      icon: <IndianRupee className="h-4 w-4" />,
      values: products.map((p) => p.processing_fee),
      bestIdx: -1, // No best highlight for string fees
    },
    {
      label: 'Employment Types',
      icon: <Briefcase className="h-4 w-4" />,
      values: products.map((p) => formatEmploymentTypes(p.employment_types)),
      bestIdx: -1,
    },
  ]

  return (
    <div className="w-full rounded-xl border border-gray-800 bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className={`h-5 w-5 ${CARD_COLORS.primary.icon}`} />
          <h3 className="text-lg font-semibold text-white">
            Product Comparison
          </h3>
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
            {products.length} product{products.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Comparison
        </button>
      </div>

      {/* ── Desktop Table View ── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-3 text-left text-sm font-medium text-gray-500 w-48">
                Feature
              </th>
              {products.map((product, idx) => (
                <th key={product.id} className="p-3 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Building2
                          className={`h-4 w-4 ${columnColors[idx % columnColors.length].icon}`}
                        />
                        <span className="text-sm font-semibold text-white">
                          {product.bank_name}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {product.name}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${columnColors[idx % columnColors.length].bg} ${columnColors[idx % columnColors.length].text}`}
                      >
                        {product.loan_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemove(product.id)}
                      className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-red-400"
                      title="Remove from comparison"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={row.label}
                className={`border-b border-gray-800/50 ${
                  rowIdx % 2 === 0 ? 'bg-gray-900/30' : ''
                }`}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    {row.icon}
                    {row.label}
                  </div>
                </td>
                {row.values.map((val, colIdx) => (
                  <td key={colIdx} className="p-3">
                    <span
                      className={
                        row.bestIdx === colIdx && products.length > 1
                          ? highlightClass
                          : 'text-sm text-gray-200'
                      }
                    >
                      {val}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Card View ── */}
      <div className="block md:hidden">
        {/* Product headers as a scrollable row */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-800 p-3">
          {products.map((product, idx) => (
            <div
              key={product.id}
              className={`flex min-w-[200px] flex-1 items-start justify-between rounded-lg border p-3 ${columnColors[idx % columnColors.length].border} ${columnColors[idx % columnColors.length].bg}`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <Building2
                    className={`h-4 w-4 ${columnColors[idx % columnColors.length].icon}`}
                  />
                  <span className="text-sm font-semibold text-white">
                    {product.bank_name}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-400">{product.name}</p>
              </div>
              <button
                onClick={() => onRemove(product.id)}
                className="rounded p-1 text-gray-500 hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Rows stacked on mobile */}
        <div className="divide-y divide-gray-800/50">
          {rows.map((row, rowIdx) => (
            <div
              key={row.label}
              className={`p-3 ${rowIdx % 2 === 0 ? 'bg-gray-900/30' : ''}`}
            >
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
                {row.icon}
                {row.label}
              </div>
              <div className="flex flex-col gap-1.5">
                {row.values.map((val, colIdx) => (
                  <div
                    key={colIdx}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-500">
                      {products[colIdx].bank_name}
                    </span>
                    <span
                      className={
                        row.bestIdx === colIdx && products.length > 1
                          ? highlightClass
                          : 'text-sm text-gray-200'
                      }
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── EMI Calculator Section ── */}
      <div className="border-t border-gray-800">
        <button
          onClick={() => setShowEmiSection((prev) => !prev)}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-900/50"
        >
          <div className="flex items-center gap-2">
            <Calculator className={`h-5 w-5 ${CARD_COLORS.info.icon}`} />
            <span className="text-sm font-semibold text-white">
              EMI Comparison Calculator
            </span>
          </div>
          {showEmiSection ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {showEmiSection && (
          <div className="border-t border-gray-800/50 p-4">
            {/* Input fields */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">
                  Loan Amount
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      parsedAmount > 0
                        ? parsedAmount.toLocaleString('en-IN')
                        : ''
                    }
                    onChange={handleAmountChange}
                    placeholder="e.g. 25,00,000"
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>
              </div>
              <div className="w-full sm:w-40">
                <label className="mb-1 block text-xs text-gray-500">
                  Tenure (months)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="number"
                    value={customTenure}
                    onChange={(e) => setCustomTenure(e.target.value)}
                    min={1}
                    max={480}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                  />
                </div>
              </div>
            </div>

            {/* EMI Results */}
            {parsedAmount > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product, idx) => {
                  const emi = emiValues[idx]
                  const totalPayable = emi * parsedTenure
                  const totalInterest = totalPayable - parsedAmount
                  const isBest = bestEmi === idx && products.length > 1

                  return (
                    <div
                      key={product.id}
                      className={`relative rounded-lg border p-4 ${
                        isBest
                          ? `${CARD_COLORS.success.border} ${CARD_COLORS.success.bg}`
                          : 'border-gray-800 bg-gray-900/50'
                      }`}
                    >
                      {isBest && (
                        <span className="absolute -top-2.5 right-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                          Lowest EMI
                        </span>
                      )}
                      <div className="mb-3 flex items-center gap-2">
                        <Building2
                          className={`h-4 w-4 ${columnColors[idx % columnColors.length].icon}`}
                        />
                        <span className="text-sm font-medium text-white">
                          {product.bank_name}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Monthly EMI</p>
                          <p
                            className={`text-lg font-bold ${
                              isBest
                                ? CARD_COLORS.success.text
                                : 'text-white'
                            }`}
                          >
                            {formatIndianCurrency(Math.round(emi))}
                          </p>
                        </div>
                        <div className="flex justify-between text-xs">
                          <div>
                            <p className="text-gray-500">Total Interest</p>
                            <p className="text-amber-400">
                              {formatIndianCurrency(Math.round(totalInterest))}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-500">Total Payable</p>
                            <p className="text-gray-300">
                              {formatIndianCurrency(Math.round(totalPayable))}
                            </p>
                          </div>
                        </div>
                        <div className="border-t border-gray-700/50 pt-2 text-xs text-gray-500">
                          @ {product.min_interest_rate}% p.a. for{' '}
                          {parsedTenure} months
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 py-8">
                <ArrowDown className="mb-2 h-5 w-5 text-gray-600" />
                <p className="text-sm text-gray-500">
                  Enter a loan amount above to see EMI comparison
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductComparisonTool
