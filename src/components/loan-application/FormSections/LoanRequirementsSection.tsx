/**
 * Loan Requirements Section Component
 * Premium loan amount, tenure, and purpose selection with sliders
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { LoanTypeConfig } from '../types';
import { PremiumInput, PremiumSelect, PremiumTextarea } from './PremiumInput';

// =====================================================
// ICONS
// =====================================================

const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3 6l-3-3h1.5a3 3 0 100-6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const TargetIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

const PercentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 5.25L5.25 18.75M7.5 7.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm12 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface LoanRequirementsSectionProps {
  loanConfig: LoanTypeConfig;
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: unknown) => void;
  className?: string;
}

interface EMIBreakdown {
  emi: number;
  totalInterest: number;
  totalAmount: number;
  interestRate: number;
}

// =====================================================
// LOAN PURPOSE OPTIONS BY CATEGORY
// =====================================================

const LOAN_PURPOSE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  PERSONAL_LOAN: [
    { value: 'medical', label: 'Medical Emergency' },
    { value: 'wedding', label: 'Wedding Expenses' },
    { value: 'travel', label: 'Travel & Vacation' },
    { value: 'education', label: 'Education / Upskilling' },
    { value: 'home_renovation', label: 'Home Renovation' },
    { value: 'debt_consolidation', label: 'Debt Consolidation' },
    { value: 'other', label: 'Other Personal Needs' },
  ],
  HOME_LOAN: [
    { value: 'purchase_new', label: 'Purchase New Property' },
    { value: 'purchase_resale', label: 'Purchase Resale Property' },
    { value: 'construction', label: 'Construction on Plot' },
    { value: 'extension', label: 'Home Extension' },
    { value: 'renovation', label: 'Home Renovation' },
  ],
  BUSINESS_LOAN: [
    { value: 'working_capital', label: 'Working Capital' },
    { value: 'expansion', label: 'Business Expansion' },
    { value: 'equipment', label: 'Equipment Purchase' },
    { value: 'inventory', label: 'Inventory Purchase' },
    { value: 'marketing', label: 'Marketing & Advertising' },
    { value: 'debt_refinance', label: 'Debt Refinancing' },
  ],
  NEW_CAR_LOAN: [
    { value: 'personal_use', label: 'Personal Use' },
    { value: 'commercial_use', label: 'Commercial Use' },
  ],
  USED_CAR_LOAN: [
    { value: 'personal_use', label: 'Personal Use' },
    { value: 'commercial_use', label: 'Commercial Use' },
  ],
  EDUCATION_LOAN: [
    { value: 'domestic_ug', label: 'Domestic Undergraduate' },
    { value: 'domestic_pg', label: 'Domestic Postgraduate' },
    { value: 'abroad_ug', label: 'Study Abroad - Undergraduate' },
    { value: 'abroad_pg', label: 'Study Abroad - Postgraduate' },
    { value: 'professional_course', label: 'Professional Course' },
    { value: 'skill_development', label: 'Skill Development' },
  ],
  default: [
    { value: 'general', label: 'General Purpose' },
    { value: 'other', label: 'Other' },
  ],
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const formatCurrency = (amount: number): string => {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
};

const formatFullCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
};

const calculateEMI = (principal: number, rate: number, tenure: number): EMIBreakdown => {
  const monthlyRate = rate / (12 * 100);
  const months = tenure;

  if (monthlyRate === 0) {
    return {
      emi: principal / months,
      totalInterest: 0,
      totalAmount: principal,
      interestRate: rate,
    };
  }

  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
              (Math.pow(1 + monthlyRate, months) - 1);
  const totalAmount = emi * months;
  const totalInterest = totalAmount - principal;

  return {
    emi: Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalAmount: Math.round(totalAmount),
    interestRate: rate,
  };
};

// =====================================================
// PREMIUM SLIDER COMPONENT
// =====================================================

interface PremiumSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue: (value: number) => string;
  onChange: (value: number) => void;
  icon: React.ReactNode;
  presets?: { value: number; label: string }[];
  gradient?: string;
}

const PremiumSlider = ({
  label,
  value,
  min,
  max,
  step = 1,
  formatValue,
  onChange,
  icon,
  presets,
  gradient = 'from-brand-primary to-orange-500',
}: PremiumSliderProps) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            `bg-gradient-to-br ${gradient}`
          )}>
            {icon}
          </div>
          <span className="text-sm font-medium text-white/70">{label}</span>
        </div>
        <motion.div
          key={value}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xl font-bold text-white"
        >
          {formatValue(value)}
        </motion.div>
      </div>

      {/* Slider */}
      <div className="relative py-3">
        {/* Track Background */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          {/* Filled Track */}
          <motion.div
            className={cn('h-full rounded-full bg-gradient-to-r', gradient)}
            style={{ width: `${percentage}%` }}
            layoutId={`slider-fill-${label}`}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Thumb */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 -ml-3"
          style={{ left: `${percentage}%` }}
          layoutId={`slider-thumb-${label}`}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className={cn(
            'w-6 h-6 rounded-full shadow-lg',
            `bg-gradient-to-br ${gradient}`,
            'ring-4 ring-zinc-900'
          )} />
        </motion.div>

        {/* Native Range Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Min/Max Labels */}
      <div className="flex justify-between mt-2 text-xs text-white/40">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>

      {/* Presets */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {presets.map((preset) => (
            <motion.button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                value === preset.value
                  ? `bg-gradient-to-r ${gradient} text-white shadow-lg`
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              )}
            >
              {preset.label}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// =====================================================
// EMI CALCULATOR CARD
// =====================================================

interface EMICalculatorCardProps {
  emiBreakdown: EMIBreakdown;
  tenure: number;
}

const EMICalculatorCard = ({ emiBreakdown, tenure }: EMICalculatorCardProps) => {
  const principalPercentage = (100 - (emiBreakdown.totalInterest / emiBreakdown.totalAmount) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary/20 to-orange-500/10 border border-brand-primary/20"
    >
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center">
            <SparklesIcon className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white/70">Estimated EMI</h4>
            <p className="text-xs text-white/40">Based on {emiBreakdown.interestRate}% interest rate</p>
          </div>
        </div>

        {/* EMI Amount */}
        <motion.div
          key={emiBreakdown.emi}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center mb-6"
        >
          <span className="text-4xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            {formatFullCurrency(emiBreakdown.emi)}
          </span>
          <span className="text-white/50 ml-2">/ month</span>
        </motion.div>

        {/* Visual Breakdown */}
        <div className="mb-4">
          <div className="h-3 rounded-full bg-white/10 overflow-hidden flex">
            <motion.div
              className="bg-emerald-500 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${principalPercentage}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <motion.div
              className="bg-orange-500 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${100 - principalPercentage}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-white/60">Principal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-white/60">Interest</span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/40 mb-1">Total Interest</p>
            <p className="text-sm font-semibold text-orange-400">
              {formatFullCurrency(emiBreakdown.totalInterest)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/40 mb-1">Total Payable</p>
            <p className="text-sm font-semibold text-white">
              {formatFullCurrency(emiBreakdown.totalAmount)}
            </p>
          </div>
        </div>

        {/* Tenure Info */}
        <div className="mt-4 p-3 rounded-xl bg-white/5 text-center">
          <p className="text-xs text-white/40">
            {tenure} monthly payments over {Math.floor(tenure / 12)} years {tenure % 12 > 0 ? `${tenure % 12} months` : ''}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function LoanRequirementsSection({
  loanConfig,
  formData,
  errors,
  onFieldChange,
  className,
}: LoanRequirementsSectionProps) {
  const loanAmount = (formData.loanAmount as number) || loanConfig.minAmount;
  const tenure = (formData.tenure as number) || loanConfig.minTenure;
  const loanPurpose = (formData.loanPurpose as string) || '';
  const additionalNotes = (formData.additionalNotes as string) || '';

  // Parse interest rate from config (e.g., "8.5% - 14%" -> use midpoint)
  const interestRate = useMemo(() => {
    const rateStr = loanConfig.interestRateRange;
    const match = rateStr.match(/(\d+\.?\d*)%?\s*-\s*(\d+\.?\d*)%?/);
    if (match) {
      const min = parseFloat(match[1]);
      const max = parseFloat(match[2]);
      return (min + max) / 2;
    }
    return 10; // Default rate
  }, [loanConfig.interestRateRange]);

  // Calculate EMI
  const emiBreakdown = useMemo(() => {
    return calculateEMI(loanAmount, interestRate, tenure);
  }, [loanAmount, interestRate, tenure]);

  // Get purpose options for this loan type
  const purposeOptions = LOAN_PURPOSE_OPTIONS[loanConfig.code] || LOAN_PURPOSE_OPTIONS.default;

  // Amount presets based on loan type
  const amountPresets = useMemo(() => {
    const range = loanConfig.maxAmount - loanConfig.minAmount;
    return [
      { value: loanConfig.minAmount, label: formatCurrency(loanConfig.minAmount) },
      { value: Math.round(loanConfig.minAmount + range * 0.25), label: formatCurrency(Math.round(loanConfig.minAmount + range * 0.25)) },
      { value: Math.round(loanConfig.minAmount + range * 0.5), label: formatCurrency(Math.round(loanConfig.minAmount + range * 0.5)) },
      { value: Math.round(loanConfig.minAmount + range * 0.75), label: formatCurrency(Math.round(loanConfig.minAmount + range * 0.75)) },
      { value: loanConfig.maxAmount, label: formatCurrency(loanConfig.maxAmount) },
    ];
  }, [loanConfig]);

  // Tenure presets
  const tenurePresets = useMemo(() => {
    const presets = [];
    for (let t = loanConfig.minTenure; t <= loanConfig.maxTenure; t += 12) {
      if (t === 12) presets.push({ value: 12, label: '1 Year' });
      else if (t === 24) presets.push({ value: 24, label: '2 Years' });
      else if (t === 36) presets.push({ value: 36, label: '3 Years' });
      else if (t === 60) presets.push({ value: 60, label: '5 Years' });
      else if (t === 84) presets.push({ value: 84, label: '7 Years' });
      else if (t === 120) presets.push({ value: 120, label: '10 Years' });
      else if (t === 180) presets.push({ value: 180, label: '15 Years' });
      else if (t === 240) presets.push({ value: 240, label: '20 Years' });
      else if (t === 360) presets.push({ value: 360, label: '30 Years' });
    }
    return presets.slice(0, 5);
  }, [loanConfig]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Section Header */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">
          Loan Requirements
        </h3>
        <p className="text-sm text-white/60">
          Tell us how much you need and for how long. Use the sliders to adjust your loan parameters.
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Sliders */}
        <div className="lg:col-span-3 space-y-6">
          {/* Loan Amount Slider */}
          <PremiumSlider
            label="Loan Amount"
            value={loanAmount}
            min={loanConfig.minAmount}
            max={loanConfig.maxAmount}
            step={loanConfig.minAmount >= 100000 ? 100000 : 10000}
            formatValue={formatCurrency}
            onChange={(value) => onFieldChange('loanAmount', value)}
            icon={<CurrencyIcon className="w-5 h-5 text-white" />}
            presets={amountPresets}
            gradient="from-emerald-500 to-teal-500"
          />

          {/* Tenure Slider */}
          <PremiumSlider
            label="Loan Tenure"
            value={tenure}
            min={loanConfig.minTenure}
            max={loanConfig.maxTenure}
            step={loanConfig.maxTenure > 60 ? 12 : 6}
            formatValue={(v) => `${v} months`}
            onChange={(value) => onFieldChange('tenure', value)}
            icon={<CalendarIcon className="w-5 h-5 text-white" />}
            presets={tenurePresets}
            gradient="from-violet-500 to-purple-500"
          />

          {/* Loan Purpose */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <TargetIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-white/70">Loan Purpose</span>
            </div>

            <PremiumSelect
              label=""
              options={purposeOptions}
              value={loanPurpose}
              onChange={(e) => onFieldChange('loanPurpose', e.target.value)}
              error={errors.loanPurpose}
              placeholder="Select loan purpose"
              required
            />

            {/* Additional Notes */}
            <div className="mt-4">
              <PremiumTextarea
                label="Additional Notes (Optional)"
                value={additionalNotes}
                onChange={(e) => onFieldChange('additionalNotes', e.target.value)}
                placeholder="Any specific requirements or details about your loan purpose..."
                rows={3}
                maxLength={500}
                showCharCount
              />
            </div>
          </motion.div>
        </div>

        {/* Right Column - EMI Calculator */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <EMICalculatorCard emiBreakdown={emiBreakdown} tenure={tenure} />

            {/* Interest Rate Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <PercentIcon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-white/40">Interest Rate Range</p>
                  <p className="text-sm font-medium text-white">{loanConfig.interestRateRange}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/40">
                Final interest rate depends on your credit profile, income, and other factors.
                The EMI shown above is an estimate for illustration purposes.
              </p>
            </motion.div>

            {/* Processing Time */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Expected Processing Time</span>
                <span className="text-sm font-medium text-emerald-400">{loanConfig.processingTime}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Collateral Notice for Secured Loans */}
      {loanConfig.requiresCollateral && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-300">Collateral Required</p>
              <p className="text-xs text-white/60 mt-1">
                This loan type requires collateral security. You'll be asked to provide property or asset details in the next step.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default LoanRequirementsSection;
