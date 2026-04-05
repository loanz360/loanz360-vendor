'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getRegisterSchema, type RegisterInput } from '@/lib/validations/auth'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput, PhoneInput } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/ui/logo'
import { CUSTOMER_CATEGORIES, PARTNER_TYPES, EMPLOYEE_ROLES } from '@/lib/constants'
import { cn, generateId } from '@/lib/utils/cn'
import { clientLogger } from '@/lib/utils/client-logger'

interface RegisterFormProps {
  className?: string
}

export function RegisterForm({ className }: RegisterFormProps) {
  const router = useRouter()
  const { signUp, loading } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [step, setStep] = useState<'role' | 'details' | 'verification'>('role')
  const [selectedRole, setSelectedRole] = useState<string>('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<RegisterInput>({
    resolver: zodResolver(getRegisterSchema()),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      role: undefined,
      subRole: '',
      termsAccepted: false,
      privacyAccepted: false
    }
  })

  const watchedRole = watch('role')

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
        generated_id: generatedId
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

  const roleOptions = [
    {
      value: 'CUSTOMER',
      title: 'Customer',
      description: 'Apply for loans and manage your finances',
      icon: '👤',
      popular: true
    },
    {
      value: 'PARTNER',
      title: 'Partner',
      description: 'Join as business associate or channel partner',
      icon: '🤝',
      popular: true
    },
    {
      value: 'EMPLOYEE',
      title: 'Employee',
      description: 'LOANZ 360 team member',
      icon: '👔',
      popular: false
    },
    {
      value: 'VENDOR',
      title: 'Vendor',
      description: 'Provide services to LOANZ 360',
      icon: '🏢',
      popular: false
    }
  ]

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role)
    setValue('role', role as RegisterInput['role'])
    setStep('details')
  }

  const isLoading = loading || isSubmitting

  // Step 1: Role Selection
  if (step === 'role') {
    return (
      <Card className={cn("w-full max-w-2xl mx-auto", className)} variant="default">
        <CardHeader className="text-center flex flex-col gap-4">
          <div className="flex justify-center">
            <Logo size="xl" />
          </div>
          <div className="flex flex-col gap-2">
            <CardTitle className="text-2xl font-bold">Join LOANZ 360</CardTitle>
            <CardDescription>
              Choose your role to get started with the right experience
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleRoleSelect(option.value)}
                className={cn(
                  "relative p-6 text-left border rounded-lg transition-all duration-200",
                  "border-border hover:border-primary hover:shadow-card-hover",
                  "bg-card hover:bg-card/80 group"
                )}
                disabled={isLoading}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{option.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors font-poppins">
                        {option.title}
                      </h3>
                      {option.popular && (
                        <Badge variant="orange" size="sm">Popular</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Step 3: Verification
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
            <CardDescription>
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
              onClick={() => router.push('/auth/login')}
            >
              Continue to Sign In
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep('details')}
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

  // Step 2: Details Form
  return (
    <Card className={cn("w-full max-w-md mx-auto", className)} variant="default">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep('role')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={isLoading}
          >
            ← Back
          </button>
          <Badge variant="default">{selectedRole}</Badge>
        </div>
        <div className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Fill in your details to complete registration
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Basic Information */}
          <div className="flex flex-col gap-4">
            <Input
              {...register('fullName')}
              label="Full Name"
              placeholder="Enter your full name"
              error={errors.fullName?.message}
              variant="default"
              disabled={isLoading}
              autoFocus
            />

            <Input
              {...register('username')}
              label="Username"
              placeholder="Choose a username"
              error={errors.username?.message}
              variant="default"
              disabled={isLoading}
            />

            <Input
              {...register('email')}
              type="email"
              label="Email Address"
              placeholder="Enter your email"
              error={errors.email?.message}
              variant="default"
              disabled={isLoading}
            />

            <PhoneInput
              {...register('mobile')}
              label="Mobile Number"
              error={errors.mobile?.message}
              variant="default"
              disabled={isLoading}
            />

            <PasswordInput
              {...register('password')}
              label="Password"
              placeholder="Create a strong password"
              error={errors.password?.message}
              variant="default"
              disabled={isLoading}
            />

            <PasswordInput
              {...register('confirmPassword')}
              label="Confirm Password"
              placeholder="Confirm your password"
              error={errors.confirmPassword?.message}
              variant="default"
              disabled={isLoading}
            />
          </div>

          {/* Role-specific fields */}
          {watchedRole === 'CUSTOMER' && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Customer Category</label>
              <select
                {...register('subRole')}
                className="form-input"
                disabled={isLoading}
              >
                <option value="">Select category</option>
                {Object.entries(CUSTOMER_CATEGORIES).map(([key, value]) => (
                  <option key={key} value={value}>
                    {value.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              {errors.subRole && (
                <p className="text-sm text-error">{errors.subRole.message}</p>
              )}
            </div>
          )}

          {watchedRole === 'PARTNER' && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Partner Type</label>
              <select
                {...register('subRole')}
                className="form-input"
                disabled={isLoading}
              >
                <option value="">Select partner type</option>
                {Object.entries(PARTNER_TYPES).map(([key, value]) => (
                  <option key={key} value={value}>
                    {value.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              {errors.subRole && (
                <p className="text-sm text-error">{errors.subRole.message}</p>
              )}
            </div>
          )}

          {watchedRole === 'EMPLOYEE' && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Employee Role</label>
              <select
                {...register('subRole')}
                className="form-input"
                disabled={isLoading}
              >
                <option value="">Select role</option>
                {Object.entries(EMPLOYEE_ROLES).map(([key, value]) => (
                  <option key={key} value={value}>
                    {value.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              {errors.subRole && (
                <p className="text-sm text-error">{errors.subRole.message}</p>
              )}
            </div>
          )}

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
              <p className="text-sm text-error">{errors.termsAccepted.message}</p>
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
              <p className="text-sm text-error">{errors.privacyAccepted.message}</p>
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
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => router.push('/auth/login')}
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