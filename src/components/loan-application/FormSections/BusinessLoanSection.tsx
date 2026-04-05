/**
 * Business Loan Section Component
 * Business details, GST, financials for business loans
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { VerificationStatus } from '../types';
import { PremiumInput, PremiumSelect, PremiumTextarea, PremiumCurrencyInput } from './PremiumInput';

// =====================================================
// ICONS
// =====================================================

const BuildingOfficeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
  </svg>
);

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const CurrencyRupeeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3 6l-3-3h1.5a3 3 0 100-6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ShieldCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface BusinessLoanSectionProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  verifications: Record<string, VerificationStatus>;
  onFieldChange: (field: string, value: unknown) => void;
  onVerify?: (field: string) => Promise<void>;
  loanType: 'BUSINESS_LOAN' | 'WORKING_CAPITAL' | 'MACHINERY_LOAN' | 'OVERDRAFT' | 'CASH_CREDIT';
  className?: string;
}

// =====================================================
// DATA
// =====================================================

const BUSINESS_TYPE_OPTIONS = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP (Limited Liability Partnership)' },
  { value: 'pvt_ltd', label: 'Private Limited Company' },
  { value: 'public_ltd', label: 'Public Limited Company' },
  { value: 'one_person', label: 'One Person Company (OPC)' },
  { value: 'huf', label: 'HUF (Hindu Undivided Family)' },
];

const INDUSTRY_OPTIONS = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'trading', label: 'Trading / Wholesale / Retail' },
  { value: 'services', label: 'Services' },
  { value: 'it_software', label: 'IT & Software' },
  { value: 'healthcare', label: 'Healthcare / Pharma' },
  { value: 'education', label: 'Education' },
  { value: 'hospitality', label: 'Hospitality / F&B' },
  { value: 'construction', label: 'Construction / Real Estate' },
  { value: 'agriculture', label: 'Agriculture / Agri-business' },
  { value: 'transportation', label: 'Transportation / Logistics' },
  { value: 'textile', label: 'Textile / Garments' },
  { value: 'fmcg', label: 'FMCG' },
  { value: 'electronics', label: 'Electronics / Electrical' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'chemicals', label: 'Chemicals / Plastics' },
  { value: 'media', label: 'Media / Entertainment' },
  { value: 'financial', label: 'Financial Services' },
  { value: 'other', label: 'Other' },
];

const LOAN_PURPOSE_OPTIONS = [
  { value: 'working_capital', label: 'Working Capital' },
  { value: 'business_expansion', label: 'Business Expansion' },
  { value: 'machinery_purchase', label: 'Machinery / Equipment Purchase' },
  { value: 'inventory', label: 'Inventory Purchase' },
  { value: 'raw_material', label: 'Raw Material Purchase' },
  { value: 'infrastructure', label: 'Infrastructure Development' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'debt_refinance', label: 'Debt Refinancing' },
  { value: 'new_project', label: 'New Project' },
  { value: 'branch_expansion', label: 'Branch Expansion' },
  { value: 'other', label: 'Other' },
];

const TURNOVER_RANGE_OPTIONS = [
  { value: 'below_40l', label: 'Below ₹40 Lakhs' },
  { value: '40l_1cr', label: '₹40 Lakhs - ₹1 Crore' },
  { value: '1cr_5cr', label: '₹1 Crore - ₹5 Crores' },
  { value: '5cr_10cr', label: '₹5 Crores - ₹10 Crores' },
  { value: '10cr_25cr', label: '₹10 Crores - ₹25 Crores' },
  { value: '25cr_50cr', label: '₹25 Crores - ₹50 Crores' },
  { value: '50cr_100cr', label: '₹50 Crores - ₹100 Crores' },
  { value: 'above_100cr', label: 'Above ₹100 Crores' },
];

const STATE_OPTIONS = [
  { value: 'MH', label: 'Maharashtra' },
  { value: 'DL', label: 'Delhi' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'WB', label: 'West Bengal' },
  { value: 'TG', label: 'Telangana' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'PB', label: 'Punjab' },
  { value: 'HR', label: 'Haryana' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'other', label: 'Other' },
];

// =====================================================
// MAIN COMPONENT
// =====================================================

export function BusinessLoanSection({
  formData,
  errors,
  verifications,
  onFieldChange,
  onVerify,
  loanType,
  className,
}: BusinessLoanSectionProps) {
  const [activeSection, setActiveSection] = useState<'business' | 'financials' | 'requirements'>('business');

  const isWorkingCapital = loanType === 'WORKING_CAPITAL';
  const isMachineryLoan = loanType === 'MACHINERY_LOAN';
  const isOverdraftOrCC = loanType === 'OVERDRAFT' || loanType === 'CASH_CREDIT';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Section Header */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">Business Details</h3>
        <p className="text-sm text-white/60">
          {isWorkingCapital
            ? 'Provide your business details for working capital assessment.'
            : isMachineryLoan
            ? 'Tell us about your business and the machinery you wish to purchase.'
            : isOverdraftOrCC
            ? 'Provide your business details for overdraft/cash credit facility.'
            : 'Provide comprehensive details about your business for loan assessment.'}
        </p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-white/[0.03]">
        {(['business', 'financials', 'requirements'] as const).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              activeSection === section
                ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
            )}
          >
            {section === 'business' && 'Business Info'}
            {section === 'financials' && 'Financials'}
            {section === 'requirements' && 'Requirements'}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      <AnimatePresence mode="wait">
        {/* Business Information */}
        {activeSection === 'business' && (
          <motion.div
            key="business"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Basic Business Info */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <BuildingOfficeIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Business Information</h4>
                  <p className="text-xs text-white/50">Basic details about your business</p>
                </div>
              </div>

              <div className="space-y-4">
                <PremiumInput
                  label="Business / Company Name"
                  value={(formData.businessName as string) || ''}
                  onChange={(e) => onFieldChange('businessName', e.target.value)}
                  placeholder="Enter registered business name"
                  required
                  error={errors.businessName}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumSelect
                    label="Business Type"
                    options={BUSINESS_TYPE_OPTIONS}
                    value={(formData.businessType as string) || ''}
                    onChange={(e) => onFieldChange('businessType', e.target.value)}
                    required
                    error={errors.businessType}
                  />
                  <PremiumSelect
                    label="Industry / Sector"
                    options={INDUSTRY_OPTIONS}
                    value={(formData.industry as string) || ''}
                    onChange={(e) => onFieldChange('industry', e.target.value)}
                    required
                    error={errors.industry}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="Year of Establishment"
                    type="number"
                    value={(formData.yearEstablished as string) || ''}
                    onChange={(e) => onFieldChange('yearEstablished', e.target.value)}
                    placeholder="e.g., 2015"
                    required
                    error={errors.yearEstablished}
                  />
                  <PremiumInput
                    label="Number of Employees"
                    type="number"
                    value={(formData.employeeCount as string) || ''}
                    onChange={(e) => onFieldChange('employeeCount', e.target.value)}
                    placeholder="e.g., 50"
                    error={errors.employeeCount}
                  />
                </div>

                <PremiumTextarea
                  label="Business Description"
                  value={(formData.businessDescription as string) || ''}
                  onChange={(e) => onFieldChange('businessDescription', e.target.value)}
                  placeholder="Brief description of your business activities..."
                  rows={3}
                  maxLength={500}
                  showCharCount
                />
              </div>
            </div>

            {/* GST & Registration */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <ShieldCheckIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Registration Details</h4>
                  <p className="text-xs text-white/50">Tax and registration information</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="GSTIN"
                    value={(formData.gstin as string) || ''}
                    onChange={(e) => onFieldChange('gstin', e.target.value.toUpperCase())}
                    placeholder="e.g., 27AABCU9603R1ZM"
                    maxLength={15}
                    verificationStatus={verifications.gstin}
                    onVerify={onVerify ? () => onVerify('gstin') : undefined}
                    error={errors.gstin}
                  />
                  <PremiumInput
                    label="Business PAN"
                    value={(formData.businessPan as string) || ''}
                    onChange={(e) => onFieldChange('businessPan', e.target.value.toUpperCase())}
                    placeholder="e.g., AABCU9603R"
                    maxLength={10}
                    verificationStatus={verifications.businessPan}
                    onVerify={onVerify ? () => onVerify('businessPan') : undefined}
                    error={errors.businessPan}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="Udyam / MSME Registration (if any)"
                    value={(formData.udyamNumber as string) || ''}
                    onChange={(e) => onFieldChange('udyamNumber', e.target.value.toUpperCase())}
                    placeholder="e.g., UDYAM-MH-00-0000000"
                    verificationStatus={verifications.udyamNumber}
                    onVerify={onVerify ? () => onVerify('udyamNumber') : undefined}
                    error={errors.udyamNumber}
                  />
                  <PremiumInput
                    label="CIN / Registration Number"
                    value={(formData.cin as string) || ''}
                    onChange={(e) => onFieldChange('cin', e.target.value.toUpperCase())}
                    placeholder="For companies"
                    error={errors.cin}
                  />
                </div>
              </div>
            </div>

            {/* Business Address */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <h4 className="text-sm font-medium text-white mb-4">Business Address</h4>

              <div className="space-y-4">
                <PremiumTextarea
                  label="Registered Address"
                  value={(formData.businessAddress as string) || ''}
                  onChange={(e) => onFieldChange('businessAddress', e.target.value)}
                  placeholder="Shop/Office No., Building, Street, Area..."
                  rows={2}
                  required
                  error={errors.businessAddress}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PremiumInput
                    label="City"
                    value={(formData.businessCity as string) || ''}
                    onChange={(e) => onFieldChange('businessCity', e.target.value)}
                    placeholder="Enter city"
                    required
                    error={errors.businessCity}
                  />
                  <PremiumSelect
                    label="State"
                    options={STATE_OPTIONS}
                    value={(formData.businessState as string) || ''}
                    onChange={(e) => onFieldChange('businessState', e.target.value)}
                    required
                    error={errors.businessState}
                  />
                  <PremiumInput
                    label="PIN Code"
                    value={(formData.businessPincode as string) || ''}
                    onChange={(e) => onFieldChange('businessPincode', e.target.value.replace(/\D/g, ''))}
                    placeholder="400001"
                    maxLength={6}
                    required
                    error={errors.businessPincode}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Financials */}
        {activeSection === 'financials' && (
          <motion.div
            key="financials"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Turnover & Revenue */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <ChartBarIcon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Revenue & Turnover</h4>
                  <p className="text-xs text-white/50">Last 2 financial years</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumCurrencyInput
                    label="Annual Turnover (Current FY)"
                    value={(formData.currentTurnover as string) || ''}
                    onChange={(e) => onFieldChange('currentTurnover', e.target.value)}
                    placeholder="e.g., 5,00,00,000"
                    required
                    error={errors.currentTurnover}
                  />
                  <PremiumCurrencyInput
                    label="Annual Turnover (Previous FY)"
                    value={(formData.previousTurnover as string) || ''}
                    onChange={(e) => onFieldChange('previousTurnover', e.target.value)}
                    placeholder="e.g., 4,50,00,000"
                    error={errors.previousTurnover}
                  />
                </div>

                <PremiumSelect
                  label="Turnover Range"
                  options={TURNOVER_RANGE_OPTIONS}
                  value={(formData.turnoverRange as string) || ''}
                  onChange={(e) => onFieldChange('turnoverRange', e.target.value)}
                  error={errors.turnoverRange}
                />
              </div>
            </div>

            {/* Profitability */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <CurrencyRupeeIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Profitability</h4>
                  <p className="text-xs text-white/50">Net profit details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumCurrencyInput
                  label="Net Profit (Current FY)"
                  value={(formData.currentProfit as string) || ''}
                  onChange={(e) => onFieldChange('currentProfit', e.target.value)}
                  placeholder="e.g., 50,00,000"
                  error={errors.currentProfit}
                />
                <PremiumCurrencyInput
                  label="Net Profit (Previous FY)"
                  value={(formData.previousProfit as string) || ''}
                  onChange={(e) => onFieldChange('previousProfit', e.target.value)}
                  placeholder="e.g., 45,00,000"
                  error={errors.previousProfit}
                />
              </div>
            </div>

            {/* Banking Details */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Banking Details</h4>
                  <p className="text-xs text-white/50">Current account information</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="Primary Bank Name"
                    value={(formData.primaryBank as string) || ''}
                    onChange={(e) => onFieldChange('primaryBank', e.target.value)}
                    placeholder="e.g., HDFC Bank"
                    required
                    error={errors.primaryBank}
                  />
                  <PremiumInput
                    label="Account Since (Year)"
                    type="number"
                    value={(formData.bankingSince as string) || ''}
                    onChange={(e) => onFieldChange('bankingSince', e.target.value)}
                    placeholder="e.g., 2018"
                    error={errors.bankingSince}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumCurrencyInput
                    label="Avg. Monthly Bank Balance"
                    value={(formData.avgBankBalance as string) || ''}
                    onChange={(e) => onFieldChange('avgBankBalance', e.target.value)}
                    placeholder="e.g., 10,00,000"
                    helperText="Last 6 months average"
                    error={errors.avgBankBalance}
                  />
                  <PremiumCurrencyInput
                    label="Monthly Bank Credits"
                    value={(formData.monthlyCredits as string) || ''}
                    onChange={(e) => onFieldChange('monthlyCredits', e.target.value)}
                    placeholder="e.g., 50,00,000"
                    helperText="Average monthly inflow"
                    error={errors.monthlyCredits}
                  />
                </div>
              </div>
            </div>

            {/* ITR Filed */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={(formData.itrFiled as boolean) || false}
                    onChange={(e) => onFieldChange('itrFiled', e.target.checked)}
                    className="sr-only"
                  />
                  <motion.div
                    className={cn(
                      'w-12 h-7 rounded-full transition-colors',
                      formData.itrFiled ? 'bg-emerald-500' : 'bg-white/20'
                    )}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white shadow-lg"
                      animate={{ x: formData.itrFiled ? 26 : 4, y: 4 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </motion.div>
                </div>
                <div>
                  <span className="text-sm font-medium text-white">ITR Filed</span>
                  <p className="text-xs text-white/50">Have you filed Income Tax Returns for last 2 years?</p>
                </div>
              </label>
            </div>
          </motion.div>
        )}

        {/* Requirements */}
        {activeSection === 'requirements' && (
          <motion.div
            key="requirements"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Loan Purpose & Amount */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-primary/10 to-orange-500/10 border border-brand-primary/20">
              <h4 className="text-sm font-medium text-white mb-4">Loan Requirement</h4>

              <div className="space-y-4">
                <PremiumSelect
                  label="Loan Purpose"
                  options={LOAN_PURPOSE_OPTIONS}
                  value={(formData.loanPurpose as string) || ''}
                  onChange={(e) => onFieldChange('loanPurpose', e.target.value)}
                  required
                  error={errors.loanPurpose}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumCurrencyInput
                    label="Required Loan Amount"
                    value={(formData.requiredAmount as string) || ''}
                    onChange={(e) => onFieldChange('requiredAmount', e.target.value)}
                    placeholder="e.g., 50,00,000"
                    required
                    error={errors.requiredAmount}
                  />
                  <PremiumInput
                    label="Preferred Tenure (Months)"
                    type="number"
                    value={(formData.preferredTenure as string) || ''}
                    onChange={(e) => onFieldChange('preferredTenure', e.target.value)}
                    placeholder="e.g., 36"
                    error={errors.preferredTenure}
                  />
                </div>

                <PremiumTextarea
                  label="Purpose Details"
                  value={(formData.purposeDetails as string) || ''}
                  onChange={(e) => onFieldChange('purposeDetails', e.target.value)}
                  placeholder="Describe how you plan to utilize the loan amount..."
                  rows={3}
                />
              </div>
            </div>

            {/* Machinery Details (for Machinery Loan) */}
            {isMachineryLoan && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl bg-violet-500/10 border border-violet-500/20"
              >
                <h4 className="text-sm font-medium text-white mb-4">Machinery Details</h4>

                <div className="space-y-4">
                  <PremiumInput
                    label="Machinery / Equipment Name"
                    value={(formData.machineryName as string) || ''}
                    onChange={(e) => onFieldChange('machineryName', e.target.value)}
                    placeholder="e.g., CNC Lathe Machine"
                    required
                    error={errors.machineryName}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PremiumInput
                      label="Manufacturer / Brand"
                      value={(formData.machineryBrand as string) || ''}
                      onChange={(e) => onFieldChange('machineryBrand', e.target.value)}
                      placeholder="e.g., Siemens"
                    />
                    <PremiumInput
                      label="Model Number"
                      value={(formData.machineryModel as string) || ''}
                      onChange={(e) => onFieldChange('machineryModel', e.target.value)}
                      placeholder="Enter model"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PremiumCurrencyInput
                      label="Machinery Cost"
                      value={(formData.machineryCost as string) || ''}
                      onChange={(e) => onFieldChange('machineryCost', e.target.value)}
                      placeholder="e.g., 25,00,000"
                      required
                      error={errors.machineryCost}
                    />
                    <PremiumInput
                      label="Supplier / Dealer Name"
                      value={(formData.machinerySupplier as string) || ''}
                      onChange={(e) => onFieldChange('machinerySupplier', e.target.value)}
                      placeholder="Enter supplier name"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Overdraft/CC Limit (for OD/CC) */}
            {isOverdraftOrCC && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20"
              >
                <h4 className="text-sm font-medium text-white mb-4">
                  {loanType === 'OVERDRAFT' ? 'Overdraft Facility' : 'Cash Credit Facility'}
                </h4>

                <div className="space-y-4">
                  <PremiumCurrencyInput
                    label="Required Limit"
                    value={(formData.requiredLimit as string) || ''}
                    onChange={(e) => onFieldChange('requiredLimit', e.target.value)}
                    placeholder="e.g., 25,00,000"
                    required
                    error={errors.requiredLimit}
                  />
                  <PremiumInput
                    label="Expected Utilization (%)"
                    type="number"
                    value={(formData.expectedUtilization as string) || ''}
                    onChange={(e) => onFieldChange('expectedUtilization', e.target.value)}
                    placeholder="e.g., 80"
                    helperText="Average expected utilization of the limit"
                  />
                </div>
              </motion.div>
            )}

            {/* Collateral */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={(formData.hasCollateral as boolean) || false}
                    onChange={(e) => onFieldChange('hasCollateral', e.target.checked)}
                    className="sr-only"
                  />
                  <motion.div
                    className={cn(
                      'w-12 h-7 rounded-full transition-colors',
                      formData.hasCollateral ? 'bg-violet-500' : 'bg-white/20'
                    )}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white shadow-lg"
                      animate={{ x: formData.hasCollateral ? 26 : 4, y: 4 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </motion.div>
                </div>
                <div>
                  <span className="text-sm font-medium text-white">Collateral Available</span>
                  <p className="text-xs text-white/50">Property or other assets to offer as security</p>
                </div>
              </label>

              <AnimatePresence>
                {formData.hasCollateral && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4"
                  >
                    <PremiumTextarea
                      label="Collateral Details"
                      value={(formData.collateralDetails as string) || ''}
                      onChange={(e) => onFieldChange('collateralDetails', e.target.value)}
                      placeholder="Describe the collateral you can offer (property type, location, value, etc.)"
                      rows={3}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default BusinessLoanSection;
