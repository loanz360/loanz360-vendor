/**
 * BA Lead Form - Business Associate Lead Capture Form
 * Wrapper around ULAPDynamicForm for BA-specific features
 *
 * Uses shared ULAPSubcategoryCard component for consistent UI
 */

'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { ULAPDynamicForm } from '../ULAPDynamicForm';
import { ULAPSubcategoryCard } from '../shared/ULAPCategoryCard';
import type { ULAPFormData, ULAPLoanSubcategory } from '../types';

interface BALeadFormProps {
  /** BA Partner ID */
  partnerId: string;
  /** BA Partner Name */
  partnerName: string;
  /** Pre-selected loan subcategory */
  subcategoryId?: string;
  /** Available loan subcategories */
  loanSubcategories?: ULAPLoanSubcategory[];
  /** Callback when lead is submitted */
  onSubmit: (data: ULAPFormData & { source: 'BA'; partnerId: string }) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback when draft is saved */
  onSaveDraft?: (data: ULAPFormData) => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

// Icons
const BuildingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export function BALeadForm({
  partnerId,
  partnerName,
  subcategoryId: initialSubcategoryId,
  loanSubcategories = [],
  onSubmit,
  onCancel,
  onSaveDraft,
  className,
}: BALeadFormProps) {
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(
    initialSubcategoryId
  );
  const [showLoanSelector, setShowLoanSelector] = useState(!initialSubcategoryId);

  // Handle form submission with BA-specific data
  const handleSubmit = useCallback(async (data: ULAPFormData) => {
    await onSubmit({
      ...data,
      source: 'BA',
      partnerId,
      loan_subcategory_id: selectedSubcategoryId,
    });
  }, [onSubmit, partnerId, selectedSubcategoryId]);

  // Loan Type Selector
  if (showLoanSelector && loanSubcategories.length > 0) {
    return (
      <div className={cn('min-h-screen bg-zinc-950 p-6', className)}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <BuildingIcon className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-blue-400">{partnerName}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Create New Lead</h1>
            <p className="text-white/60">Select the loan type to proceed with the application</p>
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
                categoryColor="#3B82F6" // Blue theme for BA
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
      {/* Loan Type Selector (Compact) */}
      {loanSubcategories.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="relative">
            <button
              onClick={() => setShowLoanSelector(true)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl',
                'bg-white/5 border border-white/10 hover:border-white/20',
                'text-white transition-all duration-200'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/50">Loan Type:</span>
                <span className="font-medium">
                  {loanSubcategories.find((l) => l.id === selectedSubcategoryId)?.name ||
                    'Select Loan Type'}
                </span>
              </div>
              <ChevronDownIcon className="w-5 h-5 text-white/50" />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Form */}
      <ULAPDynamicForm
        source="BA"
        subcategoryId={selectedSubcategoryId}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        onSaveDraft={onSaveDraft}
        showCoApplicant={true}
      />
    </div>
  );
}

export default BALeadForm;
