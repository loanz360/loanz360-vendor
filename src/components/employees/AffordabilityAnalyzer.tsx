'use client'

import React, { useState, useMemo } from 'react'
import {
  Wallet, AlertTriangle, CheckCircle2, BarChart3
} from 'lucide-react'
import { PieChart as RPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface AffordabilityResult {
  score: number
  grade: 'Excellent' | 'Good' | 'Moderate' | 'Stretched' | 'Risky'
  dti: number
  postEmiSurplus: number
  monthsOfExpensesInEmergency: number
  stressTestEMI: number
  canHandleStress: boolean
  breakdownItems: { name: string; value: number; color: string }[]
  recommendations: string[]
  warnings: string[]
  rentVsBuyYears: number | null
}

const COLORS = {
  emi: '#f97316',
  existingEMI: '#ef4444',
  expenses: '#6366f1',
  savings: '#22c55e',
  rent: '#8b5cf6',
  insurance: '#06b6d4',
  surplus: '#10b981',
}

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (absAmount >= 10000000) return `${sign}\u20B9${(absAmount / 10000000).toFixed(2)} Cr`
  if (absAmount >= 100000) return `${sign}\u20B9${(absAmount / 100000).toFixed(1)}L`
  return `${sign}\u20B9${Math.round(absAmount).toLocaleString('en-IN')}`
}

const MAX_INCOME = 100000000 // 10 Cr
const MAX_LOAN = 500000000 // 50 Cr

export default function AffordabilityAnalyzer() {
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [monthlyExpenses, setMonthlyExpenses] = useState('')
  const [existingEMIs, setExistingEMIs] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [monthlySavings, setMonthlySavings] = useState('')
  const [emergencyFund, setEmergencyFund] = useState('')
  const [insurancePremium, setInsurancePremium] = useState('')
  const [proposedEMI, setProposedEMI] = useState('')
  const [loanAmount, setLoanAmount] = useState('')
  const [loanTenureYears, setLoanTenureYears] = useState('20')

  const result = useMemo<AffordabilityResult | null>(() => {
    const income = Math.min(Math.max(parseFloat(monthlyIncome) || 0, 0), MAX_INCOME)
    const expenses = Math.min(Math.max(parseFloat(monthlyExpenses) || 0, 0), MAX_INCOME)
    const emis = Math.min(Math.max(parseFloat(existingEMIs) || 0, 0), MAX_INCOME)
    const rent = Math.min(Math.max(parseFloat(monthlyRent) || 0, 0), MAX_INCOME)
    const savings = Math.min(Math.max(parseFloat(monthlySavings) || 0, 0), MAX_INCOME)
    const emergency = Math.min(Math.max(parseFloat(emergencyFund) || 0, 0), MAX_LOAN)
    const insurance = Math.min(Math.max(parseFloat(insurancePremium) || 0, 0), MAX_INCOME)
    const newEMI = Math.min(Math.max(parseFloat(proposedEMI) || 0, 0), MAX_INCOME)
    const loan = Math.min(Math.max(parseFloat(loanAmount) || 0, 0), MAX_LOAN)
    const tenure = parseFloat(loanTenureYears) || 20

    if (income === 0 || newEMI === 0) return null

    // Calculate DTI (Debt-to-Income)
    const totalDebt = emis + newEMI
    const dti = (totalDebt / income) * 100

    // Post-EMI surplus
    const monthlyObligations = expenses + emis + newEMI + insurance
    const postEmiSurplus = income - monthlyObligations

    // Emergency fund adequacy — guard against division by zero
    const monthlyBasicExpenses = expenses + emis + newEMI
    const monthsOfExpenses = (emergency > 0 && monthlyBasicExpenses > 0)
      ? emergency / monthlyBasicExpenses
      : (emergency > 0 ? 999 : 0) // Infinite if no expenses but have fund

    // Stress test: What if rates increase by 2%?
    const currentRate = loan > 0 && newEMI > 0
      ? estimateRate(loan, newEMI, tenure * 12)
      : 8.5
    const stressRate = currentRate + 2
    const stressMonthlyRate = stressRate / 100 / 12
    const stressMonths = tenure * 12
    let stressEMI: number
    if (loan > 0 && stressMonthlyRate > 0) {
      stressEMI = (loan * stressMonthlyRate * Math.pow(1 + stressMonthlyRate, stressMonths)) /
        (Math.pow(1 + stressMonthlyRate, stressMonths) - 1)
    } else {
      stressEMI = newEMI * 1.15
    }
    const canHandleStress = (income - expenses - emis - stressEMI - insurance) > 0

    // Rent vs Buy analysis — improved principal calculation
    let rentVsBuyYears: number | null = null
    if (rent > 0 && newEMI > 0 && loan > 0) {
      const annualRentEscalation = 1.05 // 5% annual rent increase
      let totalRent = 0
      let totalEmiPaid = 0
      const propertyValue = loan * 1.2 // Assume 80% LTV
      const annualRate = currentRate / 100

      for (let year = 1; year <= 30; year++) {
        totalRent += rent * 12 * Math.pow(annualRentEscalation, year - 1)
        totalEmiPaid += newEMI * 12

        // More accurate outstanding principal using amortization formula
        const monthsPaid = year * 12
        const totalMonths = tenure * 12
        const monthlyRate = annualRate / 12
        let outstandingPrincipal: number
        if (monthlyRate > 0 && monthsPaid < totalMonths) {
          outstandingPrincipal = loan * (Math.pow(1 + monthlyRate, totalMonths) - Math.pow(1 + monthlyRate, monthsPaid)) /
            (Math.pow(1 + monthlyRate, totalMonths) - 1)
        } else {
          outstandingPrincipal = Math.max(0, loan - (totalEmiPaid * 0.6))
        }

        const currentPropertyValue = propertyValue * Math.pow(1.06, year) // 6% appreciation
        const equity = currentPropertyValue - outstandingPrincipal

        if (equity > totalRent - totalEmiPaid) {
          rentVsBuyYears = year
          break
        }
      }
    }

    // Calculate score (0-100)
    let score = 100
    if (dti > 50) score -= 30
    else if (dti > 40) score -= 15
    else if (dti > 30) score -= 5

    if (postEmiSurplus < income * 0.1) score -= 25
    else if (postEmiSurplus < income * 0.2) score -= 10

    if (monthsOfExpenses < 3) score -= 20
    else if (monthsOfExpenses < 6) score -= 10

    if (!canHandleStress) score -= 15

    if (savings < income * 0.1) score -= 10

    score = Math.max(0, Math.min(100, score))

    // Grade
    let grade: AffordabilityResult['grade']
    if (score >= 80) grade = 'Excellent'
    else if (score >= 65) grade = 'Good'
    else if (score >= 50) grade = 'Moderate'
    else if (score >= 35) grade = 'Stretched'
    else grade = 'Risky'

    // Breakdown
    const breakdownItems = [
      { name: 'New EMI', value: newEMI, color: COLORS.emi },
      { name: 'Existing EMIs', value: emis, color: COLORS.existingEMI },
      { name: 'Living Expenses', value: expenses, color: COLORS.expenses },
      { name: 'Insurance', value: insurance, color: COLORS.insurance },
      { name: 'Surplus', value: Math.max(0, postEmiSurplus), color: COLORS.surplus },
    ].filter(item => item.value > 0)

    // Recommendations
    const recommendations: string[] = []
    const warnings: string[] = []

    if (dti <= 40) recommendations.push('Your debt-to-income ratio is healthy. Banks will view your application favorably.')
    if (monthsOfExpenses >= 6) recommendations.push('Strong emergency fund. This shows financial discipline.')
    if (canHandleStress) recommendations.push('You can handle a 2% rate increase — good safety margin.')
    if (rentVsBuyYears && rentVsBuyYears <= 7) recommendations.push(`Buying becomes more economical than renting in ~${rentVsBuyYears} years.`)
    if (savings >= income * 0.2) recommendations.push('Excellent savings rate. You have strong financial discipline.')

    if (dti > 50) warnings.push('DTI above 50% — most banks will reject. Consider reducing loan amount or increasing down payment.')
    if (dti > 40 && dti <= 50) warnings.push('DTI between 40-50% — eligible but stretched. Some banks may offer at higher rates.')
    if (postEmiSurplus < income * 0.1) warnings.push('Post-EMI surplus is less than 10% of income. Any unexpected expense could cause stress.')
    if (postEmiSurplus < 0) warnings.push('Your expenses exceed your income after the new EMI. This loan is unaffordable at current income.')
    if (monthsOfExpenses < 3) warnings.push('Emergency fund covers less than 3 months. Build it to at least 6 months before taking the loan.')
    if (!canHandleStress) warnings.push('If interest rates rise by 2%, you won\'t be able to afford the EMI. Consider a smaller loan or longer tenure.')
    if (insurance === 0) warnings.push('No insurance premium detected. Recommend term insurance and health insurance before taking a large loan.')

    return {
      score,
      grade,
      dti: Math.round(dti * 10) / 10,
      postEmiSurplus: Math.round(postEmiSurplus),
      monthsOfExpensesInEmergency: Math.min(Math.round(monthsOfExpenses * 10) / 10, 999),
      stressTestEMI: Math.round(stressEMI),
      canHandleStress,
      breakdownItems,
      recommendations,
      warnings,
      rentVsBuyYears,
    }
  }, [monthlyIncome, monthlyExpenses, existingEMIs, monthlyRent, monthlySavings, emergencyFund, insurancePremium, proposedEMI, loanAmount, loanTenureYears])

  const gradeColors: Record<string, string> = {
    Excellent: 'text-green-400 bg-green-500/20',
    Good: 'text-blue-400 bg-blue-500/20',
    Moderate: 'text-yellow-400 bg-yellow-500/20',
    Stretched: 'text-orange-400 bg-orange-500/20',
    Risky: 'text-red-400 bg-red-500/20',
  }

  const inputClass = "w-full pl-8 pr-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  const preventKeys = (e: React.KeyboardEvent) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }

  const inputFields = [
    { label: 'Monthly Income', value: monthlyIncome, setter: setMonthlyIncome, placeholder: 'e.g., 100000', id: 'monthly-income' },
    { label: 'Monthly Expenses', value: monthlyExpenses, setter: setMonthlyExpenses, placeholder: 'e.g., 35000', id: 'monthly-expenses' },
    { label: 'Existing EMIs', value: existingEMIs, setter: setExistingEMIs, placeholder: '0', id: 'existing-emis' },
    { label: 'Monthly Rent', value: monthlyRent, setter: setMonthlyRent, placeholder: '0 (if buying home)', id: 'monthly-rent' },
    { label: 'Monthly Savings', value: monthlySavings, setter: setMonthlySavings, placeholder: 'e.g., 15000', id: 'monthly-savings' },
    { label: 'Emergency Fund', value: emergencyFund, setter: setEmergencyFund, placeholder: 'Total savings', id: 'emergency-fund' },
    { label: 'Insurance Premium', value: insurancePremium, setter: setInsurancePremium, placeholder: 'Monthly', id: 'insurance-premium' },
    { label: 'Proposed New EMI', value: proposedEMI, setter: setProposedEMI, placeholder: 'From calculator', id: 'proposed-emi' },
    { label: 'Loan Amount', value: loanAmount, setter: setLoanAmount, placeholder: 'e.g., 5000000', id: 'loan-amount' },
  ]

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2 font-poppins">
          <Wallet className="w-6 h-6 text-orange-500" />
          Affordability Analyzer
        </h3>
        <p className="text-gray-400 text-sm mb-6">Complete financial health assessment for loan readiness</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inputFields.map(field => (
            <div key={field.id}>
              <label htmlFor={field.id} className="block text-sm font-semibold text-gray-300 mb-2">{field.label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{'\u20B9'}</span>
                <input
                  id={field.id}
                  type="number"
                  min="0"
                  max={field.id === 'loan-amount' || field.id === 'emergency-fund' ? MAX_LOAN : MAX_INCOME}
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  onKeyDown={preventKeys}
                  placeholder={field.placeholder}
                  className={inputClass}
                  aria-label={field.label}
                />
              </div>
            </div>
          ))}

          <div>
            <label htmlFor="loan-tenure" className="block text-sm font-semibold text-gray-300 mb-2">Loan Tenure</label>
            <select
              id="loan-tenure"
              value={loanTenureYears}
              onChange={(e) => setLoanTenureYears(e.target.value)}
              className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              aria-label="Loan tenure in years"
            >
              {[5, 7, 10, 15, 20, 25, 30].map(y => (
                <option key={y} value={y} className="bg-black text-white">{y} Years</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!result && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
          <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Enter your monthly income and proposed EMI to see your affordability analysis</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Score Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1 bg-white/5 rounded-2xl border border-white/10 p-6 flex flex-col items-center justify-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold ${gradeColors[result.grade]}`}>
                {result.score}
              </div>
              <p className={`mt-2 font-bold text-lg ${gradeColors[result.grade].split(' ')[0]}`}>{result.grade}</p>
              <p className="text-xs text-gray-500 mt-1">Affordability Score</p>
            </div>

            <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-gray-400">Debt-to-Income</p>
                <p className={`text-2xl font-bold ${result.dti <= 40 ? 'text-green-400' : result.dti <= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {result.dti}%
                </p>
                <p className="text-xs text-gray-500">{result.dti <= 40 ? 'Healthy' : result.dti <= 50 ? 'Stretched' : 'High Risk'}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-gray-400">Post-EMI Surplus</p>
                <p className={`text-2xl font-bold ${result.postEmiSurplus > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(result.postEmiSurplus)}
                </p>
                <p className="text-xs text-gray-500">/month remaining</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-gray-400">Emergency Buffer</p>
                <p className={`text-2xl font-bold ${result.monthsOfExpensesInEmergency >= 6 ? 'text-green-400' : result.monthsOfExpensesInEmergency >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {result.monthsOfExpensesInEmergency >= 999 ? '∞' : result.monthsOfExpensesInEmergency}
                </p>
                <p className="text-xs text-gray-500">months of expenses</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-gray-400">Stress Test EMI (+2%)</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(result.stressTestEMI)}</p>
                <p className={`text-xs ${result.canHandleStress ? 'text-green-400' : 'text-red-400'}`}>
                  {result.canHandleStress ? 'Can handle' : 'Cannot handle'}
                </p>
              </div>
              {result.rentVsBuyYears && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-xs text-gray-400">Rent vs Buy Break-even</p>
                  <p className="text-2xl font-bold text-blue-400">{result.rentVsBuyYears} yrs</p>
                  <p className="text-xs text-gray-500">Buying beats renting</p>
                </div>
              )}
            </div>
          </div>

          {/* Income Breakdown Chart */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              Monthly Income Allocation
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <RPieChart>
                <Pie
                  data={result.breakdownItems}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {result.breakdownItems.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: string | number | (string | number)[]) => formatCurrency(Number(value))} />
                <Legend />
              </RPieChart>
            </ResponsiveContainer>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
              <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Strengths
              </h4>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
              <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Concerns
              </h4>
              <ul className="space-y-1">
                {result.warnings.map((warn, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    {warn}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Helper: Estimate interest rate from EMI, principal, tenure using Newton-Raphson
function estimateRate(principal: number, emi: number, months: number): number {
  if (principal <= 0 || emi <= 0 || months <= 0) return 8.5

  // If EMI is exactly principal/months, rate is 0
  if (Math.abs(emi - principal / months) < 1) return 0

  let rate = 0.008 // Initial guess: ~10% annual
  for (let i = 0; i < 100; i++) {
    const pow = Math.pow(1 + rate, months)
    const f = (principal * rate * pow) / (pow - 1) - emi
    const fPrime = principal * (pow * (pow - 1) - rate * months * Math.pow(1 + rate, months - 1) * (pow - 1) + rate * pow * months * Math.pow(1 + rate, months - 1)) / ((pow - 1) * (pow - 1))
    if (Math.abs(fPrime) < 1e-10) break
    const newRate = rate - f / fPrime
    // Clamp to reasonable bounds (0.01% to 50% annual)
    rate = Math.max(0.00001, Math.min(newRate, 0.04167))
    if (Math.abs(f) < 0.01) break // Converged
  }
  return Math.max(0, Math.min(rate * 12 * 100, 50)) // Cap at 50% annual
}
