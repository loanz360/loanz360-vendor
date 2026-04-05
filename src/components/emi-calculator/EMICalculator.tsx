'use client'

import React, { useState, useEffect } from 'react'
import { Calculator, TrendingUp, Share2, History, BookOpen, X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils/cn'

interface EMICalculation {
  id: string
  principal: number
  interestRate: number
  tenure: number
  emi: number
  totalInterest: number
  totalAmount: number
  timestamp: Date
}

interface AmortizationRow {
  month: number
  emi: number
  principalPaid: number
  interestPaid: number
  balance: number
}

const COLORS = ['#f97316', '#3b82f6']

export default function EMICalculator() {
  const [principal, setPrincipal] = useState<string>('')
  const [interestRate, setInterestRate] = useState<string>('')
  const [tenure, setTenure] = useState<string>('')
  const [tenureType, setTenureType] = useState<'months' | 'years'>('years')
  const [activeTab, setActiveTab] = useState<'calculator' | 'terminology'>('calculator')
  const [calculation, setCalculation] = useState<EMICalculation | null>(null)
  const [amortizationSchedule, setAmortizationSchedule] = useState<AmortizationRow[]>([])
  const [history, setHistory] = useState<EMICalculation[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [errors, setErrors] = useState<{ principal?: string; interestRate?: string; tenure?: string }>({})

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('emiCalculatorHistory')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })))
      } catch (error) {
        console.error('Failed to load history:', error)
      }
    }
  }, [])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('emiCalculatorHistory', JSON.stringify(history))
    }
  }, [history])

  const validateInputs = (): boolean => {
    const newErrors: { principal?: string; interestRate?: string; tenure?: string } = {}

    if (!principal || parseFloat(principal) <= 0) {
      newErrors.principal = 'Please enter a valid principal amount'
    }
    // Allow 0% interest rate for interest-free loans, but validate range
    if (interestRate === '' || parseFloat(interestRate) < 0 || parseFloat(interestRate) > 100) {
      newErrors.interestRate = 'Please enter a valid interest rate (0-100%)'
    }
    if (!tenure || parseFloat(tenure) <= 0) {
      newErrors.tenure = 'Please enter a valid tenure'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const calculateEMI = () => {
    if (!validateInputs()) return

    const P = parseFloat(principal)
    const annualRate = parseFloat(interestRate)
    const r = annualRate / 100 / 12 // Monthly interest rate
    const n = tenureType === 'years' ? parseFloat(tenure) * 12 : parseFloat(tenure) // Total months

    // Handle 0% interest rate (interest-free loans) - avoid division by zero
    let emi: number
    if (annualRate === 0) {
      emi = P / n
    } else {
      // EMI formula: P * r * (1 + r)^n / ((1 + r)^n - 1)
      emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    }
    const totalAmount = emi * n
    const totalInterest = totalAmount - P

    const newCalculation: EMICalculation = {
      id: Date.now().toString(),
      principal: P,
      interestRate: parseFloat(interestRate),
      tenure: n,
      emi: emi,
      totalInterest: totalInterest,
      totalAmount: totalAmount,
      timestamp: new Date()
    }

    setCalculation(newCalculation)
    generateAmortizationSchedule(P, r, n, emi)

    // Add to history (keep only last 10)
    const updatedHistory = [newCalculation, ...history].slice(0, 10)
    setHistory(updatedHistory)
  }

  const generateAmortizationSchedule = (P: number, r: number, n: number, emi: number) => {
    const schedule: AmortizationRow[] = []
    let balance = P

    for (let month = 1; month <= n; month++) {
      // Handle 0% interest rate
      const interestPaid = r === 0 ? 0 : balance * r
      const principalPaid = emi - interestPaid
      balance -= principalPaid

      schedule.push({
        month,
        emi,
        principalPaid,
        interestPaid,
        balance: Math.max(0, balance) // Prevent negative balance due to rounding
      })
    }

    setAmortizationSchedule(schedule)
  }

  const loadFromHistory = (item: EMICalculation) => {
    setPrincipal(item.principal.toString())
    setInterestRate(item.interestRate.toString())
    const years = Math.floor(item.tenure / 12)
    const months = item.tenure % 12
    if (months === 0) {
      setTenure(years.toString())
      setTenureType('years')
    } else {
      setTenure(item.tenure.toString())
      setTenureType('months')
    }
    setCalculation(item)
    generateAmortizationSchedule(
      item.principal,
      item.interestRate / 100 / 12,
      item.tenure,
      item.emi
    )
    setShowHistory(false)
  }

  const shareOnWhatsApp = () => {
    if (!calculation) return

    const message = `*EMI Calculator Results*\n\n` +
      `Loan Amount: ₹${calculation.principal.toLocaleString('en-IN')}\n` +
      `Interest Rate: ${calculation.interestRate}% p.a.\n` +
      `Tenure: ${Math.floor(calculation.tenure / 12)} years ${calculation.tenure % 12} months\n\n` +
      `Monthly EMI: ₹${calculation.emi.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n` +
      `Total Interest: ₹${calculation.totalInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n` +
      `Total Amount: ₹${calculation.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\n\n` +
      `Calculated via Loanz360 EMI Calculator`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem('emiCalculatorHistory')
    setShowHistory(false)
  }

  const pieData = calculation ? [
    { name: 'Principal Amount', value: calculation.principal },
    { name: 'Total Interest', value: calculation.totalInterest }
  ] : []

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl shadow-lg">
                <Calculator className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold font-poppins">EMI Calculator</h1>
                <p className="text-gray-400 mt-1">Calculate your loan EMI and view detailed amortization schedule</p>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/20 rounded-lg transition-colors"
            >
              <History className="w-5 h-5" />
              History ({history.length})
            </button>
          </div>
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold font-poppins">Recent Calculations</h2>
              <div className="flex gap-2">
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-sm text-red-400 hover:text-red-300 font-medium"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No calculation history yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="p-4 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors border border-white/10 hover:border-orange-500/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-white">
                        {formatCurrency(item.principal)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Rate:</span>
                        <span className="ml-1 font-medium text-gray-300">{item.interestRate}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Tenure:</span>
                        <span className="ml-1 font-medium text-gray-300">{Math.floor(item.tenure / 12)}Y {item.tenure % 12}M</span>
                      </div>
                      <div>
                        <span className="text-gray-400">EMI:</span>
                        <span className="ml-1 font-medium text-orange-400">{formatCurrency(item.emi)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 mb-6">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'calculator'
                  ? 'text-orange-500 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Calculator className="w-5 h-5" />
              Calculator
            </button>
            <button
              onClick={() => setActiveTab('terminology')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'terminology'
                  ? 'text-orange-500 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              Terminology
            </button>
          </div>

          {activeTab === 'calculator' && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Form */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Principal Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={principal}
                      onChange={(e) => setPrincipal(e.target.value)}
                      placeholder="e.g., 1000000"
                      className={`w-full px-4 py-3 bg-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 ${
                        errors.principal ? 'border-red-500' : 'border-white/20'
                      }`}
                    />
                    {errors.principal && (
                      <p className="mt-1 text-sm text-red-400">{errors.principal}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Interest Rate (% per annum)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      placeholder="e.g., 8.5"
                      className={`w-full px-4 py-3 bg-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 ${
                        errors.interestRate ? 'border-red-500' : 'border-white/20'
                      }`}
                    />
                    {errors.interestRate && (
                      <p className="mt-1 text-sm text-red-400">{errors.interestRate}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Loan Tenure
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        value={tenure}
                        onChange={(e) => setTenure(e.target.value)}
                        placeholder="e.g., 20"
                        className={`flex-1 px-4 py-3 bg-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 ${
                          errors.tenure ? 'border-red-500' : 'border-white/20'
                        }`}
                      />
                      <select
                        value={tenureType}
                        onChange={(e) => setTenureType(e.target.value as 'months' | 'years')}
                        className="px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                      >
                        <option value="years">Years</option>
                        <option value="months">Months</option>
                      </select>
                    </div>
                    {errors.tenure && (
                      <p className="mt-1 text-sm text-red-400">{errors.tenure}</p>
                    )}
                  </div>

                  <button
                    onClick={calculateEMI}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-5 h-5" />
                    Calculate EMI
                  </button>
                </div>

                {/* Results */}
                <div>
                  {calculation ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg border border-orange-400/50">
                        <div className="text-sm font-medium opacity-90 mb-1">Monthly EMI</div>
                        <div className="text-4xl font-bold">
                          {formatCurrency(calculation.emi)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
                          <div className="text-sm font-medium text-gray-400 mb-1">Principal Amount</div>
                          <div className="text-xl font-bold text-white">
                            {formatCurrency(calculation.principal)}
                          </div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-orange-500/30">
                          <div className="text-sm font-medium text-gray-400 mb-1">Total Interest</div>
                          <div className="text-xl font-bold text-orange-400">
                            {formatCurrency(calculation.totalInterest)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
                        <div className="text-sm font-medium text-gray-400 mb-1">Total Amount Payable</div>
                        <div className="text-2xl font-bold text-white">
                          {formatCurrency(calculation.totalAmount)}
                        </div>
                      </div>

                      <button
                        onClick={shareOnWhatsApp}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Share2 className="w-5 h-5" />
                        Share on WhatsApp
                      </button>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-white/5 backdrop-blur-lg rounded-xl border border-white/10">
                      <div className="text-center text-gray-500 p-8">
                        <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="font-medium">Enter loan details to see results</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pie Chart */}
              {calculation && (
                <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2 font-poppins">
                    <TrendingUp className="w-6 h-6 text-orange-500" />
                    Principal vs Interest Breakdown
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Amortization Schedule */}
              {amortizationSchedule.length > 0 && (
                <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                    <h3 className="text-xl font-bold font-poppins">EMI Amortization Schedule</h3>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full">
                      <thead className="bg-white/10 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Month</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">EMI</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Principal</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Interest</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {amortizationSchedule.map((row) => (
                          <tr key={row.month} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-300">{row.month}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-300">{formatCurrency(row.emi)}</td>
                            <td className="px-4 py-3 text-sm text-right text-blue-400 font-medium">{formatCurrency(row.principalPaid)}</td>
                            <td className="px-4 py-3 text-sm text-right text-orange-400 font-medium">{formatCurrency(row.interestPaid)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-200 font-medium">{formatCurrency(row.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'terminology' && (
            <div className="p-6">
              <div className="prose max-w-none">
                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/10">
                  <h2 className="text-2xl font-bold mb-4 font-poppins">What is EMI?</h2>
                  <p className="text-gray-300 leading-relaxed">
                    <strong>EMI (Equated Monthly Installment)</strong> is a fixed payment amount made by a borrower to a lender at a specified date each calendar month. EMIs are used to pay off both interest and principal each month so that over a specified number of years, the loan is fully paid off.
                  </p>
                </div>

                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/10">
                  <h2 className="text-2xl font-bold mb-4 font-poppins">How is EMI Calculated?</h2>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    The EMI calculation formula is:
                  </p>
                  <div className="bg-black/50 rounded-lg p-4 mb-4 border border-orange-500/30 font-mono text-center text-lg text-orange-400">
                    EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ - 1)
                  </div>
                  <div className="space-y-2 text-gray-300">
                    <p><strong>Where:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li><strong>P</strong> = Principal loan amount</li>
                      <li><strong>r</strong> = Monthly interest rate (Annual rate / 12 / 100)</li>
                      <li><strong>n</strong> = Total number of monthly installments</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/10">
                  <h2 className="text-2xl font-bold mb-4 font-poppins">Components of EMI</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2 font-poppins">1. Principal Component</h3>
                      <p className="text-gray-300">
                        The portion of your EMI that goes towards repaying the actual loan amount. This component increases over time as you pay off more of the loan.
                      </p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2 font-poppins">2. Interest Component</h3>
                      <p className="text-gray-300">
                        The portion of your EMI that pays the interest on the outstanding loan balance. This component decreases over time as the principal is repaid.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/10">
                  <h2 className="text-2xl font-bold mb-4 font-poppins">Key Terms</h2>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold font-poppins">Principal Amount</h3>
                      <p className="text-gray-300">The original loan amount borrowed from the lender, excluding interest.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-poppins">Interest Rate</h3>
                      <p className="text-gray-300">The percentage charged by the lender on the principal amount, usually expressed as an annual percentage rate (APR).</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-poppins">Loan Tenure</h3>
                      <p className="text-gray-300">The duration over which the loan must be repaid, typically measured in months or years.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-poppins">Amortization Schedule</h3>
                      <p className="text-gray-300">A detailed table showing the breakdown of each EMI payment into principal and interest components, along with the remaining loan balance after each payment.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                  <h2 className="text-2xl font-bold mb-4 font-poppins">Important Notes</h2>
                  <ul className="list-disc list-inside space-y-2 text-gray-300">
                    <li>In the early stages of loan repayment, a larger portion of your EMI goes towards interest</li>
                    <li>As time progresses, more of your EMI goes towards principal repayment</li>
                    <li>Making prepayments can significantly reduce your total interest burden</li>
                    <li>A longer tenure reduces monthly EMI but increases total interest paid</li>
                    <li>A shorter tenure increases monthly EMI but reduces total interest paid</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
