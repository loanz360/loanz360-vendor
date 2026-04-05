'use client'

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const inputVariants = cva(
  "flex w-full rounded-lg border px-3 py-2 text-sm font-poppins ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:border-brand-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-brand-card-dark/50 border-brand-card-border/30 text-foreground hover:border-brand-card-border/60",
        dark: "bg-brand-card-dark/50 border-brand-card-border/30 text-foreground hover:border-brand-card-border/60",
        filled: "bg-brand-card-dark border-transparent text-foreground hover:bg-brand-card-dark/80",
        ghost: "bg-transparent border-transparent hover:bg-brand-card-dark/30 focus:bg-brand-card-dark/50",
        error: "bg-brand-card-dark/50 border-error/50 text-foreground focus:ring-error/30 focus:border-error",
        success: "bg-brand-card-dark/50 border-success/50 text-foreground focus:ring-success/30 focus:border-success",
      },
      inputSize: {
        sm: "h-9 px-3 text-xs",
        default: "h-11 px-4",
        lg: "h-12 px-4",
        xl: "h-14 px-5 text-base",
      }
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string
  error?: string
  helper?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  isLoading?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    variant,
    inputSize,
    type,
    label,
    error,
    helper,
    leftIcon,
    rightIcon,
    isLoading,
    ...props
  }, ref) => {
    const inputId = React.useId()
    const errorId = React.useId()
    const helperId = React.useId()

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-poppins font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            type={type}
            className={cn(
              inputVariants({ variant: error ? "error" : variant, inputSize, className }),
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              isLoading && "pr-10"
            )}
            ref={ref}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={
              error ? errorId : helper ? helperId : undefined
            }
            {...props}
          />

          {(rightIcon || isLoading) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted border-t-primary" />
              ) : (
                rightIcon
              )}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-error">
            {error}
          </p>
        )}

        {helper && !error && (
          <p id={helperId} className="text-xs text-muted-foreground">
            {helper}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

// Specialized input components for LOANZ 360

const CurrencyInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'> & {
  currency?: string
}>(
  ({ currency = "₹", className, ...props }, ref) => (
    <Input
      type="text"
      className={cn("font-mono", className)}
      leftIcon={<span className="text-primary font-semibold">{currency}</span>}
      ref={ref}
      {...props}
    />
  )
)
CurrencyInput.displayName = "CurrencyInput"

const SearchInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ className, placeholder = "Search...", ...props }, ref) => (
    <Input
      type="text"
      placeholder={placeholder}
      leftIcon={
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      className={className}
      ref={ref}
      {...props}
    />
  )
)
SearchInput.displayName = "SearchInput"

const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
      <Input
        type={showPassword ? "text" : "password"}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        }
        className={className}
        ref={ref}
        {...props}
      />
    )
  }
)
PasswordInput.displayName = "PasswordInput"

const OTPInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'maxLength'>>(
  ({ className, ...props }, ref) => (
    <Input
      type="text"
      maxLength={6}
      className={cn("text-center font-mono text-lg tracking-wider", className)}
      placeholder="000000"
      ref={ref}
      {...props}
    />
  )
)
OTPInput.displayName = "OTPInput"

const PhoneInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'> & {
  countryCode?: string
}>(
  ({ countryCode = "+91", className, ...props }, ref) => (
    <Input
      type="tel"
      leftIcon={<span className="text-primary font-semibold">{countryCode}</span>}
      className={cn("font-mono", className)}
      placeholder="9876543210"
      maxLength={10}
      ref={ref}
      {...props}
    />
  )
)
PhoneInput.displayName = "PhoneInput"

export {
  Input,
  CurrencyInput,
  SearchInput,
  PasswordInput,
  OTPInput,
  PhoneInput,
  inputVariants
}