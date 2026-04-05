/**
 * ULAP Field Renderer Component
 * Renders dynamic form fields based on field type
 */

'use client';

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { ULAPFieldRendererProps, ULAPFieldType } from './types';
import { VALIDATION_PATTERNS } from './types';

// Icons
const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationCircleIcon = ({ className }: { className?: string }) => (
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

const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

// Base Input Styles
const baseInputStyles = cn(
  'w-full px-4 py-3 rounded-xl',
  'bg-white/5 border border-white/10',
  'text-white placeholder:text-white/40',
  'focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'transition-all duration-200'
);

const errorInputStyles = 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50';
const verifiedInputStyles = 'border-green-500/50';

export function ULAPFieldRenderer({
  field,
  value,
  error,
  verification,
  onChange,
  onVerify,
  disabled = false,
}: ULAPFieldRendererProps) {
  // Format currency value for display
  const formatCurrency = useCallback((val: unknown): string => {
    if (!val) return '';
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-IN');
  }, []);

  // Parse currency value from formatted string
  const parseCurrency = useCallback((formatted: string): number => {
    const num = parseFloat(formatted.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }, []);

  // Get verification status indicator
  const getVerificationIndicator = () => {
    if (!verification) return null;

    switch (verification) {
      case 'verifying':
        return <LoadingIcon className="w-5 h-5 text-blue-400" />;
      case 'verified':
        return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  // Determine if field should show verify button
  const showVerifyButton = ['pan', 'aadhaar', 'phone', 'email'].includes(field.field_type) && onVerify;

  // Common input wrapper
  const InputWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-2">
      {/* Label */}
      <label className="flex items-center gap-2 text-sm font-medium text-white/80">
        {field.field_label}
        {field.is_required && <span className="text-red-400">*</span>}
        {field.help_text && (
          <span className="text-white/40 text-xs font-normal">({field.help_text})</span>
        )}
      </label>

      {/* Input Container */}
      <div className="relative">
        {children}

        {/* Verification Indicator */}
        {verification && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {getVerificationIndicator()}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400 flex items-center gap-1"
        >
          <ExclamationCircleIcon className="w-3 h-3" />
          {error}
        </motion.p>
      )}

      {/* Verify Button */}
      {showVerifyButton && value && !verification && (
        <motion.button
          type="button"
          onClick={onVerify}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="text-xs text-brand-primary hover:text-brand-primary/80 transition-colors"
        >
          Verify {field.field_label}
        </motion.button>
      )}
    </div>
  );

  // Render based on field type
  const renderField = (): React.ReactNode => {
    const fieldType = field.field_type as ULAPFieldType;

    switch (fieldType) {
      // Text Input
      case 'text':
        return (
          <InputWrapper>
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || `Enter ${field.field_label.toLowerCase()}`}
              disabled={disabled}
              className={cn(
                baseInputStyles,
                error && errorInputStyles,
                verification === 'verified' && verifiedInputStyles
              )}
              maxLength={field.validation_rules?.maxLength}
            />
          </InputWrapper>
        );

      // Email Input
      case 'email':
        return (
          <InputWrapper>
            <input
              type="email"
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || 'email@example.com'}
              disabled={disabled}
              className={cn(
                baseInputStyles,
                error && errorInputStyles,
                verification === 'verified' && verifiedInputStyles
              )}
            />
          </InputWrapper>
        );

      // Phone Input
      case 'phone':
        return (
          <InputWrapper>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-sm font-medium">
                +91
              </span>
              <input
                type="tel"
                value={(value as string) || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  onChange(digits);
                }}
                placeholder={field.placeholder || '9876543210'}
                disabled={disabled}
                maxLength={10}
                className={cn(
                  baseInputStyles,
                  'pl-14 font-mono',
                  error && errorInputStyles,
                  verification === 'verified' && verifiedInputStyles
                )}
              />
            </div>
          </InputWrapper>
        );

      // Number Input
      case 'number':
        return (
          <InputWrapper>
            <input
              type="number"
              value={(value as number) || ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
              placeholder={field.placeholder || '0'}
              disabled={disabled}
              min={field.validation_rules?.min}
              max={field.validation_rules?.max}
              className={cn(
                baseInputStyles,
                'font-mono',
                error && errorInputStyles
              )}
            />
          </InputWrapper>
        );

      // Currency Input
      case 'currency':
        return (
          <InputWrapper>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary font-semibold">
                ₹
              </span>
              <input
                type="text"
                value={formatCurrency(value)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, '');
                  onChange(raw ? parseInt(raw, 10) : '');
                }}
                placeholder={field.placeholder || '0'}
                disabled={disabled}
                className={cn(
                  baseInputStyles,
                  'pl-10 font-mono text-right',
                  error && errorInputStyles
                )}
              />
            </div>
          </InputWrapper>
        );

      // Percentage Input
      case 'percentage':
        return (
          <InputWrapper>
            <div className="relative">
              <input
                type="number"
                value={(value as number) || ''}
                onChange={(e) => {
                  let num = parseFloat(e.target.value);
                  if (num > 100) num = 100;
                  if (num < 0) num = 0;
                  onChange(isNaN(num) ? '' : num);
                }}
                placeholder={field.placeholder || '0'}
                disabled={disabled}
                step="0.01"
                min={0}
                max={100}
                className={cn(
                  baseInputStyles,
                  'pr-10 font-mono',
                  error && errorInputStyles
                )}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 font-medium">
                %
              </span>
            </div>
          </InputWrapper>
        );

      // Date Input
      case 'date':
        return (
          <InputWrapper>
            <input
              type="date"
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className={cn(
                baseInputStyles,
                error && errorInputStyles,
                '[&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert'
              )}
            />
          </InputWrapper>
        );

      // Select Input
      case 'select':
        return (
          <InputWrapper>
            <select
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className={cn(
                baseInputStyles,
                'cursor-pointer appearance-none',
                error && errorInputStyles
              )}
            >
              <option value="" className="bg-zinc-900">
                {field.placeholder || `Select ${field.field_label.toLowerCase()}`}
              </option>
              {field.options?.map((option, index) => (
                <option
                  key={option.value || `option-${index}`}
                  value={option.value}
                  disabled={option.disabled}
                  className="bg-zinc-900"
                >
                  {option.label}
                </option>
              ))}
            </select>
            {/* Dropdown Arrow */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </InputWrapper>
        );

      // Radio Input
      case 'radio':
        return (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white/80">
              {field.field_label}
              {field.is_required && <span className="text-red-400">*</span>}
            </label>
            <div className="flex flex-wrap gap-3">
              {field.options?.map((option) => (
                <motion.label
                  key={option.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200',
                    value === option.value
                      ? 'bg-brand-primary/20 border-2 border-brand-primary/50'
                      : 'bg-white/5 border border-white/10 hover:border-white/20',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <input
                    type="radio"
                    name={field.field_name}
                    value={option.value}
                    checked={value === option.value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                      value === option.value
                        ? 'border-brand-primary bg-brand-primary'
                        : 'border-white/30'
                    )}
                  >
                    {value === option.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-sm text-white/90">{option.label}</span>
                </motion.label>
              ))}
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400"
              >
                {error}
              </motion.p>
            )}
          </div>
        );

      // Checkbox Input
      case 'checkbox':
        return (
          <motion.label
            whileHover={{ scale: 1.01 }}
            className={cn(
              'flex items-start gap-3 cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className="sr-only"
              />
              <div
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200',
                  value
                    ? 'bg-brand-primary border-brand-primary'
                    : 'border-white/30 hover:border-white/50'
                )}
              >
                {value && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-white/90">{field.field_label}</span>
              {field.help_text && (
                <p className="text-xs text-white/50">{field.help_text}</p>
              )}
            </div>
          </motion.label>
        );

      // Textarea Input
      case 'textarea':
        return (
          <InputWrapper>
            <textarea
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || `Enter ${field.field_label.toLowerCase()}`}
              disabled={disabled}
              rows={4}
              maxLength={field.validation_rules?.maxLength}
              className={cn(
                baseInputStyles,
                'resize-none',
                error && errorInputStyles
              )}
            />
          </InputWrapper>
        );

      // PAN Input
      case 'pan':
        return (
          <InputWrapper>
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => {
                const formatted = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                onChange(formatted);
              }}
              placeholder={field.placeholder || 'ABCDE1234F'}
              disabled={disabled}
              maxLength={10}
              className={cn(
                baseInputStyles,
                'uppercase font-mono tracking-wider',
                error && errorInputStyles,
                verification === 'verified' && verifiedInputStyles
              )}
            />
          </InputWrapper>
        );

      // Aadhaar Input
      case 'aadhaar':
        return (
          <InputWrapper>
            <input
              type="text"
              value={
                value
                  ? String(value).replace(/(\d{4})(?=\d)/g, '$1 ').trim()
                  : ''
              }
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                onChange(digits);
              }}
              placeholder={field.placeholder || '1234 5678 9012'}
              disabled={disabled}
              maxLength={14}
              className={cn(
                baseInputStyles,
                'font-mono tracking-wider',
                error && errorInputStyles,
                verification === 'verified' && verifiedInputStyles
              )}
            />
          </InputWrapper>
        );

      // Pincode Input
      case 'pincode':
        return (
          <InputWrapper>
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                onChange(digits);
              }}
              placeholder={field.placeholder || '400001'}
              disabled={disabled}
              maxLength={6}
              className={cn(
                baseInputStyles,
                'font-mono',
                error && errorInputStyles
              )}
            />
          </InputWrapper>
        );

      // File Input
      case 'file':
        return (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white/80">
              {field.field_label}
              {field.is_required && <span className="text-red-400">*</span>}
            </label>
            <motion.label
              whileHover={{ scale: 1.01 }}
              className={cn(
                'flex flex-col items-center justify-center w-full h-32 rounded-xl cursor-pointer',
                'border-2 border-dashed transition-all duration-200',
                value
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-white/20 hover:border-white/40 bg-white/5',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onChange(file);
                }}
                disabled={disabled}
                className="sr-only"
              />
              {value ? (
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="w-6 h-6 text-green-400" />
                  <span className="text-sm text-white/70">
                    {value instanceof File ? value.name : 'File uploaded'}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <UploadIcon className="w-8 h-8 text-white/40" />
                  <span className="text-sm text-white/50">
                    {field.placeholder || 'Click to upload file'}
                  </span>
                </div>
              )}
            </motion.label>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400"
              >
                {error}
              </motion.p>
            )}
          </div>
        );

      default:
        return (
          <InputWrapper>
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || ''}
              disabled={disabled}
              className={cn(baseInputStyles, error && errorInputStyles)}
            />
          </InputWrapper>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {renderField()}
    </motion.div>
  );
}

export default ULAPFieldRenderer;
