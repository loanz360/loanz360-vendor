/**
 * Existing Loans Section Component
 * Premium existing obligations and credit liability tracking
 */

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { PremiumInput, PremiumSelect, PremiumCurrencyInput } from './PremiumInput';

// =====================================================
// ICONS
// =====================================================

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const CreditCardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const BankIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
  </svg>
);

const CarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const BriefcaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface ExistingLoan {
  id: string;
  loanType: string;
  lenderName: string;
  loanAmount: string;
  outstandingAmount: string;
  emiAmount: string;
  startDate: string;
  endDate: string;
  isRegular: boolean;
}

interface ExistingLoansSectionProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: unknown) => void;
  className?: string;
}

// =====================================================
// LOAN TYPE OPTIONS
// =====================================================

const LOAN_TYPE_OPTIONS = [
  { value: 'home_loan', label: 'Home Loan', icon: HomeIcon },
  { value: 'personal_loan', label: 'Personal Loan', icon: CreditCardIcon },
  { value: 'car_loan', label: 'Car Loan', icon: CarIcon },
  { value: 'two_wheeler_loan', label: 'Two Wheeler Loan', icon: CarIcon },
  { value: 'education_loan', label: 'Education Loan', icon: BriefcaseIcon },
  { value: 'business_loan', label: 'Business Loan', icon: BriefcaseIcon },
  { value: 'gold_loan', label: 'Gold Loan', icon: CreditCardIcon },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCardIcon },
  { value: 'overdraft', label: 'Overdraft / CC', icon: BankIcon },
  { value: 'lap', label: 'Loan Against Property', icon: HomeIcon },
  { value: 'other', label: 'Other', icon: BankIcon },
];

const LENDER_OPTIONS = [
  { value: '', label: 'Select Lender' },
  { value: 'hdfc', label: 'HDFC Bank' },
  { value: 'icici', label: 'ICICI Bank' },
  { value: 'sbi', label: 'State Bank of India' },
  { value: 'axis', label: 'Axis Bank' },
  { value: 'kotak', label: 'Kotak Mahindra Bank' },
  { value: 'pnb', label: 'Punjab National Bank' },
  { value: 'bob', label: 'Bank of Baroda' },
  { value: 'idfc', label: 'IDFC First Bank' },
  { value: 'yes', label: 'Yes Bank' },
  { value: 'indusind', label: 'IndusInd Bank' },
  { value: 'rbl', label: 'RBL Bank' },
  { value: 'bajaj', label: 'Bajaj Finserv' },
  { value: 'tata_capital', label: 'Tata Capital' },
  { value: 'fullerton', label: 'Fullerton India' },
  { value: 'piramal', label: 'Piramal Finance' },
  { value: 'other', label: 'Other' },
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
};

const generateId = () => `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// =====================================================
// LOAN CARD COMPONENT
// =====================================================

interface LoanCardProps {
  loan: ExistingLoan;
  index: number;
  onUpdate: (loan: ExistingLoan) => void;
  onDelete: () => void;
  errors: Record<string, string>;
}

const LoanCard = ({ loan, index, onUpdate, onDelete, errors }: LoanCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const loanTypeConfig = LOAN_TYPE_OPTIONS.find(t => t.value === loan.loanType);
  const IconComponent = loanTypeConfig?.icon || BankIcon;

  const updateField = (field: keyof ExistingLoan, value: string | boolean) => {
    onUpdate({ ...loan, [field]: value });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="relative rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            loan.loanType
              ? 'bg-gradient-to-br from-violet-500 to-purple-500'
              : 'bg-white/10'
          )}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">
              {loanTypeConfig?.label || `Loan ${index + 1}`}
            </h4>
            {loan.lenderName && (
              <p className="text-xs text-white/50">{LENDER_OPTIONS.find(l => l.value === loan.lenderName)?.label || loan.lenderName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loan.outstandingAmount && (
            <div className="text-right mr-4">
              <p className="text-xs text-white/40">Outstanding</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(loan.outstandingAmount)}</p>
            </div>
          )}

          {/* Regularity Badge */}
          <div className={cn(
            'px-2 py-1 rounded-full text-xs font-medium',
            loan.isRegular
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
          )}>
            {loan.isRegular ? 'Regular' : 'Irregular'}
          </div>

          {/* Delete Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
          >
            <TrashIcon className="w-5 h-5" />
          </motion.button>

          {/* Expand Icon */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="w-6 h-6 flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-2 space-y-4 border-t border-white/[0.05]">
              {/* Loan Type & Lender */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumSelect
                  label="Loan Type"
                  options={LOAN_TYPE_OPTIONS.map(t => ({ value: t.value, label: t.label }))}
                  value={loan.loanType}
                  onChange={(e) => updateField('loanType', e.target.value)}
                  required
                  error={errors[`existingLoans.${index}.loanType`]}
                />
                <PremiumSelect
                  label="Lender / Bank"
                  options={LENDER_OPTIONS}
                  value={loan.lenderName}
                  onChange={(e) => updateField('lenderName', e.target.value)}
                  required
                  error={errors[`existingLoans.${index}.lenderName`]}
                />
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PremiumCurrencyInput
                  label="Original Loan Amount"
                  value={loan.loanAmount}
                  onChange={(e) => updateField('loanAmount', e.target.value)}
                  placeholder="e.g., 10,00,000"
                  required
                  error={errors[`existingLoans.${index}.loanAmount`]}
                />
                <PremiumCurrencyInput
                  label="Outstanding Amount"
                  value={loan.outstandingAmount}
                  onChange={(e) => updateField('outstandingAmount', e.target.value)}
                  placeholder="e.g., 7,50,000"
                  required
                  error={errors[`existingLoans.${index}.outstandingAmount`]}
                />
                <PremiumCurrencyInput
                  label="Monthly EMI"
                  value={loan.emiAmount}
                  onChange={(e) => updateField('emiAmount', e.target.value)}
                  placeholder="e.g., 25,000"
                  required
                  error={errors[`existingLoans.${index}.emiAmount`]}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumInput
                  label="Loan Start Date"
                  type="date"
                  value={loan.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  required
                  error={errors[`existingLoans.${index}.startDate`]}
                />
                <PremiumInput
                  label="Loan End Date"
                  type="date"
                  value={loan.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  required
                  error={errors[`existingLoans.${index}.endDate`]}
                />
              </div>

              {/* Payment Regularity */}
              <div className="p-4 rounded-xl bg-white/[0.02]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={loan.isRegular}
                      onChange={(e) => updateField('isRegular', e.target.checked)}
                      className="sr-only"
                    />
                    <motion.div
                      className={cn(
                        'w-12 h-7 rounded-full transition-colors',
                        loan.isRegular ? 'bg-emerald-500' : 'bg-white/20'
                      )}
                    >
                      <motion.div
                        className="w-5 h-5 rounded-full bg-white shadow-lg"
                        animate={{ x: loan.isRegular ? 26 : 4, y: 4 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </motion.div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">Regular EMI Payment</span>
                    <p className="text-xs text-white/50">Are all EMI payments made on time?</p>
                  </div>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// =====================================================
// SUMMARY CARD COMPONENT
// =====================================================

interface SummaryCardProps {
  loans: ExistingLoan[];
}

const SummaryCard = ({ loans }: SummaryCardProps) => {
  const summary = useMemo(() => {
    let totalOutstanding = 0;
    let totalEMI = 0;
    let irregularCount = 0;

    loans.forEach(loan => {
      const outstanding = parseFloat(loan.outstandingAmount?.replace(/,/g, '') || '0');
      const emi = parseFloat(loan.emiAmount?.replace(/,/g, '') || '0');

      if (!isNaN(outstanding)) totalOutstanding += outstanding;
      if (!isNaN(emi)) totalEMI += emi;
      if (!loan.isRegular) irregularCount++;
    });

    return { totalOutstanding, totalEMI, irregularCount, count: loans.length };
  }, [loans]);

  if (loans.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20"
    >
      <h4 className="text-sm font-medium text-white/70 mb-4">Existing Obligations Summary</h4>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40">Active Loans</p>
          <p className="text-xl font-bold text-white">{summary.count}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40">Total Outstanding</p>
          <p className="text-xl font-bold text-white">{formatCurrency(summary.totalOutstanding)}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40">Monthly EMI Burden</p>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(summary.totalEMI)}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <p className="text-xs text-white/40">Payment Status</p>
          {summary.irregularCount > 0 ? (
            <p className="text-xl font-bold text-amber-400">{summary.irregularCount} Irregular</p>
          ) : (
            <p className="text-xl font-bold text-emerald-400">All Regular</p>
          )}
        </div>
      </div>

      {summary.irregularCount > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <AlertIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Irregular EMI payments may affect your loan eligibility. Please ensure all dues are cleared before applying.
          </p>
        </div>
      )}
    </motion.div>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ExistingLoansSection({
  formData,
  errors,
  onFieldChange,
  className,
}: ExistingLoansSectionProps) {
  const hasExistingLoans = formData.hasExistingLoans as boolean;
  const existingLoans = (formData.existingLoans as ExistingLoan[]) || [];

  const handleToggleExistingLoans = (hasLoans: boolean) => {
    onFieldChange('hasExistingLoans', hasLoans);
    if (!hasLoans) {
      onFieldChange('existingLoans', []);
    }
  };

  const handleAddLoan = () => {
    const newLoan: ExistingLoan = {
      id: generateId(),
      loanType: '',
      lenderName: '',
      loanAmount: '',
      outstandingAmount: '',
      emiAmount: '',
      startDate: '',
      endDate: '',
      isRegular: true,
    };
    onFieldChange('existingLoans', [...existingLoans, newLoan]);
  };

  const handleUpdateLoan = (index: number, updatedLoan: ExistingLoan) => {
    const updated = [...existingLoans];
    updated[index] = updatedLoan;
    onFieldChange('existingLoans', updated);
  };

  const handleDeleteLoan = (index: number) => {
    const updated = existingLoans.filter((_, i) => i !== index);
    onFieldChange('existingLoans', updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Section Header */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">
          Existing Loans & Obligations
        </h3>
        <p className="text-sm text-white/60">
          Tell us about your current loan obligations to help us assess your eligibility and recommend the best loan options.
        </p>
      </div>

      {/* Toggle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* No Existing Loans */}
        <motion.button
          onClick={() => handleToggleExistingLoans(false)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'relative p-6 rounded-2xl border-2 text-left transition-all duration-300',
            !hasExistingLoans
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              !hasExistingLoans ? 'bg-emerald-500' : 'bg-white/10'
            )}>
              <CheckCircleIcon className={cn('w-6 h-6', !hasExistingLoans ? 'text-white' : 'text-white/60')} />
            </div>
            <div>
              <h4 className="text-base font-semibold text-white">No Existing Loans</h4>
              <p className="text-sm text-white/50">I don't have any active loans</p>
            </div>
          </div>

          {/* Selection Indicator */}
          {!hasExistingLoans && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <motion.path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </svg>
            </motion.div>
          )}
        </motion.button>

        {/* Has Existing Loans */}
        <motion.button
          onClick={() => handleToggleExistingLoans(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'relative p-6 rounded-2xl border-2 text-left transition-all duration-300',
            hasExistingLoans
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              hasExistingLoans ? 'bg-violet-500' : 'bg-white/10'
            )}>
              <BankIcon className={cn('w-6 h-6', hasExistingLoans ? 'text-white' : 'text-white/60')} />
            </div>
            <div>
              <h4 className="text-base font-semibold text-white">I Have Active Loans</h4>
              <p className="text-sm text-white/50">Add details of your existing loans</p>
            </div>
          </div>

          {/* Selection Indicator */}
          {hasExistingLoans && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-3 right-3 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <motion.path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </svg>
            </motion.div>
          )}
        </motion.button>
      </div>

      {/* Existing Loans List */}
      <AnimatePresence mode="wait">
        {hasExistingLoans && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Summary Card */}
            <SummaryCard loans={existingLoans} />

            {/* Loan Cards */}
            <AnimatePresence mode="popLayout">
              {existingLoans.map((loan, index) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  index={index}
                  onUpdate={(updated) => handleUpdateLoan(index, updated)}
                  onDelete={() => handleDeleteLoan(index)}
                  errors={errors}
                />
              ))}
            </AnimatePresence>

            {/* Add Loan Button */}
            <motion.button
              onClick={handleAddLoan}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-brand-primary/50
                         bg-white/[0.02] hover:bg-brand-primary/5 transition-all duration-300 group"
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center
                              group-hover:bg-brand-primary/30 transition-colors">
                  <PlusIcon className="w-5 h-5 text-brand-primary" />
                </div>
                <span className="text-sm font-medium text-white/60 group-hover:text-white transition-colors">
                  Add Another Loan
                </span>
              </div>
            </motion.button>

            {/* Credit Cards Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                  <CreditCardIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Credit Card Outstanding</h4>
                  <p className="text-xs text-white/50">Total outstanding balance across all credit cards</p>
                </div>
              </div>

              <PremiumCurrencyInput
                label="Total Credit Card Outstanding"
                value={(formData.creditCardOutstanding as string) || ''}
                onChange={(e) => onFieldChange('creditCardOutstanding', e.target.value)}
                placeholder="Enter total outstanding amount"
                helperText="Include outstanding amounts from all active credit cards"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Loans Message */}
      <AnimatePresence>
        {!hasExistingLoans && hasExistingLoans !== undefined && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-emerald-300">No Existing EMI Burden</h4>
                <p className="text-sm text-white/60 mt-1">
                  Having no existing loan obligations improves your debt-to-income ratio, which may help you qualify for better interest rates and higher loan amounts.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ExistingLoansSection;
