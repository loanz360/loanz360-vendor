'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getRegisterSchema, type RegisterInput } from '@/lib/validations/auth'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput, PhoneInput } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { PasswordStrengthMeter } from '@/components/ui/password-strength-meter'
import { CUSTOMER_CATEGORIES, PARTNER_TYPES, EMPLOYEE_ROLES } from '@/lib/constants'
import { cn, generateId } from '@/lib/utils/cn'
import type { UserRole } from '@/lib/types/database.types'
import { clientLogger } from '@/lib/utils/client-logger'

interface RoleSpecificRegisterFormProps {
  role: UserRole
  roleTitle: string
  roleDescription: string
  subRoleOptions: { value: string; label: string }[]
  className?: string
}

export function RoleSpecificRegisterForm({
  role,
  roleTitle,
  roleDescription,
  subRoleOptions,
  className
}: RoleSpecificRegisterFormProps) {
  const router = useRouter()
  const { signUp, loading } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [emailExistsWarning, setEmailExistsWarning] = useState<string | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const emailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [step, setStep] = useState<'form' | 'verification'>('form')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<RegisterInput>({
    resolver: zodResolver(getRegisterSchema()),
    defaultValues: {
      fullName: '',
      username: '',
      mobile: '',
      email: '',
      subRole: '',
      password: '',
      confirmPassword: '',
      role: role as 'CUSTOMER' | 'EMPLOYEE' | 'PARTNER' | 'VENDOR',
      termsAccepted: false,
      privacyAccepted: false
    }
  })

  // Generate unique IDs based on role
  const generateRoleId = (role: string): string => {
    const prefix = {
      'PARTNER': 'PA',
      'EMPLOYEE': 'EMP',
      'CUSTOMER': 'CUST',
      'VENDOR': 'VEND'
    }[role] || 'USER'

    const randomPart = generateId(6)
    return `${prefix}${randomPart}`
  }

  // Proactive email check on blur - detects auto-registered members
  const checkEmailExists = useCallback(async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailExistsWarning(null)
      return
    }

    // Clear any pending timeout
    if (emailCheckTimeoutRef.current) {
      clearTimeout(emailCheckTimeoutRef.current)
    }

    // Debounce 500ms
    emailCheckTimeoutRef.current = setTimeout(async () => {
      setCheckingEmail(true)
      try {
        const response = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() })
        })
        const result = await response.json()
        if (result.success && result.exists) {
          setEmailExistsWarning(result.message || 'An account with this email already exists. Please sign in instead.')
        } else {
          setEmailExistsWarning(null)
        }
      } catch {
        // Don't block signup on check failure
        setEmailExistsWarning(null)
      } finally {
        setCheckingEmail(false)
      }
    }, 500)
  }, [])

  const onSubmit = async (data: RegisterInput) => {
    setSubmitError(null)

    try {
      // Generate role-specific ID
      const generatedId = generateRoleId(data.role)

      // Prepare metadata for Supabase
      const metadata = {
        full_name: data.fullName,
        role: data.role,
        sub_role: data.subRole,
        mobile: data.mobile,
        generated_id: generatedId,
        username: data.username
      }

      const { error } = await signUp(data.email, data.password, metadata)

      if (error) {
        if (error.message.includes('User already registered')) {
          setSubmitError('An account with this email already exists. Please sign in instead.')
        } else if (error.message.includes('Invalid email')) {
          setSubmitError('Please enter a valid email address.')
        } else if (error.message.includes('Password')) {
          setSubmitError('Password does not meet requirements. Please ensure it meets all criteria.')
        } else {
          setSubmitError(error.message || 'An error occurred during registration.')
        }
        return
      }

      // Move to verification step
      setStep('verification')

    } catch (err) {
      clientLogger.error('Registration error occurred', {
        error: err instanceof Error ? err.message : 'Unknown error',
        role: data.role
      })
      setSubmitError('An unexpected error occurred. Please try again.')
    }
  }

  const getSignInUrl = () => {
    const baseUrls: Record<string, string> = {
      'PARTNER': '/partners/auth/login',
      'EMPLOYEE': '/employees/auth/login',
      'CUSTOMER': '/customers/auth/login',
      'VENDOR': '/auth/login',
      'ADMIN': '/admin/auth/login'
    }
    return baseUrls[role] || '/auth/login'
  }

  const isLoading = loading || isSubmitting

  // Verification step
  if (step === 'verification') {
    return (
      <Card className={cn("w-full max-w-md mx-auto", className)} variant="default">
        <CardHeader className="text-center flex flex-col gap-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
            <CardDescription className="text-orange-400">
              We&apos;ve sent a verification link to your email address. Please check your inbox and click the link to activate your account.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="bg-info/10 border border-info/30 rounded-lg p-4">
            <p className="text-sm text-info">
              📧 Verification email sent to: <strong>{watch('email')}</strong>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="orange"
              size="lg"
              className="w-full"
              onClick={() => router.push(getSignInUrl())}
            >
              Continue to Sign In
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep('form')}
            >
              Go Back to Edit Details
            </Button>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or contact support.
          </div>
        </CardContent>
      </Card>
    )
  }

  // Registration form
  return (
    <Card className={cn("w-full max-w-md mx-auto", className)} variant="default">
      <CardHeader className="flex flex-col gap-4 text-center">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <div className="flex flex-col gap-2">
          <CardTitle className="text-2xl font-bold">Join as {roleTitle}</CardTitle>
          <CardDescription className="text-orange-400">
            {roleDescription}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Name Field */}
          <div className="form-group">
            <Input
              {...register('fullName')}
              label="Name"
              placeholder="Enter your full name"
              error={errors.fullName?.message}
              variant="default"
              disabled={isLoading}
              autoFocus
              required
            />
          </div>

          {/* Username Field */}
          <div className="form-group">
            <Input
              {...register('username')}
              label="Username"
              placeholder="Choose a unique username"
              error={errors.username?.message}
              variant="default"
              disabled={isLoading}
              required
            />
          </div>

          {/* Mobile Number Field */}
          <div className="form-group">
            <PhoneInput
              {...register('mobile')}
              label="Mobile Number"
              error={errors.mobile?.message}
              variant="default"
              disabled={isLoading}
              required
            />
          </div>

          {/* Email ID Field */}
          <div className="form-group">
            <Input
              {...register('email', {
                onBlur: (e) => checkEmailExists(e.target.value)
              })}
              type="email"
              label="Email ID"
              placeholder="Enter your email address"
              error={errors.email?.message}
              variant="default"
              disabled={isLoading}
              required
            />
            {checkingEmail && (
              <p className="mt-1 text-xs text-muted-foreground">Checking email...</p>
            )}
            {emailExistsWarning && !checkingEmail && (
              <div className="mt-2 p-3 text-sm bg-warning/10 border border-warning/30 rounded-md">
                <p className="text-warning font-medium">{emailExistsWarning}</p>
                <button
                  type="button"
                  onClick={() => router.push(getSignInUrl())}
                  className="mt-1 text-primary hover:text-primary/80 font-medium text-xs underline"
                >
                  Go to Sign In
                </button>
              </div>
            )}
          </div>

          {/* Sub Role Field */}
          <div className="form-group">
            <label className="form-label">
              Sub Role <span className="text-error">*</span>
            </label>
            <select
              {...register('subRole')}
              className={cn(
                "form-input",
                errors.subRole && "border-error focus:ring-error"
              )}
              disabled={isLoading}
            >
              <option value="">Select your {roleTitle.toLowerCase()} type</option>
              {subRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.subRole && (
              <p className="form-error">{errors.subRole.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="form-group">
            <PasswordInput
              {...register('password')}
              label="Password"
              placeholder="Create a strong password"
              error={errors.password?.message}
              variant="default"
              disabled={isLoading}
              required
            />
            <PasswordStrengthMeter password={watch('password')} className="mt-2" />
          </div>

          {/* Confirm Password Field */}
          <div className="form-group">
            <PasswordInput
              {...register('confirmPassword')}
              label="Confirm Password"
              placeholder="Confirm your password"
              error={errors.confirmPassword?.message}
              variant="default"
              disabled={isLoading}
              required
            />
          </div>

          {/* Terms and Privacy */}
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                {...register('termsAccepted')}
                type="checkbox"
                className="mt-0.5 rounded border-border bg-card text-primary focus:ring-primary"
                disabled={isLoading}
              />
              <span className="text-muted-foreground">
                I agree to the{' '}
                <button type="button" className="text-primary hover:underline">
                  Terms of Service
                </button>
              </span>
            </label>
            {errors.termsAccepted && (
              <p className="form-error">{errors.termsAccepted.message}</p>
            )}

            <label className="flex items-start gap-2 text-sm">
              <input
                {...register('privacyAccepted')}
                type="checkbox"
                className="mt-0.5 rounded border-border bg-card text-primary focus:ring-primary"
                disabled={isLoading}
              />
              <span className="text-muted-foreground">
                I agree to the{' '}
                <button type="button" className="text-primary hover:underline">
                  Privacy Policy
                </button>
              </span>
            </label>
            {errors.privacyAccepted && (
              <p className="form-error">{errors.privacyAccepted.message}</p>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 text-sm text-error bg-error/10 border border-error/30 rounded-md">
              {submitError}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="orange"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : `Create ${roleTitle} Account`}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => router.push(getSignInUrl())}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
              disabled={isLoading}
            >
              Sign In
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function to get sub-role options based on role
export function getSubRoleOptions(role: UserRole): { value: string; label: string }[] {
  switch (role) {
    case 'CUSTOMER':
      return Object.entries(CUSTOMER_CATEGORIES).map(([, value]) => ({
        value,
        label: value.replace(/_/g, ' ')
      }))

    case 'PARTNER':
      return Object.entries(PARTNER_TYPES).map(([, value]) => ({
        value,
        label: value.replace(/_/g, ' ')
      }))

    case 'EMPLOYEE':
      return Object.entries(EMPLOYEE_ROLES).map(([, value]) => ({
        value,
        label: value.replace(/_/g, ' ')
      }))

    case 'VENDOR':
      return [
        { value: 'COLLECTION', label: 'Collection Services' },
        { value: 'AUCTION', label: 'Auction Services' },
        { value: 'SERVICE', label: 'General Services' }
      ]

    default:
      return []
  }
}