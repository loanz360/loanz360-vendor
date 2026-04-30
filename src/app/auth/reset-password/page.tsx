'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { PasswordStrengthMeter } from '@/components/ui/password-strength-meter'
import { clientLogger } from '@/lib/utils/client-logger'
import { createSupabaseClient } from '@/lib/supabase/client'
import { VALIDATION_RULES } from '@/lib/constants'

const resetPasswordSchema = z.object({
  password: z.string()
    .min(1, 'Password is required')
    .min(VALIDATION_RULES.password.minLength, `Password must be at least ${VALIDATION_RULES.password.minLength} characters`)
    .max(VALIDATION_RULES.password.maxLength, `Password must not exceed ${VALIDATION_RULES.password.maxLength} characters`)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/\d/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] })

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export default function VendorResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [validatingToken, setValidatingToken] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' }
  })

  useEffect(() => {
    const validateToken = async () => {
      try {
        const token = searchParams.get('token')
        const type = searchParams.get('type')
        if (!token || type !== 'recovery') { setTokenValid(false); setValidatingToken(false); return }
        const supabase = createSupabaseClient()
        const { data, error } = await supabase.auth.getSession()
        setTokenValid(!error && !!data.session)
      } catch { setTokenValid(false) }
      finally { setValidatingToken(false) }
    }
    validateToken()
  }, [searchParams])

  const onSubmit = async (data: ResetPasswordInput) => {
    setSubmitError(null)
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) { setSubmitError(error.message || 'Failed to reset password. Please try again.'); return }
      clientLogger.info('Vendor password reset successful')
      setSubmitSuccess(true)
      setTimeout(() => router.push('/auth/login'), 3000)
    } catch (err) {
      clientLogger.error('Password reset exception', err)
      setSubmitError('An unexpected error occurred. Please try again.')
    }
  }

  if (validatingToken) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto" variant="default">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><Logo size="xl" /></div>
          <CardTitle>Validating...</CardTitle>
          <CardDescription>Verifying your reset link</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    </div>
  )

  if (!tokenValid) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto" variant="default">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-error/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Invalid Reset Link</CardTitle>
          <CardDescription className="text-error">This link is invalid or has expired</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-error/10 border border-error/30 rounded-lg p-4">
            <p className="text-sm text-error">The reset link is invalid, expired, or already used.</p>
          </div>
          <Button variant="orange" size="lg" className="w-full" onClick={() => router.push('/auth/forgot-password')}>
            Request New Reset Link
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => router.push('/auth/login')}>
            Back to Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  if (submitSuccess) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto" variant="default">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Password Reset Successful!</CardTitle>
          <CardDescription className="text-success">Your password has been reset</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">Redirecting to sign in in 3 seconds...</p>
          <Button variant="orange" size="lg" className="w-full" onClick={() => router.push('/auth/login')}>Sign In Now</Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto" variant="default">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><Logo size="xl" /></div>
          <CardTitle className="text-2xl font-bold">Create New Password</CardTitle>
          <CardDescription className="text-orange-400">Enter a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <PasswordInput {...register('password')} label="New Password" placeholder="Enter your new password"
                error={errors.password?.message} variant="default" disabled={isSubmitting} autoFocus required />
              <PasswordStrengthMeter password={watch('password')} className="mt-2" />
            </div>
            <PasswordInput {...register('confirmPassword')} label="Confirm New Password" placeholder="Confirm your new password"
              error={errors.confirmPassword?.message} variant="default" disabled={isSubmitting} required />
            {submitError && <div className="p-3 text-sm text-error bg-error/10 border border-error/30 rounded-md">{submitError}</div>}
            <Button type="submit" variant="orange" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button type="button" onClick={() => router.push('/auth/login')} className="text-sm text-primary">Cancel and return to Sign In</button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
