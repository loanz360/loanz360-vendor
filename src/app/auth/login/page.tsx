'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { clientLogger } from '@/lib/utils/client-logger'
import { useLoginRateLimit } from '@/lib/auth/client-rate-limiter'

// Simple validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional()
})

type LoginInput = z.infer<typeof loginSchema>

export default function VendorsLoginPage() {
  const router = useRouter()
  const { signIn, loading, user } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  })

  const rateLimit = useLoginRateLimit(email)

  const onSubmit = async (data: LoginInput) => {
    setSubmitError(null)
    setEmail(data.email)

    if (rateLimit.isLocked) {
      const remainingMinutes = Math.ceil(rateLimit.remainingTime / 60000)
      setSubmitError(`Too many failed attempts. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`)
      return
    }

    try {
      clientLogger.info('Attempting vendor login', { email: data.email })

      const { error } = await signIn(data.email, data.password)

      if (error) {
        clientLogger.error('Vendor login failed', { email: data.email, error: error.message })
        const result = rateLimit.recordFailed()

        if (result.isLocked) {
          setSubmitError('Too many failed attempts. Account locked for 15 minutes.')
          return
        }

        if (error.message.includes('Invalid login credentials')) {
          setSubmitError(`Invalid email or password. ${result.remainingAttempts} attempt${result.remainingAttempts !== 1 ? 's' : ''} remaining.`)
        } else if (error.message.includes('Email not confirmed')) {
          setSubmitError('Please verify your email address before signing in.')
        } else {
          setSubmitError(error.message || 'An error occurred during sign in.')
        }
        return
      }

      clientLogger.info('Vendor login successful', { email: data.email })
      rateLimit.clearAttempts()

      router.push('/vendors')
      router.refresh()

    } catch (err) {
      clientLogger.error('Vendor login exception', { email: data.email, error: err instanceof Error ? err.message : String(err) })
      setSubmitError('An unexpected error occurred. Please try again.')
    }
  }

  // If user is already logged in and is vendor, redirect
  React.useEffect(() => {
    if (user && user.role === 'VENDOR') {
      clientLogger.info('User already logged in as vendor - redirecting')
      router.push('/vendors')
    }
  }, [user, router])

  const isLoading = loading || isSubmitting

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto relative overflow-hidden" variant="ash">
        {/* Animated Loading Bar */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-orange-500/20 overflow-hidden z-50">
            <div className="h-full bg-orange-500 w-[40%] animate-progress" />
            <style jsx>{`
              @keyframes progress {
                0% {
                  transform: translateX(-100%);
                }
                100% {
                  transform: translateX(350%);
                }
              }
              .animate-progress {
                animation: progress 1.5s ease-in-out infinite;
              }
            `}</style>
          </div>
        )}
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">Vendor Sign In</CardTitle>
            <CardDescription className="text-orange-400">
              Access your vendor portal and manage your services with LOANZ 360. Connect, deliver, and grow together.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="form-group">
              <Input
                {...register('email')}
                type="email"
                label="Email Address"
                placeholder="Enter your email address"
                error={errors.email?.message}
                variant="default"
                disabled={isLoading || rateLimit.isLocked}
                autoFocus
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password Field */}
            <div className="form-group">
              <PasswordInput
                {...register('password')}
                label="Password"
                placeholder="Enter your password"
                error={errors.password?.message}
                variant="default"
                disabled={isLoading}
                required
              />
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  {...register('rememberMe')}
                  type="checkbox"
                  className="rounded border-border bg-card text-primary focus:ring-primary"
                  disabled={isLoading}
                />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => router.push('/auth/forgot-password')}
                className="text-sm text-primary transition-colors"
                disabled={isLoading}
              >
                Forgot password?
              </button>
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
              disabled={isLoading || rateLimit.isLocked}
            >
              {rateLimit.isLocked ? `Locked (${Math.ceil(rateLimit.remainingTime / 1000)}s)` : isLoading ? 'Signing in...' : 'Sign In to Vendor Portal'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              New vendor partner?{' '}
              <button
                type="button"
                onClick={() => router.push('/auth/register')}
                className="text-primary font-medium transition-colors"
                disabled={isLoading}
              >
                Register now
              </button>
            </p>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Are you a different type of user?{' '}
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="text-primary transition-colors"
                disabled={isLoading}
              >
                Go to main login
              </button>
            </p>
          </div>

          {/* Vendor Badge */}
          <div className="mt-6 text-center pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-[#FF6700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Vendor Portal Access
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}