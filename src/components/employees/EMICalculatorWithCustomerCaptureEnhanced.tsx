'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calculator,
  TrendingUp,
  Share2,
  Save,
  User,
  Phone,
  Mail,
  DollarSign,
  MessageSquare,
  X,
  Loader2,
  ChevronDown,
  History,
  BookOpen,
  PiggyBank,
  Scale,
  Target,
  FileText,
  RefreshCw,
  Check,
  AlertCircle,
  Trash2,
  Plus,
  Clock,
  IndianRupee,
  Home,
  Car,
  GraduationCap,
  Briefcase,
  Gem,
  Building,
  Wallet,
  CreditCard,
  BarChart3,
  PieChart as PieChartIcon,
  Table,
  ArrowRight,
  Info,
  CheckCircle2,
  Flame,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts'
import { useAuth } from '@/lib/auth/auth-context'

import type {
  LoanType,
  TenureType,
  AmortizationRow,
  PrepaymentResult,
  EligibilityResult,
  TaxBenefitResult,
  EMIValidationErrors,
  IncomeRange,
  CreditScoreRange,
} from '@/types/emi-calculator'

import {
  LOAN_TYPE_CONFIG,
  INCOME_RANGE_CONFIG,
  CREDIT_SCORE_CONFIG,
} from '@/types/emi-calculator'

import {
  calculateEMI,
  calculateEMIComplete,
  generateAmortizationSchedule,
  calculatePrepaymentImpact,
  calculateEligibility,
  calculateTaxBenefits,
  formatIndianCurrency,
  formatIndianNumber,
  formatTenure,
  sanitizeNumericInput,
  generateId,
  roundToTwo,
} from '@/lib/utils/emi-calculations'

// ============================================================================
// CONSTANTS
// ============================================================================

const CHART_COLORS = {
  principal: '#3b82f6',
  interest: '#f97316',
  balance: '#22c55e',
  emi: '#8b5cf6',
  savings: '#10b981',
}

const LOAN_TYPE_ICONS: Record<LoanType, React.ElementType> = {
  home_loan: Home,
  personal_loan: Wallet,
  car_loan: Car,
  business_loan: Briefcase,
  education_loan: GraduationCap,
  gold_loan: Gem,
  loan_against_property: Building,
  two_wheeler_loan: Car,
  consumer_durable_loan: CreditCard,
  overdraft: CreditCard,
}

const INCOME_RANGES = [
  { value: 'below_3L', label: 'Below ₹3 Lakhs' },
  { value: '3L_5L', label: '₹3-5 Lakhs' },
  { value: '5L_10L', label: '₹5-10 Lakhs' },
  { value: '10L_15L', label: '₹10-15 Lakhs' },
  { value: '15L_25L', label: '₹15-25 Lakhs' },
  { value: '25L_50L', label: '₹25-50 Lakhs' },
  { value: 'above_50L', label: 'Above ₹50 Lakhs' },
]

// ============================================================================
// TYPES
// ============================================================================

type TabType = 'calculator' | 'prepayment' | 'eligibility' | 'tax-benefit' | 'terminology'
type ViewType = 'chart' | 'table'

// Phone validation helper
const validatePhoneNumber = (phone: string): { isValid: boolean; formatted: string; error?: string } => {
  if (!phone || phone.trim() === '') {
    return { isValid: true, formatted: '', error: undefined }
  }

  const cleaned = phone.replace(/[^0-9+]/g, '')
  const hasCountryCode = cleaned.startsWith('+') || cleaned.length > 10

  if (!hasCountryCode) {
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      return { isValid: true, formatted: '+91' + cleaned }
    }
    return { isValid: false, formatted: cleaned, error: 'Please enter a valid 10-digit mobile number starting with 6-9' }
  }

  if (cleaned.startsWith('+91')) {
    const number = cleaned.slice(3)
    if (/^[6-9]\d{9}$/.test(number)) {
      return { isValid: true, formatted: cleaned }
    }
    return { isValid: false, formatted: cleaned, error: 'Invalid Indian mobile number' }
  }

  if (cleaned.startsWith('+')) {
    const withoutPlus = cleaned.slice(1)
    if (withoutPlus.length >= 8 && withoutPlus.length <= 15) {
      return { isValid: true, formatted: cleaned }
    }
    return { isValid: false, formatted: cleaned, error: 'Invalid international phone number' }
  }

  return { isValid: false, formatted: cleaned, error: 'Please include country code (e.g., +91 for India)' }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EMICalculatorWithCustomerCaptureEnhanced() {
  const { user } = useAuth()

  // ============================================================================
  // STATE - Core Calculator
  // ============================================================================
  const [principal, setPrincipal] = useState<string>('')
  const [interestRate, setInterestRate] = useState<string>('')
  const [tenure, setTenure] = useState<string>('')
  const [tenureType, setTenureType] = useState<TenureType>('years')
  const [loanType, setLoanType] = useState<LoanType>('personal_loan')
  const [processingFee, setProcessingFee] = useState<string>('')

  // Results
  const [emi, setEmi] = useState<number>(0)
  const [totalInterest, setTotalInterest] = useState<number>(0)
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [amortizationSchedule, setAmortizationSchedule] = useState<AmortizationRow[]>([])
  const [calculated, setCalculated] = useState(false)

  // ============================================================================
  // STATE - UI
  // ============================================================================
  const [activeTab, setActiveTab] = useState<TabType>('calculator')
  const [errors, setErrors] = useState<EMIValidationErrors>({})
  const [amortizationView, setAmortizationView] = useState<ViewType>('table')
  const [showYearlyView, setShowYearlyView] = useState(false)
  const [showAllAmortization, setShowAllAmortization] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)

  // ============================================================================
  // STATE - Customer Information
  // ============================================================================
  const [customerName, setCustomerName] = useState<string>('')
  const [customerPhone, setCustomerPhone] = useState<string>('')
  const [customerEmail, setCustomerEmail] = useState<string>('')
  const [customerIncomeRange, setCustomerIncomeRange] = useState<string>('')
  const [customerRequirements, setCustomerRequirements] = useState<string>('')
  const [internalNotes, setInternalNotes] = useState<string>('')
  const [hotLead, setHotLead] = useState(false)
  const [customerConsent, setCustomerConsent] = useState(false)

  // ============================================================================
  // STATE - Save & Share
  // ============================================================================
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [savedInquiryId, setSavedInquiryId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // ============================================================================
  // STATE - Prepayment Calculator
  // ============================================================================
  const [prepaymentAmount, setPrepaymentAmount] = useState<string>('')
  const [prepaymentType, setPrepaymentType] = useState<'reduce_emi' | 'reduce_tenure'>('reduce_tenure')
  const [prepaymentResult, setPrepaymentResult] = useState<PrepaymentResult | null>(null)

  // ============================================================================
  // STATE - Eligibility Calculator
  // ============================================================================
  const [monthlyIncome, setMonthlyIncome] = useState<string>('')
  const [existingEMIs, setExistingEMIs] = useState<string>('')
  const [age, setAge] = useState<string>('')
  const [creditScore, setCreditScore] = useState<CreditScoreRange | ''>('')
  const [employmentType, setEmploymentType] = useState<'salaried' | 'self_employed'>('salaried')
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult | null>(null)

  // ============================================================================
  // STATE - Tax Benefit Calculator
  // ============================================================================
  const [isFirstHomeLoan, setIsFirstHomeLoan] = useState(true)
  const [taxRegime, setTaxRegime] = useState<'old' | 'new'>('old')
  const [incomeSlabRate, setIncomeSlabRate] = useState<number>(30)
  const [taxBenefitResult, setTaxBenefitResult] = useState<TaxBenefitResult | null>(null)

  // Get loan config
  const loanConfig = useMemo(() => LOAN_TYPE_CONFIG[loanType], [loanType])

  // ============================================================================
  // HANDLERS - Core Calculator
  // ============================================================================

  const validateInputs = useCallback((): boolean => {
    const newErrors: EMIValidationErrors = {}

    const principalNum = sanitizeNumericInput(principal)
    const rateNum = sanitizeNumericInput(interestRate)
    const tenureNum = sanitizeNumericInput(tenure)

    if (!principal || principalNum <= 0) {
      newErrors.principal = 'Please enter a valid loan amount'
    } else if (principalNum < loanConfig.minAmount) {
      newErrors.principal = `Minimum amount is ${formatIndianCurrency(loanConfig.minAmount)}`
    } else if (principalNum > loanConfig.maxAmount) {
      newErrors.principal = `Maximum amount is ${formatIndianNumber(loanConfig.maxAmount)}`
    }

    if (interestRate === '' || rateNum < 0) {
      newErrors.interestRate = 'Please enter a valid interest rate'
    } else if (rateNum > 50) {
      newErrors.interestRate = 'Interest rate seems unusually high'
    }

    const tenureMonths = tenureType === 'years' ? tenureNum * 12 : tenureNum
    if (!tenure || tenureNum <= 0) {
      newErrors.tenure = 'Please enter a valid tenure'
    } else if (tenureMonths < loanConfig.minTenure) {
      newErrors.tenure = `Minimum tenure is ${formatTenure(loanConfig.minTenure)}`
    } else if (tenureMonths > loanConfig.maxTenure) {
      newErrors.tenure = `Maximum tenure is ${formatTenure(loanConfig.maxTenure)}`
    }

    const feeNum = sanitizeNumericInput(processingFee)
    if (processingFee && (feeNum < 0 || feeNum > 10)) {
      newErrors.processingFee = 'Processing fee should be between 0% and 10%'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [principal, interestRate, tenure, tenureType, processingFee, loanConfig])

  const handleCalculate = useCallback(() => {
    if (!validateInputs()) return

    setIsCalculating(true)

    const P = sanitizeNumericInput(principal)
    const r = sanitizeNumericInput(interestRate)
    const n = tenureType === 'years' ? sanitizeNumericInput(tenure) * 12 : sanitizeNumericInput(tenure)
    const fee = sanitizeNumericInput(processingFee) || 0

    const result = calculateEMIComplete({
      principalAmount: P,
      interestRate: r,
      tenureMonths: n,
      processingFeePercentage: fee,
    })

    setEmi(result.monthlyEMI)
    setTotalInterest(result.totalInterest)
    setTotalAmount(result.totalAmount)
    setCalculated(true)

    // Clear stale results when recalculating
    setPrepaymentResult(null)
    setEligibilityResult(null)
    setTaxBenefitResult(null)
    setSavedInquiryId(null) // Clear stale inquiry to prevent sharing outdated data

    const schedule = generateAmortizationSchedule(P, r, n)
    setAmortizationSchedule(schedule.rows)

    setIsCalculating(false)
  }, [principal, interestRate, tenure, tenureType, processingFee, validateInputs])

  const handleReset = useCallback(() => {
    setPrincipal('')
    setInterestRate('')
    setTenure('')
    setProcessingFee('')
    setEmi(0)
    setTotalInterest(0)
    setTotalAmount(0)
    setAmortizationSchedule([])
    setCalculated(false)
    setErrors({})
    setPrepaymentResult(null)
    setEligibilityResult(null)
    setTaxBenefitResult(null)
    setSavedInquiryId(null)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setCustomerIncomeRange('')
    setCustomerRequirements('')
    setInternalNotes('')
    setHotLead(false)
    setCustomerConsent(false)
    setShowAllAmortization(false)
  }, [])

  // ============================================================================
  // HANDLERS - Save Inquiry
  // ============================================================================

  const saveInquiry = async () => {
    if (saving) return // Prevent double-click

    if (!calculated) {
      setErrors({ submit: 'Please calculate EMI first' })
      return
    }

    // Validate email if provided
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setErrors({ submit: 'Please enter a valid email address' })
      return
    }

    // Validate phone if provided
    if (customerPhone) {
      const phoneResult = validatePhoneNumber(customerPhone)
      if (!phoneResult.isValid) {
        setErrors({ submit: phoneResult.error || 'Invalid phone number' })
        return
      }
    }

    // Validate consent when personal data is provided
    if ((customerPhone || customerEmail) && !customerConsent) {
      setErrors({ submit: 'Customer consent is required when collecting personal information (DPDPA Compliance)' })
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const method = savedInquiryId ? 'PUT' : 'POST'
      const url = savedInquiryId ? `/api/emi-inquiries/${savedInquiryId}` : '/api/emi-inquiries'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principal_amount: sanitizeNumericInput(principal),
          interest_rate: sanitizeNumericInput(interestRate),
          tenure_months: tenureType === 'years' ? sanitizeNumericInput(tenure) * 12 : sanitizeNumericInput(tenure),
          monthly_emi: emi,
          total_interest: totalInterest,
          total_amount: totalAmount,
          loan_type: loanType,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          customer_phone: customerPhone ? validatePhoneNumber(customerPhone).formatted || customerPhone : null,
          customer_income_range: customerIncomeRange || null,
          customer_requirements: customerRequirements || null,
          internal_notes: internalNotes || null,
          hot_lead: hotLead,
          customer_consent_given: customerConsent,
          inquiry_source: 'emi_calculator',
          meeting_type: 'online'
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save inquiry')
      }

      setSavedInquiryId(data.inquiry?.id)
      setSuccessMessage('Inquiry saved successfully!')
      setShowCustomerForm(false)

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: unknown) {
      console.error('Error saving inquiry:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save inquiry' })
    } finally {
      setSaving(false)
    }
  }

  // ============================================================================
  // HANDLERS - Share
  // ============================================================================

  const shareViaWhatsApp = async () => {
    if (!savedInquiryId) {
      setErrors({ submit: 'Please save the inquiry first' })
      return
    }

    if (!customerPhone) {
      setErrors({ customerPhone: 'Please enter customer phone number' })
      return
    }

    setSharing(true)

    try {
      const response = await fetch(`/api/emi-inquiries/${savedInquiryId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          share_method: 'whatsapp',
          recipient_phone: customerPhone,
          recipient_name: customerName,
          recipient_email: customerEmail,
          include_amortization: true
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to share')
      }

      if (data.whatsapp_url) {
        const win = window.open(data.whatsapp_url, '_blank')
        if (!win) {
          // Popup blocked — fall back to direct navigation
          window.location.href = data.whatsapp_url
        }
      }

      setSuccessMessage('Shared via WhatsApp!')
      setShowShareModal(false)

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: unknown) {
      console.error('Error sharing:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to share' })
    } finally {
      setSharing(false)
    }
  }

  const handleDirectWhatsAppShare = useCallback(() => {
    if (!calculated) return

    const message = `*EMI Calculator Results*\n\n` +
      `💰 Loan Amount: ${formatIndianCurrency(sanitizeNumericInput(principal))}\n` +
      `📊 Interest Rate: ${interestRate}% p.a.\n` +
      `⏱️ Tenure: ${formatTenure(tenureType === 'years' ? sanitizeNumericInput(tenure) * 12 : sanitizeNumericInput(tenure))}\n\n` +
      `📅 Monthly EMI: ${formatIndianCurrency(emi)}\n` +
      `💸 Total Interest: ${formatIndianCurrency(totalInterest)}\n` +
      `💵 Total Amount: ${formatIndianCurrency(totalAmount)}\n\n` +
      `Calculated via Loanz360 EMI Calculator`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    const win = window.open(whatsappUrl, '_blank')
    if (!win) {
      window.location.href = whatsappUrl
    }
  }, [calculated, principal, interestRate, tenure, tenureType, emi, totalInterest, totalAmount])

  // ============================================================================
  // HANDLERS - Prepayment Calculator
  // ============================================================================

  const handlePrepaymentCalculate = useCallback(() => {
    if (!calculated || !prepaymentAmount) return

    const prepaymentNum = sanitizeNumericInput(prepaymentAmount)
    const currentOutstanding = sanitizeNumericInput(principal)
    const remainingTenure = tenureType === 'years' ? sanitizeNumericInput(tenure) * 12 : sanitizeNumericInput(tenure)

    const result = calculatePrepaymentImpact({
      currentOutstanding,
      currentEMI: emi,
      remainingTenureMonths: remainingTenure,
      interestRate: sanitizeNumericInput(interestRate),
      prepaymentAmount: prepaymentNum,
      prepaymentType,
    })

    setPrepaymentResult(result)
  }, [calculated, prepaymentAmount, principal, tenure, tenureType, emi, interestRate, prepaymentType])

  // ============================================================================
  // HANDLERS - Eligibility Calculator
  // ============================================================================

  const handleEligibilityCalculate = useCallback(() => {
    if (!monthlyIncome || !age) return

    const result = calculateEligibility({
      monthlyIncome: sanitizeNumericInput(monthlyIncome),
      existingEMIs: sanitizeNumericInput(existingEMIs) || 0,
      age: sanitizeNumericInput(age),
      loanType,
      interestRate: sanitizeNumericInput(interestRate) || loanConfig.minRate,
      creditScore: creditScore || undefined,
      employmentType,
    })

    setEligibilityResult(result)
  }, [monthlyIncome, age, existingEMIs, loanType, interestRate, creditScore, employmentType, loanConfig])

  // ============================================================================
  // HANDLERS - Tax Benefit Calculator
  // ============================================================================

  const handleTaxBenefitCalculate = useCallback(() => {
    if (!calculated) return

    const result = calculateTaxBenefits({
      loanType,
      principalAmount: sanitizeNumericInput(principal),
      interestRate: sanitizeNumericInput(interestRate),
      tenureMonths: tenureType === 'years' ? sanitizeNumericInput(tenure) * 12 : sanitizeNumericInput(tenure),
      financialYear: (() => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1 // 1-indexed
        if (currentMonth >= 4) {
          return `${currentYear}-${(currentYear + 1).toString().slice(2)}`
        }
        return `${currentYear - 1}-${currentYear.toString().slice(2)}`
      })(),
      isFirstHomeLoan,
      isPropertyUnderConstruction: false,
      borrowerType: 'individual',
      taxRegime,
      incomeSlabRate,
    })

    setTaxBenefitResult(result)
  }, [calculated, loanType, principal, interestRate, tenure, tenureType, isFirstHomeLoan, taxRegime, incomeSlabRate])

  // ============================================================================
  // COMPUTED DATA
  // ============================================================================

  const pieData = useMemo(() => {
    if (!calculated) return []
    return [
      { name: 'Principal Amount', value: sanitizeNumericInput(principal), color: CHART_COLORS.principal },
      { name: 'Total Interest', value: totalInterest, color: CHART_COLORS.interest },
    ]
  }, [calculated, principal, totalInterest])

  const yearlyData = useMemo(() => {
    if (amortizationSchedule.length === 0) return []

    const yearMap = new Map<number, { year: number; emi: number; principal: number; interest: number; balance: number }>()

    for (const row of amortizationSchedule) {
      if (!yearMap.has(row.year)) {
        yearMap.set(row.year, { year: row.year, emi: 0, principal: 0, interest: 0, balance: row.balance })
      }
      const entry = yearMap.get(row.year)!
      entry.emi += row.emi
      entry.principal += row.principalPaid
      entry.interest += row.interestPaid
      entry.balance = row.balance
    }

    return Array.from(yearMap.values())
  }, [amortizationSchedule])

  const balanceTrendData = useMemo(() => {
    if (amortizationSchedule.length === 0) return []

    const step = Math.max(1, Math.floor(amortizationSchedule.length / 60))
    return amortizationSchedule
      .filter((_, i) => i % step === 0 || i === amortizationSchedule.length - 1)
      .map((row) => ({
        month: row.month,
        balance: roundToTwo(row.balance),
        principal: roundToTwo(row.cumulativePrincipal),
        interest: roundToTwo(row.cumulativeInterest),
      }))
  }, [amortizationSchedule])

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderLoanTypeIcon = (type: LoanType) => {
    const Icon = LOAN_TYPE_ICONS[type] || Calculator
    return <Icon className="w-5 h-5" />
  }

  const renderInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    error?: string,
    prefix?: string,
    suffix?: string,
    type: 'number' | 'text' | 'email' | 'tel' = 'number',
    ariaLabel?: string
  ) => (
    <div>
      <label className="block text-sm font-semibold text-gray-300 mb-2">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{prefix}</span>
        )}
        <input
          type={type}
          inputMode={type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={type === 'number' ? (e) => {
            if (['e', 'E', '+', '-'].includes(e.key)) {
              e.preventDefault()
            }
          } : undefined}
          placeholder={placeholder}
          aria-label={ariaLabel || label}
          aria-invalid={!!error}
          className={`w-full px-4 py-3 bg-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 transition-colors ${
            prefix ? 'pl-8' : ''
          } ${suffix ? 'pr-12' : ''} ${error ? 'border-red-500' : 'border-white/20 hover:border-white/30'}`}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">{suffix}</span>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-400 flex items-center gap-1" role="alert">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  )

  // ============================================================================
  // TABS CONFIG
  // ============================================================================

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'calculator', label: 'Calculator', icon: Calculator },
    { id: 'prepayment', label: 'Prepayment', icon: PiggyBank },
    { id: 'eligibility', label: 'Eligibility', icon: Target },
    { id: 'tax-benefit', label: 'Tax Benefit', icon: FileText },
    { id: 'terminology', label: 'Learn', icon: BookOpen },
  ]

  // Filter tax benefit tab if not home/education loan
  const visibleTabs = tabs.filter(tab => {
    if (tab.id === 'tax-benefit') {
      return loanType === 'home_loan' || loanType === 'education_loan'
    }
    return true
  })

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-black p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 md:p-4 rounded-xl shadow-lg">
                <Calculator className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold font-poppins text-white">EMI Calculator</h1>
                <p className="text-gray-400 text-sm md:text-base mt-1">
                  Calculate EMI, capture leads, and track customer inquiries
                </p>
              </div>
            </div>
            {savedInquiryId && (
              <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm">Inquiry Saved</span>
              </div>
            )}
          </div>
        </header>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-6 text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {successMessage}
          </div>
        )}

        {/* Tabs Navigation */}
        <nav className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 mb-6 overflow-x-auto">
          <div className="flex border-b border-white/10 min-w-max">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm md:text-base">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 md:p-6">
            {/* Calculator Tab */}
            {activeTab === 'calculator' && (
              <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                  {/* Input Form */}
                  <div className="space-y-4 md:space-y-6">
                    {/* Loan Type */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Loan Type
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(LOAN_TYPE_CONFIG).slice(0, 6).map(([key, config]) => (
                          <button
                            key={key}
                            onClick={() => setLoanType(key as LoanType)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                              loanType === key
                                ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
                            }`}
                          >
                            {renderLoanTypeIcon(key as LoanType)}
                            <span className="truncate">{config.shortLabel}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Principal */}
                    {renderInput(
                      'Loan Amount',
                      principal,
                      setPrincipal,
                      'e.g., 5000000',
                      errors.principal,
                      '₹'
                    )}

                    {/* Interest Rate */}
                    {renderInput(
                      'Interest Rate (Annual)',
                      interestRate,
                      setInterestRate,
                      'e.g., 8.5',
                      errors.interestRate,
                      undefined,
                      '%'
                    )}

                    {/* Tenure */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Loan Tenure
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={tenure}
                            onChange={(e) => setTenure(e.target.value)}
                            onKeyDown={(e) => {
                              if (['e', 'E', '+', '-'].includes(e.key)) {
                                e.preventDefault()
                              }
                            }}
                            placeholder="e.g., 20"
                            className={`w-full px-4 py-3 bg-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 ${
                              errors.tenure ? 'border-red-500' : 'border-white/20'
                            }`}
                          />
                        </div>
                        <select
                          value={tenureType}
                          onChange={(e) => setTenureType(e.target.value as TenureType)}
                          className="px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white min-w-[100px]"
                        >
                          <option value="years">Years</option>
                          <option value="months">Months</option>
                        </select>
                      </div>
                      {errors.tenure && (
                        <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.tenure}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleCalculate}
                        disabled={isCalculating}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 md:py-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                      >
                        {isCalculating ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Calculator className="w-5 h-5" />
                        )}
                        {isCalculating ? 'Calculating...' : 'Calculate EMI'}
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/20 rounded-lg transition-colors"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Results */}
                  <div>
                    {calculated ? (
                      <div className="space-y-4">
                        {/* Monthly EMI */}
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 md:p-6 text-white shadow-lg border border-orange-400/50">
                          <div className="text-sm font-medium opacity-90 mb-1">Monthly EMI</div>
                          <div className="text-3xl md:text-4xl font-bold">
                            {formatIndianCurrency(emi)}
                          </div>
                        </div>

                        {/* Secondary Stats */}
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-white/10">
                            <div className="text-xs md:text-sm font-medium text-gray-400 mb-1">Principal</div>
                            <div className="text-lg md:text-xl font-bold text-white">
                              {formatIndianNumber(sanitizeNumericInput(principal))}
                            </div>
                          </div>
                          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-orange-500/30">
                            <div className="text-xs md:text-sm font-medium text-gray-400 mb-1">Total Interest</div>
                            <div className="text-lg md:text-xl font-bold text-orange-400">
                              {formatIndianNumber(totalInterest)}
                            </div>
                          </div>
                        </div>

                        {/* Total Amount */}
                        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-white/10">
                          <div className="text-xs md:text-sm font-medium text-gray-400 mb-1">Total Amount Payable</div>
                          <div className="text-xl md:text-2xl font-bold text-white">
                            {formatIndianCurrency(totalAmount)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Interest is {roundToTwo((totalInterest / sanitizeNumericInput(principal)) * 100)}% of principal
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setShowCustomerForm(!showCustomerForm)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            <Save className="w-5 h-5" />
                            {savedInquiryId ? 'Update' : 'Save'}
                          </button>
                          <button
                            onClick={() => savedInquiryId ? setShowShareModal(true) : handleDirectWhatsAppShare()}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            <Share2 className="w-5 h-5" />
                            Share
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 min-h-[300px]">
                        <div className="text-center text-gray-500 p-6">
                          <TrendingUp className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">Enter loan details to see results</p>
                          <p className="text-sm mt-2 text-gray-600">
                            Fill in the form and click Calculate EMI
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Information Form */}
                {showCustomerForm && (
                  <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-orange-500" />
                        Customer Information
                      </h2>
                      <button
                        onClick={() => setShowCustomerForm(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          <User className="w-4 h-4 inline mr-1" />
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter customer name"
                          className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          <Phone className="w-4 h-4 inline mr-1" />
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="e.g., 9876543210"
                          className={`w-full px-4 py-3 bg-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 ${
                            errors.customerPhone ? 'border-red-500' : 'border-white/20'
                          }`}
                        />
                        {errors.customerPhone && (
                          <p className="mt-1 text-sm text-red-400">{errors.customerPhone}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          <Mail className="w-4 h-4 inline mr-1" />
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="Enter email address"
                          pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                          aria-label="Customer email address"
                          className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                        />
                        {customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) && (
                          <p className="mt-1 text-xs text-amber-400">Please enter a valid email address</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          <DollarSign className="w-4 h-4 inline mr-1" />
                          Annual Income Range
                        </label>
                        <select
                          value={customerIncomeRange}
                          onChange={(e) => setCustomerIncomeRange(e.target.value)}
                          className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                        >
                          <option value="">Select income range</option>
                          {INCOME_RANGES.map(range => (
                            <option key={range.value} value={range.value}>{range.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          <MessageSquare className="w-4 h-4 inline mr-1" />
                          Customer Requirements
                        </label>
                        <textarea
                          value={customerRequirements}
                          onChange={(e) => setCustomerRequirements(e.target.value.slice(0, 500))}
                          placeholder="What is the customer looking for?"
                          rows={2}
                          maxLength={500}
                          aria-label="Customer requirements"
                          className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                        />
                        <p className="text-xs text-gray-600 mt-1 text-right">{customerRequirements.length}/500</p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Internal Notes (Not visible to customer)
                        </label>
                        <textarea
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value.slice(0, 1000))}
                          placeholder="Your private notes about this customer"
                          rows={2}
                          maxLength={1000}
                          aria-label="Internal notes about customer"
                          className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                        />
                        <p className="text-xs text-gray-600 mt-1 text-right">{internalNotes.length}/1000</p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={customerConsent}
                            onChange={(e) => setCustomerConsent(e.target.checked)}
                            aria-label="Customer consent for data processing"
                            className="w-5 h-5 rounded border-white/20 bg-black text-orange-500 focus:ring-2 focus:ring-orange-500"
                          />
                          <span className="text-sm font-semibold text-gray-300">
                            Customer has consented to data collection and processing (DPDPA Compliance)
                          </span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-7">Required when collecting personal information like phone or email</p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hotLead}
                            onChange={(e) => setHotLead(e.target.checked)}
                            aria-label="Mark as hot lead"
                            className="w-5 h-5 rounded border-white/20 bg-black text-orange-500 focus:ring-2 focus:ring-orange-500"
                          />
                          <span className="text-sm font-semibold text-gray-300 flex items-center gap-1">
                            <Flame className="w-4 h-4 text-orange-500" />
                            Mark as Hot Lead
                          </span>
                        </label>
                      </div>
                    </div>

                    {errors.submit && (
                      <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4 text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {errors.submit}
                      </div>
                    )}

                    <button
                      onClick={saveInquiry}
                      disabled={saving}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Save Customer Inquiry
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Charts - Only show when calculated */}
                {calculated && (
                  <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 md:p-6 border border-white/10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 text-white">
                        <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
                        Payment Breakdown
                      </h3>
                      <div className="flex rounded-lg overflow-hidden border border-white/20">
                        <button
                          onClick={() => setAmortizationView('chart')}
                          className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
                            amortizationView === 'chart' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-300'
                          }`}
                        >
                          <PieChartIcon className="w-4 h-4" />
                          Chart
                        </button>
                        <button
                          onClick={() => setAmortizationView('table')}
                          className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
                            amortizationView === 'table' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-300'
                          }`}
                        >
                          <Table className="w-4 h-4" />
                          Table
                        </button>
                      </div>
                    </div>

                    {amortizationView === 'chart' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Pie Chart */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-400 mb-4">Principal vs Interest</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => formatIndianCurrency(value)}
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                              />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Balance Trend */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-400 mb-4">Balance Over Time</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={balanceTrendData}>
                              <defs>
                                <linearGradient id="balanceGradientEmp" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={CHART_COLORS.principal} stopOpacity={0.3} />
                                  <stop offset="95%" stopColor={CHART_COLORS.principal} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis
                                dataKey="month"
                                stroke="#9ca3af"
                                tickFormatter={(v) => `M${v}`}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis
                                stroke="#9ca3af"
                                tickFormatter={(v) => formatIndianNumber(v)}
                                tick={{ fontSize: 12 }}
                              />
                              <Tooltip
                                formatter={(value: number) => formatIndianCurrency(value)}
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                              />
                              <Area
                                type="monotone"
                                dataKey="balance"
                                stroke={CHART_COLORS.principal}
                                fill="url(#balanceGradientEmp)"
                                name="Outstanding Balance"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      /* Amortization Table */
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showYearlyView}
                              onChange={(e) => setShowYearlyView(e.target.checked)}
                              className="rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500"
                            />
                            Show yearly summary
                          </label>
                          <span className="text-sm text-gray-500">
                            {amortizationSchedule.length} payments
                          </span>
                        </div>

                        <div className="overflow-x-auto max-h-96 rounded-lg border border-white/10">
                          <table className="w-full text-sm">
                            <thead className="bg-white/10 sticky top-0">
                              <tr>
                                <th className="px-3 md:px-4 py-3 text-left font-semibold text-gray-300">
                                  {showYearlyView ? 'Year' : 'Month'}
                                </th>
                                <th className="px-3 md:px-4 py-3 text-right font-semibold text-gray-300">EMI</th>
                                <th className="px-3 md:px-4 py-3 text-right font-semibold text-gray-300">Principal</th>
                                <th className="px-3 md:px-4 py-3 text-right font-semibold text-gray-300">Interest</th>
                                <th className="px-3 md:px-4 py-3 text-right font-semibold text-gray-300">Balance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {(showYearlyView ? yearlyData : (showAllAmortization ? amortizationSchedule : amortizationSchedule.slice(0, 24))).map((row) => (
                                <tr
                                  key={showYearlyView ? (row as typeof yearlyData[0]).year : (row as AmortizationRow).month}
                                  className="hover:bg-white/5 transition-colors"
                                >
                                  <td className="px-3 md:px-4 py-2 text-gray-300">
                                    {showYearlyView ? `Year ${(row as typeof yearlyData[0]).year}` : (row as AmortizationRow).month}
                                  </td>
                                  <td className="px-3 md:px-4 py-2 text-right text-gray-300">
                                    {formatIndianCurrency(showYearlyView ? (row as typeof yearlyData[0]).emi : (row as AmortizationRow).emi)}
                                  </td>
                                  <td className="px-3 md:px-4 py-2 text-right text-blue-400 font-medium">
                                    {formatIndianCurrency(showYearlyView ? (row as typeof yearlyData[0]).principal : (row as AmortizationRow).principalPaid)}
                                  </td>
                                  <td className="px-3 md:px-4 py-2 text-right text-orange-400 font-medium">
                                    {formatIndianCurrency(showYearlyView ? (row as typeof yearlyData[0]).interest : (row as AmortizationRow).interestPaid)}
                                  </td>
                                  <td className="px-3 md:px-4 py-2 text-right text-gray-200 font-medium">
                                    {formatIndianCurrency((row as typeof yearlyData[0]).balance)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {!showYearlyView && amortizationSchedule.length > 24 && (
                            <div className="p-3 text-center border-t border-white/10">
                              <button
                                onClick={() => setShowAllAmortization(!showAllAmortization)}
                                className="text-sm text-orange-400 hover:text-orange-300 font-medium"
                              >
                                {showAllAmortization ? 'Show Less' : `Show All ${amortizationSchedule.length} Payments`}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Prepayment Tab */}
            {activeTab === 'prepayment' && (
              <div className="space-y-6">
                {!calculated ? (
                  <div className="text-center py-12">
                    <PiggyBank className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">Please calculate your EMI first</p>
                    <button
                      onClick={() => setActiveTab('calculator')}
                      className="mt-4 text-orange-400 hover:text-orange-300"
                    >
                      Go to Calculator
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Form */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">Prepayment Calculator</h3>
                      <p className="text-sm text-gray-400">
                        See how much you can save by making a prepayment
                      </p>

                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Current EMI</span>
                            <p className="text-white font-semibold">{formatIndianCurrency(emi)}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Outstanding</span>
                            <p className="text-white font-semibold">{formatIndianNumber(sanitizeNumericInput(principal))}</p>
                          </div>
                        </div>
                      </div>

                      {renderInput(
                        'Prepayment Amount',
                        prepaymentAmount,
                        setPrepaymentAmount,
                        'e.g., 500000',
                        undefined,
                        '₹'
                      )}

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Prepayment Option
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setPrepaymentType('reduce_tenure')}
                            className={`p-3 rounded-lg border text-sm transition-colors ${
                              prepaymentType === 'reduce_tenure'
                                ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                                : 'bg-white/5 border-white/10 text-gray-300'
                            }`}
                          >
                            <Clock className="w-5 h-5 mx-auto mb-1" />
                            Reduce Tenure
                          </button>
                          <button
                            onClick={() => setPrepaymentType('reduce_emi')}
                            className={`p-3 rounded-lg border text-sm transition-colors ${
                              prepaymentType === 'reduce_emi'
                                ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                                : 'bg-white/5 border-white/10 text-gray-300'
                            }`}
                          >
                            <IndianRupee className="w-5 h-5 mx-auto mb-1" />
                            Reduce EMI
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handlePrepaymentCalculate}
                        disabled={!prepaymentAmount}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
                      >
                        <PiggyBank className="w-5 h-5 inline mr-2" />
                        Calculate Savings
                      </button>
                    </div>

                    {/* Results */}
                    <div>
                      {prepaymentResult ? (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                            <div className="text-sm font-medium opacity-90 mb-1">Total Interest Saved</div>
                            <div className="text-3xl font-bold">
                              {formatIndianCurrency(prepaymentResult.interestSaved)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <div className="text-sm text-gray-400 mb-1">New EMI</div>
                              <div className="text-xl font-bold text-white">
                                {formatIndianCurrency(prepaymentResult.newEMI)}
                              </div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <div className="text-sm text-gray-400 mb-1">New Tenure</div>
                              <div className="text-xl font-bold text-white">
                                {formatTenure(prepaymentResult.newTenureMonths)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center bg-white/5 rounded-xl border border-white/10 min-h-[300px]">
                          <div className="text-center text-gray-500 p-6">
                            <PiggyBank className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">Enter prepayment amount</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Other tabs would continue similarly - Eligibility, Tax Benefit, Terminology */}
            {/* For brevity, showing simplified versions */}

            {activeTab === 'eligibility' && (
              <div className="space-y-6">
                {/* Eligibility Input Form */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-500" />
                    Check Loan Eligibility
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Monthly Income */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Monthly Income</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="number"
                          value={monthlyIncome}
                          onChange={(e) => setMonthlyIncome(e.target.value)}
                          onKeyDown={(e) => {
                            if (['e', 'E', '+', '-'].includes(e.key)) {
                              e.preventDefault()
                            }
                          }}
                          placeholder="e.g. 50000"
                          className="w-full pl-9 pr-4 py-2.5 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                        />
                      </div>
                    </div>

                    {/* Existing EMIs */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Existing EMIs (Monthly)</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="number"
                          value={existingEMIs}
                          onChange={(e) => setExistingEMIs(e.target.value)}
                          onKeyDown={(e) => {
                            if (['e', 'E', '+', '-'].includes(e.key)) {
                              e.preventDefault()
                            }
                          }}
                          placeholder="0"
                          className="w-full pl-9 pr-4 py-2.5 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                        />
                      </div>
                    </div>

                    {/* Age */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Age (Years)</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        onKeyDown={(e) => {
                          if (['e', 'E', '+', '-'].includes(e.key)) {
                            e.preventDefault()
                          }
                        }}
                        placeholder="e.g. 30"
                        min={18}
                        max={65}
                        className="w-full px-4 py-2.5 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
                      />
                    </div>

                    {/* Credit Score */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Credit Score Range</label>
                      <select
                        value={creditScore}
                        onChange={(e) => setCreditScore(e.target.value as CreditScoreRange)}
                        className="w-full px-4 py-2.5 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                      >
                        <option value="">Select credit score range</option>
                        {Object.entries(CREDIT_SCORE_CONFIG).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Employment Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Employment Type</label>
                      <select
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value as 'salaried' | 'self_employed')}
                        className="w-full px-4 py-2.5 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                      >
                        <option value="salaried">Salaried</option>
                        <option value="self_employed">Self Employed</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleEligibilityCalculate}
                    disabled={!monthlyIncome || !age}
                    className="mt-4 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    <Target className="w-4 h-4" />
                    Check Eligibility
                  </button>
                </div>

                {/* Eligibility Results */}
                {eligibilityResult && (
                  <div className="space-y-4">
                    {/* Main Result Card */}
                    <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl p-6 border border-orange-500/30">
                      <h4 className="text-lg font-bold text-white mb-4">Eligibility Summary</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-black/30 rounded-lg p-4 text-center">
                          <p className="text-xs text-gray-400 mb-1">Max Loan Amount</p>
                          <p className="text-2xl font-bold text-orange-500">{formatIndianCurrency(eligibilityResult.maxLoanAmount)}</p>
                        </div>
                        <div className="bg-black/30 rounded-lg p-4 text-center">
                          <p className="text-xs text-gray-400 mb-1">Max Affordable EMI</p>
                          <p className="text-2xl font-bold text-green-400">{formatIndianCurrency(eligibilityResult.maxEMIAffordable)}</p>
                        </div>
                        <div className="bg-black/30 rounded-lg p-4 text-center">
                          <p className="text-xs text-gray-400 mb-1">Suggested Tenure</p>
                          <p className="text-2xl font-bold text-blue-400">{Math.floor(eligibilityResult.suggestedTenure / 12)}Y {eligibilityResult.suggestedTenure % 12}M</p>
                        </div>
                      </div>
                    </div>

                    {/* Factors */}
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                      <h4 className="text-sm font-semibold text-gray-300 mb-3">Assessment Factors</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-sm text-gray-400">Income-based Max</span>
                          <span className="text-sm font-medium text-white">{formatIndianCurrency(eligibilityResult.factors.incomeBasedMax)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-sm text-gray-400">Age-based Max</span>
                          <span className="text-sm font-medium text-white">{formatIndianCurrency(eligibilityResult.factors.ageBasedMax)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-sm text-gray-400">FOIR Used</span>
                          <span className="text-sm font-medium text-white">{(eligibilityResult.foirUsed * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-sm text-gray-400">Credit Score Impact</span>
                          <span className="text-sm font-medium text-white">{eligibilityResult.factors.creditScoreImpact}</span>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations & Warnings */}
                    {eligibilityResult.recommendations.length > 0 && (
                      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                          <Info className="w-4 h-4" /> Recommendations
                        </h4>
                        <ul className="space-y-1">
                          {eligibilityResult.recommendations.map((rec, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {eligibilityResult.warnings.length > 0 && (
                      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                        <h4 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" /> Warnings
                        </h4>
                        <ul className="space-y-1">
                          {eligibilityResult.warnings.map((warn, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                              {warn}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tax-benefit' && (
              <div className="space-y-6">
                {/* Tax Benefit Input */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-500" />
                    Tax Benefit Calculator
                  </h3>

                  {!calculated ? (
                    <div className="text-center py-8">
                      <Calculator className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400">Please calculate EMI first in the Calculator tab to see tax benefits</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {/* Tax Regime */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Tax Regime</label>
                          <select
                            value={taxRegime}
                            onChange={(e) => setTaxRegime(e.target.value as 'old' | 'new')}
                            className="w-full px-4 py-2.5 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                          >
                            <option value="old">Old Regime</option>
                            <option value="new">New Regime</option>
                          </select>
                        </div>

                        {/* Income Slab Rate */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Tax Slab Rate (%)</label>
                          <select
                            value={incomeSlabRate}
                            onChange={(e) => setIncomeSlabRate(Number(e.target.value))}
                            className="w-full px-4 py-2.5 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                          >
                            <option value={5}>5%</option>
                            <option value={10}>10%</option>
                            <option value={15}>15%</option>
                            <option value={20}>20%</option>
                            <option value={25}>25%</option>
                            <option value={30}>30%</option>
                          </select>
                        </div>

                        {/* First Home Loan */}
                        {loanType === 'home_loan' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">First Home Loan?</label>
                            <select
                              value={isFirstHomeLoan ? 'yes' : 'no'}
                              onChange={(e) => setIsFirstHomeLoan(e.target.value === 'yes')}
                              className="w-full px-4 py-2.5 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                            >
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleTaxBenefitCalculate}
                        className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Calculate Tax Benefits
                      </button>
                    </>
                  )}
                </div>

                {/* Tax Benefit Results */}
                {taxBenefitResult && (
                  <div className="space-y-4">
                    {/* Total Savings Card */}
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-6 border border-green-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-bold text-white">Total Annual Tax Benefit</h4>
                        <span className="text-3xl font-bold text-green-400">{formatIndianCurrency(taxBenefitResult.totalTaxBenefit)}</span>
                      </div>
                      <p className="text-sm text-gray-400">
                        Effective interest rate after tax benefit: <span className="text-green-400 font-medium">{taxBenefitResult.effectiveInterestRate.toFixed(2)}%</span>
                      </p>
                    </div>

                    {/* Section-wise Breakdown */}
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                      <h4 className="text-sm font-semibold text-gray-300 mb-4">Section-wise Breakdown</h4>
                      <div className="space-y-3">
                        {/* Section 80C */}
                        {taxBenefitResult.section80C.eligible && (
                          <div className="flex items-center justify-between py-3 px-4 bg-black/30 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-white">Section 80C (Principal)</p>
                              <p className="text-xs text-gray-400">Max: {formatIndianCurrency(taxBenefitResult.section80C.maxDeduction)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-orange-400">{formatIndianCurrency(taxBenefitResult.section80C.actualDeduction)}</p>
                              <p className="text-xs text-green-400">Tax saved: {formatIndianCurrency(taxBenefitResult.section80C.taxSaved)}</p>
                            </div>
                          </div>
                        )}

                        {/* Section 24(b) */}
                        {taxBenefitResult.section24b.eligible && (
                          <div className="flex items-center justify-between py-3 px-4 bg-black/30 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-white">Section 24(b) (Interest)</p>
                              <p className="text-xs text-gray-400">Max: {formatIndianCurrency(taxBenefitResult.section24b.maxDeduction)}</p>
                              {taxBenefitResult.section24b.note && (
                                <p className="text-xs text-yellow-400 mt-1">{taxBenefitResult.section24b.note}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-orange-400">{formatIndianCurrency(taxBenefitResult.section24b.actualDeduction)}</p>
                              <p className="text-xs text-green-400">Tax saved: {formatIndianCurrency(taxBenefitResult.section24b.taxSaved)}</p>
                            </div>
                          </div>
                        )}

                        {/* Section 80EE */}
                        {taxBenefitResult.section80EE?.eligible && (
                          <div className="flex items-center justify-between py-3 px-4 bg-black/30 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-white">Section 80EE (First-time Buyers)</p>
                              <p className="text-xs text-gray-400">Max: {formatIndianCurrency(taxBenefitResult.section80EE.maxDeduction)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-orange-400">{formatIndianCurrency(taxBenefitResult.section80EE.actualDeduction)}</p>
                              <p className="text-xs text-green-400">Tax saved: {formatIndianCurrency(taxBenefitResult.section80EE.taxSaved)}</p>
                            </div>
                          </div>
                        )}

                        {/* Section 80EEA */}
                        {taxBenefitResult.section80EEA?.eligible && (
                          <div className="flex items-center justify-between py-3 px-4 bg-black/30 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-white">Section 80EEA (Affordable Housing)</p>
                              <p className="text-xs text-gray-400">Max: {formatIndianCurrency(taxBenefitResult.section80EEA.maxDeduction)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-orange-400">{formatIndianCurrency(taxBenefitResult.section80EEA.actualDeduction)}</p>
                              <p className="text-xs text-green-400">Tax saved: {formatIndianCurrency(taxBenefitResult.section80EEA.taxSaved)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tax Regime Note */}
                    {taxRegime === 'new' && (
                      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                        <p className="text-sm text-yellow-400 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          Under the New Tax Regime, most deductions under Section 80C and 80EE/80EEA are not available. Only Section 24(b) deduction up to Rs. 2 lakhs applies for self-occupied property.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'terminology' && (
              <div className="prose prose-invert max-w-none">
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
                  <h3 className="text-xl font-bold text-white mb-4">What is EMI?</h3>
                  <p className="text-gray-300">
                    EMI (Equated Monthly Installment) is a fixed payment amount made by a borrower
                    to a lender at a specified date each month. EMIs are used to pay off both
                    interest and principal each month.
                  </p>
                  <div className="mt-4 p-3 bg-black/50 rounded-lg border border-orange-500/30 font-mono text-center text-lg text-orange-400">
                    EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ - 1)
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Share Modal */}
        {showShareModal && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Share with Customer"
            onKeyDown={(e) => { if (e.key === 'Escape') setShowShareModal(false) }}
          >
            <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Share with Customer</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-white"
                  aria-label="Close share dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Customer Phone (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Enter phone number with country code"
                    className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white placeholder-gray-500"
                    aria-label="Customer phone number for WhatsApp sharing"
                  />
                  {customerPhone && !validatePhoneNumber(customerPhone).isValid && (
                    <p className="mt-1 text-sm text-red-400">{validatePhoneNumber(customerPhone).error}</p>
                  )}
                </div>
              </div>

              <button
                onClick={shareViaWhatsApp}
                disabled={sharing || !customerPhone}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sharing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
                {sharing ? 'Preparing...' : 'Share via WhatsApp'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
