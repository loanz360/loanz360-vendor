/**
 * Property Details Section Component
 * For Home Loan, LAP, and property-backed loans
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { PremiumInput, PremiumSelect, PremiumTextarea, PremiumCurrencyInput } from './PremiumInput';

// =====================================================
// ICONS
// =====================================================

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const BuildingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <motion.path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 13l4 4L19 7"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3 }}
    />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface PropertyDetailsSectionProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: unknown) => void;
  loanType: 'HOME_LOAN' | 'LAP' | 'MORTGAGE_LOAN' | 'LEASE_RENTAL_DISCOUNTING';
  className?: string;
}

// =====================================================
// OPTIONS
// =====================================================

const PROPERTY_TYPE_OPTIONS = [
  { value: 'residential_apartment', label: 'Residential Apartment' },
  { value: 'independent_house', label: 'Independent House / Villa' },
  { value: 'row_house', label: 'Row House' },
  { value: 'builder_floor', label: 'Builder Floor' },
  { value: 'penthouse', label: 'Penthouse' },
  { value: 'studio', label: 'Studio Apartment' },
  { value: 'plot', label: 'Residential Plot' },
  { value: 'commercial_shop', label: 'Commercial Shop' },
  { value: 'commercial_office', label: 'Commercial Office Space' },
  { value: 'commercial_warehouse', label: 'Warehouse / Godown' },
  { value: 'industrial', label: 'Industrial Property' },
];

const PROPERTY_STATUS_OPTIONS = [
  { value: 'ready_to_move', label: 'Ready to Move' },
  { value: 'under_construction', label: 'Under Construction' },
  { value: 'resale', label: 'Resale Property' },
  { value: 'new_booking', label: 'New Booking / Launch' },
];

const OWNERSHIP_TYPE_OPTIONS = [
  { value: 'freehold', label: 'Freehold' },
  { value: 'leasehold', label: 'Leasehold' },
  { value: 'cooperative', label: 'Cooperative Society' },
  { value: 'power_of_attorney', label: 'Power of Attorney' },
];

const PURPOSE_OPTIONS_HOME = [
  { value: 'self_occupied', label: 'Self Occupied' },
  { value: 'investment', label: 'Investment' },
  { value: 'rental', label: 'Rental Income' },
];

const PURPOSE_OPTIONS_LAP = [
  { value: 'business_expansion', label: 'Business Expansion' },
  { value: 'working_capital', label: 'Working Capital' },
  { value: 'debt_consolidation', label: 'Debt Consolidation' },
  { value: 'personal_needs', label: 'Personal Needs' },
  { value: 'medical_emergency', label: 'Medical Emergency' },
  { value: 'education', label: 'Education' },
  { value: 'wedding', label: 'Wedding' },
];

const STATE_OPTIONS = [
  { value: 'MH', label: 'Maharashtra' },
  { value: 'DL', label: 'Delhi' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'WB', label: 'West Bengal' },
  { value: 'TG', label: 'Telangana' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'KL', label: 'Kerala' },
  { value: 'HR', label: 'Haryana' },
  { value: 'PB', label: 'Punjab' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'OR', label: 'Odisha' },
  { value: 'BR', label: 'Bihar' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'CT', label: 'Chhattisgarh' },
  { value: 'AS', label: 'Assam' },
  { value: 'UK', label: 'Uttarakhand' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'GA', label: 'Goa' },
  { value: 'JK', label: 'Jammu & Kashmir' },
];

const BUILDER_TYPE_OPTIONS = [
  { value: 'tier1', label: 'Tier 1 - Listed / Large Developer' },
  { value: 'tier2', label: 'Tier 2 - Regional Developer' },
  { value: 'tier3', label: 'Tier 3 - Local Builder' },
  { value: 'individual', label: 'Individual / Self-Construction' },
];

// =====================================================
// PROPERTY TYPE CARD COMPONENT
// =====================================================

interface PropertyTypeCardProps {
  type: string;
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}

const PropertyTypeCard = ({ type, label, icon, isSelected, onClick }: PropertyTypeCardProps) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={cn(
      'relative p-4 rounded-xl border-2 text-left transition-all duration-300',
      isSelected
        ? 'border-brand-primary bg-brand-primary/10'
        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
    )}
  >
    <div className="flex items-center gap-3">
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
        isSelected ? 'bg-brand-primary text-white' : 'bg-white/10 text-white/60'
      )}>
        {icon}
      </div>
      <span className={cn(
        'text-sm font-medium transition-colors',
        isSelected ? 'text-white' : 'text-white/70'
      )}>
        {label}
      </span>
    </div>

    {isSelected && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center"
      >
        <CheckIcon className="w-3 h-3 text-white" />
      </motion.div>
    )}
  </motion.button>
);

// =====================================================
// MAIN COMPONENT
// =====================================================

export function PropertyDetailsSection({
  formData,
  errors,
  onFieldChange,
  loanType,
  className,
}: PropertyDetailsSectionProps) {
  const [activeSection, setActiveSection] = useState<'basic' | 'location' | 'valuation'>('basic');

  const propertyType = formData.propertyType as string;
  const isLAP = loanType === 'LAP' || loanType === 'MORTGAGE_LOAN';
  const isLRD = loanType === 'LEASE_RENTAL_DISCOUNTING';

  const purposeOptions = isLAP ? PURPOSE_OPTIONS_LAP : PURPOSE_OPTIONS_HOME;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Section Header */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">
          {isLAP ? 'Property Details (Collateral)' : 'Property Details'}
        </h3>
        <p className="text-sm text-white/60">
          {isLAP
            ? 'Provide details of the property you want to pledge as collateral for the loan.'
            : 'Tell us about the property you wish to purchase or construct.'}
        </p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-white/[0.03] mb-6">
        {(['basic', 'location', 'valuation'] as const).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              activeSection === section
                ? 'bg-gradient-to-r from-brand-primary to-orange-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
            )}
          >
            {section === 'basic' && 'Basic Info'}
            {section === 'location' && 'Location'}
            {section === 'valuation' && 'Valuation'}
          </button>
        ))}
      </div>

      {/* Basic Info Section */}
      <AnimatePresence mode="wait">
        {activeSection === 'basic' && (
          <motion.div
            key="basic"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Property Type Selection */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-3">
                Property Type <span className="text-brand-primary">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PROPERTY_TYPE_OPTIONS.slice(0, 6).map((option) => (
                  <PropertyTypeCard
                    key={option.value}
                    type={option.value}
                    label={option.label}
                    icon={option.value.includes('commercial') || option.value.includes('industrial')
                      ? <BuildingIcon className="w-5 h-5" />
                      : <HomeIcon className="w-5 h-5" />}
                    isSelected={propertyType === option.value}
                    onClick={() => onFieldChange('propertyType', option.value)}
                  />
                ))}
              </div>
              {/* More Options Dropdown */}
              <PremiumSelect
                label=""
                options={PROPERTY_TYPE_OPTIONS}
                value={propertyType}
                onChange={(e) => onFieldChange('propertyType', e.target.value)}
                placeholder="Select other property type..."
                className="mt-3"
              />
              {errors.propertyType && (
                <p className="text-xs text-red-400 mt-1">{errors.propertyType}</p>
              )}
            </div>

            {/* Property Status */}
            <PremiumSelect
              label="Property Status"
              options={PROPERTY_STATUS_OPTIONS}
              value={(formData.propertyStatus as string) || ''}
              onChange={(e) => onFieldChange('propertyStatus', e.target.value)}
              required
              error={errors.propertyStatus}
            />

            {/* Ownership Type */}
            <PremiumSelect
              label="Ownership Type"
              options={OWNERSHIP_TYPE_OPTIONS}
              value={(formData.ownershipType as string) || ''}
              onChange={(e) => onFieldChange('ownershipType', e.target.value)}
              required
              error={errors.ownershipType}
            />

            {/* Purpose */}
            <PremiumSelect
              label={isLAP ? 'Loan Purpose' : 'Property Usage'}
              options={purposeOptions}
              value={(formData.propertyPurpose as string) || ''}
              onChange={(e) => onFieldChange('propertyPurpose', e.target.value)}
              required
              error={errors.propertyPurpose}
            />

            {/* Built-up Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PremiumInput
                label="Built-up Area (sq.ft.)"
                type="number"
                value={(formData.builtUpArea as string) || ''}
                onChange={(e) => onFieldChange('builtUpArea', e.target.value)}
                placeholder="e.g., 1200"
                required
                error={errors.builtUpArea}
              />
              <PremiumInput
                label="Carpet Area (sq.ft.)"
                type="number"
                value={(formData.carpetArea as string) || ''}
                onChange={(e) => onFieldChange('carpetArea', e.target.value)}
                placeholder="e.g., 950"
                error={errors.carpetArea}
              />
            </div>

            {/* Property Age for LAP */}
            {isLAP && (
              <PremiumInput
                label="Property Age (Years)"
                type="number"
                value={(formData.propertyAge as string) || ''}
                onChange={(e) => onFieldChange('propertyAge', e.target.value)}
                placeholder="e.g., 5"
                helperText="Age of the property since construction"
                error={errors.propertyAge}
              />
            )}

            {/* Under Construction Details */}
            {formData.propertyStatus === 'under_construction' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-4"
              >
                <h4 className="text-sm font-medium text-white">Under Construction Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumSelect
                    label="Builder Category"
                    options={BUILDER_TYPE_OPTIONS}
                    value={(formData.builderCategory as string) || ''}
                    onChange={(e) => onFieldChange('builderCategory', e.target.value)}
                    error={errors.builderCategory}
                  />
                  <PremiumInput
                    label="Expected Possession Date"
                    type="date"
                    value={(formData.possessionDate as string) || ''}
                    onChange={(e) => onFieldChange('possessionDate', e.target.value)}
                    error={errors.possessionDate}
                  />
                </div>
                <PremiumInput
                  label="Builder / Developer Name"
                  value={(formData.builderName as string) || ''}
                  onChange={(e) => onFieldChange('builderName', e.target.value)}
                  placeholder="Enter builder name"
                  error={errors.builderName}
                />
                <PremiumInput
                  label="Project / Society Name"
                  value={(formData.projectName as string) || ''}
                  onChange={(e) => onFieldChange('projectName', e.target.value)}
                  placeholder="Enter project name"
                  error={errors.projectName}
                />
              </motion.div>
            )}

            {/* LRD Specific Fields */}
            {isLRD && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 space-y-4"
              >
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <DocumentIcon className="w-4 h-4 text-violet-400" />
                  Lease Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="Tenant Name"
                    value={(formData.tenantName as string) || ''}
                    onChange={(e) => onFieldChange('tenantName', e.target.value)}
                    placeholder="Enter tenant name"
                    required
                    error={errors.tenantName}
                  />
                  <PremiumCurrencyInput
                    label="Monthly Rent"
                    value={(formData.monthlyRent as string) || ''}
                    onChange={(e) => onFieldChange('monthlyRent', e.target.value)}
                    placeholder="e.g., 50,000"
                    required
                    error={errors.monthlyRent}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="Lease Start Date"
                    type="date"
                    value={(formData.leaseStartDate as string) || ''}
                    onChange={(e) => onFieldChange('leaseStartDate', e.target.value)}
                    required
                    error={errors.leaseStartDate}
                  />
                  <PremiumInput
                    label="Lease End Date"
                    type="date"
                    value={(formData.leaseEndDate as string) || ''}
                    onChange={(e) => onFieldChange('leaseEndDate', e.target.value)}
                    required
                    error={errors.leaseEndDate}
                  />
                </div>
                <PremiumInput
                  label="Remaining Lease Period (Months)"
                  type="number"
                  value={(formData.remainingLeasePeriod as string) || ''}
                  onChange={(e) => onFieldChange('remainingLeasePeriod', e.target.value)}
                  placeholder="e.g., 48"
                  error={errors.remainingLeasePeriod}
                />
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Location Section */}
        {activeSection === 'location' && (
          <motion.div
            key="location"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <MapPinIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Property Location</h4>
                  <p className="text-xs text-white/50">Complete address of the property</p>
                </div>
              </div>

              <div className="space-y-4">
                <PremiumTextarea
                  label="Full Address"
                  value={(formData.propertyAddress as string) || ''}
                  onChange={(e) => onFieldChange('propertyAddress', e.target.value)}
                  placeholder="Flat/Plot No., Building Name, Street, Area, Landmark..."
                  rows={3}
                  required
                  error={errors.propertyAddress}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="City"
                    value={(formData.propertyCity as string) || ''}
                    onChange={(e) => onFieldChange('propertyCity', e.target.value)}
                    placeholder="Enter city"
                    required
                    error={errors.propertyCity}
                  />
                  <PremiumSelect
                    label="State"
                    options={STATE_OPTIONS}
                    value={(formData.propertyState as string) || ''}
                    onChange={(e) => onFieldChange('propertyState', e.target.value)}
                    required
                    error={errors.propertyState}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PremiumInput
                    label="PIN Code"
                    value={(formData.propertyPincode as string) || ''}
                    onChange={(e) => onFieldChange('propertyPincode', e.target.value.replace(/\D/g, ''))}
                    placeholder="400001"
                    maxLength={6}
                    required
                    error={errors.propertyPincode}
                  />
                  <PremiumInput
                    label="Locality / Area"
                    value={(formData.propertyLocality as string) || ''}
                    onChange={(e) => onFieldChange('propertyLocality', e.target.value)}
                    placeholder="e.g., Bandra West"
                    error={errors.propertyLocality}
                  />
                </div>
              </div>
            </div>

            {/* Property Documents */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <DocumentIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Property Documents</h4>
                  <p className="text-xs text-white/50">Registration and ownership details</p>
                </div>
              </div>

              <div className="space-y-4">
                <PremiumInput
                  label="Property Registration Number"
                  value={(formData.registrationNumber as string) || ''}
                  onChange={(e) => onFieldChange('registrationNumber', e.target.value)}
                  placeholder="Enter registration number"
                  error={errors.registrationNumber}
                />
                <PremiumInput
                  label="Survey / Plot Number"
                  value={(formData.surveyNumber as string) || ''}
                  onChange={(e) => onFieldChange('surveyNumber', e.target.value)}
                  placeholder="Enter survey / plot number"
                  error={errors.surveyNumber}
                />
                <PremiumInput
                  label="RERA Registration Number (if applicable)"
                  value={(formData.reraNumber as string) || ''}
                  onChange={(e) => onFieldChange('reraNumber', e.target.value)}
                  placeholder="Enter RERA number"
                  helperText="Required for under-construction properties"
                  error={errors.reraNumber}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Valuation Section */}
        {activeSection === 'valuation' && (
          <motion.div
            key="valuation"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Property Value */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <h4 className="text-sm font-medium text-white mb-4">Property Valuation</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumCurrencyInput
                  label="Agreement / Purchase Value"
                  value={(formData.agreementValue as string) || ''}
                  onChange={(e) => onFieldChange('agreementValue', e.target.value)}
                  placeholder="e.g., 1,00,00,000"
                  required
                  error={errors.agreementValue}
                  helperText="As per agreement or expected purchase price"
                />
                <PremiumCurrencyInput
                  label="Market Value (Estimated)"
                  value={(formData.marketValue as string) || ''}
                  onChange={(e) => onFieldChange('marketValue', e.target.value)}
                  placeholder="e.g., 1,20,00,000"
                  error={errors.marketValue}
                  helperText="Current market value of the property"
                />
              </div>

              {isLAP && (
                <PremiumCurrencyInput
                  label="Expected Loan Amount"
                  value={(formData.expectedLoanOnProperty as string) || ''}
                  onChange={(e) => onFieldChange('expectedLoanOnProperty', e.target.value)}
                  placeholder="e.g., 50,00,000"
                  className="mt-4"
                  helperText="Usually 50-70% of property value is sanctioned"
                  error={errors.expectedLoanOnProperty}
                />
              )}
            </div>

            {/* Stamp Duty & Registration */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <h4 className="text-sm font-medium text-white mb-4">Stamp Duty & Registration</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumCurrencyInput
                  label="Stamp Duty Amount"
                  value={(formData.stampDuty as string) || ''}
                  onChange={(e) => onFieldChange('stampDuty', e.target.value)}
                  placeholder="e.g., 6,00,000"
                  error={errors.stampDuty}
                />
                <PremiumCurrencyInput
                  label="Registration Charges"
                  value={(formData.registrationCharges as string) || ''}
                  onChange={(e) => onFieldChange('registrationCharges', e.target.value)}
                  placeholder="e.g., 30,000"
                  error={errors.registrationCharges}
                />
              </div>
            </div>

            {/* Existing Loan on Property */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={(formData.hasExistingLoanOnProperty as boolean) || false}
                      onChange={(e) => onFieldChange('hasExistingLoanOnProperty', e.target.checked)}
                      className="sr-only"
                    />
                    <motion.div
                      className={cn(
                        'w-12 h-7 rounded-full transition-colors',
                        formData.hasExistingLoanOnProperty ? 'bg-brand-primary' : 'bg-white/20'
                      )}
                    >
                      <motion.div
                        className="w-5 h-5 rounded-full bg-white shadow-lg"
                        animate={{ x: formData.hasExistingLoanOnProperty ? 26 : 4, y: 4 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </motion.div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">Existing Loan on this Property</span>
                    <p className="text-xs text-white/50">Is there any existing loan secured against this property?</p>
                  </div>
                </label>
              </div>

              <AnimatePresence>
                {formData.hasExistingLoanOnProperty && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 mt-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <PremiumInput
                        label="Existing Lender Name"
                        value={(formData.existingLenderName as string) || ''}
                        onChange={(e) => onFieldChange('existingLenderName', e.target.value)}
                        placeholder="Bank / NBFC name"
                        error={errors.existingLenderName}
                      />
                      <PremiumCurrencyInput
                        label="Outstanding Amount"
                        value={(formData.existingLoanOutstanding as string) || ''}
                        onChange={(e) => onFieldChange('existingLoanOutstanding', e.target.value)}
                        placeholder="e.g., 25,00,000"
                        error={errors.existingLoanOutstanding}
                      />
                    </div>
                    <PremiumCurrencyInput
                      label="Current EMI"
                      value={(formData.existingLoanEMI as string) || ''}
                      onChange={(e) => onFieldChange('existingLoanEMI', e.target.value)}
                      placeholder="e.g., 30,000"
                      error={errors.existingLoanEMI}
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

export default PropertyDetailsSection;
