/**
 * Co-Applicant Section Component
 * Premium co-applicant and guarantor management
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { VerificationStatus } from '../types';
import { PremiumInput, PremiumSelect, PremiumPhoneInput, PremiumCurrencyInput } from './PremiumInput';

// =====================================================
// ICONS
// =====================================================

const UserPlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);

const BriefcaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>
);

const ShieldCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface CoApplicant {
  id: string;
  type: 'co_applicant' | 'guarantor';
  relationship: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  pan: string;
  panVerificationStatus: VerificationStatus;
  aadhaar: string;
  mobile: string;
  email: string;
  employmentType: string;
  companyName: string;
  designation: string;
  monthlyIncome: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface CoApplicantSectionProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  verifications: Record<string, VerificationStatus>;
  onFieldChange: (field: string, value: unknown) => void;
  onVerify?: (field: string) => Promise<void>;
  requiresCoApplicant?: boolean;
  className?: string;
}

// =====================================================
// OPTIONS
// =====================================================

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Son / Daughter' },
  { value: 'sibling', label: 'Brother / Sister' },
  { value: 'friend', label: 'Friend' },
  { value: 'business_partner', label: 'Business Partner' },
  { value: 'other', label: 'Other' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'salaried', label: 'Salaried' },
  { value: 'self_employed', label: 'Self Employed' },
  { value: 'business', label: 'Business Owner' },
  { value: 'professional', label: 'Professional' },
  { value: 'retired', label: 'Retired' },
  { value: 'homemaker', label: 'Homemaker' },
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
  { value: 'LA', label: 'Ladakh' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OR', label: 'Odisha' },
  { value: 'PY', label: 'Puducherry' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UT', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const generateId = () => `coapplicant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const createEmptyCoApplicant = (type: 'co_applicant' | 'guarantor'): CoApplicant => ({
  id: generateId(),
  type,
  relationship: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  pan: '',
  panVerificationStatus: 'PENDING',
  aadhaar: '',
  mobile: '',
  email: '',
  employmentType: '',
  companyName: '',
  designation: '',
  monthlyIncome: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
});

// =====================================================
// CO-APPLICANT CARD COMPONENT
// =====================================================

interface CoApplicantCardProps {
  coApplicant: CoApplicant;
  index: number;
  onUpdate: (coApplicant: CoApplicant) => void;
  onDelete: () => void;
  errors: Record<string, string>;
  onVerify?: (field: string) => Promise<void>;
}

const CoApplicantCard = ({
  coApplicant,
  index,
  onUpdate,
  onDelete,
  errors,
  onVerify,
}: CoApplicantCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState<'personal' | 'employment' | 'address'>('personal');

  const updateField = (field: keyof CoApplicant, value: string) => {
    onUpdate({ ...coApplicant, [field]: value });
  };

  const isCoApplicant = coApplicant.type === 'co_applicant';
  const gradientColors = isCoApplicant
    ? 'from-violet-500 to-purple-500'
    : 'from-amber-500 to-orange-500';

  const displayName = coApplicant.firstName && coApplicant.lastName
    ? `${coApplicant.firstName} ${coApplicant.lastName}`
    : isCoApplicant ? `Co-Applicant ${index + 1}` : `Guarantor ${index + 1}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            `bg-gradient-to-br ${gradientColors}`
          )}>
            {isCoApplicant ? (
              <UsersIcon className="w-6 h-6 text-white" />
            ) : (
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">{displayName}</h4>
            <p className="text-xs text-white/50">
              {isCoApplicant ? 'Co-Applicant' : 'Guarantor'}
              {coApplicant.relationship && ` • ${RELATIONSHIP_OPTIONS.find(r => r.value === coApplicant.relationship)?.label}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Type Badge */}
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            isCoApplicant
              ? 'bg-violet-500/20 text-violet-400'
              : 'bg-amber-500/20 text-amber-400'
          )}>
            {isCoApplicant ? 'Co-Applicant' : 'Guarantor'}
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
          >
            <ChevronDownIcon className="w-5 h-5 text-white/40" />
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
            <div className="p-6 pt-2 space-y-6 border-t border-white/[0.05]">
              {/* Section Tabs */}
              <div className="flex gap-2 p-1 rounded-xl bg-white/[0.03]">
                {(['personal', 'employment', 'address'] as const).map((section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      activeSection === section
                        ? `bg-gradient-to-r ${gradientColors} text-white shadow-lg`
                        : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
                    )}
                  >
                    {section === 'personal' && 'Personal Info'}
                    {section === 'employment' && 'Employment'}
                    {section === 'address' && 'Address'}
                  </button>
                ))}
              </div>

              {/* Personal Info Section */}
              <AnimatePresence mode="wait">
                {activeSection === 'personal' && (
                  <motion.div
                    key="personal"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    {/* Relationship */}
                    <PremiumSelect
                      label="Relationship with Applicant"
                      options={RELATIONSHIP_OPTIONS}
                      value={coApplicant.relationship}
                      onChange={(e) => updateField('relationship', e.target.value)}
                      required
                      error={errors[`coApplicants.${index}.relationship`]}
                    />

                    {/* Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PremiumInput
                        label="First Name"
                        value={coApplicant.firstName}
                        onChange={(e) => updateField('firstName', e.target.value)}
                        placeholder="Enter first name"
                        required
                        error={errors[`coApplicants.${index}.firstName`]}
                      />
                      <PremiumInput
                        label="Last Name"
                        value={coApplicant.lastName}
                        onChange={(e) => updateField('lastName', e.target.value)}
                        placeholder="Enter last name"
                        required
                        error={errors[`coApplicants.${index}.lastName`]}
                      />
                    </div>

                    {/* DOB & Gender */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PremiumInput
                        label="Date of Birth"
                        type="date"
                        value={coApplicant.dateOfBirth}
                        onChange={(e) => updateField('dateOfBirth', e.target.value)}
                        required
                        error={errors[`coApplicants.${index}.dateOfBirth`]}
                      />
                      <PremiumSelect
                        label="Gender"
                        options={GENDER_OPTIONS}
                        value={coApplicant.gender}
                        onChange={(e) => updateField('gender', e.target.value)}
                        required
                        error={errors[`coApplicants.${index}.gender`]}
                      />
                    </div>

                    {/* Identity Documents */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PremiumInput
                        label="PAN Number"
                        value={coApplicant.pan}
                        onChange={(e) => updateField('pan', e.target.value.toUpperCase())}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        required
                        verificationStatus={coApplicant.panVerificationStatus}
                        onVerify={onVerify ? () => onVerify(`coApplicants.${index}.pan`) : undefined}
                        error={errors[`coApplicants.${index}.pan`]}
                      />
                      <PremiumInput
                        label="Aadhaar Number"
                        value={coApplicant.aadhaar}
                        onChange={(e) => updateField('aadhaar', e.target.value.replace(/\D/g, ''))}
                        placeholder="1234 5678 9012"
                        maxLength={12}
                        required
                        error={errors[`coApplicants.${index}.aadhaar`]}
                      />
                    </div>

                    {/* Contact */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PremiumPhoneInput
                        label="Mobile Number"
                        value={coApplicant.mobile}
                        onChange={(e) => updateField('mobile', e.target.value.replace(/\D/g, ''))}
                        placeholder="98765 43210"
                        maxLength={10}
                        required
                        error={errors[`coApplicants.${index}.mobile`]}
                      />
                      <PremiumInput
                        label="Email Address"
                        type="email"
                        value={coApplicant.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="email@example.com"
                        required
                        error={errors[`coApplicants.${index}.email`]}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Employment Section */}
                {activeSection === 'employment' && (
                  <motion.div
                    key="employment"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <PremiumSelect
                      label="Employment Type"
                      options={EMPLOYMENT_TYPE_OPTIONS}
                      value={coApplicant.employmentType}
                      onChange={(e) => updateField('employmentType', e.target.value)}
                      required
                      error={errors[`coApplicants.${index}.employmentType`]}
                    />

                    {(coApplicant.employmentType === 'salaried' || coApplicant.employmentType === 'professional') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PremiumInput
                          label="Company / Organization Name"
                          value={coApplicant.companyName}
                          onChange={(e) => updateField('companyName', e.target.value)}
                          placeholder="Enter company name"
                          error={errors[`coApplicants.${index}.companyName`]}
                        />
                        <PremiumInput
                          label="Designation"
                          value={coApplicant.designation}
                          onChange={(e) => updateField('designation', e.target.value)}
                          placeholder="Enter designation"
                          error={errors[`coApplicants.${index}.designation`]}
                        />
                      </div>
                    )}

                    {coApplicant.employmentType === 'business' && (
                      <PremiumInput
                        label="Business Name"
                        value={coApplicant.companyName}
                        onChange={(e) => updateField('companyName', e.target.value)}
                        placeholder="Enter business name"
                        error={errors[`coApplicants.${index}.companyName`]}
                      />
                    )}

                    <PremiumCurrencyInput
                      label="Monthly Income"
                      value={coApplicant.monthlyIncome}
                      onChange={(e) => updateField('monthlyIncome', e.target.value)}
                      placeholder="e.g., 75,000"
                      required
                      error={errors[`coApplicants.${index}.monthlyIncome`]}
                    />
                  </motion.div>
                )}

                {/* Address Section */}
                {activeSection === 'address' && (
                  <motion.div
                    key="address"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <PremiumInput
                      label="Address"
                      value={coApplicant.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="House/Flat No., Street, Area"
                      required
                      error={errors[`coApplicants.${index}.address`]}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <PremiumInput
                        label="City"
                        value={coApplicant.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        placeholder="Enter city"
                        required
                        error={errors[`coApplicants.${index}.city`]}
                      />
                      <PremiumSelect
                        label="State"
                        options={STATE_OPTIONS}
                        value={coApplicant.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        required
                        error={errors[`coApplicants.${index}.state`]}
                      />
                      <PremiumInput
                        label="PIN Code"
                        value={coApplicant.pincode}
                        onChange={(e) => updateField('pincode', e.target.value.replace(/\D/g, ''))}
                        placeholder="400001"
                        maxLength={6}
                        required
                        error={errors[`coApplicants.${index}.pincode`]}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function CoApplicantSection({
  formData,
  errors,
  verifications,
  onFieldChange,
  onVerify,
  requiresCoApplicant = false,
  className,
}: CoApplicantSectionProps) {
  const coApplicants = (formData.coApplicants as CoApplicant[]) || [];
  const hasCoApplicant = coApplicants.length > 0;

  const handleAddCoApplicant = (type: 'co_applicant' | 'guarantor') => {
    const newCoApplicant = createEmptyCoApplicant(type);
    onFieldChange('coApplicants', [...coApplicants, newCoApplicant]);
  };

  const handleUpdateCoApplicant = (index: number, updated: CoApplicant) => {
    const updatedList = [...coApplicants];
    updatedList[index] = updated;
    onFieldChange('coApplicants', updatedList);
  };

  const handleDeleteCoApplicant = (index: number) => {
    const updatedList = coApplicants.filter((_, i) => i !== index);
    onFieldChange('coApplicants', updatedList);
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
          Co-Applicant & Guarantor
        </h3>
        <p className="text-sm text-white/60">
          Adding a co-applicant or guarantor can improve your loan eligibility and help you get better interest rates.
        </p>
      </div>

      {/* Required Notice */}
      {requiresCoApplicant && !hasCoApplicant && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <InfoIcon className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-300">Co-Applicant Required</p>
              <p className="text-xs text-white/60 mt-1">
                This loan type requires at least one co-applicant for processing. Please add a co-applicant to proceed.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Benefits Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20"
      >
        <h4 className="text-sm font-medium text-white mb-4">Benefits of Adding a Co-Applicant</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Higher Loan Amount</p>
              <p className="text-xs text-white/50">Combined income increases eligibility</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Lower Interest Rate</p>
              <p className="text-xs text-white/50">Better rates with strong co-applicant</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Faster Approval</p>
              <p className="text-xs text-white/50">Shared risk improves chances</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Co-Applicant Cards */}
      <AnimatePresence mode="popLayout">
        {coApplicants.map((coApplicant, index) => (
          <CoApplicantCard
            key={coApplicant.id}
            coApplicant={coApplicant}
            index={index}
            onUpdate={(updated) => handleUpdateCoApplicant(index, updated)}
            onDelete={() => handleDeleteCoApplicant(index)}
            errors={errors}
            onVerify={onVerify}
          />
        ))}
      </AnimatePresence>

      {/* Add Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Add Co-Applicant */}
        <motion.button
          onClick={() => handleAddCoApplicant('co_applicant')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="p-5 rounded-2xl border-2 border-dashed border-violet-500/30 hover:border-violet-500/50
                     bg-violet-500/5 hover:bg-violet-500/10 transition-all duration-300 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500
                          flex items-center justify-center shadow-lg shadow-violet-500/25">
              <UserPlusIcon className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                Add Co-Applicant
              </h4>
              <p className="text-xs text-white/50">
                Joint applicant with income contribution
              </p>
            </div>
          </div>
        </motion.button>

        {/* Add Guarantor */}
        <motion.button
          onClick={() => handleAddCoApplicant('guarantor')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="p-5 rounded-2xl border-2 border-dashed border-amber-500/30 hover:border-amber-500/50
                     bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-300 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500
                          flex items-center justify-center shadow-lg shadow-amber-500/25">
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                Add Guarantor
              </h4>
              <p className="text-xs text-white/50">
                Security provider for loan repayment
              </p>
            </div>
          </div>
        </motion.button>
      </div>

      {/* No Co-Applicant Info */}
      {!hasCoApplicant && !requiresCoApplicant && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]"
        >
          <div className="flex items-start gap-3">
            <InfoIcon className="w-5 h-5 text-white/40 flex-shrink-0" />
            <p className="text-sm text-white/50">
              Adding a co-applicant is optional for this loan type, but it can help you qualify for a higher loan amount
              or better interest rates. You can skip this step if you prefer to apply individually.
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default CoApplicantSection;
