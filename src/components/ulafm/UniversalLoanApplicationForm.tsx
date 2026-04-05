/**
 * Universal Loan Application Form Component
 * Version: 4.0.0 - Premium Design
 *
 * Features:
 * - 4-Step Wizard: Basic Info → Loan Type → Applicants → Documents
 * - Premium glassmorphism design with animations
 * - Step-by-step validation
 * - Theme: LOANZ 360 Dark Theme with Orange Accents (#FF6700)
 */

'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Input, PhoneInput } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  LOAN_TYPES,
  fullNameSchema,
  indianMobileSchema,
  optionalEmailSchema,
} from '@/lib/validations/ulafm-schemas'
import type { UniversalLoanFormProps } from '@/types/ulafm'

// =====================================================
// TYPES & SCHEMAS
// =====================================================

const step1Schema = z.object({
  customer_full_name: fullNameSchema,
  customer_mobile: indianMobileSchema,
  customer_email: optionalEmailSchema,
  customer_location: z.string().min(2, 'Location is required').max(100, 'Location is too long').trim(),
})

type Step1Data = z.infer<typeof step1Schema>

const step2Schema = z.object({
  loan_type: z.string().min(1, 'Please select a loan type'),
})

type Step2Data = z.infer<typeof step2Schema>

interface FormData extends Step1Data, Step2Data {
  terms_accepted: boolean
  referral_token?: string
}

interface StepConfig {
  id: number
  title: string
  shortTitle: string
  description: string
  icon: React.ReactNode
}

// =====================================================
// PREMIUM ICONS WITH BETTER STYLING
// =====================================================

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={cn("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const BriefcaseIcon = ({ className }: { className?: string }) => (
  <svg className={cn("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={cn("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={cn("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={cn("w-16 h-16", className)} fill="none" viewBox="0 0 24 24">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={cn("w-4 h-4", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
)

const ArrowLeftIcon = () => (
  <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
  </svg>
)

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={cn("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)

// =====================================================
// STEP CONFIGURATION
// =====================================================

const STEPS: StepConfig[] = [
  { id: 1, title: 'Basic Information', shortTitle: 'Basic Info', description: 'Personal details', icon: <UserIcon /> },
  { id: 2, title: 'Loan Type', shortTitle: 'Loan Type', description: 'Select category', icon: <BriefcaseIcon /> },
  { id: 3, title: 'Applicants', shortTitle: 'Applicants', description: 'Co-applicants', icon: <UsersIcon /> },
  { id: 4, title: 'Documents', shortTitle: 'Documents', description: 'Upload docs', icon: <DocumentIcon /> },
]

// =====================================================
// ANIMATED BACKGROUND DECORATION
// =====================================================

function BackgroundDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient orbs */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,103,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,103,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
    </div>
  )
}

// =====================================================
// PREMIUM PROGRESS INDICATOR - ULTRA MODERN DESIGN
// =====================================================

function ProgressIndicator({ currentStep, completedSteps }: { currentStep: number; completedSteps: Set<number> }) {
  return (
    <div className="mb-12">
      {/* Desktop Progress - Card Style */}
      <div className="hidden md:block">
        {/* Premium Header Card */}
        <div className="relative rounded-2xl bg-gradient-to-r from-zinc-900/80 via-zinc-800/50 to-zinc-900/80 border border-white/5 p-6 overflow-hidden">
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 via-transparent to-brand-primary/5 animate-pulse" />
          <div className="absolute top-0 left-1/4 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />

          <div className="relative flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isCompleted = completedSteps.has(step.id)
              const isCurrent = currentStep === step.id
              const isUpcoming = step.id > currentStep
              const isLast = index === STEPS.length - 1

              return (
                <div key={step.id} className="flex items-center flex-1">
                  {/* Step Container */}
                  <div className="flex flex-col items-center relative group">
                    {/* Outer Ring Animation for Current */}
                    {isCurrent && (
                      <>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-brand-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-brand-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
                      </>
                    )}

                    {/* Glow Effect */}
                    {(isCurrent || isCompleted) && (
                      <div className={cn(
                        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full blur-xl transition-all duration-500",
                        isCurrent ? "bg-brand-primary/40" : "bg-orange-500/30"
                      )} />
                    )}

                    {/* Step Circle - Premium Design */}
                    <div className={cn(
                      'relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 transform',
                      isCompleted && 'bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 shadow-lg shadow-orange-500/30 scale-100',
                      isCurrent && 'bg-gradient-to-br from-brand-primary via-orange-500 to-orange-600 shadow-xl shadow-brand-primary/40 scale-110',
                      isUpcoming && 'bg-zinc-800/80 border-2 border-zinc-700/50 scale-95'
                    )}>
                      {/* Inner Gradient Overlay */}
                      {(isCurrent || isCompleted) && (
                        <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
                      )}

                      {/* Icon */}
                      <div className={cn(
                        'relative z-10 transition-all duration-300',
                        isCompleted && 'text-white',
                        isCurrent && 'text-white',
                        isUpcoming && 'text-zinc-500'
                      )}>
                        {isCompleted ? (
                          <CheckIcon className="w-6 h-6 drop-shadow-lg" />
                        ) : (
                          <div className={cn(isCurrent && 'drop-shadow-lg')}>
                            {step.icon}
                          </div>
                        )}
                      </div>

                      {/* Step Number Badge for Current */}
                      {isCurrent && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-brand-primary text-xs font-bold flex items-center justify-center shadow-lg">
                          {step.id}
                        </div>
                      )}
                    </div>

                    {/* Labels */}
                    <div className="mt-4 text-center">
                      <p className={cn(
                        'text-sm font-semibold transition-all duration-300',
                        isCurrent && 'text-brand-primary text-base',
                        isCompleted && 'text-orange-400',
                        isUpcoming && 'text-orange-300/50'
                      )}>
                        {step.shortTitle}
                      </p>
                      <p className={cn(
                        'text-xs mt-1 transition-colors duration-300',
                        isCurrent && 'text-orange-300/80',
                        isCompleted && 'text-orange-300/60',
                        isUpcoming && 'text-orange-200/40'
                      )}>
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Connector Line - Premium Gradient */}
                  {!isLast && (
                    <div className="flex-1 px-3 relative">
                      {/* Background Track */}
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        {/* Animated Fill */}
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden',
                            step.id < currentStep && 'bg-gradient-to-r from-orange-500 to-orange-400 w-full',
                            step.id === currentStep && 'bg-gradient-to-r from-brand-primary to-orange-400 w-1/2',
                            step.id > currentStep && 'w-0'
                          )}
                        >
                          {/* Shimmer Effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                      </div>

                      {/* Connector Dots */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
                        {[0, 1, 2].map((dot) => (
                          <div
                            key={dot}
                            className={cn(
                              'w-1.5 h-1.5 rounded-full transition-all duration-500',
                              step.id < currentStep ? 'bg-orange-400' :
                              step.id === currentStep ? 'bg-brand-primary' : 'bg-zinc-700'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Progress Bar at Bottom */}
          <div className="mt-6 relative">
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-primary via-orange-500 to-brand-primary rounded-full transition-all duration-700 ease-out relative"
                style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
            </div>
            <p className="text-center mt-3 text-sm text-zinc-500">
              Step <span className="text-brand-primary font-semibold">{currentStep}</span> of <span className="text-zinc-400">{STEPS.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Progress - Ultra Modern Card */}
      <div className="md:hidden">
        <div className="relative rounded-2xl bg-gradient-to-br from-zinc-900/90 to-zinc-800/50 border border-white/5 p-5 overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/20 rounded-full blur-2xl" />

          <div className="relative flex items-center gap-4">
            {/* Step Circle - Large */}
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary via-orange-500 to-orange-600 flex items-center justify-center shadow-xl shadow-brand-primary/30">
                <div className="text-white">
                  {STEPS[currentStep - 1].icon}
                </div>
              </div>
              {/* Animated Ring */}
              <div className="absolute -inset-1 rounded-2xl border-2 border-brand-primary/30 animate-pulse" />
              {/* Step Badge */}
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-brand-primary text-xs font-bold flex items-center justify-center shadow-lg">
                {currentStep}
              </div>
            </div>

            {/* Step Info */}
            <div className="flex-1">
              <p className="text-lg font-bold text-brand-primary">{STEPS[currentStep - 1].title}</p>
              <p className="text-sm text-orange-300/80">{STEPS[currentStep - 1].description}</p>
            </div>
          </div>

          {/* Step Pills Row */}
          <div className="flex gap-2 mt-5">
            {STEPS.map((step) => {
              const isCompleted = completedSteps.has(step.id)
              const isCurrent = currentStep === step.id

              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex-1 h-2 rounded-full transition-all duration-500 relative overflow-hidden',
                    isCompleted && 'bg-gradient-to-r from-orange-500 to-orange-400',
                    isCurrent && 'bg-gradient-to-r from-brand-primary to-orange-500',
                    !isCompleted && !isCurrent && 'bg-zinc-700/50'
                  )}
                >
                  {(isCompleted || isCurrent) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Mini Step Icons */}
          <div className="flex justify-between mt-3 px-1">
            {STEPS.map((step) => {
              const isCompleted = completedSteps.has(step.id)
              const isCurrent = currentStep === step.id

              return (
                <div key={step.id} className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                  isCompleted && 'bg-orange-500/20 text-orange-400',
                  isCurrent && 'bg-brand-primary/20 text-brand-primary',
                  !isCompleted && !isCurrent && 'text-orange-300/40'
                )}>
                  {isCompleted ? <CheckIcon className="w-3 h-3" /> : (
                    <span className="text-[10px] font-semibold">{step.id}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// FORM FIELD WRAPPER WITH LABEL
// =====================================================

function FormField({ children, label, required, error, helper }: {
  children: React.ReactNode
  label: string
  required?: boolean
  error?: string
  helper?: string
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1 text-sm font-medium text-white/80">
        {label}
        {required && <span className="text-brand-primary">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-400" />{error}</p>}
      {helper && !error && <p className="text-xs text-white/40">{helper}</p>}
    </div>
  )
}

// =====================================================
// STEP 1: BASIC INFORMATION
// =====================================================

function Step1BasicInfo({ formData, onNext, errors, setErrors }: {
  formData: Partial<FormData>
  onNext: (data: Step1Data) => void
  errors: Record<string, string>
  setErrors: (errors: Record<string, string>) => void
}) {
  const { register, handleSubmit, formState: { errors: formErrors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    mode: 'onBlur',
    defaultValues: {
      customer_full_name: formData.customer_full_name || '',
      customer_mobile: formData.customer_mobile || '',
      customer_email: formData.customer_email || '',
      customer_location: formData.customer_location || '',
    },
  })

  const onSubmit = (data: Step1Data) => {
    setErrors({})
    onNext(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-primary/10 text-brand-primary">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Basic Information</h2>
            <p className="text-sm text-white/50">Tell us about yourself</p>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid gap-5">
        <Input
          label="Full Name"
          placeholder="Enter your full name as per PAN"
          error={formErrors.customer_full_name?.message || errors.customer_full_name}
          required
          inputSize="lg"
          {...register('customer_full_name')}
        />

        <PhoneInput
          label="Mobile Number"
          placeholder="9876543210"
          error={formErrors.customer_mobile?.message || errors.customer_mobile}
          required
          inputSize="lg"
          {...register('customer_mobile')}
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="your.email@example.com"
          helper="Optional - We'll send updates here"
          error={formErrors.customer_email?.message || errors.customer_email}
          inputSize="lg"
          {...register('customer_email')}
        />

        <Input
          label="Location / City"
          placeholder="Enter your city or area"
          error={formErrors.customer_location?.message || errors.customer_location}
          required
          inputSize="lg"
          {...register('customer_location')}
        />
      </div>

      {/* Action */}
      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          className="group h-12 px-8 bg-gradient-to-r from-brand-primary to-orange-500 hover:from-brand-primary/90 hover:to-orange-500/90 text-white font-semibold rounded-xl shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/40 transition-all duration-300"
        >
          Continue
          <ArrowRightIcon />
        </Button>
      </div>
    </form>
  )
}

// =====================================================
// STEP 2: LOAN TYPE
// =====================================================

function Step2LoanType({ formData, onNext, onBack }: {
  formData: Partial<FormData>
  onNext: (data: Step2Data) => void
  onBack: () => void
}) {
  const [selectedLoanType, setSelectedLoanType] = useState<string>(formData.loan_type || '')
  const [error, setError] = useState<string>('')

  const handleContinue = () => {
    if (!selectedLoanType) {
      setError('Please select a loan type')
      return
    }
    onNext({ loan_type: selectedLoanType })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-primary/10 text-brand-primary">
            <BriefcaseIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Select Loan Type</h2>
            <p className="text-sm text-white/50">What kind of loan are you looking for?</p>
          </div>
        </div>
      </div>

      {/* Loan Type Grid */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-white/80">
          Type of Loan <span className="text-brand-primary">*</span>
        </Label>
        <Select value={selectedLoanType} onValueChange={(value) => { setSelectedLoanType(value); setError('') }}>
          <SelectTrigger className={cn(
            'w-full h-14 bg-white/5 border-white/10 rounded-xl text-base',
            'hover:bg-white/10 hover:border-white/20',
            'focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
            'transition-all duration-200',
            error && 'border-red-500/50'
          )}>
            <SelectValue placeholder="Choose your loan type..." />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-white/10 rounded-xl shadow-2xl">
            {LOAN_TYPES.map((type) => (
              <SelectItem
                key={type.value}
                value={type.value}
                className="hover:bg-brand-primary/10 focus:bg-brand-primary/10 cursor-pointer rounded-lg my-0.5 py-3"
              >
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Coming Soon Card */}
      {selectedLoanType && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl" />
          <div className="relative text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary/10 mb-4">
              <SparklesIcon className="w-8 h-8 text-brand-primary" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Additional Fields Coming Soon</h3>
            <p className="text-sm text-white/50 max-w-md mx-auto">
              Specific fields for <span className="text-brand-primary font-medium">{LOAN_TYPES.find(t => t.value === selectedLoanType)?.label}</span> will appear here.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="group h-12 px-6 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 rounded-xl transition-all duration-200"
        >
          <ArrowLeftIcon />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          className="group h-12 px-8 bg-gradient-to-r from-brand-primary to-orange-500 hover:from-brand-primary/90 hover:to-orange-500/90 text-white font-semibold rounded-xl shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/40 transition-all duration-300"
        >
          Continue
          <ArrowRightIcon />
        </Button>
      </div>
    </div>
  )
}

// =====================================================
// STEP 3: APPLICANTS (Coming Soon)
// =====================================================

function Step3Applicants({ onNext, onBack }: { formData: Partial<FormData>; onNext: () => void; onBack: () => void }) {
  const features = ['Personal Information', 'Employment Details', 'Income Details', 'Relationship', 'Contact Info', 'Address']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-primary/10 text-brand-primary">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Applicants</h2>
            <p className="text-sm text-white/50">Add co-applicants or guarantors</p>
          </div>
        </div>
      </div>

      {/* Coming Soon Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-8">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-primary/5 mb-4">
            <SparklesIcon className="w-10 h-10 text-brand-primary" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Coming Soon</h3>
          <p className="text-white/50 max-w-sm mx-auto">This section will allow you to add co-applicants and guarantors</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {features.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-brand-primary to-orange-500" />
              <span className="text-sm text-white/70">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} className="group h-12 px-6 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 rounded-xl transition-all duration-200">
          <ArrowLeftIcon />Back
        </Button>
        <Button type="button" onClick={onNext} className="group h-12 px-8 bg-gradient-to-r from-brand-primary to-orange-500 hover:from-brand-primary/90 hover:to-orange-500/90 text-white font-semibold rounded-xl shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/40 transition-all duration-300">
          Continue<ArrowRightIcon />
        </Button>
      </div>
    </div>
  )
}

// =====================================================
// STEP 4: DOCUMENTS (Coming Soon)
// =====================================================

function Step4Documents({ formData, onSubmit, onBack, isSubmitting }: {
  formData: Partial<FormData>; onSubmit: () => void; onBack: () => void; isSubmitting: boolean
}) {
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsError, setTermsError] = useState('')
  const loanTypeLabel = LOAN_TYPES.find(t => t.value === formData.loan_type)?.label || 'Selected Loan'
  const docs = ['Identity Proof (PAN/Aadhaar)', 'Address Proof', 'Income Proof', 'Bank Statements', 'Property Documents', 'Business Documents']

  const handleSubmit = () => {
    if (!termsAccepted) { setTermsError('Please accept the terms'); return }
    onSubmit()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-primary/10 text-brand-primary">
            <DocumentIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Documents</h2>
            <p className="text-sm text-white/50">Required for {loanTypeLabel}</p>
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-8">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-primary/10 rounded-full blur-3xl" />
        <div className="relative text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-primary/5 mb-4">
            <SparklesIcon className="w-10 h-10 text-brand-primary" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Coming Soon</h3>
          <p className="text-white/50">Document upload based on your loan type</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {docs.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-brand-primary to-orange-500" />
              <span className="text-sm text-white/70">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Terms */}
      <div className="p-5 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-start gap-3">
          <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(c) => { setTermsAccepted(c as boolean); setTermsError('') }} className="mt-0.5" />
          <div>
            <Label htmlFor="terms" className="text-sm text-white/80 cursor-pointer">
              I agree to the <a href="/terms" target="_blank" className="text-brand-primary hover:underline">Terms</a> and <a href="/privacy" target="_blank" className="text-brand-primary hover:underline">Privacy Policy</a> <span className="text-red-400">*</span>
            </Label>
            {termsError && <p className="text-xs text-red-400 mt-1">{termsError}</p>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting} className="group h-12 px-6 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 rounded-xl transition-all duration-200">
          <ArrowLeftIcon />Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="group h-14 px-10 bg-gradient-to-r from-brand-primary to-orange-500 hover:from-brand-primary/90 hover:to-orange-500/90 text-white font-bold text-base rounded-xl shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/40 transition-all duration-300">
          {isSubmitting ? <><LoadingSpinner /><span className="ml-2">Submitting...</span></> : <>Submit Application<ArrowRightIcon /></>}
        </Button>
      </div>
    </div>
  )
}

// =====================================================
// SUCCESS STATE
// =====================================================

function SuccessState({ applicationId, customerName, onClose }: { applicationId?: string; customerName?: string; onClose?: () => void }) {
  return (
    <div className="text-center py-12 relative">
      {/* Confetti-like decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-3 h-3 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
        <div className="absolute top-20 right-20 w-2 h-2 bg-success rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        <div className="absolute bottom-20 left-20 w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
      </div>

      <div className="relative">
        <div className="mx-auto w-28 h-28 rounded-3xl bg-gradient-to-br from-success/30 to-success/10 flex items-center justify-center mb-8 shadow-2xl shadow-success/20">
          <CheckCircleIcon className="text-success" />
        </div>

        <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent mb-3">
          Application Submitted!
        </h2>
        {customerName && <p className="text-xl text-white/80 mb-4">Thank you, {customerName}!</p>}
        <p className="text-white/50 mb-8 max-w-md mx-auto">Your loan application has been submitted. We'll review and contact you shortly.</p>

        {applicationId && (
          <div className="inline-block mb-8">
            <div className="px-8 py-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 shadow-xl">
              <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Application ID</p>
              <p className="text-4xl font-mono font-bold bg-gradient-to-r from-brand-primary to-orange-500 bg-clip-text text-transparent">{applicationId}</p>
            </div>
          </div>
        )}

        <p className="text-sm text-white/40 mb-8">Confirmation sent to your mobile & email</p>

        {onClose && (
          <Button onClick={onClose} className="h-12 px-8 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all duration-200">
            Submit Another Application
          </Button>
        )}
      </div>
    </div>
  )
}

// =====================================================
// BENEFIT CARDS
// =====================================================

function BenefitCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative text-center">
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-white/50">{description}</p>
      </div>
    </div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function UniversalLoanApplicationForm({
  token, config_key: _config_key = 'DEFAULT', onSuccess, onError, className, showHeader = true, showBenefits = true, theme: _theme,
}: UniversalLoanFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [formData, setFormData] = useState<Partial<FormData>>({ referral_token: token })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [applicationId, setApplicationId] = useState<string | undefined>()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleStep1Complete = (data: Step1Data) => { setFormData(prev => ({ ...prev, ...data })); setCompletedSteps(prev => new Set([...prev, 1])); setCurrentStep(2) }
  const handleStep2Complete = (data: Step2Data) => { setFormData(prev => ({ ...prev, ...data })); setCompletedSteps(prev => new Set([...prev, 2])); setCurrentStep(3) }
  const handleStep3Complete = () => { setCompletedSteps(prev => new Set([...prev, 3])); setCurrentStep(4) }
  const handleBack = () => setCurrentStep(prev => Math.max(1, prev - 1))

  const handleFinalSubmit = async () => {
    setIsSubmitting(true); setSubmitError(null)
    try {
      const response = await fetch('/api/ulafm/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, terms_accepted: true, form_type: 'detailed', referral_token: token }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.duplicate ? `Active application exists: ${result.existing_application_id}` : result.error || 'Failed to submit')
      }
      setApplicationId(result.application_id); setCompletedSteps(prev => new Set([...prev, 4])); setIsSuccess(true); onSuccess?.(result.application)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'; setSubmitError(msg); onError?.(msg)
    } finally { setIsSubmitting(false) }
  }

  const handleReset = () => { setCurrentStep(1); setCompletedSteps(new Set()); setFormData({ referral_token: token }); setErrors({}); setIsSuccess(false); setApplicationId(undefined); setSubmitError(null) }

  if (isSuccess) {
    return (
      <div className={cn('w-full max-w-2xl mx-auto', className)}>
        <div className="relative rounded-3xl bg-gradient-to-br from-zinc-900/90 to-zinc-900/70 backdrop-blur-xl border border-white/10 p-8 shadow-2xl overflow-hidden">
          <BackgroundDecoration />
          <SuccessState applicationId={applicationId} customerName={formData.customer_full_name} onClose={handleReset} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      {/* Header */}
      {showHeader && (
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 mb-4">
            <SparklesIcon className="w-4 h-4 text-brand-primary" />
            <span className="text-sm font-medium text-brand-primary">Quick & Easy Application</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent mb-3">
            Loan Application
          </h1>
          <p className="text-white/50">Complete all steps to submit your application</p>
        </div>
      )}

      {/* Progress */}
      <ProgressIndicator currentStep={currentStep} completedSteps={completedSteps} />

      {/* Form Card */}
      <div className="relative rounded-3xl bg-gradient-to-br from-zinc-900/90 to-zinc-900/70 backdrop-blur-xl border border-white/10 p-8 md:p-10 shadow-2xl overflow-hidden">
        <BackgroundDecoration />

        <div className="relative">
          {submitError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          )}

          {currentStep === 1 && <Step1BasicInfo formData={formData} onNext={handleStep1Complete} errors={errors} setErrors={setErrors} />}
          {currentStep === 2 && <Step2LoanType formData={formData} onNext={handleStep2Complete} onBack={handleBack} />}
          {currentStep === 3 && <Step3Applicants formData={formData} onNext={handleStep3Complete} onBack={handleBack} />}
          {currentStep === 4 && <Step4Documents formData={formData} onSubmit={handleFinalSubmit} onBack={handleBack} isSubmitting={isSubmitting} />}
        </div>
      </div>

      {/* Benefits */}
      {showBenefits && (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <BenefitCard icon="⚡" title="Quick Process" description="Response in 24 hours" />
          <BenefitCard icon="🔒" title="100% Secure" description="Your data is encrypted" />
          <BenefitCard icon="💰" title="Best Rates" description="Competitive interest" />
        </div>
      )}
    </div>
  )
}
