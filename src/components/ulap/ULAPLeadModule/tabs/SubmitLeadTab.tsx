/**
 * Submit Lead Tab Component
 * World-class fintech UI for lead submission
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type {
  ULAPModuleContext,
  ULAPModuleConfig,
  ULAPUserContext,
  ULAPLeadSubmission,
  ULAPSubmitResponse,
} from '../types'

// =====================================================
// TYPES
// =====================================================

interface SubmitLeadTabProps {
  context: ULAPModuleContext
  config: ULAPModuleConfig
  userContext: ULAPUserContext | null
  submitLead: (data: Partial<ULAPLeadSubmission>) => Promise<ULAPSubmitResponse>
  isSubmitting: boolean
  submitError: string | null
  lastSubmittedLead: { id: string; number: string } | null
}

interface LoanCategory {
  id: string
  name: string
  display_name: string
  icon: string
  color: string
}

interface FormStep {
  id: string
  title: string
  description: string
}

// =====================================================
// ICONS
// =====================================================

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
)

const EnvelopeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
)

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
)

const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
)

const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
)

const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

const RocketIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>
)

// =====================================================
// LOAN CATEGORIES
// =====================================================

const LOAN_CATEGORIES: LoanCategory[] = [
  { id: 'home-loan', name: 'HOME_LOAN', display_name: 'Home Loan', icon: '🏠', color: 'from-blue-500 to-blue-600' },
  { id: 'personal-loan', name: 'PERSONAL_LOAN', display_name: 'Personal Loan', icon: '💳', color: 'from-purple-500 to-purple-600' },
  { id: 'business-loan', name: 'BUSINESS_LOAN', display_name: 'Business Loan', icon: '🏢', color: 'from-emerald-500 to-emerald-600' },
  { id: 'vehicle-loan', name: 'VEHICLE_LOAN', display_name: 'Vehicle Loan', icon: '🚗', color: 'from-orange-500 to-orange-600' },
  { id: 'education-loan', name: 'EDUCATION_LOAN', display_name: 'Education Loan', icon: '🎓', color: 'from-cyan-500 to-cyan-600' },
  { id: 'gold-loan', name: 'GOLD_LOAN', display_name: 'Gold Loan', icon: '✨', color: 'from-yellow-500 to-amber-600' },
  { id: 'lap', name: 'LAP', display_name: 'Loan Against Property', icon: '🏦', color: 'from-indigo-500 to-indigo-600' },
  { id: 'other', name: 'OTHER', display_name: 'Other Loans', icon: '📋', color: 'from-gray-500 to-gray-600' },
]

// =====================================================
// FORM STEPS
// =====================================================

const FORM_STEPS: FormStep[] = [
  { id: 'loan', title: 'Loan Type', description: 'Select the type of loan' },
  { id: 'customer', title: 'Customer Details', description: 'Enter customer information' },
  { id: 'amount', title: 'Loan Amount', description: 'Specify loan requirements' },
  { id: 'review', title: 'Review & Submit', description: 'Confirm all details' },
]

// =====================================================
// INPUT COMPONENT
// =====================================================

interface InputProps {
  label: string
  name: string
  type?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  icon?: React.ReactNode
  error?: string
  required?: boolean
  maxLength?: number
}

const Input: React.FC<InputProps> = ({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  icon,
  error,
  required,
  maxLength,
}) => (
  <div className="space-y-2">
    <label htmlFor={name} className="block text-sm font-medium text-white/70">
      {label}
      {required && <span className="text-orange-400 ml-1">*</span>}
    </label>
    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
          {icon}
        </div>
      )}
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className={cn(
          'w-full px-4 py-3.5 rounded-xl',
          'bg-white/[0.05] border border-white/[0.1]',
          'text-white placeholder-white/30',
          'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50',
          'transition-all duration-200',
          icon && 'pl-12',
          error && 'border-red-500/50 focus:ring-red-500/50'
        )}
      />
    </div>
    {error && (
      <motion.p
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-red-400 text-xs mt-1"
      >
        {error}
      </motion.p>
    )}
  </div>
)

// =====================================================
// MAIN COMPONENT
// =====================================================

export const SubmitLeadTab: React.FC<SubmitLeadTabProps> = ({
  context: _context,
  config,
  userContext,
  submitLead,
  isSubmitting,
  submitError,
  lastSubmittedLead,
}) => {
  // Form state
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedLoanType, setSelectedLoanType] = useState<LoanCategory | null>(null)
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_mobile: '',
    customer_email: '',
    customer_city: '',
    customer_pincode: '',
    loan_amount: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSuccess, setShowSuccess] = useState(false)
  const [categories, setCategories] = useState<LoanCategory[]>(LOAN_CATEGORIES)

  // Fetch loan categories from API
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/ulap/loan-categories')
        if (response.ok) {
          const data = await response.json()
          if (data.categories?.length) {
            setCategories(data.categories.map((cat: { id: string; name: string; display_name: string }) => ({
              id: cat.id,
              name: cat.name,
              display_name: cat.display_name,
              icon: LOAN_CATEGORIES.find(c => c.name === cat.name)?.icon || '📋',
              color: LOAN_CATEGORIES.find(c => c.name === cat.name)?.color || 'from-gray-500 to-gray-600',
            })))
          }
        }
      } catch (err) {
        console.error('Failed to fetch loan categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // Handle field change
  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }, [errors])

  // Validate current step
  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 0) {
      if (!selectedLoanType) {
        newErrors.loan_type = 'Please select a loan type'
      }
    } else if (step === 1) {
      if (!formData.customer_name.trim()) {
        newErrors.customer_name = 'Customer name is required'
      }
      if (!formData.customer_mobile.trim()) {
        newErrors.customer_mobile = 'Mobile number is required'
      } else if (!/^[6-9]\d{9}$/.test(formData.customer_mobile)) {
        newErrors.customer_mobile = 'Enter a valid 10-digit mobile number'
      }
      if (formData.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
        newErrors.customer_email = 'Enter a valid email address'
      }
    } else if (step === 2) {
      if (formData.loan_amount && (isNaN(Number(formData.loan_amount)) || Number(formData.loan_amount) < 10000)) {
        newErrors.loan_amount = 'Enter a valid loan amount (minimum ₹10,000)'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [selectedLoanType, formData])

  // Handle next step
  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, FORM_STEPS.length - 1))
    }
  }, [currentStep, validateStep])

  // Handle previous step
  const handlePrevious = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }, [])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validateStep(currentStep)) return
    if (!selectedLoanType) return

    const result = await submitLead({
      customer_name: formData.customer_name,
      customer_mobile: formData.customer_mobile,
      customer_email: formData.customer_email || undefined,
      customer_city: formData.customer_city || undefined,
      customer_pincode: formData.customer_pincode || undefined,
      loan_type: selectedLoanType.name,
      required_loan_amount: formData.loan_amount ? Number(formData.loan_amount) : undefined,
    })

    if (result.success) {
      setShowSuccess(true)
    }
  }, [currentStep, validateStep, selectedLoanType, formData, submitLead])

  // Reset form
  const handleReset = useCallback(() => {
    setCurrentStep(0)
    setSelectedLoanType(null)
    setFormData({
      customer_name: '',
      customer_mobile: '',
      customer_email: '',
      customer_city: '',
      customer_pincode: '',
      loan_amount: '',
    })
    setErrors({})
    setShowSuccess(false)
  }, [])

  // Success state
  if (showSuccess && lastSubmittedLead) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/25"
        >
          <CheckIcon className="w-12 h-12 text-white" />
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-white mb-2"
        >
          {config.labels.successMessage}
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-white/60 mb-2"
        >
          Lead Number: <span className="text-orange-400 font-semibold">{lastSubmittedLead.number}</span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-white/40 text-sm mb-8"
        >
          The customer will receive a link to complete the detailed application.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={handleReset}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium shadow-lg shadow-orange-500/25"
        >
          Submit Another Lead
        </motion.button>
      </motion.div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {FORM_STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <motion.div
                  animate={{
                    scale: index === currentStep ? 1.1 : 1,
                    backgroundColor: index < currentStep
                      ? 'rgb(34 197 94)'
                      : index === currentStep
                      ? 'rgb(249 115 22)'
                      : 'rgba(255 255 255 / 0.1)',
                  }}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'text-sm font-medium transition-colors duration-300',
                    index <= currentStep ? 'text-white' : 'text-white/40'
                  )}
                >
                  {index < currentStep ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </motion.div>
                <span
                  className={cn(
                    'text-xs mt-2 hidden sm:block',
                    index === currentStep ? 'text-white' : 'text-white/40'
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < FORM_STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 bg-white/10 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: index < currentStep ? '100%' : '0%' }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-orange-500"
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <motion.div
        className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6 sm:p-8"
      >
        <AnimatePresence mode="wait">
          {/* Step 0: Loan Type */}
          {currentStep === 0 && (
            <motion.div
              key="loan-type"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                Select Loan Type
              </h3>
              <p className="text-white/50 text-sm mb-6">
                Choose the type of loan the customer needs
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {categories.map((category) => (
                  <motion.button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedLoanType(category)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'relative p-4 rounded-xl border transition-all duration-200',
                      'flex flex-col items-center gap-2 text-center',
                      selectedLoanType?.id === category.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                    )}
                  >
                    <span className="text-3xl">{category.icon}</span>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        selectedLoanType?.id === category.id
                          ? 'text-orange-400'
                          : 'text-white/70'
                      )}
                    >
                      {category.display_name}
                    </span>
                    {selectedLoanType?.id === category.id && (
                      <motion.div
                        layoutId="selectedLoan"
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center"
                      >
                        <CheckIcon className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>

              {errors.loan_type && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-sm mt-4"
                >
                  {errors.loan_type}
                </motion.p>
              )}
            </motion.div>
          )}

          {/* Step 1: Customer Details */}
          {currentStep === 1 && (
            <motion.div
              key="customer-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                Customer Information
              </h3>
              <p className="text-white/50 text-sm mb-6">
                Enter the customer&apos;s contact details
              </p>

              <Input
                label="Customer Name"
                name="customer_name"
                placeholder="Enter full name"
                value={formData.customer_name}
                onChange={(v) => handleFieldChange('customer_name', v)}
                icon={<UserIcon className="w-5 h-5" />}
                error={errors.customer_name}
                required
              />

              <Input
                label="Mobile Number"
                name="customer_mobile"
                type="tel"
                placeholder="10-digit mobile number"
                value={formData.customer_mobile}
                onChange={(v) => handleFieldChange('customer_mobile', v.replace(/\D/g, '').slice(0, 10))}
                icon={<PhoneIcon className="w-5 h-5" />}
                error={errors.customer_mobile}
                required
                maxLength={10}
              />

              <Input
                label="Email Address"
                name="customer_email"
                type="email"
                placeholder="customer@email.com"
                value={formData.customer_email}
                onChange={(v) => handleFieldChange('customer_email', v)}
                icon={<EnvelopeIcon className="w-5 h-5" />}
                error={errors.customer_email}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  name="customer_city"
                  placeholder="City name"
                  value={formData.customer_city}
                  onChange={(v) => handleFieldChange('customer_city', v)}
                  icon={<MapPinIcon className="w-5 h-5" />}
                />

                <Input
                  label="PIN Code"
                  name="customer_pincode"
                  placeholder="6-digit PIN"
                  value={formData.customer_pincode}
                  onChange={(v) => handleFieldChange('customer_pincode', v.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </div>
            </motion.div>
          )}

          {/* Step 2: Loan Amount */}
          {currentStep === 2 && (
            <motion.div
              key="loan-amount"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                Loan Requirements
              </h3>
              <p className="text-white/50 text-sm mb-6">
                Specify the loan amount needed (optional)
              </p>

              <Input
                label="Required Loan Amount"
                name="loan_amount"
                type="text"
                placeholder="Enter amount in ₹"
                value={formData.loan_amount}
                onChange={(v) => handleFieldChange('loan_amount', v.replace(/\D/g, ''))}
                icon={<CurrencyIcon className="w-5 h-5" />}
                error={errors.loan_amount}
              />

              {formData.loan_amount && Number(formData.loan_amount) >= 10000 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20"
                >
                  <p className="text-orange-400 text-lg font-semibold">
                    ₹{Number(formData.loan_amount).toLocaleString('en-IN')}
                  </p>
                  <p className="text-white/50 text-sm">Requested Loan Amount</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                Review & Submit
              </h3>
              <p className="text-white/50 text-sm mb-6">
                Please verify all details before submitting
              </p>

              <div className="space-y-4">
                {/* Loan Type */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Loan Type</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedLoanType?.icon}</span>
                    <span className="text-white font-medium">{selectedLoanType?.display_name}</span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Customer</p>
                  <p className="text-white font-medium">{formData.customer_name}</p>
                  <p className="text-white/70 text-sm">{formData.customer_mobile}</p>
                  {formData.customer_email && (
                    <p className="text-white/50 text-sm">{formData.customer_email}</p>
                  )}
                  {(formData.customer_city || formData.customer_pincode) && (
                    <p className="text-white/50 text-sm">
                      {[formData.customer_city, formData.customer_pincode].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </div>

                {/* Loan Amount */}
                {formData.loan_amount && (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Loan Amount</p>
                    <p className="text-white font-medium text-lg">
                      ₹{Number(formData.loan_amount).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}

                {/* Source Attribution */}
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                  <p className="text-orange-400/70 text-xs uppercase tracking-wider mb-1">Submitted By</p>
                  <p className="text-white font-medium">{userContext?.userName || 'You'}</p>
                  <p className="text-white/50 text-sm">Source: {config.sourceType}</p>
                </div>
              </div>

              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                  <p className="text-red-400 text-sm">{submitError}</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.08]">
          <motion.button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            whileHover={{ scale: currentStep === 0 ? 1 : 1.02 }}
            whileTap={{ scale: currentStep === 0 ? 1 : 0.98 }}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-xl',
              'text-sm font-medium transition-all duration-200',
              currentStep === 0
                ? 'opacity-50 cursor-not-allowed text-white/40'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-white'
            )}
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span>Back</span>
          </motion.button>

          {currentStep < FORM_STEPS.length - 1 ? (
            <motion.button
              type="button"
              onClick={handleNext}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl',
                'bg-gradient-to-r from-orange-500 to-orange-600',
                'text-white text-sm font-medium',
                'shadow-lg shadow-orange-500/25'
              )}
            >
              <span>Continue</span>
              <ChevronRightIcon className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className={cn(
                'flex items-center gap-2 px-8 py-3 rounded-xl',
                'bg-gradient-to-r from-emerald-500 to-green-600',
                'text-white text-sm font-medium',
                'shadow-lg shadow-emerald-500/25',
                isSubmitting && 'opacity-70 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner className="w-4 h-4" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <RocketIcon className="w-4 h-4" />
                  <span>{config.labels.submitButtonLabel}</span>
                </>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default SubmitLeadTab
