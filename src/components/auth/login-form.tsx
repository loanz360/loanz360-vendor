'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getLoginSchema, type LoginInput } from '@/lib/validations/auth'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils/cn'
import { sanitizeText } from '@/lib/utils/sanitize'
import { clientLogger } from '@/lib/utils/client-logger'

interface LoginFormProps {
  className?: string
  redirectTo?: string
}

export function LoginForm({ className, redirectTo }: LoginFormProps) {
  const router = useRouter()
  const { signIn, loading } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginInput>({
    resolver: zodResolver(getLoginSchema()),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  })

  const onSubmit = async (data: LoginInput) => {
    setSubmitError(null)

    try {
      const { error } = await signIn(data.email, data.password)

      if (error) {
        // Handle specific error messages
        if (error.message.includes('Invalid login credentials')) {
          setSubmitError('Invalid email or password. Please check your credentials and try again.')
        } else if (error.message.includes('Email not confirmed')) {
          setSubmitError('Please verify your email address before signing in.')
        } else if (error.message.includes('Account not activated')) {
          setSubmitError('Your account is not activated. Please contact support.')
        } else {
          setSubmitError('An error occurred during sign in. Please try again.')
        }
        return
      }

      // Redirect to intended page or dashboard
      const redirectUrl = redirectTo || '/dashboard'
      router.push(redirectUrl)
      router.refresh()

    } catch (err) {
      clientLogger.error('Login error occurred', {
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setSubmitError('An unexpected error occurred. Please try again.')
    }
  }

  const isLoading = loading || isSubmitting

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)} variant="default">
      <CardHeader className="flex flex-col gap-4 text-center">
        <div className="flex justify-center">
          <Logo size="xl" />
        </div>
        <div className="flex flex-col gap-2">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your LOANZ 360 account to continue
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Field */}
          <div className="form-group">
            <Input
              {...register('email')}
              type="email"
              label="Email Address"
              placeholder="Enter your email"
              error={errors.email?.message}
              variant="default"
              disabled={isLoading}
              autoComplete="email"
              autoFocus
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
              autoComplete="current-password"
            />
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 text-sm">
              <input
                {...register('rememberMe')}
                type="checkbox"
                className="rounded border-border bg-card text-primary focus:ring-primary focus:ring-offset-background"
                disabled={isLoading}
              />
              <span className="text-muted-foreground">Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => router.push('/auth/forgot-password')}
              className="text-sm text-primary hover:text-primary/80 transition-colors"
              disabled={isLoading}
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 text-sm text-error bg-error/10 border border-error/30 rounded-md">
              {sanitizeText(submitError)}
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
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Registration Link */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => router.push('/auth/register')}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
              disabled={isLoading}
            >
              Create Account
            </button>
          </p>
        </div>

        {/* Security Notice */}
        <div className="text-center pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            🔒 Your data is protected with enterprise-grade security
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Simplified login form for modal usage
export function QuickLoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const { error: signInError } = await signIn(email, password)

    if (signInError) {
      setError(signInError.message)
      return
    }

    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        variant="default"
        disabled={loading}
        required
      />

      <PasswordInput
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter your password"
        variant="default"
        disabled={loading}
        required
      />

      {error && (
        <div className="text-sm text-error bg-error/10 border border-error/30 rounded-md p-2">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="orange"
        className="w-full"
        disabled={loading || !email || !password}
      >
        {loading ? 'Signing In...' : 'Sign In'}
      </Button>
    </form>
  )
}