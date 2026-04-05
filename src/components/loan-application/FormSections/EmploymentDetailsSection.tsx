/**
 * Employment Details Section Component
 * Premium form section for collecting employment and income information
 * Supports: Salaried, Self-Employed, Business, Professional, Retired
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { PremiumInput, PremiumSelect, PremiumCurrencyInput } from './PremiumInput';
import type { VerificationStatus } from '../types';

// =====================================================
// ICONS
// =====================================================

const BriefcaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>
);

const BuildingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);

const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
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

type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'PROFESSIONAL' | 'RETIRED' | 'HOMEMAKER' | 'STUDENT';

interface EmploymentDetailsData {
  employment_type: EmploymentType;
  // Salaried Fields
  employer_name?: string;
  employer_address?: string;
  industry_type?: string;
  designation?: string;
  department?: string;
  employee_id?: string;
  date_of_joining?: string;
  total_experience?: string;
  current_job_experience?: string;
  monthly_gross_salary?: number;
  monthly_net_salary?: number;
  salary_bank_name?: string;
  salary_account_number?: string;
  // Self-Employed / Business Fields
  business_name?: string;
  business_type?: string;
  business_nature?: string;
  gstin?: string;
  udyam_number?: string;
  business_vintage?: string;
  business_address?: string;
  annual_turnover?: number;
  net_profit?: number;
  business_bank_name?: string;
  business_account_number?: string;
  // Professional Fields
  profession?: string;
  professional_registration?: string;
  practice_name?: string;
  practice_address?: string;
  // Other Income
  other_income_source?: string;
  other_income_amount?: number;
}

interface EmploymentDetailsSectionProps {
  data: Partial<EmploymentDetailsData>;
  errors: Record<string, string>;
  verifications: Record<string, VerificationStatus>;
  onChange: (field: string, value: unknown) => void;
  onVerify: (field: string) => Promise<void>;
  isSubmitting?: boolean;
  className?: string;
}

// =====================================================
// OPTIONS
// =====================================================

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'SALARIED', label: 'Salaried Employee', description: 'Working for a company/organization' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed', description: 'Running own business/freelancer' },
  { value: 'BUSINESS', label: 'Business Owner', description: 'Proprietor/Partner/Director of a company' },
  { value: 'PROFESSIONAL', label: 'Professional', description: 'Doctor, CA, Lawyer, etc.' },
  { value: 'RETIRED', label: 'Retired / Pensioner', description: 'Receiving pension income' },
];

const INDUSTRY_TYPE_OPTIONS = [
  { value: 'IT_SOFTWARE', label: 'IT / Software' },
  { value: 'BANKING_FINANCE', label: 'Banking / Finance' },
  { value: 'HEALTHCARE', label: 'Healthcare / Pharma' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'RETAIL', label: 'Retail / FMCG' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'GOVERNMENT', label: 'Government / PSU' },
  { value: 'TELECOM', label: 'Telecom' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'CONSULTING', label: 'Consulting' },
  { value: 'MEDIA', label: 'Media / Entertainment' },
  { value: 'AUTOMOBILE', label: 'Automobile' },
  { value: 'OTHER', label: 'Other' },
];

const BUSINESS_TYPE_OPTIONS = [
  { value: 'PROPRIETORSHIP', label: 'Proprietorship' },
  { value: 'PARTNERSHIP', label: 'Partnership Firm' },
  { value: 'LLP', label: 'Limited Liability Partnership (LLP)' },
  { value: 'PRIVATE_LIMITED', label: 'Private Limited Company' },
  { value: 'PUBLIC_LIMITED', label: 'Public Limited Company' },
  { value: 'OPC', label: 'One Person Company (OPC)' },
];

const BUSINESS_NATURE_OPTIONS = [
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'TRADING', label: 'Trading' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'EXPORT_IMPORT', label: 'Export / Import' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'OTHER', label: 'Other' },
];

const PROFESSION_OPTIONS = [
  { value: 'DOCTOR', label: 'Doctor / Medical Professional' },
  { value: 'CA', label: 'Chartered Accountant' },
  { value: 'CS', label: 'Company Secretary' },
  { value: 'LAWYER', label: 'Lawyer / Advocate' },
  { value: 'ARCHITECT', label: 'Architect' },
  { value: 'ENGINEER', label: 'Engineer (Consultant)' },
  { value: 'OTHER', label: 'Other Professional' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'LESS_THAN_1', label: 'Less than 1 year' },
  { value: '1_TO_2', label: '1-2 years' },
  { value: '2_TO_3', label: '2-3 years' },
  { value: '3_TO_5', label: '3-5 years' },
  { value: '5_TO_10', label: '5-10 years' },
  { value: '10_TO_15', label: '10-15 years' },
  { value: '15_TO_20', label: '15-20 years' },
  { value: 'MORE_THAN_20', label: 'More than 20 years' },
];

const BUSINESS_VINTAGE_OPTIONS = [
  { value: 'LESS_THAN_1', label: 'Less than 1 year' },
  { value: '1_TO_3', label: '1-3 years' },
  { value: '3_TO_5', label: '3-5 years' },
  { value: '5_TO_10', label: '5-10 years' },
  { value: 'MORE_THAN_10', label: 'More than 10 years' },
];

// =====================================================
// EMPLOYMENT TYPE CARD
// =====================================================

interface EmploymentTypeCardProps {
  type: typeof EMPLOYMENT_TYPE_OPTIONS[number];
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function EmploymentTypeCard({ type, isSelected, onClick, disabled }: EmploymentTypeCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        'relative p-4 rounded-xl text-left transition-all duration-300',
        'border backdrop-blur-sm',
        isSelected
          ? 'bg-brand-primary/10 border-brand-primary ring-2 ring-brand-primary/20'
          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Selection Indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      <h4 className={cn(
        'font-semibold transition-colors',
        isSelected ? 'text-brand-primary' : 'text-white'
      )}>
        {type.label}
      </h4>
      <p className="text-sm text-white/50 mt-1">{type.description}</p>
    </motion.button>
  );
}

// =====================================================
// SUB-SECTION COMPONENT
// =====================================================

interface SubSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isComplete?: boolean;
}

function SubSection({ title, description, icon, children, isComplete }: SubSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
          isComplete
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-brand-primary/10 text-brand-primary'
        )}>
          {isComplete ? <CheckCircleIcon className="w-6 h-6" /> : icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/50">{description}</p>
        </div>
      </div>

      <div className="pl-16">
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function EmploymentDetailsSection({
  data,
  errors,
  verifications,
  onChange,
  onVerify,
  isSubmitting,
  className,
}: EmploymentDetailsSectionProps) {
  const employmentType = data.employment_type;

  return (
    <div className={cn('space-y-8', className)}>
      {/* Section 1: Employment Type Selection */}
      <SubSection
        title="Employment Type"
        description="Select your current employment status"
        icon={<BriefcaseIcon className="w-6 h-6" />}
        isComplete={!!employmentType}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EMPLOYMENT_TYPE_OPTIONS.map((type) => (
            <EmploymentTypeCard
              key={type.value}
              type={type}
              isSelected={employmentType === type.value}
              onClick={() => onChange('employment_type', type.value)}
              disabled={isSubmitting}
            />
          ))}
        </div>
      </SubSection>

      {/* Section 2: Employment Details (Based on Type) */}
      <AnimatePresence mode="wait">
        {employmentType === 'SALARIED' && (
          <motion.div
            key="salaried"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <SubSection
              title="Employer Details"
              description="Information about your current employer"
              icon={<BuildingIcon className="w-6 h-6" />}
              isComplete={!!(data.employer_name && data.designation)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <PremiumInput
                  label="Employer/Company Name"
                  placeholder="Enter company name"
                  value={data.employer_name || ''}
                  onChange={(e) => onChange('employer_name', e.target.value)}
                  error={errors.employer_name}
                  required
                  disabled={isSubmitting}
                />

                <PremiumSelect
                  label="Industry Type"
                  options={INDUSTRY_TYPE_OPTIONS}
                  value={data.industry_type || ''}
                  onChange={(e) => onChange('industry_type', e.target.value)}
                  error={errors.industry_type}
                  required
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="Designation"
                  placeholder="Your current role/title"
                  value={data.designation || ''}
                  onChange={(e) => onChange('designation', e.target.value)}
                  error={errors.designation}
                  required
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="Department"
                  placeholder="Your department"
                  value={data.department || ''}
                  onChange={(e) => onChange('department', e.target.value)}
                  error={errors.department}
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="Employee ID"
                  placeholder="Your employee ID"
                  value={data.employee_id || ''}
                  onChange={(e) => onChange('employee_id', e.target.value)}
                  error={errors.employee_id}
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="Date of Joining"
                  type="date"
                  value={data.date_of_joining || ''}
                  onChange={(e) => onChange('date_of_joining', e.target.value)}
                  error={errors.date_of_joining}
                  required
                  disabled={isSubmitting}
                />

                <PremiumSelect
                  label="Total Work Experience"
                  options={EXPERIENCE_OPTIONS}
                  value={data.total_experience || ''}
                  onChange={(e) => onChange('total_experience', e.target.value)}
                  error={errors.total_experience}
                  required
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="Office Address"
                  placeholder="Office/workplace address"
                  value={data.employer_address || ''}
                  onChange={(e) => onChange('employer_address', e.target.value)}
                  error={errors.employer_address}
                  disabled={isSubmitting}
                />
              </div>
            </SubSection>
          </motion.div>
        )}

        {(employmentType === 'SELF_EMPLOYED' || employmentType === 'BUSINESS') && (
          <motion.div
            key="business"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <SubSection
              title="Business Details"
              description="Information about your business"
              icon={<BuildingIcon className="w-6 h-6" />}
              isComplete={!!(data.business_name && data.gstin)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <PremiumInput
                  label="Business/Firm Name"
                  placeholder="Enter business name"
                  value={data.business_name || ''}
                  onChange={(e) => onChange('business_name', e.target.value)}
                  error={errors.business_name}
                  required
                  disabled={isSubmitting}
                />

                <PremiumSelect
                  label="Business Type"
                  options={BUSINESS_TYPE_OPTIONS}
                  value={data.business_type || ''}
                  onChange={(e) => onChange('business_type', e.target.value)}
                  error={errors.business_type}
                  required
                  disabled={isSubmitting}
                />

                <PremiumSelect
                  label="Nature of Business"
                  options={BUSINESS_NATURE_OPTIONS}
                  value={data.business_nature || ''}
                  onChange={(e) => onChange('business_nature', e.target.value)}
                  error={errors.business_nature}
                  required
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="GSTIN"
                  placeholder="22AAAAA0000A1Z5"
                  value={data.gstin || ''}
                  onChange={(e) => onChange('gstin', e.target.value.toUpperCase())}
                  error={errors.gstin}
                  verificationStatus={verifications.gstin}
                  onVerify={() => onVerify('gstin')}
                  verifyLabel="Fetch GST"
                  maxLength={15}
                  required
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="Udyam Registration Number"
                  placeholder="UDYAM-XX-00-0000000"
                  value={data.udyam_number || ''}
                  onChange={(e) => onChange('udyam_number', e.target.value.toUpperCase())}
                  error={errors.udyam_number}
                  disabled={isSubmitting}
                />

                <PremiumSelect
                  label="Business Vintage"
                  options={BUSINESS_VINTAGE_OPTIONS}
                  value={data.business_vintage || ''}
                  onChange={(e) => onChange('business_vintage', e.target.value)}
                  error={errors.business_vintage}
                  helperText="Years since business started"
                  required
                  disabled={isSubmitting}
                />

                <div className="md:col-span-2">
                  <PremiumInput
                    label="Business Address"
                    placeholder="Registered office / factory address"
                    value={data.business_address || ''}
                    onChange={(e) => onChange('business_address', e.target.value)}
                    error={errors.business_address}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </SubSection>
          </motion.div>
        )}

        {employmentType === 'PROFESSIONAL' && (
          <motion.div
            key="professional"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <SubSection
              title="Professional Details"
              description="Information about your profession and practice"
              icon={<BuildingIcon className="w-6 h-6" />}
              isComplete={!!(data.profession && data.professional_registration)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <PremiumSelect
                  label="Profession"
                  options={PROFESSION_OPTIONS}
                  value={data.profession || ''}
                  onChange={(e) => onChange('profession', e.target.value)}
                  error={errors.profession}
                  required
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="Professional Registration Number"
                  placeholder="Registration/License number"
                  value={data.professional_registration || ''}
                  onChange={(e) => onChange('professional_registration', e.target.value)}
                  error={errors.professional_registration}
                  helperText="MCI/ICAI/Bar Council registration"
                  required
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="Practice/Firm Name"
                  placeholder="Clinic/Firm name"
                  value={data.practice_name || ''}
                  onChange={(e) => onChange('practice_name', e.target.value)}
                  error={errors.practice_name}
                  disabled={isSubmitting}
                />

                <PremiumSelect
                  label="Years of Practice"
                  options={EXPERIENCE_OPTIONS}
                  value={data.total_experience || ''}
                  onChange={(e) => onChange('total_experience', e.target.value)}
                  error={errors.total_experience}
                  required
                  disabled={isSubmitting}
                />

                <div className="md:col-span-2">
                  <PremiumInput
                    label="Practice Address"
                    placeholder="Clinic/Office address"
                    value={data.practice_address || ''}
                    onChange={(e) => onChange('practice_address', e.target.value)}
                    error={errors.practice_address}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </SubSection>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section 3: Income Details (Always shown after employment type selected) */}
      <AnimatePresence>
        {employmentType && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <SubSection
              title="Income Details"
              description="Your monthly/annual income information"
              icon={<CurrencyIcon className="w-6 h-6" />}
              isComplete={
                employmentType === 'SALARIED'
                  ? !!(data.monthly_gross_salary && data.monthly_net_salary)
                  : !!(data.annual_turnover && data.net_profit)
              }
            >
              {employmentType === 'SALARIED' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <PremiumCurrencyInput
                    label="Monthly Gross Salary"
                    placeholder="Enter gross salary"
                    value={data.monthly_gross_salary?.toString() || ''}
                    onChange={(e) => onChange('monthly_gross_salary', parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                    error={errors.monthly_gross_salary}
                    helperText="Before any deductions"
                    required
                    disabled={isSubmitting}
                  />

                  <PremiumCurrencyInput
                    label="Monthly Net Salary"
                    placeholder="Enter net take-home"
                    value={data.monthly_net_salary?.toString() || ''}
                    onChange={(e) => onChange('monthly_net_salary', parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                    error={errors.monthly_net_salary}
                    helperText="After all deductions"
                    required
                    disabled={isSubmitting}
                  />

                  <PremiumInput
                    label="Salary Bank Name"
                    placeholder="Bank where salary is credited"
                    value={data.salary_bank_name || ''}
                    onChange={(e) => onChange('salary_bank_name', e.target.value)}
                    error={errors.salary_bank_name}
                    required
                    disabled={isSubmitting}
                  />

                  <PremiumInput
                    label="Salary Account Number"
                    placeholder="Account number"
                    value={data.salary_account_number || ''}
                    onChange={(e) => onChange('salary_account_number', e.target.value)}
                    error={errors.salary_account_number}
                    verificationStatus={verifications.salary_account_number}
                    onVerify={() => onVerify('salary_account_number')}
                    verifyLabel="Verify"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {(employmentType === 'SELF_EMPLOYED' || employmentType === 'BUSINESS' || employmentType === 'PROFESSIONAL') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <PremiumCurrencyInput
                    label="Annual Turnover (Last FY)"
                    placeholder="Enter annual turnover"
                    value={data.annual_turnover?.toString() || ''}
                    onChange={(e) => onChange('annual_turnover', parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                    error={errors.annual_turnover}
                    helperText="As per last ITR filed"
                    required
                    disabled={isSubmitting}
                  />

                  <PremiumCurrencyInput
                    label="Net Profit (Last FY)"
                    placeholder="Enter net profit"
                    value={data.net_profit?.toString() || ''}
                    onChange={(e) => onChange('net_profit', parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                    error={errors.net_profit}
                    helperText="After all expenses"
                    required
                    disabled={isSubmitting}
                  />

                  <PremiumInput
                    label="Business Bank Name"
                    placeholder="Primary business bank"
                    value={data.business_bank_name || ''}
                    onChange={(e) => onChange('business_bank_name', e.target.value)}
                    error={errors.business_bank_name}
                    required
                    disabled={isSubmitting}
                  />

                  <PremiumInput
                    label="Business Account Number"
                    placeholder="Current account number"
                    value={data.business_account_number || ''}
                    onChange={(e) => onChange('business_account_number', e.target.value)}
                    error={errors.business_account_number}
                    verificationStatus={verifications.business_account_number}
                    onVerify={() => onVerify('business_account_number')}
                    verifyLabel="Verify"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {employmentType === 'RETIRED' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <PremiumCurrencyInput
                    label="Monthly Pension"
                    placeholder="Enter monthly pension"
                    value={data.monthly_net_salary?.toString() || ''}
                    onChange={(e) => onChange('monthly_net_salary', parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                    error={errors.monthly_net_salary}
                    required
                    disabled={isSubmitting}
                  />

                  <PremiumInput
                    label="Pension Bank Name"
                    placeholder="Bank where pension is credited"
                    value={data.salary_bank_name || ''}
                    onChange={(e) => onChange('salary_bank_name', e.target.value)}
                    error={errors.salary_bank_name}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {/* Other Income (Optional for all) */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h4 className="text-sm font-medium text-white/70 mb-4">Other Income (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <PremiumInput
                    label="Other Income Source"
                    placeholder="Rental, Investments, etc."
                    value={data.other_income_source || ''}
                    onChange={(e) => onChange('other_income_source', e.target.value)}
                    error={errors.other_income_source}
                    disabled={isSubmitting}
                  />

                  <PremiumCurrencyInput
                    label="Monthly Other Income"
                    placeholder="Amount per month"
                    value={data.other_income_amount?.toString() || ''}
                    onChange={(e) => onChange('other_income_amount', parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                    error={errors.other_income_amount}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </SubSection>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EmploymentDetailsSection;
