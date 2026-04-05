/**
 * Customer Details Section Component
 * Premium multi-step form section for collecting customer information
 */

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { PremiumInput, PremiumSelect, PremiumPhoneInput } from './PremiumInput';
import type { VerificationStatus } from '../types';

// =====================================================
// ICONS
// =====================================================

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const IdCardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
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

interface CustomerDetailsData {
  full_name: string;
  date_of_birth: string;
  gender: string;
  father_name: string;
  mother_name: string;
  marital_status: string;
  pan_number: string;
  aadhaar_number: string;
  mobile_number: string;
  email: string;
  current_address: string;
  current_city: string;
  current_state: string;
  current_pincode: string;
  permanent_address: string;
  permanent_city: string;
  permanent_state: string;
  permanent_pincode: string;
  same_as_current: boolean;
  residential_status: string;
  years_at_current_address: string;
}

interface CustomerDetailsSectionProps {
  data: Partial<CustomerDetailsData>;
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

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' },
];

const RESIDENTIAL_STATUS_OPTIONS = [
  { value: 'OWNED', label: 'Self-Owned' },
  { value: 'RENTED', label: 'Rented' },
  { value: 'PARENTAL', label: 'Parental / Family Owned' },
  { value: 'COMPANY_PROVIDED', label: 'Company Provided' },
  { value: 'HOSTEL', label: 'Hostel / PG' },
];

const STATE_OPTIONS = [
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'CT', label: 'Chhattisgarh' },
  { value: 'DL', label: 'Delhi' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OR', label: 'Odisha' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
];

const YEARS_AT_ADDRESS_OPTIONS = [
  { value: 'LESS_THAN_1', label: 'Less than 1 year' },
  { value: '1_TO_2', label: '1-2 years' },
  { value: '2_TO_5', label: '2-5 years' },
  { value: '5_TO_10', label: '5-10 years' },
  { value: 'MORE_THAN_10', label: 'More than 10 years' },
];

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
      {/* Section Header */}
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

      {/* Section Content */}
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

export function CustomerDetailsSection({
  data,
  errors,
  verifications,
  onChange,
  onVerify,
  isSubmitting,
  className,
}: CustomerDetailsSectionProps) {
  const [sameAsCurrentAddress, setSameAsCurrentAddress] = useState(data.same_as_current ?? false);

  const handleSameAsCurrentChange = useCallback((checked: boolean) => {
    setSameAsCurrentAddress(checked);
    onChange('same_as_current', checked);

    if (checked) {
      onChange('permanent_address', data.current_address);
      onChange('permanent_city', data.current_city);
      onChange('permanent_state', data.current_state);
      onChange('permanent_pincode', data.current_pincode);
    }
  }, [data, onChange]);

  return (
    <div className={cn('space-y-8', className)}>
      {/* Section 1: Personal Information */}
      <SubSection
        title="Personal Information"
        description="Your basic details as per official documents"
        icon={<UserIcon className="w-6 h-6" />}
        isComplete={!!(data.full_name && data.date_of_birth && data.gender)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PremiumInput
            label="Full Name"
            placeholder="Enter your full name as per PAN"
            value={data.full_name || ''}
            onChange={(e) => onChange('full_name', e.target.value)}
            error={errors.full_name}
            helperText="Name should match your PAN card"
            required
            disabled={isSubmitting}
          />

          <PremiumInput
            label="Date of Birth"
            type="date"
            value={data.date_of_birth || ''}
            onChange={(e) => onChange('date_of_birth', e.target.value)}
            error={errors.date_of_birth}
            required
            disabled={isSubmitting}
          />

          <PremiumSelect
            label="Gender"
            options={GENDER_OPTIONS}
            value={data.gender || ''}
            onChange={(e) => onChange('gender', e.target.value)}
            error={errors.gender}
            required
            disabled={isSubmitting}
          />

          <PremiumSelect
            label="Marital Status"
            options={MARITAL_STATUS_OPTIONS}
            value={data.marital_status || ''}
            onChange={(e) => onChange('marital_status', e.target.value)}
            error={errors.marital_status}
            required
            disabled={isSubmitting}
          />

          <PremiumInput
            label="Father's Name"
            placeholder="Enter father's full name"
            value={data.father_name || ''}
            onChange={(e) => onChange('father_name', e.target.value)}
            error={errors.father_name}
            required
            disabled={isSubmitting}
          />

          <PremiumInput
            label="Mother's Name"
            placeholder="Enter mother's full name"
            value={data.mother_name || ''}
            onChange={(e) => onChange('mother_name', e.target.value)}
            error={errors.mother_name}
            disabled={isSubmitting}
          />
        </div>
      </SubSection>

      {/* Section 2: Identity Documents */}
      <SubSection
        title="Identity Documents"
        description="Your PAN & Aadhaar for KYC verification"
        icon={<IdCardIcon className="w-6 h-6" />}
        isComplete={
          verifications.pan_number === 'VERIFIED' &&
          verifications.aadhaar_number === 'VERIFIED'
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PremiumInput
            label="PAN Number"
            placeholder="ABCDE1234F"
            value={data.pan_number || ''}
            onChange={(e) => onChange('pan_number', e.target.value.toUpperCase())}
            error={errors.pan_number}
            verificationStatus={verifications.pan_number}
            onVerify={() => onVerify('pan_number')}
            verifyLabel="Verify PAN"
            maxLength={10}
            required
            disabled={isSubmitting}
          />

          <PremiumInput
            label="Aadhaar Number"
            placeholder="1234 5678 9012"
            value={data.aadhaar_number || ''}
            onChange={(e) => {
              // Format aadhaar with spaces
              const value = e.target.value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
              onChange('aadhaar_number', value);
            }}
            error={errors.aadhaar_number}
            verificationStatus={verifications.aadhaar_number}
            onVerify={() => onVerify('aadhaar_number')}
            verifyLabel="Verify Aadhaar"
            maxLength={14}
            required
            disabled={isSubmitting}
          />

          <PremiumPhoneInput
            label="Mobile Number"
            placeholder="9876543210"
            value={data.mobile_number || ''}
            onChange={(e) => onChange('mobile_number', e.target.value)}
            error={errors.mobile_number}
            verificationStatus={verifications.mobile_number}
            onVerify={() => onVerify('mobile_number')}
            verifyLabel="Send OTP"
            maxLength={10}
            required
            disabled={isSubmitting}
          />

          <PremiumInput
            label="Email Address"
            type="email"
            placeholder="your.email@example.com"
            value={data.email || ''}
            onChange={(e) => onChange('email', e.target.value)}
            error={errors.email}
            helperText="We'll send updates to this email"
            disabled={isSubmitting}
          />
        </div>

        {/* Verification Progress */}
        <AnimatePresence>
          {(verifications.pan_number === 'VERIFIED' || verifications.aadhaar_number === 'VERIFIED') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
            >
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">KYC Verification Progress</p>
                  <p className="text-xs text-emerald-400/70">
                    {[
                      verifications.pan_number === 'VERIFIED' && 'PAN',
                      verifications.aadhaar_number === 'VERIFIED' && 'Aadhaar',
                      verifications.mobile_number === 'VERIFIED' && 'Mobile',
                    ].filter(Boolean).join(', ')} verified successfully
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SubSection>

      {/* Section 3: Current Address */}
      <SubSection
        title="Current Address"
        description="Your present residential address"
        icon={<MapPinIcon className="w-6 h-6" />}
        isComplete={!!(data.current_address && data.current_city && data.current_pincode)}
      >
        <div className="space-y-5">
          <PremiumInput
            label="Street Address"
            placeholder="House/Flat No., Building Name, Street Name"
            value={data.current_address || ''}
            onChange={(e) => onChange('current_address', e.target.value)}
            error={errors.current_address}
            required
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <PremiumInput
              label="City"
              placeholder="Enter city name"
              value={data.current_city || ''}
              onChange={(e) => onChange('current_city', e.target.value)}
              error={errors.current_city}
              required
              disabled={isSubmitting}
            />

            <PremiumSelect
              label="State"
              options={STATE_OPTIONS}
              value={data.current_state || ''}
              onChange={(e) => onChange('current_state', e.target.value)}
              error={errors.current_state}
              required
              disabled={isSubmitting}
            />

            <PremiumInput
              label="PIN Code"
              placeholder="6-digit PIN code"
              value={data.current_pincode || ''}
              onChange={(e) => onChange('current_pincode', e.target.value)}
              error={errors.current_pincode}
              maxLength={6}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PremiumSelect
              label="Residential Status"
              options={RESIDENTIAL_STATUS_OPTIONS}
              value={data.residential_status || ''}
              onChange={(e) => onChange('residential_status', e.target.value)}
              error={errors.residential_status}
              required
              disabled={isSubmitting}
            />

            <PremiumSelect
              label="Years at Current Address"
              options={YEARS_AT_ADDRESS_OPTIONS}
              value={data.years_at_current_address || ''}
              onChange={(e) => onChange('years_at_current_address', e.target.value)}
              error={errors.years_at_current_address}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>
      </SubSection>

      {/* Section 4: Permanent Address */}
      <SubSection
        title="Permanent Address"
        description="Your permanent residential address"
        icon={<MapPinIcon className="w-6 h-6" />}
        isComplete={
          sameAsCurrentAddress ||
          !!(data.permanent_address && data.permanent_city && data.permanent_pincode)
        }
      >
        {/* Same as Current Checkbox */}
        <div className="mb-5">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={sameAsCurrentAddress}
                onChange={(e) => handleSameAsCurrentChange(e.target.checked)}
                className="sr-only"
                disabled={isSubmitting}
              />
              <motion.div
                className={cn(
                  'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors',
                  sameAsCurrentAddress
                    ? 'bg-brand-primary border-brand-primary'
                    : 'bg-white/5 border-white/20 group-hover:border-white/40'
                )}
                whileTap={{ scale: 0.9 }}
              >
                <AnimatePresence>
                  {sameAsCurrentAddress && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="w-4 h-4 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
            <span className="text-sm text-white/70 group-hover:text-white transition-colors">
              Same as current address
            </span>
          </label>
        </div>

        {/* Permanent Address Fields */}
        <AnimatePresence>
          {!sameAsCurrentAddress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-5"
            >
              <PremiumInput
                label="Street Address"
                placeholder="House/Flat No., Building Name, Street Name"
                value={data.permanent_address || ''}
                onChange={(e) => onChange('permanent_address', e.target.value)}
                error={errors.permanent_address}
                required
                disabled={isSubmitting}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <PremiumInput
                  label="City"
                  placeholder="Enter city name"
                  value={data.permanent_city || ''}
                  onChange={(e) => onChange('permanent_city', e.target.value)}
                  error={errors.permanent_city}
                  required
                  disabled={isSubmitting}
                />

                <PremiumSelect
                  label="State"
                  options={STATE_OPTIONS}
                  value={data.permanent_state || ''}
                  onChange={(e) => onChange('permanent_state', e.target.value)}
                  error={errors.permanent_state}
                  required
                  disabled={isSubmitting}
                />

                <PremiumInput
                  label="PIN Code"
                  placeholder="6-digit PIN code"
                  value={data.permanent_pincode || ''}
                  onChange={(e) => onChange('permanent_pincode', e.target.value)}
                  error={errors.permanent_pincode}
                  maxLength={6}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SubSection>
    </div>
  );
}

export default CustomerDetailsSection;
