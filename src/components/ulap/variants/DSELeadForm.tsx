/**
 * DSE Lead Form - Direct Sales Executive Lead Capture Form
 * Wrapper around ULAPDynamicForm for DSE-specific features
 *
 * Uses shared ULAPSubcategoryCard component for consistent UI
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { ULAPDynamicForm } from '../ULAPDynamicForm';
import { ULAPSubcategoryCard } from '../shared/ULAPCategoryCard';
import type { ULAPFormData, ULAPLoanSubcategory } from '../types';

interface DSELeadFormProps {
  /** DSE Employee ID */
  employeeId: string;
  /** DSE Employee Name */
  employeeName: string;
  /** DSE's Branch/Region */
  branchId?: string;
  branchName?: string;
  /** Pre-selected loan subcategory */
  subcategoryId?: string;
  /** Available loan subcategories */
  loanSubcategories?: ULAPLoanSubcategory[];
  /** Today's target info */
  targetInfo?: {
    daily: number;
    achieved: number;
    remaining: number;
  };
  /** Callback when lead is submitted */
  onSubmit: (data: ULAPFormData & { source: 'DSE'; employeeId: string }) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback when draft is saved */
  onSaveDraft?: (data: ULAPFormData) => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

// Icons
const UserCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TargetIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrophyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m3.044-1.35a6.726 6.726 0 01-2.748 1.35m0 0V12" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export function DSELeadForm({
  employeeId,
  employeeName,
  branchId,
  branchName,
  subcategoryId: initialSubcategoryId,
  loanSubcategories = [],
  targetInfo,
  onSubmit,
  onCancel,
  onSaveDraft,
  className,
}: DSELeadFormProps) {
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(
    initialSubcategoryId
  );
  const [showLoanSelector, setShowLoanSelector] = useState(!initialSubcategoryId);

  // Handle form submission with DSE-specific data
  const handleSubmit = useCallback(async (data: ULAPFormData) => {
    await onSubmit({
      ...data,
      source: 'DSE',
      employeeId,
      branchId,
      loan_subcategory_id: selectedSubcategoryId,
    });
  }, [onSubmit, employeeId, branchId, selectedSubcategoryId]);

  // Calculate target progress
  const targetProgress = targetInfo
    ? Math.min((targetInfo.achieved / targetInfo.daily) * 100, 100)
    : 0;

  // Loan Type Selector with DSE Dashboard
  if (showLoanSelector && loanSubcategories.length > 0) {
    return (
      <div className={cn('min-h-screen bg-zinc-950 p-6', className)}>
        <div className="max-w-4xl mx-auto">
          {/* Header with Target Info */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Employee Info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <UserCircleIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{employeeName}</h2>
                  <p className="text-sm text-white/50">
                    {branchName ? `${branchName} Branch` : 'Direct Sales Executive'}
                  </p>
                </div>
              </div>

              {/* Target Progress */}
              {targetInfo && (
                <div className="flex items-center gap-6 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2">
                    <TargetIcon className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-white/70">Today&apos;s Target:</span>
                    <span className="font-semibold text-white">{targetInfo.daily}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrophyIcon className="w-5 h-5 text-amber-400" />
                    <span className="text-sm text-white/70">Achieved:</span>
                    <span className="font-semibold text-green-400">{targetInfo.achieved}</span>
                  </div>
                  <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${targetProgress}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Page Title */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-white mb-2">Create New Lead</h1>
            <p className="text-white/60">Select loan type to start the application</p>
          </div>

          {/* Loan Type Grid - Using shared ULAPSubcategoryCard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loanSubcategories.map((loan, index) => (
              <ULAPSubcategoryCard
                key={loan.id}
                id={loan.id}
                name={loan.name}
                description={loan.description}
                categoryId={loan.category_id}
                categoryColor="#22C55E" // Green theme for DSE
                minAmount={loan.min_amount}
                maxAmount={loan.max_amount}
                onSelect={() => {
                  setSelectedSubcategoryId(loan.id);
                  setShowLoanSelector(false);
                }}
                animationDelay={index * 0.05}
              />
            ))}
          </div>

          {/* Cancel Button */}
          {onCancel && (
            <div className="text-center mt-8">
              <button
                onClick={onCancel}
                className="text-white/50 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show the dynamic form
  return (
    <div className={className}>
      {/* DSE Info Bar */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Employee Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <UserCircleIcon className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-300">{employeeName}</span>
            </div>

            {/* Loan Type Selector */}
            {loanSubcategories.length > 0 && (
              <button
                onClick={() => setShowLoanSelector(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-white/5 border border-white/10 hover:border-white/20',
                  'text-white transition-all duration-200'
                )}
              >
                <span className="text-sm text-white/50">Loan:</span>
                <span className="font-medium text-sm">
                  {loanSubcategories.find((l) => l.id === selectedSubcategoryId)?.name ||
                    'Select'}
                </span>
                <ChevronDownIcon className="w-4 h-4 text-white/50" />
              </button>
            )}
          </div>

          {/* Target Progress Mini */}
          {targetInfo && (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/5">
              <span className="text-xs text-white/50">Target:</span>
              <span className="text-sm font-medium text-green-400">
                {targetInfo.achieved}/{targetInfo.daily}
              </span>
              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                  style={{ width: `${targetProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Form */}
      <ULAPDynamicForm
        source="DSE"
        subcategoryId={selectedSubcategoryId}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        onSaveDraft={onSaveDraft}
        showCoApplicant={true}
      />
    </div>
  );
}

export default DSELeadForm;
