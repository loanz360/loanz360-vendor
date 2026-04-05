/**
 * Loan Type Selector - Main Entry Component
 * Premium Welcome Screen + Loan Type Selection
 *
 * Design: Apple/Stripe inspired with micro-interactions
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { LoanTypeCode, LoanTypeSelectorProps } from '../types';
import { LOAN_TYPES } from '../constants';
import { LoanTypeGrid } from './LoanTypeGrid';

// Re-export components
export { LoanTypeCard } from './LoanTypeCard';
export { LoanCategorySection } from './LoanCategorySection';
export { LoanTypeGrid } from './LoanTypeGrid';

// =====================================================
// ANIMATED ICONS
// =====================================================

const RocketIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>
);

const ShieldCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckBadgeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
  </svg>
);

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

// =====================================================
// ANIMATED BACKGROUND
// =====================================================

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient Orbs */}
      <motion.div
        className="absolute -top-40 -right-40 w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px]"
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 180, 360],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-brand-primary/30"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 3) * 20}%`,
          }}
          animate={{
            y: [-20, 20, -20],
            x: [-10, 10, -10],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4 + i,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.5,
          }}
        />
      ))}
    </div>
  );
}

// =====================================================
// WELCOME SCREEN COMPONENT
// =====================================================

interface WelcomeScreenProps {
  onStart: () => void;
  title?: string;
  subtitle?: string;
}

function WelcomeScreen({ onStart, title, subtitle }: WelcomeScreenProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      icon: ClockIcon,
      title: 'Quick Process',
      description: 'Complete in under 5 minutes',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: ShieldCheckIcon,
      title: '100% Secure',
      description: 'Bank-grade encryption',
      color: 'from-emerald-500 to-green-500',
    },
    {
      icon: CheckBadgeIcon,
      title: 'Instant Eligibility',
      description: 'Know your limit instantly',
      color: 'from-purple-500 to-indigo-500',
    },
  ];

  return (
    <div className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <AnimatedBackground />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 mb-8"
        >
          <SparklesIcon className="w-4 h-4 text-brand-primary" />
          <span className="text-sm font-medium text-brand-primary">Start Your Journey</span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6"
        >
          <span className="text-white">{title || 'Find Your Perfect'}</span>
          <br />
          <span className="bg-gradient-to-r from-brand-primary via-orange-400 to-amber-500 bg-clip-text text-transparent">
            {subtitle || 'Loan Solution'}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg sm:text-xl text-white/60 mb-10 max-w-xl mx-auto"
        >
          Choose from 26+ loan types tailored to your needs. Quick approval, competitive rates, and a seamless experience.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <button
            onClick={onStart}
            className={cn(
              'group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl',
              'bg-gradient-to-r from-brand-primary to-orange-500 text-white',
              'font-semibold text-lg shadow-2xl shadow-brand-primary/30',
              'hover:shadow-brand-primary/50 hover:scale-105',
              'transition-all duration-300'
            )}
          >
            {/* Button Shine Effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <RocketIcon className="w-6 h-6" />
            <span>Let's Get Started</span>
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRightIcon className="w-5 h-5" />
            </motion.span>
          </button>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 40 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className={cn(
                'relative p-6 rounded-2xl overflow-hidden',
                'bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl',
                'hover:bg-white/[0.06] hover:border-white/[0.1]',
                'transition-all duration-300'
              )}
            >
              {/* Background Gradient */}
              <div className={cn(
                'absolute -top-10 -right-10 w-20 h-20 rounded-full blur-2xl opacity-20',
                `bg-gradient-to-br ${feature.color}`
              )} />

              <div className="relative">
                <div className={cn(
                  'w-12 h-12 rounded-xl mb-4 flex items-center justify-center',
                  `bg-gradient-to-br ${feature.color}`
                )}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-white/50">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-white/40"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>50,000+ Applications</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>50+ Partner Banks</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span>4.9/5 Rating</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// =====================================================
// MAIN LOAN TYPE SELECTOR COMPONENT
// =====================================================

export function LoanTypeSelector({
  onSelect,
  selectedType,
  showCategories = true,
  className,
}: LoanTypeSelectorProps) {
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedLoanType, setSelectedLoanType] = useState<LoanTypeCode | undefined>(selectedType);

  const handleSelectLoanType = (code: LoanTypeCode) => {
    setSelectedLoanType(code);
    onSelect(code);
  };

  const handleStartSelection = () => {
    setShowWelcome(false);
  };

  return (
    <div className={cn('relative min-h-screen', className)}>
      <AnimatePresence mode="wait">
        {showWelcome ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <WelcomeScreen onStart={handleStartSelection} />
          </motion.div>
        ) : (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="px-4 py-8"
          >
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  Select Your Loan Type
                </h2>
                <p className="text-lg text-white/50">
                  Choose the loan that best fits your needs
                </p>
              </motion.div>
            </div>

            {/* Selected Loan Preview */}
            <AnimatePresence>
              {selectedLoanType && (
                <motion.div
                  initial={{ opacity: 0, y: -20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -20, height: 0 }}
                  className="max-w-7xl mx-auto mb-6"
                >
                  <div className="p-4 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-primary flex items-center justify-center">
                        <CheckBadgeIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-brand-primary font-medium">Selected Loan Type</p>
                        <p className="text-lg font-semibold text-white">{LOAN_TYPES[selectedLoanType].name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedLoanType(undefined);
                        onSelect(selectedLoanType);
                      }}
                      className="px-6 py-3 rounded-xl bg-brand-primary text-white font-semibold flex items-center gap-2 hover:bg-brand-primary/90 transition-colors"
                    >
                      Continue
                      <ArrowRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loan Type Grid */}
            <div className="max-w-7xl mx-auto">
              <LoanTypeGrid
                selectedLoanType={selectedLoanType}
                onSelectLoanType={handleSelectLoanType}
                showSearch={true}
                showViewToggle={true}
                showPopular={true}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LoanTypeSelector;
