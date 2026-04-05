/**
 * Premium Input Components
 * World-class form inputs with micro-interactions
 */

'use client';

import { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { VerificationStatus } from '../types';

// =====================================================
// ICONS
// =====================================================

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <motion.path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 13l4 4L19 7"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3 }}
    />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
  </svg>
);

const LoadingIcon = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeSlashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface PremiumInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  helperText?: string;
  verificationStatus?: VerificationStatus;
  onVerify?: () => Promise<void>;
  verifyLabel?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showCharCount?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outlined';
}

interface PremiumSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  error?: string;
  helperText?: string;
  inputSize?: 'sm' | 'md' | 'lg';
  placeholder?: string;
}

interface PremiumTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
  showCharCount?: boolean;
}

// =====================================================
// PREMIUM INPUT COMPONENT
// =====================================================

export const PremiumInput = forwardRef<HTMLInputElement, PremiumInputProps>(
  (
    {
      label,
      error,
      helperText,
      verificationStatus,
      onVerify,
      verifyLabel = 'Verify',
      leftIcon,
      rightIcon,
      showCharCount,
      inputSize = 'md',
      variant = 'default',
      className,
      type = 'text',
      maxLength,
      value,
      onChange,
      onFocus,
      onBlur,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [charCount, setCharCount] = useState(String(value || '').length);

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        onFocus?.(e);
      },
      [onFocus]
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        onBlur?.(e);
      },
      [onBlur]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setCharCount(e.target.value.length);
        onChange?.(e);
      },
      [onChange]
    );

    const handleVerify = async () => {
      if (!onVerify || isVerifying) return;
      setIsVerifying(true);
      try {
        await onVerify();
      } finally {
        setIsVerifying(false);
      }
    };

    const sizeClasses = {
      sm: 'h-10 text-sm px-3',
      md: 'h-12 text-base px-4',
      lg: 'h-14 text-lg px-5',
    };

    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const getStatusIcon = () => {
      if (isVerifying) {
        return <LoadingIcon className="w-5 h-5 text-brand-primary" />;
      }
      switch (verificationStatus) {
        case 'VERIFIED':
          return <CheckIcon className="w-5 h-5 text-emerald-500" />;
        case 'FAILED':
        case 'MISMATCH':
          return <AlertIcon className="w-5 h-5 text-red-500" />;
        case 'IN_PROGRESS':
          return <LoadingIcon className="w-5 h-5 text-brand-primary" />;
        default:
          return null;
      }
    };

    const getStatusColor = () => {
      if (error) return 'border-red-500/50 focus:border-red-500';
      switch (verificationStatus) {
        case 'VERIFIED':
          return 'border-emerald-500/50 focus:border-emerald-500';
        case 'FAILED':
        case 'MISMATCH':
          return 'border-red-500/50 focus:border-red-500';
        default:
          return 'border-white/10 focus:border-brand-primary';
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('relative', className)}
      >
        {/* Label */}
        <label className="flex items-center gap-1.5 mb-2">
          <span className="text-sm font-medium text-white/80">{label}</span>
          {required && <span className="text-brand-primary">*</span>}
          {helperText && !error && (
            <div className="group relative ml-1">
              <InfoIcon className="w-4 h-4 text-white/40 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-xs text-white/70 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                {helperText}
              </div>
            </div>
          )}
        </label>

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <motion.input
            ref={ref}
            type={inputType}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            maxLength={maxLength}
            disabled={disabled}
            className={cn(
              'w-full rounded-xl transition-all duration-300',
              'bg-white/5 text-white placeholder-white/30',
              'focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
              getStatusColor(),
              sizeClasses[inputSize],
              leftIcon && 'pl-12',
              (rightIcon || isPassword || verificationStatus || onVerify) && 'pr-24',
              disabled && 'opacity-50 cursor-not-allowed',
              isFocused && 'bg-white/[0.08] shadow-lg shadow-brand-primary/5'
            )}
            animate={{
              boxShadow: isFocused ? '0 0 0 4px rgba(255, 103, 0, 0.1)' : '0 0 0 0px rgba(255, 103, 0, 0)',
            }}
            {...props}
          />

          {/* Right Side Actions */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {/* Password Toggle */}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5 text-white/50" />
                ) : (
                  <EyeIcon className="w-5 h-5 text-white/50" />
                )}
              </button>
            )}

            {/* Status Icon */}
            {getStatusIcon()}

            {/* Verify Button */}
            {onVerify && verificationStatus !== 'VERIFIED' && (
              <button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying || disabled}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  'bg-brand-primary/20 text-brand-primary',
                  'hover:bg-brand-primary/30',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isVerifying ? 'Verifying...' : verifyLabel}
              </button>
            )}

            {/* Custom Right Icon */}
            {rightIcon && !isPassword && !verificationStatus && !onVerify && (
              <div className="text-white/40">{rightIcon}</div>
            )}
          </div>

          {/* Focus Glow */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -inset-0.5 rounded-[14px] bg-gradient-to-r from-brand-primary/20 to-orange-500/20 -z-10 blur-sm"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Row: Error/Helper & Char Count */}
        <div className="flex items-center justify-between mt-1.5">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-1.5 text-xs text-red-400"
              >
                <AlertIcon className="w-3.5 h-3.5" />
                {error}
              </motion.p>
            ) : verificationStatus === 'VERIFIED' ? (
              <motion.p
                key="verified"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-1.5 text-xs text-emerald-400"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                Verified successfully
              </motion.p>
            ) : (
              <span />
            )}
          </AnimatePresence>

          {showCharCount && maxLength && (
            <span className={cn(
              'text-xs transition-colors',
              charCount >= maxLength ? 'text-red-400' : 'text-white/40'
            )}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </motion.div>
    );
  }
);

PremiumInput.displayName = 'PremiumInput';

// =====================================================
// PREMIUM SELECT COMPONENT
// =====================================================

export const PremiumSelect = forwardRef<HTMLSelectElement, PremiumSelectProps>(
  (
    {
      label,
      options,
      error,
      helperText,
      inputSize = 'md',
      placeholder = 'Select an option',
      className,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const sizeClasses = {
      sm: 'h-10 text-sm px-3',
      md: 'h-12 text-base px-4',
      lg: 'h-14 text-lg px-5',
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('relative', className)}
      >
        {/* Label */}
        <label className="flex items-center gap-1.5 mb-2">
          <span className="text-sm font-medium text-white/80">{label}</span>
          {required && <span className="text-brand-primary">*</span>}
        </label>

        {/* Select */}
        <div className="relative">
          <select
            ref={ref}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            className={cn(
              'w-full rounded-xl transition-all duration-300 appearance-none cursor-pointer',
              'bg-white/5 text-white',
              'border focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
              error ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-brand-primary',
              sizeClasses[inputSize],
              'pr-12',
              disabled && 'opacity-50 cursor-not-allowed',
              isFocused && 'bg-white/[0.08]'
            )}
            {...props}
          >
            <option value="" disabled className="bg-zinc-900">
              {placeholder}
            </option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="bg-zinc-900"
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* Dropdown Icon */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {/* Error/Helper */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400"
            >
              <AlertIcon className="w-3.5 h-3.5" />
              {error}
            </motion.p>
          )}
          {helperText && !error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1.5 text-xs text-white/40"
            >
              {helperText}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);

PremiumSelect.displayName = 'PremiumSelect';

// =====================================================
// PREMIUM TEXTAREA COMPONENT
// =====================================================

export const PremiumTextarea = forwardRef<HTMLTextAreaElement, PremiumTextareaProps>(
  (
    {
      label,
      error,
      helperText,
      showCharCount,
      className,
      maxLength,
      value,
      onChange,
      required,
      disabled,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [charCount, setCharCount] = useState(String(value || '').length);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('relative', className)}
      >
        {/* Label */}
        <label className="flex items-center gap-1.5 mb-2">
          <span className="text-sm font-medium text-white/80">{label}</span>
          {required && <span className="text-brand-primary">*</span>}
        </label>

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            maxLength={maxLength}
            disabled={disabled}
            rows={rows}
            className={cn(
              'w-full rounded-xl transition-all duration-300 resize-none',
              'bg-white/5 text-white placeholder-white/30',
              'border focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
              'px-4 py-3',
              error ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-brand-primary',
              disabled && 'opacity-50 cursor-not-allowed',
              isFocused && 'bg-white/[0.08]'
            )}
            {...props}
          />

          {/* Focus Glow */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -inset-0.5 rounded-[14px] bg-gradient-to-r from-brand-primary/20 to-orange-500/20 -z-10 blur-sm"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Row */}
        <div className="flex items-center justify-between mt-1.5">
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-1.5 text-xs text-red-400"
              >
                <AlertIcon className="w-3.5 h-3.5" />
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {showCharCount && maxLength && (
            <span className={cn(
              'text-xs transition-colors ml-auto',
              charCount >= maxLength ? 'text-red-400' : 'text-white/40'
            )}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </motion.div>
    );
  }
);

PremiumTextarea.displayName = 'PremiumTextarea';

// =====================================================
// PREMIUM PHONE INPUT
// =====================================================

interface PremiumPhoneInputProps extends Omit<PremiumInputProps, 'leftIcon'> {
  countryCode?: string;
  onCountryCodeChange?: (code: string) => void;
}

export const PremiumPhoneInput = forwardRef<HTMLInputElement, PremiumPhoneInputProps>(
  ({ countryCode = '+91', onCountryCodeChange, ...props }, ref) => {
    return (
      <PremiumInput
        ref={ref}
        type="tel"
        leftIcon={
          <div className="flex items-center gap-1 text-white/60 text-sm font-medium">
            <span className="text-lg">🇮🇳</span>
            <span>{countryCode}</span>
          </div>
        }
        {...props}
      />
    );
  }
);

PremiumPhoneInput.displayName = 'PremiumPhoneInput';

// =====================================================
// PREMIUM CURRENCY INPUT
// =====================================================

interface PremiumCurrencyInputProps extends Omit<PremiumInputProps, 'leftIcon' | 'type'> {
  currency?: string;
}

export const PremiumCurrencyInput = forwardRef<HTMLInputElement, PremiumCurrencyInputProps>(
  ({ currency = '₹', ...props }, ref) => {
    return (
      <PremiumInput
        ref={ref}
        type="text"
        inputMode="numeric"
        leftIcon={
          <span className="text-white/60 font-semibold">{currency}</span>
        }
        {...props}
      />
    );
  }
);

PremiumCurrencyInput.displayName = 'PremiumCurrencyInput';

export default PremiumInput;
