/**
 * Customer Lead Form - Self-Service Customer Application Form
 * Wrapper around ULAPDynamicForm for Customer-specific features
 *
 * Uses shared ULAPCategoryCard and ULAPSubcategoryCard components
 * for consistent UI across all ULAP forms
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { ULAPDynamicForm } from '../ULAPDynamicForm';
import {
  ULAPCategoryCard,
  ULAPSubcategoryCard,
  getCategoryColor
} from '../shared/ULAPCategoryCard';
import type { ULAPFormData, ULAPLoanSubcategory, ULAPLoanCategory } from '../types';

interface CustomerLeadFormProps {
  /** Pre-selected loan category */
  categoryId?: string;
  /** Pre-selected loan subcategory */
  subcategoryId?: string;
  /** Available loan categories */
  loanCategories?: ULAPLoanCategory[];
  /** Available loan subcategories */
  loanSubcategories?: ULAPLoanSubcategory[];
  /** Referral code (if any) */
  referralCode?: string;
  /** Callback when lead is submitted */
  onSubmit: (data: ULAPFormData & { source: 'CUSTOMER' | 'REFERRAL' }) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback when draft is saved */
  onSaveDraft?: (data: ULAPFormData) => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

// Category icons and colors are now imported from shared ULAPCategoryCard module

// Icons
const GiftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export function CustomerLeadForm({
  categoryId: initialCategoryId,
  subcategoryId: initialSubcategoryId,
  loanCategories = [],
  loanSubcategories = [],
  referralCode,
  onSubmit,
  onCancel,
  onSaveDraft,
  className,
}: CustomerLeadFormProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    initialCategoryId
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(
    initialSubcategoryId
  );
  const [step, setStep] = useState<'category' | 'subcategory' | 'form'>(
    initialSubcategoryId ? 'form' : initialCategoryId ? 'subcategory' : 'category'
  );
  const [bankCountsMap, setBankCountsMap] = useState<Record<string, number>>({});

  // Fetch bank counts on mount
  useEffect(() => {
    async function fetchBankCounts() {
      try {
        const response = await fetch('/api/ulap/bank-counts', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.bankCounts) {
            setBankCountsMap(data.bankCounts);
          }
        }
      } catch (error) {
        console.error('Failed to fetch bank counts:', error);
      }
    }
    fetchBankCounts();
  }, []);

  // Filter subcategories by selected category
  const filteredSubcategories = selectedCategoryId
    ? loanSubcategories.filter((sub) => sub.category_id === selectedCategoryId)
    : loanSubcategories;

  // Handle form submission
  const handleSubmit = useCallback(async (data: ULAPFormData) => {
    await onSubmit({
      ...data,
      source: referralCode ? 'REFERRAL' : 'CUSTOMER',
      referral_code: referralCode,
      loan_category_id: selectedCategoryId,
      loan_subcategory_id: selectedSubcategoryId,
    });
  }, [onSubmit, referralCode, selectedCategoryId, selectedSubcategoryId]);

  // Category Selection Screen - Glassmorphism Card Design
  if (step === 'category' && loanCategories.length > 0) {
    return (
      <div className={cn('min-h-screen bg-zinc-950', className)}>
        {/* Hero Section */}
        <div className="bg-gradient-to-b from-brand-primary/20 to-transparent py-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Referral Badge */}
            {referralCode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/20 border border-pink-500/30 mb-6"
              >
                <GiftIcon className="w-5 h-5 text-pink-400" />
                <span className="text-sm text-pink-300">Referral: {referralCode}</span>
              </motion.div>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-white mb-4"
            >
              Apply for a Loan
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-white/60 mb-8"
            >
              Quick approval, competitive rates, and hassle-free process
            </motion.p>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-4"
            >
              {['Quick Approval', '100% Online', 'Best Rates', 'Secure'].map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
                >
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white/70">{badge}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Category Selection - Glassmorphism Cards */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-xl font-semibold text-white text-center mb-8">
            What type of loan are you looking for?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loanCategories.map((category, index) => (
              <ULAPCategoryCard
                key={category.id}
                id={category.id}
                name={category.name}
                description={category.description}
                color={category.color}
                subcategoryCount={loanSubcategories.filter(s => s.category_id === category.id).length}
                bankCount={bankCountsMap[category.id] || 0}
                onSelect={() => {
                  setSelectedCategoryId(category.id);
                  setStep('subcategory');
                }}
                animationDelay={index * 0.05}
              />
            ))}
          </div>

          {/* Cancel Button */}
          {onCancel && (
            <div className="text-center mt-12">
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

  // Subcategory Selection Screen
  if (step === 'subcategory') {
    const selectedCategory = loanCategories.find((c) => c.id === selectedCategoryId);

    return (
      <div className={cn('min-h-screen bg-zinc-950 p-6', className)}>
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => setStep('category')}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Categories
          </button>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-white mb-2">
              {selectedCategory?.name || 'Select Loan Type'}
            </h1>
            <p className="text-white/60">Choose the specific loan product</p>
          </div>

          {/* Subcategory Grid - Using shared ULAPSubcategoryCard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSubcategories.map((loan, index) => (
              <ULAPSubcategoryCard
                key={loan.id}
                id={loan.id}
                name={loan.name}
                description={loan.description}
                categoryId={loan.category_id}
                categoryColor={selectedCategory?.color || getCategoryColor(loan.category_id || '')}
                minAmount={loan.min_amount}
                maxAmount={loan.max_amount}
                onSelect={() => {
                  setSelectedSubcategoryId(loan.id);
                  setStep('form');
                }}
                animationDelay={index * 0.05}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show the dynamic form
  return (
    <div className={className}>
      {/* Referral Badge */}
      {referralCode && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-500/10 border border-pink-500/20 w-fit">
            <GiftIcon className="w-4 h-4 text-pink-400" />
            <span className="text-sm text-pink-300">Applied with referral: {referralCode}</span>
          </div>
        </div>
      )}

      {/* Dynamic Form */}
      <ULAPDynamicForm
        source={referralCode ? 'REFERRAL' : 'CUSTOMER'}
        subcategoryId={selectedSubcategoryId}
        onSubmit={handleSubmit}
        onCancel={() => {
          if (step === 'form') {
            setStep('subcategory');
          } else if (onCancel) {
            onCancel();
          }
        }}
        onSaveDraft={onSaveDraft}
        showCoApplicant={true}
      />
    </div>
  );
}

export default CustomerLeadForm;
