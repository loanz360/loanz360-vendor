'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calculator, Building2, MapPin, FileText, TrendingUp, AlertCircle, Loader2, IndianRupee, Calendar, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/cn'

interface CalculatorResult {
  general_percentage: number
  partner_percentage: number
  commission_amount: number
  effective_from: string
  effective_to: string | null
  version: number
  conditions: string[]
  specific_conditions: string | null
  multiplier: number
}

interface CommissionCalculatorProps {
  partnerType: 'BA' | 'BP' | 'CP'
  showTeamCommission?: boolean
}

export default function CommissionCalculator({
  partnerType,
  showTeamCommission = false
}: CommissionCalculatorProps) {
  const supabase = createClient()

  // Form State
  const [bankName, setBankName] = useState('')
  const [location, setLocation] = useState('')
  const [loanType, setLoanType] = useState('')
  const [disbursementAmount, setDisbursementAmount] = useState('')
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split('T')[0])

  // Dropdown options
  const [banks, setBanks] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [loanTypes, setLoanTypes] = useState<string[]>([])

  // Result state
  const [result, setResult] = useState<CalculatorResult | null>(null)
  const [teamCommission, setTeamCommission] = useState<{ percentage: number; amount: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)

  // Fetch dropdown options
  const fetchOptions = useCallback(async () => {
    setOptionsLoading(true)
    try {
      // Get unique banks
      const { data: banksData } = await supabase
        .from(`payout_${partnerType.toLowerCase()}_percentages`)
        .select('bank_name')
        .eq('is_current', true)
        .order('bank_name')

      // Get unique locations
      const { data: locationsData } = await supabase
        .from(`payout_${partnerType.toLowerCase()}_percentages`)
        .select('location')
        .eq('is_current', true)
        .order('location')

      // Get unique loan types
      const { data: loanTypesData } = await supabase
        .from(`payout_${partnerType.toLowerCase()}_percentages`)
        .select('loan_type')
        .eq('is_current', true)
        .order('loan_type')

      setBanks([...new Set(banksData?.map(b => b.bank_name) || [])])
      setLocations([...new Set(locationsData?.map(l => l.location) || [])])
      setLoanTypes([...new Set(loanTypesData?.map(t => t.loan_type) || [])])
    } catch (err) {
      console.error('Error fetching options:', err)
    } finally {
      setOptionsLoading(false)
    }
  }, [supabase, partnerType])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  // Calculate commission
  const handleCalculate = async () => {
    if (!bankName || !location || !loanType || !disbursementAmount) {
      setError('Please fill in all required fields')
      return
    }

    const amount = parseFloat(disbursementAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid disbursement amount')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setTeamCommission(null)

    try {
      const params = new URLSearchParams({
        bank_name: bankName,
        location: location,
        loan_type: loanType,
        amount: amount.toString(),
        partner_type: partnerType,
        disbursement_date: disbursementDate,
        include_team: showTeamCommission ? 'true' : 'false'
      })

      const response = await fetch(`/api/commissions/calculate?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate commission')
      }

      setResult(data.data)
      if (data.team_commission) {
        setTeamCommission(data.team_commission)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while calculating')
    } finally {
      setLoading(false)
    }
  }

  // Reset calculator
  const handleReset = () => {
    setBankName('')
    setLocation('')
    setLoanType('')
    setDisbursementAmount('')
    setDisbursementDate(new Date().toISOString().split('T')[0])
    setResult(null)
    setTeamCommission(null)
    setError(null)
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-gradient-to-r from-orange-900/20 to-transparent">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold font-poppins text-white">Commission Calculator</h3>
            <p className="text-sm text-gray-400">Calculate your expected commission for a loan</p>
          </div>
        </div>
      </div>

      {/* Calculator Form */}
      <div className="p-6">
        {optionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading options...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bank Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-orange-400" />
                  <span>Bank/NBFC</span>
                </div>
              </label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-white/5 text-white rounded-lg px-4 py-3 text-sm
                           border border-white/10 focus:ring-2 focus:ring-orange-500
                           focus:border-orange-500"
              >
                <option value="">Select Bank/NBFC</option>
                {banks.map(bank => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>

            {/* Location and Loan Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-green-400" />
                    <span>Location</span>
                  </div>
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-white/5 text-white rounded-lg px-4 py-3 text-sm
                             border border-white/10 focus:ring-2 focus:ring-orange-500
                             focus:border-orange-500"
                >
                  <option value="">Select Location</option>
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Loan Type</span>
                  </div>
                </label>
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  className="w-full bg-white/5 text-white rounded-lg px-4 py-3 text-sm
                             border border-white/10 focus:ring-2 focus:ring-orange-500
                             focus:border-orange-500"
                >
                  <option value="">Select Loan Type</option>
                  {loanTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Disbursement Amount and Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center space-x-2">
                    <IndianRupee className="w-4 h-4 text-yellow-400" />
                    <span>Disbursement Amount</span>
                  </div>
                </label>
                <input
                  type="number"
                  value={disbursementAmount}
                  onChange={(e) => setDisbursementAmount(e.target.value)}
                  placeholder="e.g., 1000000"
                  className="w-full bg-white/5 text-white rounded-lg px-4 py-3 text-sm
                             border border-white/10 focus:ring-2 focus:ring-orange-500
                             focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span>Disbursement Date</span>
                  </div>
                </label>
                <input
                  type="date"
                  value={disbursementDate}
                  onChange={(e) => setDisbursementDate(e.target.value)}
                  className="w-full bg-white/5 text-white rounded-lg px-4 py-3 text-sm
                             border border-white/10 focus:ring-2 focus:ring-orange-500
                             focus:border-orange-500"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-2">
              <Button
                onClick={handleCalculate}
                disabled={loading}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    Calculate Commission
                  </>
                )}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="mt-6 space-y-4">
            {/* Commission Amount Card */}
            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-6 border border-green-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Your Commission</p>
                  <p className="text-3xl font-bold text-green-400">
                    {formatCurrency(result.commission_amount)}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {result.partner_percentage}% of {formatCurrency(parseFloat(disbursementAmount))}
                  </p>
                </div>
                <div className="text-right">
                  <TrendingUp className="w-12 h-12 text-green-400/50" />
                </div>
              </div>

              {/* Team Commission for BP */}
              {teamCommission && partnerType === 'BP' && (
                <div className="mt-4 pt-4 border-t border-green-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Team Override Commission</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {formatCurrency(teamCommission.amount)}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        {teamCommission.percentage}% on team sourced business
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rate Details */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Rate Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">General Commission:</span>
                  <span className="text-white font-medium">{result.general_percentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Your Rate:</span>
                  <span className="text-orange-400 font-medium">{result.partner_percentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Multiplier:</span>
                  <span className="text-white font-medium">{result.multiplier}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate Effective:</span>
                  <span className="text-white font-medium">
                    {new Date(result.effective_from).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Conditions */}
            {result.conditions && result.conditions.length > 0 && (
              <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-500/30">
                <h4 className="text-sm font-medium text-yellow-300 mb-3">Payout Conditions</h4>
                <ul className="space-y-2 text-sm">
                  {result.conditions.map((condition, index) => (
                    <li key={index} className="flex items-start space-x-2 text-gray-300">
                      <span className="text-yellow-400 mt-0.5">•</span>
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specific Conditions */}
            {result.specific_conditions && (
              <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-500/30">
                <h4 className="text-sm font-medium text-blue-300 mb-3">Specific Conditions</h4>
                <p className="text-sm text-gray-300">{result.specific_conditions}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
