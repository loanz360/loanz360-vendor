/**
 * Progress Indicator Component
 * Premium animated step progress tracker
 */

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { FormStepConfig } from '../types';

// =====================================================
// ICONS
// =====================================================

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <motion.path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 13l4 4L19 7"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    />
  </svg>
);

// Step Icons
const StepIcons: Record<string, React.FC<{ className?: string }>> = {
  welcome: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  ),
  customer_details: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  employment_details: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  loan_requirements: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  documents: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  review: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>
  ),
  success: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  default: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
};

// =====================================================
// TYPES
// =====================================================

interface ProgressIndicatorProps {
  steps: FormStepConfig[];
  currentStep: number;
  completedSteps: Set<number>;
  variant?: 'horizontal' | 'vertical' | 'compact';
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

// =====================================================
// HORIZONTAL PROGRESS
// =====================================================

const HorizontalProgress = ({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: Omit<ProgressIndicatorProps, 'variant' | 'className'>) => {
  const progress = useMemo(() => {
    return (completedSteps.size / steps.length) * 100;
  }, [completedSteps.size, steps.length]);

  return (
    <div className="w-full">
      {/* Progress Bar */}
      <div className="relative h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-primary to-orange-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Steps */}
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(index);
          const isCurrent = index === currentStep;
          const isClickable = isCompleted || index <= Math.max(...Array.from(completedSteps), 0) + 1;
          const IconComponent = StepIcons[step.id] || StepIcons.default;

          return (
            <motion.button
              key={step.id}
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex flex-col items-center gap-2 group transition-all duration-300',
                isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              )}
            >
              {/* Step Circle */}
              <motion.div
                className={cn(
                  'relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                  isCompleted
                    ? 'bg-emerald-500'
                    : isCurrent
                    ? 'bg-brand-primary'
                    : 'bg-white/10'
                )}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  boxShadow: isCurrent ? '0 0 20px rgba(255, 103, 0, 0.5)' : '0 0 0px rgba(255, 103, 0, 0)',
                }}
              >
                {isCompleted ? (
                  <CheckIcon className="w-5 h-5 text-white" />
                ) : (
                  <IconComponent className={cn(
                    'w-5 h-5',
                    isCurrent ? 'text-white' : 'text-white/50'
                  )} />
                )}

                {/* Pulse Effect for Current */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-brand-primary"
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>

              {/* Step Label */}
              <span className={cn(
                'text-xs font-medium transition-colors max-w-[80px] text-center',
                isCurrent ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-white/50'
              )}>
                {step.shortTitle}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// =====================================================
// VERTICAL PROGRESS
// =====================================================

const VerticalProgress = ({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: Omit<ProgressIndicatorProps, 'variant' | 'className'>) => {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isCurrent = index === currentStep;
        const isLast = index === steps.length - 1;
        const isClickable = isCompleted || index <= Math.max(...Array.from(completedSteps), 0) + 1;
        const IconComponent = StepIcons[step.id] || StepIcons.default;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {/* Connector Line */}
            {!isLast && (
              <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-white/10">
                <motion.div
                  className="w-full bg-emerald-500"
                  initial={{ height: 0 }}
                  animate={{ height: isCompleted ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {/* Step Row */}
            <button
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              className={cn(
                'flex items-start gap-4 w-full p-3 rounded-xl transition-all duration-300',
                isCurrent && 'bg-white/[0.03]',
                isClickable ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-not-allowed'
              )}
            >
              {/* Step Circle */}
              <motion.div
                className={cn(
                  'relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300',
                  isCompleted
                    ? 'bg-emerald-500'
                    : isCurrent
                    ? 'bg-brand-primary'
                    : 'bg-white/10'
                )}
                animate={{
                  scale: isCurrent ? 1.05 : 1,
                }}
              >
                {isCompleted ? (
                  <CheckIcon className="w-5 h-5 text-white" />
                ) : (
                  <IconComponent className={cn(
                    'w-5 h-5',
                    isCurrent ? 'text-white' : 'text-white/50'
                  )} />
                )}
              </motion.div>

              {/* Step Content */}
              <div className="flex-1 text-left pt-1">
                <p className={cn(
                  'text-sm font-medium transition-colors',
                  isCurrent ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-white/60'
                )}>
                  {step.title}
                </p>
                <p className={cn(
                  'text-xs mt-0.5 transition-colors',
                  isCurrent ? 'text-white/60' : 'text-white/40'
                )}>
                  {step.description}
                </p>
                {step.estimatedTime && (
                  <p className="text-xs text-white/30 mt-1">~{step.estimatedTime}</p>
                )}
              </div>

              {/* Status Badge */}
              <div className="pt-1.5">
                {isCompleted && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400"
                  >
                    Done
                  </motion.span>
                )}
                {isCurrent && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-2 py-0.5 rounded-full text-xs bg-brand-primary/20 text-brand-primary"
                  >
                    Current
                  </motion.span>
                )}
              </div>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
};

// =====================================================
// COMPACT PROGRESS
// =====================================================

const CompactProgress = ({
  steps,
  currentStep,
  completedSteps,
}: Omit<ProgressIndicatorProps, 'variant' | 'className' | 'onStepClick'>) => {
  const progress = useMemo(() => {
    return Math.round((completedSteps.size / steps.length) * 100);
  }, [completedSteps.size, steps.length]);

  const currentStepData = steps[currentStep];

  return (
    <div className="flex items-center gap-4">
      {/* Progress Ring */}
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90">
          {/* Background Circle */}
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-white/10"
          />
          {/* Progress Circle */}
          <motion.circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ strokeDasharray: '0 151' }}
            animate={{ strokeDasharray: `${progress * 1.51} 151` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff6700" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>
        </svg>
        {/* Percentage */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{progress}%</span>
        </div>
      </div>

      {/* Current Step Info */}
      <div className="flex-1">
        <p className="text-xs text-white/40">
          Step {currentStep + 1} of {steps.length}
        </p>
        <p className="text-sm font-medium text-white">{currentStepData?.title}</p>
      </div>
    </div>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ProgressIndicator({
  steps,
  currentStep,
  completedSteps,
  variant = 'horizontal',
  onStepClick,
  className,
}: ProgressIndicatorProps) {
  return (
    <div className={cn('w-full', className)}>
      {variant === 'horizontal' && (
        <HorizontalProgress
          steps={steps}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={onStepClick}
        />
      )}
      {variant === 'vertical' && (
        <VerticalProgress
          steps={steps}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={onStepClick}
        />
      )}
      {variant === 'compact' && (
        <CompactProgress
          steps={steps}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
      )}
    </div>
  );
}

export default ProgressIndicator;
