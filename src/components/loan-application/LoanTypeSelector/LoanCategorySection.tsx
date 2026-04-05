/**
 * Loan Category Section Component
 * Collapsible category with animated loan cards
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { LoanCategoryConfig, LoanTypeConfig, LoanTypeCode } from '../types';
import { LoanTypeCard } from './LoanTypeCard';

// =====================================================
// ICONS
// =====================================================

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const CategoryIcons: Record<string, React.FC<{ className?: string }>> = {
  Users: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  Briefcase: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  ),
  Building2: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  Stethoscope: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  Globe: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
};

// =====================================================
// COMPONENT PROPS
// =====================================================

interface LoanCategorySectionProps {
  category: LoanCategoryConfig;
  loanTypes: LoanTypeConfig[];
  selectedLoanType?: LoanTypeCode;
  onSelectLoanType: (code: LoanTypeCode) => void;
  defaultExpanded?: boolean;
  cardVariant?: 'default' | 'compact';
  className?: string;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function LoanCategorySection({
  category,
  loanTypes,
  selectedLoanType,
  onSelectLoanType,
  defaultExpanded = true,
  cardVariant = 'default',
  className,
}: LoanCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const IconComponent = CategoryIcons[category.icon] || CategoryIcons.Users;

  // Check if any loan in this category is selected
  const hasSelectedLoan = loanTypes.some(lt => lt.code === selectedLoanType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('relative', className)}
    >
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300',
          'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05]',
          isExpanded && 'bg-white/[0.05] border-white/[0.08]',
          hasSelectedLoan && 'ring-1 ring-brand-primary/30'
        )}
      >
        <div className="flex items-center gap-4">
          {/* Category Icon */}
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300',
              `bg-gradient-to-br ${category.gradient}`,
              isExpanded ? 'shadow-lg' : 'shadow-md'
            )}
            style={{ boxShadow: isExpanded ? `0 8px 25px ${category.color}40` : undefined }}
          >
            <IconComponent className="w-6 h-6 text-white" />
          </div>

          {/* Category Info */}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{category.name}</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/60">
                {loanTypes.length} types
              </span>
              {hasSelectedLoan && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/20 text-brand-primary"
                >
                  Selected
                </motion.span>
              )}
            </div>
            <p className="text-sm text-white/50">{category.description}</p>
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
        >
          <ChevronDownIcon className="w-5 h-5 text-white/60" />
        </motion.div>
      </button>

      {/* Loan Cards Grid */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className={cn(
              'pt-4',
              cardVariant === 'default'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'grid grid-cols-1 sm:grid-cols-2 gap-3'
            )}>
              {loanTypes.map((loanType, index) => (
                <LoanTypeCard
                  key={loanType.code}
                  config={loanType}
                  isSelected={selectedLoanType === loanType.code}
                  onClick={() => onSelectLoanType(loanType.code)}
                  variant={cardVariant}
                  index={index}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gradient Border Bottom */}
      <div
        className={cn(
          'absolute bottom-0 left-4 right-4 h-px',
          `bg-gradient-to-r from-transparent ${category.gradient.replace('from-', 'via-').split(' ')[0]} to-transparent`,
          'opacity-20'
        )}
      />
    </motion.div>
  );
}

export default LoanCategorySection;
