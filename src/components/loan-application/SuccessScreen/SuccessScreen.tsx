/**
 * Success Screen Component
 * Celebration screen after successful loan application submission
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { LoanTypeConfig } from '../types';

// =====================================================
// ICONS
// =====================================================

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <motion.path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
    />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

// =====================================================
// CONFETTI ANIMATION
// =====================================================

const Confetti = () => {
  const colors = ['#ff6700', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {[...Array(50)].map((_, i) => {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 10 + 5;
        const delay = Math.random() * 0.5;
        const duration = Math.random() * 2 + 2;
        const startX = Math.random() * 100;

        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${startX}%`,
              top: -20,
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            }}
            initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
            animate={{
              y: window.innerHeight + 100,
              x: (Math.random() - 0.5) * 200,
              rotate: Math.random() * 720,
              opacity: [1, 1, 0],
            }}
            transition={{
              duration,
              delay,
              ease: 'easeOut',
            }}
          />
        );
      })}
    </div>
  );
};

// =====================================================
// TYPES
// =====================================================

interface SuccessScreenProps {
  applicationId: string;
  loanConfig: LoanTypeConfig;
  onGoToDashboard?: () => void;
  onTrackApplication?: () => void;
  className?: string;
}

// =====================================================
// TIMELINE STEP
// =====================================================

interface TimelineStepProps {
  step: number;
  title: string;
  description: string;
  isActive?: boolean;
  isCompleted?: boolean;
  estimatedTime?: string;
}

const TimelineStep = ({ step, title, description, isActive, isCompleted, estimatedTime }: TimelineStepProps) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: step * 0.1 + 1 }}
    className={cn(
      'relative flex gap-4 pb-8 last:pb-0',
      'before:absolute before:left-[18px] before:top-10 before:bottom-0 before:w-0.5',
      'before:bg-gradient-to-b before:from-white/20 before:to-transparent',
      'last:before:hidden'
    )}
  >
    {/* Step Number */}
    <div className={cn(
      'relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
      isCompleted
        ? 'bg-emerald-500'
        : isActive
        ? 'bg-brand-primary'
        : 'bg-white/10'
    )}>
      {isCompleted ? (
        <CheckCircleIcon className="w-5 h-5 text-white" />
      ) : (
        <span className={cn(
          'text-sm font-medium',
          isActive ? 'text-white' : 'text-white/50'
        )}>
          {step}
        </span>
      )}
    </div>

    {/* Content */}
    <div className="flex-1 pt-1">
      <div className="flex items-center justify-between">
        <h4 className={cn(
          'text-sm font-medium',
          isActive ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-white/60'
        )}>
          {title}
        </h4>
        {estimatedTime && (
          <span className="text-xs text-white/40">{estimatedTime}</span>
        )}
      </div>
      <p className="text-xs text-white/40 mt-1">{description}</p>
    </div>
  </motion.div>
);

// =====================================================
// MAIN COMPONENT
// =====================================================

export function SuccessScreen({
  applicationId,
  loanConfig,
  onGoToDashboard,
  onTrackApplication,
  className,
}: SuccessScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const nextSteps = [
    {
      step: 1,
      title: 'Application Submitted',
      description: 'Your application has been received and is being processed',
      isCompleted: true,
    },
    {
      step: 2,
      title: 'Document Verification',
      description: 'Our team will verify the submitted documents',
      isActive: true,
      estimatedTime: '1-2 days',
    },
    {
      step: 3,
      title: 'Credit Assessment',
      description: 'Credit bureau check and eligibility assessment',
      estimatedTime: '1-2 days',
    },
    {
      step: 4,
      title: 'Loan Approval',
      description: 'Final approval and sanction letter generation',
      estimatedTime: '1-3 days',
    },
    {
      step: 5,
      title: 'Disbursement',
      description: 'Amount will be transferred to your account',
      estimatedTime: '1-2 days',
    },
  ];

  return (
    <div className={cn('min-h-screen bg-zinc-950 relative overflow-hidden', className)}>
      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && <Confetti />}
      </AnimatePresence>

      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full"
          style={{ background: `radial-gradient(circle, ${loanConfig.color}20 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)' }}
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center mb-12"
        >
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500
                       flex items-center justify-center shadow-2xl shadow-emerald-500/30"
          >
            <CheckCircleIcon className="w-12 h-12 text-white" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl md:text-4xl font-bold text-white mb-3"
          >
            Application Submitted Successfully!
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-lg text-white/60"
          >
            Thank you for applying for {loanConfig.name}
          </motion.p>
        </motion.div>

        {/* Application Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-8 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">Application ID</p>
              <p className="text-xl font-mono font-bold text-brand-primary">{applicationId}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                `bg-gradient-to-br ${loanConfig.gradient}`
              )}>
                <DocumentIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{loanConfig.name}</p>
                <p className="text-xs text-white/50">Submitted just now</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* What's Next */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
          >
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-brand-primary" />
              What Happens Next
            </h3>

            <div className="space-y-0">
              {nextSteps.map((step) => (
                <TimelineStep key={step.step} {...step} />
              ))}
            </div>

            {/* Expected Timeline */}
            <div className="mt-6 p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Expected Processing Time</span>
                <span className="text-sm font-semibold text-brand-primary">{loanConfig.processingTime}</span>
              </div>
            </div>
          </motion.div>

          {/* Contact & Actions */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
            className="space-y-6"
          >
            {/* Contact Support */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <h3 className="text-lg font-semibold text-white mb-4">Need Help?</h3>
              <p className="text-sm text-white/60 mb-4">
                Our support team is here to assist you with any questions about your application.
              </p>

              <div className="space-y-3">
                <a
                  href="tel:+911234567890"
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05]
                           transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center
                                group-hover:bg-emerald-500/30 transition-colors">
                    <PhoneIcon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Call Support</p>
                    <p className="text-xs text-white/50">+91 12345 67890</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <motion.button
                onClick={onTrackApplication}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl
                         bg-gradient-to-r from-brand-primary to-orange-500 text-white font-medium
                         shadow-lg shadow-brand-primary/25"
              >
                <span>Track Application</span>
                <ArrowRightIcon className="w-5 h-5" />
              </motion.button>

              <motion.button
                onClick={onGoToDashboard}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl
                         bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
              >
                <HomeIcon className="w-5 h-5" />
                <span>Go to Dashboard</span>
              </motion.button>
            </div>

            {/* Tips Card */}
            <div className="p-6 rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <h4 className="text-sm font-medium text-white mb-3">Quick Tips</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex items-start gap-2">
                  <span className="text-violet-400">•</span>
                  Keep your phone handy for verification calls
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400">•</span>
                  Check your email for updates on your application
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400">•</span>
                  Have original documents ready for physical verification
                </li>
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Footer Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-white/40">
            You will receive an email confirmation shortly at your registered email address.
            <br />
            For any queries, please contact our support team.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default SuccessScreen;
