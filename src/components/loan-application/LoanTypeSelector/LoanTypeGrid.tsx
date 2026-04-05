/**
 * Loan Type Grid Component
 * Full grid view with search, filter, and category organization
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { LoanTypeCode, LoanCategory } from '../types';
import { LOAN_CATEGORIES, LOAN_TYPES, getPopularLoanTypes } from '../constants';
import { LoanTypeCard } from './LoanTypeCard';
import { LoanCategorySection } from './LoanCategorySection';

// =====================================================
// ICONS
// =====================================================

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const GridIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

const ListIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// =====================================================
// COMPONENT PROPS
// =====================================================

type ViewMode = 'grid' | 'list' | 'categories';

interface LoanTypeGridProps {
  selectedLoanType?: LoanTypeCode;
  onSelectLoanType: (code: LoanTypeCode) => void;
  showSearch?: boolean;
  showViewToggle?: boolean;
  showPopular?: boolean;
  defaultView?: ViewMode;
  className?: string;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function LoanTypeGrid({
  selectedLoanType,
  onSelectLoanType,
  showSearch = true,
  showViewToggle = true,
  showPopular = true,
  defaultView = 'categories',
  className,
}: LoanTypeGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [activeCategory, setActiveCategory] = useState<LoanCategory | 'all'>('all');

  // Get popular loan types
  const popularLoanTypes = useMemo(() => getPopularLoanTypes(6), []);

  // Filter loan types based on search and category
  const filteredLoanTypes = useMemo(() => {
    let loans = Object.values(LOAN_TYPES);

    // Filter by category
    if (activeCategory !== 'all') {
      loans = loans.filter(lt => lt.category === activeCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      loans = loans.filter(
        lt =>
          lt.name.toLowerCase().includes(query) ||
          lt.shortName.toLowerCase().includes(query) ||
          lt.description.toLowerCase().includes(query) ||
          lt.tagline.toLowerCase().includes(query) ||
          lt.features.some(f => f.toLowerCase().includes(query))
      );
    }

    return loans;
  }, [searchQuery, activeCategory]);

  // Group loans by category
  const loansByCategory = useMemo(() => {
    return LOAN_CATEGORIES.map(category => ({
      category,
      loans: filteredLoanTypes.filter(lt => lt.category === category.id),
    })).filter(group => group.loans.length > 0);
  }, [filteredLoanTypes]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setActiveCategory('all');
  }, []);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search Bar */}
        {showSearch && (
          <div className="relative w-full sm:w-96">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search loan types..."
              className={cn(
                'w-full h-12 pl-12 pr-10 rounded-xl',
                'bg-white/5 border border-white/10',
                'text-white placeholder-white/40',
                'focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20',
                'transition-all duration-300'
              )}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-white/60" />
              </button>
            )}
          </div>
        )}

        {/* View Toggle */}
        {showViewToggle && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {[
              { mode: 'categories' as const, icon: GridIcon, label: 'Categories' },
              { mode: 'grid' as const, icon: GridIcon, label: 'Grid' },
              { mode: 'list' as const, icon: ListIcon, label: 'List' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  viewMode === mode
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
            activeCategory === 'all'
              ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30'
              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
          )}
        >
          All Types
        </button>
        {LOAN_CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2',
              activeCategory === category.id
                ? `bg-gradient-to-r ${category.gradient} text-white shadow-lg`
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
            )}
            style={{
              boxShadow: activeCategory === category.id ? `0 4px 20px ${category.color}40` : undefined,
            }}
          >
            {category.name}
            <span className={cn(
              'px-1.5 py-0.5 rounded-full text-xs',
              activeCategory === category.id ? 'bg-white/20' : 'bg-white/10'
            )}>
              {category.loanTypes.length}
            </span>
          </button>
        ))}
      </div>

      {/* Popular Loans Section (Only when not searching) */}
      {showPopular && !searchQuery && activeCategory === 'all' && viewMode === 'categories' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Popular Choices</h3>
              <p className="text-sm text-white/50">Most frequently applied loan types</p>
            </div>
          </div>

          {/* Popular Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularLoanTypes.map((loanType, index) => (
              <LoanTypeCard
                key={loanType.code}
                config={loanType}
                isSelected={selectedLoanType === loanType.code}
                onClick={() => onSelectLoanType(loanType.code)}
                variant="featured"
                index={index}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {/* No Results */}
        {filteredLoanTypes.length === 0 && (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center">
              <SearchIcon className="w-10 h-10 text-white/30" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No loan types found</h3>
            <p className="text-white/50 mb-6">Try adjusting your search or filter criteria</p>
            <button
              onClick={clearSearch}
              className="px-6 py-3 rounded-xl bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition-colors"
            >
              Clear Filters
            </button>
          </motion.div>
        )}

        {/* Categories View */}
        {viewMode === 'categories' && filteredLoanTypes.length > 0 && (
          <motion.div
            key="categories"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {loansByCategory.map((group, index) => (
              <LoanCategorySection
                key={group.category.id}
                category={group.category}
                loanTypes={group.loans}
                selectedLoanType={selectedLoanType}
                onSelectLoanType={onSelectLoanType}
                defaultExpanded={index < 2 || group.loans.some(lt => lt.code === selectedLoanType)}
              />
            ))}
          </motion.div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && filteredLoanTypes.length > 0 && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filteredLoanTypes.map((loanType, index) => (
              <LoanTypeCard
                key={loanType.code}
                config={loanType}
                isSelected={selectedLoanType === loanType.code}
                onClick={() => onSelectLoanType(loanType.code)}
                variant="default"
                index={index}
              />
            ))}
          </motion.div>
        )}

        {/* List View */}
        {viewMode === 'list' && filteredLoanTypes.length > 0 && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {filteredLoanTypes.map((loanType, index) => (
              <LoanTypeCard
                key={loanType.code}
                config={loanType}
                isSelected={selectedLoanType === loanType.code}
                onClick={() => onSelectLoanType(loanType.code)}
                variant="compact"
                index={index}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Count */}
      {filteredLoanTypes.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-white/40 pt-4"
        >
          Showing {filteredLoanTypes.length} of {Object.keys(LOAN_TYPES).length} loan types
        </motion.div>
      )}
    </div>
  );
}

export default LoanTypeGrid;
