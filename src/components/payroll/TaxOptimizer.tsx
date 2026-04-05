// =====================================================
// TAX OPTIMIZER COMPONENT (Enhancement E2)
// Visual tax optimization recommendations
// =====================================================

'use client'

import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Target,
  Lightbulb,
  Calculator,
  DollarSign,
  PieChart,
  ArrowRight
} from 'lucide-react'
import { optimizeTax, TaxOptimizationResult, TaxSection } from '@/lib/tax/tax-optimizer'
import { formatCurrency } from '@/lib/utils/payroll-utils'

interface TaxOptimizerProps {
  grossAnnualIncome: number
  currentDeductions: {
    section80C?: number
    section80D?: number
    section80CCD1B?: number
    hraExemption?: number
    homeLoanInterest?: number
  }
  employeeDetails: {
    age?: number
    parentsAge?: number
    rentPaid?: number
    metroCity?: boolean
    homeLoanInterest?: number
  }
}

export default function TaxOptimizer({
  grossAnnualIncome,
  currentDeductions,
  employeeDetails
}: TaxOptimizerProps) {
  const [optimization, setOptimization] = useState<TaxOptimizationResult | null>(null)
  const [selectedSection, setSelectedSection] = useState<TaxSection | null>(null)

  useEffect(() => {
    const result = optimizeTax(grossAnnualIncome, currentDeductions, employeeDetails)
    setOptimization(result)
  }, [grossAnnualIncome, currentDeductions, employeeDetails])

  if (!optimization) {
    return <div>Loading tax optimization...</div>
  }

  const savingsPotential = optimization.totalPotentialSavings

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Lightbulb className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl font-bold text-white">Tax Optimization Insights</h2>
            </div>
            <p className="text-gray-300">
              AI-powered recommendations to maximize your tax savings
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Potential Annual Savings</div>
            <div className="text-3xl font-bold text-emerald-400">
              {formatCurrency(savingsPotential)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ₹{Math.round(savingsPotential / 12).toLocaleString('en-IN')}/month
            </div>
          </div>
        </div>
      </div>

      {/* Regime Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Old Regime */}
        <div
          className={`bg-gray-900 border rounded-xl p-6 ${
            optimization.recommendation === 'old'
              ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
              : 'border-gray-700/50'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Old Tax Regime</h3>
            {optimization.recommendation === 'old' && (
              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>Recommended</span>
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-400">Taxable Income</div>
              <div className="text-xl font-bold text-white">
                {formatCurrency(optimization.currentRegime.taxableIncome)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Total Deductions</div>
              <div className="text-lg text-emerald-400">
                {formatCurrency(optimization.currentRegime.totalDeductions)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Annual Tax</div>
              <div className="text-2xl font-bold text-orange-400">
                {formatCurrency(optimization.currentRegime.taxAmount)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Effective Tax Rate</div>
              <div className="text-lg text-white">
                {optimization.currentRegime.effectiveTaxRate.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* New Regime */}
        <div
          className={`bg-gray-900 border rounded-xl p-6 ${
            optimization.recommendation === 'new'
              ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
              : 'border-gray-700/50'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">New Tax Regime</h3>
            {optimization.recommendation === 'new' && (
              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>Recommended</span>
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-400">Taxable Income</div>
              <div className="text-xl font-bold text-white">
                {formatCurrency(optimization.alternateRegime.taxableIncome)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Total Deductions</div>
              <div className="text-lg text-blue-400">
                {formatCurrency(optimization.alternateRegime.totalDeductions)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                (Standard deduction only)
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Annual Tax</div>
              <div className="text-2xl font-bold text-orange-400">
                {formatCurrency(optimization.alternateRegime.taxAmount)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Effective Tax Rate</div>
              <div className="text-lg text-white">
                {optimization.alternateRegime.effectiveTaxRate.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Savings Comparison */}
      {optimization.annualSavings > 0 && (
        <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingDown className="w-8 h-8 text-blue-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">
                  You save {formatCurrency(optimization.annualSavings)} annually
                </h3>
                <p className="text-sm text-gray-400">
                  by choosing the <span className="text-emerald-400 font-medium">{optimization.recommendation.toUpperCase()} regime</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Monthly Savings</div>
              <div className="text-xl font-bold text-blue-400">
                {formatCurrency(optimization.monthlySavings)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optimization Suggestions */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Target className="w-5 h-5 text-orange-400" />
          <h3 className="text-xl font-semibold text-white">Optimization Opportunities</h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {optimization.optimizationSuggestions.map((section, index) => (
            <div
              key={section.section}
              className={`bg-gray-900 border border-gray-700/50 rounded-lg p-4 hover:border-orange-500/50 transition-colors cursor-pointer ${
                selectedSection?.section === section.section ? 'ring-2 ring-orange-500/30' : ''
              }`}
              onClick={() => setSelectedSection(selectedSection?.section === section.section ? null : section)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    section.priority === 'high'
                      ? 'bg-red-500/20'
                      : section.priority === 'medium'
                      ? 'bg-yellow-500/20'
                      : 'bg-green-500/20'
                  }`}>
                    <DollarSign className={`w-5 h-5 ${
                      section.priority === 'high'
                        ? 'text-red-400'
                        : section.priority === 'medium'
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-semibold">{section.section}</span>
                      <span className="text-gray-400 text-sm">{section.name}</span>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-gray-500">
                        Utilized: {formatCurrency(section.currentDeclared)} / {formatCurrency(section.maxLimit)}
                      </span>
                      {section.availableLimit > 0 && (
                        <span className="text-xs text-emerald-400">
                          Available: {formatCurrency(section.availableLimit)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right ml-4">
                  <div className="text-lg font-bold text-emerald-400">
                    {formatCurrency(section.potentialSavings)}
                  </div>
                  <div className="text-xs text-gray-500">potential savings</div>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedSection?.section === section.section && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <p className="text-sm text-gray-400 mb-3">{section.description}</p>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-2 font-semibold">Suggested Actions:</div>
                    <ul className="space-y-1">
                      {section.suggestedInvestments.map((investment, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-start space-x-2">
                          <ArrowRight className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                          <span>{investment}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Implementation Priority */}
      {optimization.implementationPriority.length > 0 && (
        <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertCircle className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Top 3 Priority Actions</h3>
          </div>
          <div className="space-y-2">
            {optimization.implementationPriority.map((action, index) => (
              <div key={index} className="flex items-start space-x-3">
                <span className="bg-purple-500/20 text-purple-400 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-gray-300 text-sm">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
