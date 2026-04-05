/**
 * BP Lead Form - Business Partner Lead Capture Form
 * Wrapper around ULAPDynamicForm for BP-specific features
 *
 * Uses shared ULAPSubcategoryCard component for consistent UI
 */

'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { ULAPDynamicForm } from '../ULAPDynamicForm';
import { ULAPSubcategoryCard } from '../shared/ULAPCategoryCard';
import type { ULAPFormData, ULAPLoanSubcategory } from '../types';

interface BPLeadFormProps {
  /** BP Partner ID */
  partnerId: string;
  /** BP Partner Name (Business Name) */
  partnerName: string;
  /** Branch ID */
  branchId?: string;
  /** Branch Name */
  branchName?: string;
  /** Pre-selected loan subcategory */
  subcategoryId?: string;
  /** Available loan subcategories */
  loanSubcategories?: ULAPLoanSubcategory[];
  /** Callback when lead is submitted */
  onSubmit: (data: ULAPFormData & { source: 'BP'; partnerId: string; branchId?: string }) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback when draft is saved */
  onSaveDraft?: (data: ULAPFormData) => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

// Icons
const BankIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const LightningIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

export function BPLeadForm({
  partnerId,
  partnerName,
  branchId,
  branchName,
  subcategoryId: initialSubcategoryId,
  loanSubcategories = [],
  onSubmit,
  onCancel,
  onSaveDraft,
  className,
}: BPLeadFormProps) {
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(
    initialSubcategoryId
  );
  const [showLoanSelector, setShowLoanSelector] = useState(!initialSubcategoryId);

  // Handle form submission with BP-specific data
  const handleSubmit = useCallback(async (data: ULAPFormData) => {
    await onSubmit({
      ...data,
      source: 'BP',
      partnerId,
      branchId,
      loan_subcategory_id: selectedSubcategoryId,
    });
  }, [onSubmit, partnerId, branchId, selectedSubcategoryId]);

  // Loan Type Selector (Bank-themed)
  if (showLoanSelector && loanSubcategories.length > 0) {
    return (
      <div className={cn('min-h-screen bg-zinc-950 p-6', className)}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <BankIcon className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-purple-400">{partnerName}</span>
              {branchName && (
                <>
                  <span className="text-purple-400/50">|</span>
                  <span className="text-sm text-purple-400/70">{branchName}</span>
                </>
              )}
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">New Loan Application</h1>
            <p className="text-white/60">Select the loan product to proceed</p>

            {/* Quick Features Badge */}
            <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <LightningIcon className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">Instant Processing Available</span>
            </div>
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
                categoryColor="#8B5CF6" // Purple theme for BP
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
      {/* Partner & Loan Info Bar */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Partner Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <BankIcon className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">{partnerName}</span>
            {branchName && (
              <span className="text-sm text-purple-300/70">| {branchName}</span>
            )}
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
              <span className="text-sm text-white/50">Product:</span>
              <span className="font-medium text-sm">
                {loanSubcategories.find((l) => l.id === selectedSubcategoryId)?.name ||
                  'Select'}
              </span>
              <ChevronDownIcon className="w-4 h-4 text-white/50" />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Form */}
      <ULAPDynamicForm
        source="BP"
        subcategoryId={selectedSubcategoryId}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        onSaveDraft={onSaveDraft}
        showCoApplicant={true}
      />
    </div>
  );
}

export default BPLeadForm;
