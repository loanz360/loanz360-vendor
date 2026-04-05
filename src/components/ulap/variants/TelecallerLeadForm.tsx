/**
 * Telecaller Lead Form - Tele-Sales Lead Capture Form
 * Wrapper around ULAPDynamicForm for Telecaller-specific features
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { ULAPDynamicForm } from '../ULAPDynamicForm';
import type { ULAPFormData, ULAPLoanSubcategory } from '../types';

interface TelecallerLeadFormProps {
  /** Telecaller Employee ID */
  employeeId: string;
  /** Telecaller Employee Name */
  employeeName: string;
  /** Call ID (if integrated with telephony) */
  callId?: string;
  /** Caller phone number (auto-populated) */
  callerPhone?: string;
  /** Pre-selected loan subcategory */
  subcategoryId?: string;
  /** Available loan subcategories */
  loanSubcategories?: ULAPLoanSubcategory[];
  /** Call scripts for reference */
  callScript?: {
    greeting: string;
    introduction: string;
    closing: string;
  };
  /** Callback when lead is submitted */
  onSubmit: (data: ULAPFormData & { source: 'TELECALLER'; employeeId: string; callId?: string }) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback when draft is saved */
  onSaveDraft?: (data: ULAPFormData) => Promise<void>;
  /** Callback to end call */
  onEndCall?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// Icons
const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const PhoneXMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export function TelecallerLeadForm({
  employeeId,
  employeeName,
  callId,
  callerPhone,
  subcategoryId: initialSubcategoryId,
  loanSubcategories = [],
  callScript,
  onSubmit,
  onCancel,
  onSaveDraft,
  onEndCall,
  className,
}: TelecallerLeadFormProps) {
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(
    initialSubcategoryId
  );
  const [callDuration, setCallDuration] = useState(0);
  const [showScript, setShowScript] = useState(false);

  // Call timer
  React.useEffect(() => {
    if (callId) {
      const timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [callId]);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle form submission
  const handleSubmit = useCallback(async (data: ULAPFormData) => {
    await onSubmit({
      ...data,
      source: 'TELECALLER',
      employeeId,
      callId,
      call_duration: callDuration,
      loan_subcategory_id: selectedSubcategoryId,
    });
  }, [onSubmit, employeeId, callId, callDuration, selectedSubcategoryId]);

  return (
    <div className={cn('min-h-screen bg-zinc-950', className)}>
      {/* Call Control Bar */}
      <div className="sticky top-0 z-50 bg-zinc-900 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Agent Info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <PhoneIcon className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-orange-300">{employeeName}</span>
              </div>

              {/* Loan Type Selector */}
              {loanSubcategories.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedSubcategoryId || ''}
                    onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                    className={cn(
                      'appearance-none px-4 py-2 pr-10 rounded-lg text-sm',
                      'bg-white/5 border border-white/10 text-white',
                      'focus:outline-none focus:border-white/20'
                    )}
                  >
                    <option value="">Select Loan Type</option>
                    {loanSubcategories.map((loan) => (
                      <option key={loan.id} value={loan.id}>
                        {loan.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="w-4 h-4 text-white/50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Center: Call Info */}
            {callId && (
              <div className="flex items-center gap-4">
                {/* Caller Phone */}
                {callerPhone && (
                  <div className="flex items-center gap-2 text-white/70">
                    <PhoneIcon className="w-4 h-4" />
                    <span className="font-mono text-sm">{callerPhone}</span>
                  </div>
                )}

                {/* Call Duration */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <ClockIcon className="w-4 h-4 text-green-400" />
                  <span className="font-mono text-sm text-green-300">{formatDuration(callDuration)}</span>
                </div>
              </div>
            )}

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {/* Script Toggle */}
              {callScript && (
                <motion.button
                  onClick={() => setShowScript(!showScript)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    showScript
                      ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                      : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                  )}
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  <span className="text-sm">Script</span>
                </motion.button>
              )}

              {/* End Call Button */}
              {onEndCall && callId && (
                <motion.button
                  onClick={onEndCall}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors"
                >
                  <PhoneXMarkIcon className="w-4 h-4" />
                  <span className="text-sm">End Call</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Call Script Panel */}
      {callScript && showScript && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-blue-500/5 border-b border-blue-500/20"
        >
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Greeting */}
              <div className="p-4 rounded-lg bg-white/5">
                <h4 className="text-xs font-medium text-blue-400 uppercase mb-2">Greeting</h4>
                <p className="text-sm text-white/70">{callScript.greeting}</p>
              </div>

              {/* Introduction */}
              <div className="p-4 rounded-lg bg-white/5">
                <h4 className="text-xs font-medium text-blue-400 uppercase mb-2">Introduction</h4>
                <p className="text-sm text-white/70">{callScript.introduction}</p>
              </div>

              {/* Closing */}
              <div className="p-4 rounded-lg bg-white/5">
                <h4 className="text-xs font-medium text-blue-400 uppercase mb-2">Closing</h4>
                <p className="text-sm text-white/70">{callScript.closing}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Dynamic Form */}
      <ULAPDynamicForm
        source="TELECALLER"
        subcategoryId={selectedSubcategoryId}
        initialData={callerPhone ? { phone: callerPhone } : {}}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        onSaveDraft={onSaveDraft}
        showCoApplicant={false}
      />
    </div>
  );
}

export default TelecallerLeadForm;
