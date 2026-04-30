'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calculator,
  TrendingUp,
  Share2,
  History,
  BookOpen,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Percent,
  Calendar,
  CalendarDays,
  PiggyBank,
  Scale,
  FileText,
  IndianRupee,
  Clock,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Minus,
  BarChart3,
  PieChart as PieChartIcon,
  Table,
  Wallet,
  Target,
  Building,
  GraduationCap,
  Car,
  Home,
  Gem,
  Briefcase,
  CreditCard,
  FileDown,
  Bell,
  ExternalLink,
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
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'

import type {
  LoanType,
  TenureType,
  EMICalculationHistory,
  AmortizationRow,
  PrepaymentResult,
  EligibilityResult,
  TaxBenefitResult,
  LoanScenario,
  LoanComparisonResult,
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
  compareLoanScenarios,
  formatIndianCurrency,
  formatIndianNumber,
  formatTenure,
  validateEMIInputs,
  sanitizeNumericInput,
  generateId,
  roundToTwo,
} from '@/lib/utils/emi-calculations'

import {
  downloadPDFReport,
  generateWhatsAppShareMessage,
  type PDFReportData,
} from '@/lib/utils/emi-pdf-generator'

import {
  generateEMICalendar,
  getUpcomingPayments,
  getPaymentStatistics,
  generateGoogleCalendarUrl,
  downloadICalFile,
  formatEMIDate,
  getDaysUntilPayment,
  type EMICalendar,
  type EMIPayment,
} from '@/lib/utils/emi-calendar'

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

// ============================================================================
// TYPES
// ============================================================================

type TabType = 'calculator' | 'prepayment' | 'comparison' | 'eligibility' | 'tax-benefit' | 'schedule' | 'terminology'
type ViewType = 'chart' | 'table'

interface EMICalculatorEnhancedProps {
  variant?: 'basic' | 'advanced' | 'full'
  defaultLoanType?: LoanType
  showHistory?: boolean
  className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EMICalculatorEnhanced({
  variant = 'full',
  defaultLoanType = 'home_loan',
  showHistory = true,
  className = '',
}: EMICalculatorEnhancedProps) {
  // ============================================================================
  // STATE - Core Calculator
  // ============================================================================
  const [principal, setPrincipal] = useState<string>('')
  const [interestRate, setInterestRate] = useState<string>('')
  const [tenure, setTenure] = useState<string>('')
  const [tenureType, setTenureType] = useState<TenureType>('years')
  const [loanType, setLoanType] = useState<LoanType>(defaultLoanType)
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
  const [historyVisible, setHistoryVisible] = useState(false)
  const [history, setHistory] = useState<EMICalculationHistory[]>([])
  const [errors, setErrors] = useState<EMIValidationErrors>({})
  const [amortizationView, setAmortizationView] = useState<ViewType>('table')
  const [showYearlyView, setShowYearlyView] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)

  // ============================================================================
  // STATE - Prepayment Calculator
  // ============================================================================
  const [prepaymentAmount, setPrepaymentAmount] = useState<string>('')
  const [prepaymentType, setPrepaymentType] = useState<'reduce_emi' | 'reduce_tenure'>('reduce_tenure')
  const [prepaymentResult, setPrepaymentResult] = useState<PrepaymentResult | null>(null)

  // ============================================================================
  // STATE - Loan Comparison
  // ============================================================================
  const [comparisonScenarios, setComparisonScenarios] = useState<LoanScenario[]>([])
  const [comparisonResult, setComparisonResult] = useState<LoanComparisonResult | null>(null)

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

  // ============================================================================
  // STATE - EMI Calendar/Schedule
  // ============================================================================
  const [emiCalendar, setEmiCalendar] = useState<EMICalendar | null>(null)
  const [preferredPaymentDay, setPreferredPaymentDay] = useState<number>(1)
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0])

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load history from localStorage
  useEffect(() => {
    if (showHistory && typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('emiCalculatorHistory')
      if (savedHistory) {
        try {
          setHistory(JSON.parse(savedHistory))
        } catch (e) {
          console.error('Failed to parse history:', e)
        }
      }
    }
  }, [showHistory])

  // Save history to localStorage
  useEffect(() => {
    if (showHistory && history.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem('emiCalculatorHistory', JSON.stringify(history))
    }
  }, [history, showHistory])

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

    // Allow 0% for interest-free loans
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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [principal, interestRate, tenure, tenureType, loanConfig])

  const handleCalculate = useCallback(() => {
    if (!validateInputs()) return

    setIsCalculating(true)

    // Use setTimeout to show loading state
    setTimeout(() => {
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

      // Generate amortization schedule
      const schedule = generateAmortizationSchedule(P, r, n)
      setAmortizationSchedule(schedule.rows)

      // Add to history
      if (showHistory) {
        const historyItem: EMICalculationHistory = {
          id: generateId(),
          principal: P,
          interestRate: r,
          tenure: n,
          tenureType,
          loanType,
          emi: result.monthlyEMI,
          totalInterest: result.totalInterest,
          totalAmount: result.totalAmount,
          timestamp: new Date().toISOString(),
        }
        setHistory((prev) => [historyItem, ...prev.slice(0, 9)])
      }

      setIsCalculating(false)
    }, 300)
  }, [principal, interestRate, tenure, tenureType, processingFee, loanType, showHistory, validateInputs])

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
  }, [])

  const loadFromHistory = useCallback((item: EMICalculationHistory) => {
    setPrincipal(item.principal.toString())
    setInterestRate(item.interestRate.toString())
    setTenure((item.tenureType === 'years' ? item.tenure / 12 : item.tenure).toString())
    setTenureType(item.tenureType)
    setLoanType(item.loanType)
    setEmi(item.emi)
    setTotalInterest(item.totalInterest)
    setTotalAmount(item.totalAmount)
    setCalculated(true)

    const schedule = generateAmortizationSchedule(item.principal, item.interestRate, item.tenure)
    setAmortizationSchedule(schedule.rows)
    setHistoryVisible(false)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem('emiCalculatorHistory')
    }
  }, [])

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
  // HANDLERS - Loan Comparison
  // ============================================================================

  const addComparisonScenario = useCallback(() => {
    if (comparisonScenarios.length >= 4) return

    const newScenario: LoanScenario = {
      id: generateId(),
      name: `Scenario ${comparisonScenarios.length + 1}`,
      loanType,
      principalAmount: sanitizeNumericInput(principal) || 1000000,
      interestRate: sanitizeNumericInput(interestRate) || 9,
      tenureMonths: tenureType === 'years' ? sanitizeNumericInput(tenure) * 12 : sanitizeNumericInput(tenure) || 240,
      processingFeePercentage: 1,
      processingFeeFlat: 0,
      insuranceRequired: false,
      insurancePremium: 0,
      otherCharges: 0,
    }

    setComparisonScenarios((prev) => [...prev, newScenario])
  }, [comparisonScenarios.length, loanType, principal, interestRate, tenure, tenureType])

  const removeComparisonScenario = useCallback((id: string) => {
    setComparisonScenarios((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const updateComparisonScenario = useCallback((id: string, updates: Partial<LoanScenario>) => {
    setComparisonScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }, [])

  const runComparison = useCallback(() => {
    if (comparisonScenarios.length < 2) return
    const result = compareLoanScenarios(comparisonScenarios)
    setComparisonResult(result)
  }, [comparisonScenarios])

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
      financialYear: '2024-25',
      isFirstHomeLoan,
      isPropertyUnderConstruction: false,
      borrowerType: 'individual',
      taxRegime,
      incomeSlabRate,
    })

    setTaxBenefitResult(result)
  }, [calculated, loanType, principal, interestRate, tenure, tenureType, isFirstHomeLoan, taxRegime, incomeSlabRate])

  // ============================================================================
  // HANDLERS - Share
  // ============================================================================

  const handleShareWhatsApp = useCallback(() => {
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
    window.open(whatsappUrl, '_blank')
  }, [calculated, principal, interestRate, tenure, tenureType, emi, totalInterest, totalAmount])

  // ============================================================================
  // HANDLERS - PDF Export
  // ============================================================================

  const handleDownloadPDF = useCallback(() => {
    if (!calculated || amortizationSchedule.length === 0) return

    const tenureMonths = tenureType === 'years' ? sanitizeNumericInput(tenure) * 12 : sanitizeNumericInput(tenure)

    const pdfData: PDFReportData = {
      calculation: {
        emi,
        totalInterest,
        totalPayment: totalAmount,
        amortizationSchedule: amortizationSchedule.map((row) => ({
          month: row.month,
          emi: row.emi,
          principalPaid: row.principalPaid,
          interestPaid: row.interestPaid,
          remainingBalance: row.balance,
        })),
      },
      loanType,
      principal: sanitizeNumericInput(principal),
      interestRate: sanitizeNumericInput(interestRate),
      tenure: tenureType === 'years' ? sanitizeNumericInput(tenure) : sanitizeNumericInput(tenure) / 12,
      tenureType: tenureType === 'years' ? 'years' : 'months',
      config: {
        companyName: 'Loanz360',
        showAmortizationSchedule: true,
        showCharts: true,
        showTermsAndConditions: true,
      },
    }

    downloadPDFReport(pdfData)
  }, [calculated, amortizationSchedule, loanType, principal, interestRate, tenure, tenureType, emi, totalInterest, totalAmount])

  // ============================================================================
  // HANDLERS - EMI Calendar/Schedule
  // ============================================================================

  const handleGenerateCalendar = useCallback(() => {
    if (!calculated || amortizationSchedule.length === 0) return

    const loanId = generateId()
    const schedule = amortizationSchedule.map((row) => ({
      month: row.month,
      emi: row.emi,
      principalPaid: row.principalPaid,
      interestPaid: row.interestPaid,
      remainingBalance: row.balance,
    }))

    const calendar = generateEMICalendar(
      loanId,
      loanType,
      sanitizeNumericInput(principal),
      sanitizeNumericInput(interestRate),
      schedule,
      new Date(startDate),
      preferredPaymentDay
    )

    setEmiCalendar(calendar)
  }, [calculated, amortizationSchedule, loanType, principal, interestRate, startDate, preferredPaymentDay])

  const handleDownloadICalFile = useCallback(() => {
    if (!emiCalendar) return
    downloadICalFile(emiCalendar)
  }, [emiCalendar])

  const handleAddToGoogleCalendar = useCallback((payment: EMIPayment) => {
    if (!emiCalendar) return
    const url = generateGoogleCalendarUrl(payment, emiCalendar.loanType)
    window.open(url, '_blank')
  }, [emiCalendar])

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

    const yearMap = new Map<number, { year: number; principal: number; interest: number; balance: number }>()

    for (const row of amortizationSchedule) {
      if (!yearMap.has(row.year)) {
        yearMap.set(row.year, { year: row.year, principal: 0, interest: 0, balance: row.balance })
      }
      const entry = yearMap.get(row.year)!
      entry.principal += row.principalPaid
      entry.interest += row.interestPaid
      entry.balance = row.balance
    }

    return Array.from(yearMap.values())
  }, [amortizationSchedule])

  const balanceTrendData = useMemo(() => {
    if (amortizationSchedule.length === 0) return []

    // Sample every 6 months for performance
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
    type: 'number' | 'text' = 'number',
    ariaLabel?: string
  ) => (
    <div>
      <label className="block text-sm font-semibold text-gray-300 mb-2" id={`${label.toLowerCase().replace(/\s/g, '-')}-label`}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{prefix}</span>
        )}
        <input
          type={type}
          inputMode={type === 'number' ? 'decimal' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel || label}
          aria-describedby={error ? `${label.toLowerCase().replace(/\s/g, '-')}-error` : undefined}
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
        <p id={`${label.toLowerCase().replace(/\s/g, '-')}-error`} className="mt-1 text-sm text-red-400 flex items-center gap-1" role="alert">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  )

  // ============================================================================
  // RENDER - TABS
  // ============================================================================

  const tabs: { id: TabType; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: 'calculator', label: 'Calculator', icon: Calculator, show: true },
    { id: 'prepayment', label: 'Prepayment', icon: PiggyBank, show: variant === 'full' || variant === 'advanced' },
    { id: 'comparison', label: 'Compare', icon: Scale, show: variant === 'full' },
    { id: 'eligibility', label: 'Eligibility', icon: Target, show: variant === 'full' },
    { id: 'tax-benefit', label: 'Tax Benefit', icon: FileText, show: variant === 'full' && (loanType === 'home_loan' || loanType === 'education_loan') },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays, show: variant === 'full' || variant === 'advanced' },
    { id: 'terminology', label: 'Learn', icon: BookOpen, show: true },
  ]

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`min-h-screen bg-black p-4 md:p-6 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 md:p-4 rounded-xl shadow-lg" aria-hidden="true">
                <Calculator className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold font-poppins text-white">EMI Calculator</h1>
                <p className="text-gray-400 text-sm md:text-base mt-1">
                  Calculate EMI, compare loans, and plan your finances
                </p>
              </div>
            </div>
            {showHistory && (
              <button
                onClick={() => setHistoryVisible(!historyVisible)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/20 rounded-lg transition-colors"
                aria-expanded={historyVisible}
                aria-controls="history-panel"
              >
                <History className="w-5 h-5" aria-hidden="true" />
                <span className="hidden sm:inline">History</span>
                <span className="bg-orange-500 text-xs px-2 py-0.5 rounded-full">{history.length}</span>
              </button>
            )}
          </div>
        </header>

        {/* History Panel */}
        {historyVisible && (
          <section
            id="history-panel"
            className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4 md:p-6 mb-6"
            aria-label="Calculation History"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-bold text-white">Recent Calculations</h2>
              <div className="flex gap-2">
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-sm text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                    aria-label="Clear all history"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setHistoryVisible(false)}
                  className="text-gray-400 hover:text-white p-1"
                  aria-label="Close history"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No calculation history yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="p-3 md:p-4 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors border border-white/10 hover:border-orange-500/50 text-left"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-white text-sm">
                        {formatIndianNumber(item.principal)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-gray-300">{item.interestRate}%</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-300">{formatTenure(item.tenure)}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-orange-400 font-medium">
                        {formatIndianCurrency(item.emi)}/mo
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tabs Navigation */}
        <nav className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 mb-6 overflow-x-auto" aria-label="Calculator sections">
          <div className="flex border-b border-white/10 min-w-max">
            {tabs.filter(tab => tab.show).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                }`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                <tab.icon className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
                <span className="text-sm md:text-base">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 md:p-6" role="tabpanel">
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
                      '₹',
                      undefined,
                      'number',
                      'Enter loan amount in rupees'
                    )}

                    {/* Interest Rate */}
                    {renderInput(
                      'Interest Rate (Annual)',
                      interestRate,
                      setInterestRate,
                      'e.g., 8.5',
                      errors.interestRate,
                      undefined,
                      '%',
                      'number',
                      'Enter annual interest rate percentage'
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
                            placeholder="e.g., 20"
                            aria-label="Tenure value"
                            className={`w-full px-4 py-3 bg-black border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500 ${
                              errors.tenure ? 'border-red-500' : 'border-white/20'
                            }`}
                          />
                        </div>
                        <select
                          value={tenureType}
                          onChange={(e) => setTenureType(e.target.value as TenureType)}
                          aria-label="Tenure unit"
                          className="px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white min-w-[100px]"
                        >
                          <option value="years">Years</option>
                          <option value="months">Months</option>
                        </select>
                      </div>
                      {errors.tenure && (
                        <p className="mt-1 text-sm text-red-400 flex items-center gap-1" role="alert">
                          <AlertCircle className="w-4 h-4" />
                          {errors.tenure}
                        </p>
                      )}
                    </div>

                    {/* Processing Fee (Optional) */}
                    {variant !== 'basic' && (
                      <details className="group">
                        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 flex items-center gap-2">
                          <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                          Additional Options
                        </summary>
                        <div className="mt-3">
                          {renderInput(
                            'Processing Fee',
                            processingFee,
                            setProcessingFee,
                            'e.g., 1',
                            undefined,
                            undefined,
                            '%',
                            'number'
                          )}
                        </div>
                      </details>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleCalculate}
                        disabled={isCalculating}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 md:py-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        aria-busy={isCalculating}
                      >
                        {isCalculating ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Calculator className="w-5 h-5" />
                        )}
                        {isCalculating ? 'Calculating...' : 'Calculate EMI'}
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/20 rounded-lg transition-colors"
                        aria-label="Reset calculator"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Results */}
                  <div>
                    {calculated ? (
                      <div className="space-y-4" role="region" aria-label="EMI Calculation Results">
                        {/* Monthly EMI - Highlighted */}
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 md:p-6 text-white shadow-lg border border-orange-400/50">
                          <div className="text-sm font-medium opacity-90 mb-1">Monthly EMI</div>
                          <div className="text-3xl md:text-4xl font-bold" aria-live="polite">
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

                        {/* Share and Download Buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={handleShareWhatsApp}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            <Share2 className="w-5 h-5" />
                            Share
                          </button>
                          <button
                            onClick={handleDownloadPDF}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                            title="Download PDF Report"
                          >
                            <FileDown className="w-5 h-5" />
                            PDF
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

                {/* Charts and Amortization - Only show when calculated */}
                {calculated && (
                  <>
                    {/* Principal vs Interest Chart */}
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
                                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
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
                                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
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
                                  fill="url(#balanceGradient)"
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
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={showYearlyView}
                                  onChange={(e) => setShowYearlyView(e.target.checked)}
                                  className="rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500"
                                />
                                Show yearly summary
                              </label>
                            </div>
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
                                {(showYearlyView ? yearlyData : amortizationSchedule).map((row) => (
                                  <tr
                                    key={showYearlyView ? (row as unknown).year : (row as AmortizationRow).month}
                                    className="hover:bg-white/5 transition-colors"
                                  >
                                    <td className="px-3 md:px-4 py-2 text-gray-300">
                                      {showYearlyView ? `Year ${(row as unknown).year}` : (row as AmortizationRow).month}
                                    </td>
                                    <td className="px-3 md:px-4 py-2 text-right text-gray-300">
                                      {formatIndianCurrency(showYearlyView ? emi * 12 : (row as AmortizationRow).emi)}
                                    </td>
                                    <td className="px-3 md:px-4 py-2 text-right text-blue-400 font-medium">
                                      {formatIndianCurrency(showYearlyView ? (row as unknown).principal : (row as AmortizationRow).principalPaid)}
                                    </td>
                                    <td className="px-3 md:px-4 py-2 text-right text-orange-400 font-medium">
                                      {formatIndianCurrency(showYearlyView ? (row as unknown).interest : (row as AmortizationRow).interestPaid)}
                                    </td>
                                    <td className="px-3 md:px-4 py-2 text-right text-gray-200 font-medium">
                                      {formatIndianCurrency((row as unknown).balance)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Year-wise Bar Chart */}
                    {yearlyData.length > 1 && (
                      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 md:p-6 border border-white/10">
                        <h3 className="text-lg md:text-xl font-bold flex items-center gap-2 text-white mb-6">
                          <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
                          Year-wise Payment Distribution
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={yearlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="year" stroke="#9ca3af" tickFormatter={(v) => `Y${v}`} />
                            <YAxis stroke="#9ca3af" tickFormatter={(v) => formatIndianNumber(v)} />
                            <Tooltip
                              formatter={(value: number) => formatIndianCurrency(value)}
                              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Bar dataKey="principal" name="Principal" fill={CHART_COLORS.principal} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="interest" name="Interest" fill={CHART_COLORS.interest} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
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
                    {/* Prepayment Form */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">Prepayment Calculator</h3>
                      <p className="text-sm text-gray-400">
                        See how much you can save by making a prepayment on your loan
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
                          <div>
                            <span className="text-gray-400">Remaining Tenure</span>
                            <p className="text-white font-semibold">
                              {formatTenure(tenureType === 'years' ? sanitizeNumericInput(tenure) * 12 : sanitizeNumericInput(tenure))}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-400">Interest Rate</span>
                            <p className="text-white font-semibold">{interestRate}% p.a.</p>
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
                                : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
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
                                : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
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
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <PiggyBank className="w-5 h-5" />
                        Calculate Savings
                      </button>
                    </div>

                    {/* Prepayment Results */}
                    <div>
                      {prepaymentResult ? (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                            <div className="text-sm font-medium opacity-90 mb-1">Total Interest Saved</div>
                            <div className="text-3xl md:text-4xl font-bold">
                              {formatIndianCurrency(prepaymentResult.interestSaved)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <div className="text-sm text-gray-400 mb-1">New EMI</div>
                              <div className="text-xl font-bold text-white">
                                {formatIndianCurrency(prepaymentResult.newEMI)}
                              </div>
                              {prepaymentResult.emiReduction > 0 && (
                                <div className="text-xs text-green-400 mt-1">
                                  ↓ {formatIndianCurrency(prepaymentResult.emiReduction)} saved
                                </div>
                              )}
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <div className="text-sm text-gray-400 mb-1">New Tenure</div>
                              <div className="text-xl font-bold text-white">
                                {formatTenure(prepaymentResult.newTenureMonths)}
                              </div>
                              {prepaymentResult.tenureReduction > 0 && (
                                <div className="text-xs text-green-400 mt-1">
                                  ↓ {formatTenure(prepaymentResult.tenureReduction)} reduced
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="text-sm text-gray-400 mb-1">New Total Interest</div>
                            <div className="text-lg font-bold text-orange-400">
                              {formatIndianCurrency(prepaymentResult.newTotalInterest)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Previously: {formatIndianCurrency(totalInterest)}
                            </div>
                          </div>

                          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="flex items-start gap-3">
                              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-green-300">
                                <strong>Great decision!</strong> A prepayment of{' '}
                                {formatIndianCurrency(sanitizeNumericInput(prepaymentAmount))} will save you{' '}
                                {formatIndianCurrency(prepaymentResult.interestSaved)} in interest.
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center bg-white/5 rounded-xl border border-white/10 min-h-[300px]">
                          <div className="text-center text-gray-500 p-6">
                            <PiggyBank className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">Enter prepayment amount</p>
                            <p className="text-sm mt-2">See how much you can save</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comparison Tab */}
            {activeTab === 'comparison' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Loan Comparison</h3>
                    <p className="text-sm text-gray-400">
                      Compare up to 4 different loan scenarios side by side
                    </p>
                  </div>
                  <button
                    onClick={addComparisonScenario}
                    disabled={comparisonScenarios.length >= 4}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Scenario
                  </button>
                </div>

                {comparisonScenarios.length === 0 ? (
                  <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                    <Scale className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400 mb-4">No scenarios added yet</p>
                    <button
                      onClick={addComparisonScenario}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                    >
                      Add First Scenario
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Scenario Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {comparisonScenarios.map((scenario, index) => (
                        <div
                          key={scenario.id}
                          className="bg-white/5 rounded-xl p-4 border border-white/10"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <input
                              type="text"
                              value={scenario.name}
                              onChange={(e) => updateComparisonScenario(scenario.id, { name: e.target.value })}
                              className="bg-transparent text-white font-semibold border-b border-transparent hover:border-white/30 focus:border-orange-500 focus:outline-none"
                            />
                            <button
                              onClick={() => removeComparisonScenario(scenario.id)}
                              className="text-gray-400 hover:text-red-400 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-3 text-sm">
                            <div>
                              <label className="text-gray-400 text-xs">Amount</label>
                              <input
                                type="number"
                                value={scenario.principalAmount}
                                onChange={(e) =>
                                  updateComparisonScenario(scenario.id, {
                                    principalAmount: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-2 py-1 bg-black/50 border border-white/20 rounded text-white"
                              />
                            </div>
                            <div>
                              <label className="text-gray-400 text-xs">Rate (%)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={scenario.interestRate}
                                onChange={(e) =>
                                  updateComparisonScenario(scenario.id, {
                                    interestRate: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-2 py-1 bg-black/50 border border-white/20 rounded text-white"
                              />
                            </div>
                            <div>
                              <label className="text-gray-400 text-xs">Tenure (months)</label>
                              <input
                                type="number"
                                value={scenario.tenureMonths}
                                onChange={(e) =>
                                  updateComparisonScenario(scenario.id, {
                                    tenureMonths: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-2 py-1 bg-black/50 border border-white/20 rounded text-white"
                              />
                            </div>
                            <div>
                              <label className="text-gray-400 text-xs">Processing Fee (%)</label>
                              <input
                                type="number"
                                step="0.1"
                                value={scenario.processingFeePercentage}
                                onChange={(e) =>
                                  updateComparisonScenario(scenario.id, {
                                    processingFeePercentage: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full px-2 py-1 bg-black/50 border border-white/20 rounded text-white"
                              />
                            </div>
                          </div>

                          {scenario.monthlyEMI && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                              <div className="text-orange-400 font-bold text-lg">
                                {formatIndianCurrency(scenario.monthlyEMI)}/mo
                              </div>
                              <div className="text-gray-400 text-xs">
                                Total: {formatIndianNumber(scenario.totalCost || 0)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Compare Button */}
                    {comparisonScenarios.length >= 2 && (
                      <button
                        onClick={runComparison}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Scale className="w-5 h-5" />
                        Compare Scenarios
                      </button>
                    )}

                    {/* Comparison Results */}
                    {comparisonResult && (
                      <div className="bg-white/5 rounded-xl p-4 md:p-6 border border-white/10">
                        <h4 className="font-bold text-white mb-4">Comparison Results</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <div className="text-xs text-green-400 mb-1">Best for Lowest EMI</div>
                            <div className="font-bold text-white">
                              {comparisonResult.scenarios.find(s => s.id === comparisonResult.bestForLowestEMI)?.name}
                            </div>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <div className="text-xs text-blue-400 mb-1">Best for Lowest Interest</div>
                            <div className="font-bold text-white">
                              {comparisonResult.scenarios.find(s => s.id === comparisonResult.bestForLowestInterest)?.name}
                            </div>
                          </div>
                          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                            <div className="text-xs text-purple-400 mb-1">Best for Total Cost</div>
                            <div className="font-bold text-white">
                              {comparisonResult.scenarios.find(s => s.id === comparisonResult.bestForLowestTotalCost)?.name}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Eligibility Tab */}
            {activeTab === 'eligibility' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Eligibility Form */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white">Loan Eligibility Calculator</h3>
                  <p className="text-sm text-gray-400">
                    Check your loan eligibility based on your income and existing obligations
                  </p>

                  {renderInput(
                    'Monthly Income',
                    monthlyIncome,
                    setMonthlyIncome,
                    'e.g., 100000',
                    undefined,
                    '₹'
                  )}

                  {renderInput(
                    'Existing EMIs (Total)',
                    existingEMIs,
                    setExistingEMIs,
                    'e.g., 20000',
                    undefined,
                    '₹'
                  )}

                  {renderInput('Age', age, setAge, 'e.g., 35', undefined, undefined, 'years')}

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Credit Score Range
                    </label>
                    <select
                      value={creditScore}
                      onChange={(e) => setCreditScore(e.target.value as CreditScoreRange)}
                      className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                    >
                      <option value="">Select credit score range</option>
                      {Object.entries(CREDIT_SCORE_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Employment Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setEmploymentType('salaried')}
                        className={`p-3 rounded-lg border text-sm transition-colors ${
                          employmentType === 'salaried'
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
                        }`}
                      >
                        Salaried
                      </button>
                      <button
                        onClick={() => setEmploymentType('self_employed')}
                        className={`p-3 rounded-lg border text-sm transition-colors ${
                          employmentType === 'self_employed'
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
                        }`}
                      >
                        Self Employed
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleEligibilityCalculate}
                    disabled={!monthlyIncome || !age}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Target className="w-5 h-5" />
                    Check Eligibility
                  </button>
                </div>

                {/* Eligibility Results */}
                <div>
                  {eligibilityResult ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                        <div className="text-sm font-medium opacity-90 mb-1">Maximum Loan Eligibility</div>
                        <div className="text-3xl md:text-4xl font-bold">
                          {formatIndianNumber(eligibilityResult.maxLoanAmount)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <div className="text-sm text-gray-400 mb-1">Max EMI Affordable</div>
                          <div className="text-xl font-bold text-white">
                            {formatIndianCurrency(eligibilityResult.maxEMIAffordable)}
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <div className="text-sm text-gray-400 mb-1">Max Tenure</div>
                          <div className="text-xl font-bold text-white">
                            {formatTenure(eligibilityResult.maxTenureMonths)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="text-sm text-gray-400 mb-2">FOIR Utilization</div>
                        <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="absolute h-full bg-gradient-to-r from-green-500 to-yellow-500"
                            style={{ width: `${Math.min(eligibilityResult.foirUsed, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>Used: {eligibilityResult.foirUsed.toFixed(1)}%</span>
                          <span>Available: {eligibilityResult.availableFOIR.toFixed(1)}%</span>
                        </div>
                      </div>

                      {eligibilityResult.recommendations.length > 0 && (
                        <div className="space-y-2">
                          {eligibilityResult.recommendations.map((rec, i) => (
                            <div key={i} className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-blue-300">{rec}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {eligibilityResult.warnings.length > 0 && (
                        <div className="space-y-2">
                          {eligibilityResult.warnings.map((warn, i) => (
                            <div key={i} className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-yellow-300">{warn}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-white/5 rounded-xl border border-white/10 min-h-[300px]">
                      <div className="text-center text-gray-500 p-6">
                        <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="font-medium">Enter your details</p>
                        <p className="text-sm mt-2">Check your loan eligibility</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tax Benefit Tab */}
            {activeTab === 'tax-benefit' && (
              <div className="space-y-6">
                {!calculated ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-gray-600 mb-4" />
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
                    {/* Tax Form */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">Tax Benefit Calculator</h3>
                      <p className="text-sm text-gray-400">
                        Calculate tax deductions under Section 80C, 24(b), 80EE, and 80EEA
                      </p>

                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Loan Type</span>
                            <p className="text-white font-semibold capitalize">{loanType.replace(/_/g, ' ')}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Loan Amount</span>
                            <p className="text-white font-semibold">{formatIndianNumber(sanitizeNumericInput(principal))}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Tax Regime
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setTaxRegime('old')}
                            className={`p-3 rounded-lg border text-sm transition-colors ${
                              taxRegime === 'old'
                                ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
                            }`}
                          >
                            Old Regime
                          </button>
                          <button
                            onClick={() => setTaxRegime('new')}
                            className={`p-3 rounded-lg border text-sm transition-colors ${
                              taxRegime === 'new'
                                ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
                            }`}
                          >
                            New Regime
                          </button>
                        </div>
                        {taxRegime === 'new' && (
                          <p className="text-xs text-yellow-400 mt-2">
                            Note: Limited tax benefits available under new regime
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Income Tax Slab Rate
                        </label>
                        <select
                          value={incomeSlabRate}
                          onChange={(e) => setIncomeSlabRate(parseInt(e.target.value))}
                          className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                        >
                          <option value={5}>5%</option>
                          <option value={10}>10%</option>
                          <option value={15}>15%</option>
                          <option value={20}>20%</option>
                          <option value={30}>30%</option>
                        </select>
                      </div>

                      {loanType === 'home_loan' && (
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isFirstHomeLoan}
                            onChange={(e) => setIsFirstHomeLoan(e.target.checked)}
                            className="rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500"
                          />
                          This is my first home loan
                        </label>
                      )}

                      <button
                        onClick={handleTaxBenefitCalculate}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <FileText className="w-5 h-5" />
                        Calculate Tax Benefit
                      </button>
                    </div>

                    {/* Tax Results */}
                    <div>
                      {taxBenefitResult ? (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                            <div className="text-sm font-medium opacity-90 mb-1">Total Tax Benefit (Year 1)</div>
                            <div className="text-3xl md:text-4xl font-bold">
                              {formatIndianCurrency(taxBenefitResult.totalTaxBenefit)}
                            </div>
                          </div>

                          <div className="space-y-3">
                            {/* Section 80C */}
                            {taxBenefitResult.section80C.eligible && (
                              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="text-sm font-semibold text-white">Section 80C</div>
                                    <div className="text-xs text-gray-400">Principal repayment</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-green-400">
                                      {formatIndianCurrency(taxBenefitResult.section80C.taxSaved)}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      Deduction: {formatIndianCurrency(taxBenefitResult.section80C.actualDeduction)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Section 24(b) */}
                            {taxBenefitResult.section24b.eligible && (
                              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="text-sm font-semibold text-white">Section 24(b)</div>
                                    <div className="text-xs text-gray-400">Interest payment</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-green-400">
                                      {formatIndianCurrency(taxBenefitResult.section24b.taxSaved)}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      Deduction: {formatIndianCurrency(taxBenefitResult.section24b.actualDeduction)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Section 80EE */}
                            {taxBenefitResult.section80EE?.eligible && (
                              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="text-sm font-semibold text-white">Section 80EE</div>
                                    <div className="text-xs text-gray-400">First-time homebuyers</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-green-400">
                                      {formatIndianCurrency(taxBenefitResult.section80EE.taxSaved)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                            <div className="flex items-start gap-3">
                              <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-purple-300">
                                Your effective interest rate after tax benefit is{' '}
                                <strong>{taxBenefitResult.effectiveInterestRate}%</strong> compared to {interestRate}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center bg-white/5 rounded-xl border border-white/10 min-h-[300px]">
                          <div className="text-center text-gray-500 p-6">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">Calculate tax benefits</p>
                            <p className="text-sm mt-2">See how much you can save on taxes</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                {!calculated ? (
                  <div className="text-center py-12">
                    <CalendarDays className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">Please calculate your EMI first</p>
                    <button
                      onClick={() => setActiveTab('calculator')}
                      className="mt-4 text-orange-400 hover:text-orange-300"
                    >
                      Go to Calculator
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Calendar Setup */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-1 space-y-4">
                        <h3 className="text-lg font-bold text-white">EMI Schedule Setup</h3>
                        <p className="text-sm text-gray-400">
                          Set your loan start date and preferred EMI payment day
                        </p>

                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Loan Start Date
                          </label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Preferred Payment Day
                          </label>
                          <select
                            value={preferredPaymentDay}
                            onChange={(e) => setPreferredPaymentDay(parseInt(e.target.value))}
                            className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                          >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                              <option key={day} value={day}>
                                {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of every month
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={handleGenerateCalendar}
                          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                          <CalendarDays className="w-5 h-5" />
                          Generate Schedule
                        </button>

                        {emiCalendar && (
                          <button
                            onClick={handleDownloadICalFile}
                            className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/20 font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                          >
                            <Download className="w-5 h-5" />
                            Download Calendar (.ics)
                          </button>
                        )}
                      </div>

                      {/* Calendar Display */}
                      <div className="lg:col-span-2">
                        {emiCalendar ? (
                          <div className="space-y-4">
                            {/* Statistics */}
                            {(() => {
                              const stats = getPaymentStatistics(emiCalendar)
                              return (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <div className="text-xs text-gray-400 mb-1">Total Payments</div>
                                    <div className="text-xl font-bold text-white">{stats.totalPayments}</div>
                                  </div>
                                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <div className="text-xs text-gray-400 mb-1">Completed</div>
                                    <div className="text-xl font-bold text-green-400">{stats.paidPayments}</div>
                                  </div>
                                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <div className="text-xs text-gray-400 mb-1">Upcoming</div>
                                    <div className="text-xl font-bold text-blue-400">{stats.upcomingPayments}</div>
                                  </div>
                                  {stats.overduePayments > 0 && (
                                    <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                                      <div className="text-xs text-red-400 mb-1">Overdue</div>
                                      <div className="text-xl font-bold text-red-400">{stats.overduePayments}</div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* Next Due */}
                            {emiCalendar.nextDue && (
                              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium opacity-90 mb-1">Next EMI Due</div>
                                    <div className="text-3xl font-bold">
                                      {formatIndianCurrency(emiCalendar.nextDue.emi)}
                                    </div>
                                    <div className="text-sm opacity-90 mt-1">
                                      {formatEMIDate(emiCalendar.nextDue.dueDate, 'full')}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-5xl font-bold opacity-80">
                                      {getDaysUntilPayment(emiCalendar.nextDue)}
                                    </div>
                                    <div className="text-sm opacity-70">days left</div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAddToGoogleCalendar(emiCalendar.nextDue!)}
                                  className="mt-4 w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Add to Google Calendar
                                </button>
                              </div>
                            )}

                            {/* Upcoming Payments */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-orange-500" />
                                Upcoming Payments (Next 6 Months)
                              </h4>
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                {getUpcomingPayments(emiCalendar, 6).slice(0, 12).map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="flex items-center justify-between p-3 bg-black/30 rounded-lg hover:bg-black/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        payment.status === 'due' ? 'bg-yellow-500/20 text-yellow-400' :
                                        payment.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                                        'bg-white/10 text-gray-400'
                                      }`}>
                                        {payment.month}
                                      </div>
                                      <div>
                                        <div className="font-medium text-white">
                                          {formatEMIDate(payment.dueDate, 'long')}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          P: {formatIndianCurrency(payment.principalPaid)} | I: {formatIndianCurrency(payment.interestPaid)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-orange-400">
                                        {formatIndianCurrency(payment.emi)}
                                      </div>
                                      <div className={`text-xs ${
                                        payment.status === 'due' ? 'text-yellow-400' :
                                        payment.status === 'overdue' ? 'text-red-400' :
                                        'text-gray-500'
                                      }`}>
                                        {payment.status === 'due' ? 'Due Soon' :
                                         payment.status === 'overdue' ? 'Overdue' :
                                         `${getDaysUntilPayment(payment)} days`}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center bg-white/5 rounded-xl border border-white/10 min-h-[400px]">
                            <div className="text-center text-gray-500 p-6">
                              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p className="font-medium">Set up your EMI schedule</p>
                              <p className="text-sm mt-2">Choose start date and payment day, then generate</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Terminology Tab */}
            {activeTab === 'terminology' && (
              <div className="prose prose-invert max-w-none">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* What is EMI */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-orange-500" />
                      What is EMI?
                    </h3>
                    <p className="text-gray-300 leading-relaxed">
                      <strong>EMI (Equated Monthly Installment)</strong> is a fixed payment amount made by a
                      borrower to a lender at a specified date each month. EMIs are used to pay off both
                      interest and principal each month so that over a specified number of years, the loan
                      is fully paid off.
                    </p>
                    <div className="mt-4 p-3 bg-black/50 rounded-lg border border-orange-500/30 font-mono text-center text-lg text-orange-400">
                      EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ - 1)
                    </div>
                    <div className="mt-3 text-sm text-gray-400">
                      <p><strong>P</strong> = Principal loan amount</p>
                      <p><strong>r</strong> = Monthly interest rate</p>
                      <p><strong>n</strong> = Number of monthly installments</p>
                    </div>
                  </div>

                  {/* Key Terms */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-orange-500" />
                      Key Financial Terms
                    </h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="font-semibold text-white">Principal Amount</dt>
                        <dd className="text-gray-400 text-sm">The original loan amount borrowed, excluding interest</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white">Interest Rate</dt>
                        <dd className="text-gray-400 text-sm">Annual percentage charged by lender (APR)</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white">Loan Tenure</dt>
                        <dd className="text-gray-400 text-sm">Duration for loan repayment in months/years</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white">FOIR</dt>
                        <dd className="text-gray-400 text-sm">Fixed Obligation to Income Ratio - % of income for EMIs</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white">Amortization</dt>
                        <dd className="text-gray-400 text-sm">Gradual loan repayment through scheduled payments</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Loan Types */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-orange-500" />
                      Loan Types Overview
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(LOAN_TYPE_CONFIG).slice(0, 7).map(([key, config]) => (
                        <div key={key} className="flex items-center gap-3 text-sm">
                          <div className="p-2 bg-white/5 rounded-lg">
                            {renderLoanTypeIcon(key as LoanType)}
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-medium">{config.label}</div>
                            <div className="text-gray-500 text-xs">
                              {config.minRate}-{config.maxRate}% • {formatTenure(config.minTenure)}-{formatTenure(config.maxTenure)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                      <Info className="w-5 h-5 text-orange-500" />
                      Important Tips
                    </h3>
                    <ul className="space-y-3 text-sm text-gray-300">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
                        Early EMIs have higher interest component, later ones have higher principal
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
                        Prepayments can significantly reduce total interest burden
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
                        Shorter tenure means higher EMI but lower total interest
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
                        Maintain FOIR below 50% for healthy finances
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
                        Good credit score can help get better interest rates
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </div>
  )
}
