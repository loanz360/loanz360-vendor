/**
 * Vehicle Details Section Component
 * For New Car Loan, Used Car Loan, and Two-Wheeler Loans
 */

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { PremiumInput, PremiumSelect, PremiumCurrencyInput } from './PremiumInput';

// =====================================================
// ICONS
// =====================================================

const CarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

const BikeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M5.5 17.5L9 9l6 0l2.5 4.5L18.5 17.5" />
    <path d="M9 9l3 -4.5" />
  </svg>
);

const NewCarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25" />
  </svg>
);

const UsedCarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
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

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

// =====================================================
// TYPES
// =====================================================

interface VehicleDetailsSectionProps {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  onFieldChange: (field: string, value: unknown) => void;
  loanType: 'NEW_CAR_LOAN' | 'USED_CAR_LOAN' | 'TWO_WHEELER_LOAN';
  className?: string;
}

// =====================================================
// DATA
// =====================================================

const CAR_MANUFACTURERS = [
  { value: 'maruti', label: 'Maruti Suzuki' },
  { value: 'hyundai', label: 'Hyundai' },
  { value: 'tata', label: 'Tata Motors' },
  { value: 'mahindra', label: 'Mahindra' },
  { value: 'kia', label: 'Kia' },
  { value: 'toyota', label: 'Toyota' },
  { value: 'honda', label: 'Honda' },
  { value: 'mg', label: 'MG Motor' },
  { value: 'skoda', label: 'Skoda' },
  { value: 'volkswagen', label: 'Volkswagen' },
  { value: 'renault', label: 'Renault' },
  { value: 'nissan', label: 'Nissan' },
  { value: 'jeep', label: 'Jeep' },
  { value: 'citroen', label: 'Citroën' },
  { value: 'mercedes', label: 'Mercedes-Benz' },
  { value: 'bmw', label: 'BMW' },
  { value: 'audi', label: 'Audi' },
  { value: 'volvo', label: 'Volvo' },
  { value: 'jaguar', label: 'Jaguar' },
  { value: 'land_rover', label: 'Land Rover' },
  { value: 'porsche', label: 'Porsche' },
  { value: 'lexus', label: 'Lexus' },
  { value: 'other', label: 'Other' },
];

const TWO_WHEELER_MANUFACTURERS = [
  { value: 'hero', label: 'Hero MotoCorp' },
  { value: 'honda', label: 'Honda' },
  { value: 'tvs', label: 'TVS' },
  { value: 'bajaj', label: 'Bajaj' },
  { value: 'royal_enfield', label: 'Royal Enfield' },
  { value: 'suzuki', label: 'Suzuki' },
  { value: 'yamaha', label: 'Yamaha' },
  { value: 'ktm', label: 'KTM' },
  { value: 'kawasaki', label: 'Kawasaki' },
  { value: 'harley', label: 'Harley-Davidson' },
  { value: 'triumph', label: 'Triumph' },
  { value: 'ather', label: 'Ather Energy' },
  { value: 'ola', label: 'Ola Electric' },
  { value: 'other', label: 'Other' },
];

const FUEL_TYPES = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'cng', label: 'CNG' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'electric', label: 'Electric' },
];

const VEHICLE_TYPES = [
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'muv', label: 'MUV / MPV' },
  { value: 'crossover', label: 'Crossover' },
  { value: 'coupe', label: 'Coupe' },
  { value: 'convertible', label: 'Convertible' },
  { value: 'pickup', label: 'Pick-up Truck' },
];

const TWO_WHEELER_TYPES = [
  { value: 'scooter', label: 'Scooter' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'sports_bike', label: 'Sports Bike' },
  { value: 'cruiser', label: 'Cruiser' },
  { value: 'electric_scooter', label: 'Electric Scooter' },
  { value: 'electric_bike', label: 'Electric Bike' },
];

const TRANSMISSION_TYPES = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'amt', label: 'AMT' },
  { value: 'cvt', label: 'CVT' },
  { value: 'dct', label: 'DCT' },
];

const DEALER_TYPES = [
  { value: 'authorized', label: 'Authorized Dealer' },
  { value: 'multi_brand', label: 'Multi-Brand Showroom' },
  { value: 'individual', label: 'Individual Seller' },
  { value: 'auction', label: 'Auction / Seized Vehicle' },
];

// Generate year options (current year to current year - 15)
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear + 1; i >= currentYear - 15; i--) {
    years.push({ value: String(i), label: String(i) });
  }
  return years;
};

// =====================================================
// VEHICLE TYPE CARD COMPONENT
// =====================================================

interface VehicleTypeCardProps {
  type: string;
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  gradient: string;
}

const VehicleTypeCard = ({ type, label, icon, isSelected, onClick, gradient }: VehicleTypeCardProps) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    className={cn(
      'relative p-5 rounded-2xl border-2 text-center transition-all duration-300',
      isSelected
        ? `border-transparent bg-gradient-to-br ${gradient}`
        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
    )}
  >
    <div className="flex flex-col items-center gap-3">
      <div className={cn(
        'w-14 h-14 rounded-xl flex items-center justify-center transition-colors',
        isSelected ? 'bg-white/20' : 'bg-white/10'
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
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"
      >
        <CheckIcon className="w-4 h-4 text-white" />
      </motion.div>
    )}
  </motion.button>
);

// =====================================================
// MAIN COMPONENT
// =====================================================

export function VehicleDetailsSection({
  formData,
  errors,
  onFieldChange,
  loanType,
  className,
}: VehicleDetailsSectionProps) {
  const isNewVehicle = loanType === 'NEW_CAR_LOAN';
  const isTwoWheeler = loanType === 'TWO_WHEELER_LOAN';
  const isUsedCar = loanType === 'USED_CAR_LOAN';

  const manufacturers = isTwoWheeler ? TWO_WHEELER_MANUFACTURERS : CAR_MANUFACTURERS;
  const vehicleTypes = isTwoWheeler ? TWO_WHEELER_TYPES : VEHICLE_TYPES;
  const yearOptions = useMemo(() => generateYearOptions(), []);

  const vehicleCategory = formData.vehicleCategory as string;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-6', className)}
    >
      {/* Section Header */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">
          {isTwoWheeler ? 'Two-Wheeler Details' : 'Vehicle Details'}
        </h3>
        <p className="text-sm text-white/60">
          {isNewVehicle
            ? 'Provide details about the vehicle you wish to purchase.'
            : isUsedCar
            ? 'Tell us about the pre-owned vehicle you want to finance.'
            : 'Enter the details of the two-wheeler you want to purchase.'}
        </p>
      </div>

      {/* New vs Used Selection (for two-wheelers) */}
      {isTwoWheeler && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <VehicleTypeCard
            type="new"
            label="Brand New"
            icon={<NewCarIcon className="w-7 h-7 text-white" />}
            isSelected={vehicleCategory === 'new'}
            onClick={() => onFieldChange('vehicleCategory', 'new')}
            gradient="from-emerald-500 to-teal-500"
          />
          <VehicleTypeCard
            type="used"
            label="Pre-Owned"
            icon={<UsedCarIcon className="w-7 h-7 text-white" />}
            isSelected={vehicleCategory === 'used'}
            onClick={() => onFieldChange('vehicleCategory', 'used')}
            gradient="from-amber-500 to-orange-500"
          />
        </div>
      )}

      {/* Vehicle Type Selection */}
      <div>
        <label className="block text-sm font-medium text-white/80 mb-3">
          {isTwoWheeler ? 'Two-Wheeler Type' : 'Vehicle Type'} <span className="text-brand-primary">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {vehicleTypes.slice(0, 4).map((type) => (
            <motion.button
              key={type.value}
              onClick={() => onFieldChange('vehicleType', type.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'p-4 rounded-xl border-2 text-center transition-all duration-300',
                formData.vehicleType === type.value
                  ? 'border-brand-primary bg-brand-primary/10'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                {isTwoWheeler ? (
                  <BikeIcon className={cn(
                    'w-5 h-5',
                    formData.vehicleType === type.value ? 'text-brand-primary' : 'text-white/60'
                  )} />
                ) : (
                  <CarIcon className={cn(
                    'w-5 h-5',
                    formData.vehicleType === type.value ? 'text-brand-primary' : 'text-white/60'
                  )} />
                )}
                <span className={cn(
                  'text-sm font-medium',
                  formData.vehicleType === type.value ? 'text-white' : 'text-white/70'
                )}>
                  {type.label}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
        <PremiumSelect
          label=""
          options={vehicleTypes}
          value={(formData.vehicleType as string) || ''}
          onChange={(e) => onFieldChange('vehicleType', e.target.value)}
          placeholder="Select other type..."
          className="mt-3"
        />
      </div>

      {/* Manufacturer & Model */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'bg-gradient-to-br from-violet-500 to-purple-500'
          )}>
            {isTwoWheeler ? (
              <BikeIcon className="w-5 h-5 text-white" />
            ) : (
              <CarIcon className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">Make & Model</h4>
            <p className="text-xs text-white/50">Select the manufacturer and model</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PremiumSelect
            label="Manufacturer / Brand"
            options={manufacturers}
            value={(formData.manufacturer as string) || ''}
            onChange={(e) => onFieldChange('manufacturer', e.target.value)}
            required
            error={errors.manufacturer}
          />
          <PremiumInput
            label="Model Name"
            value={(formData.modelName as string) || ''}
            onChange={(e) => onFieldChange('modelName', e.target.value)}
            placeholder={isTwoWheeler ? 'e.g., Classic 350' : 'e.g., Swift Dzire'}
            required
            error={errors.modelName}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <PremiumInput
            label="Variant"
            value={(formData.variant as string) || ''}
            onChange={(e) => onFieldChange('variant', e.target.value)}
            placeholder={isTwoWheeler ? 'e.g., Signals Edition' : 'e.g., ZXi AMT'}
            error={errors.variant}
          />
          <PremiumSelect
            label="Manufacturing Year"
            options={yearOptions}
            value={(formData.manufacturingYear as string) || ''}
            onChange={(e) => onFieldChange('manufacturingYear', e.target.value)}
            required
            error={errors.manufacturingYear}
          />
        </div>
      </div>

      {/* Technical Specifications */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
        <h4 className="text-sm font-medium text-white mb-4">Technical Specifications</h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PremiumSelect
            label="Fuel Type"
            options={FUEL_TYPES}
            value={(formData.fuelType as string) || ''}
            onChange={(e) => onFieldChange('fuelType', e.target.value)}
            required
            error={errors.fuelType}
          />
          {!isTwoWheeler && (
            <PremiumSelect
              label="Transmission"
              options={TRANSMISSION_TYPES}
              value={(formData.transmission as string) || ''}
              onChange={(e) => onFieldChange('transmission', e.target.value)}
              error={errors.transmission}
            />
          )}
          <PremiumInput
            label={isTwoWheeler ? 'Engine CC' : 'Engine Capacity (CC)'}
            type="number"
            value={(formData.engineCC as string) || ''}
            onChange={(e) => onFieldChange('engineCC', e.target.value)}
            placeholder={isTwoWheeler ? 'e.g., 350' : 'e.g., 1197'}
            error={errors.engineCC}
          />
        </div>

        {/* Color */}
        <PremiumInput
          label="Color"
          value={(formData.vehicleColor as string) || ''}
          onChange={(e) => onFieldChange('vehicleColor', e.target.value)}
          placeholder="e.g., Pearl White"
          className="mt-4"
        />
      </div>

      {/* Used Vehicle Specific Fields */}
      {isUsedCar && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <UsedCarIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">Pre-Owned Vehicle Details</h4>
              <p className="text-xs text-white/50">Additional information for used vehicles</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PremiumInput
              label="Registration Number"
              value={(formData.registrationNumber as string) || ''}
              onChange={(e) => onFieldChange('registrationNumber', e.target.value.toUpperCase())}
              placeholder="e.g., MH12AB1234"
              required
              error={errors.registrationNumber}
            />
            <PremiumInput
              label="Odometer Reading (KM)"
              type="number"
              value={(formData.odometerReading as string) || ''}
              onChange={(e) => onFieldChange('odometerReading', e.target.value)}
              placeholder="e.g., 45000"
              required
              error={errors.odometerReading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <PremiumInput
              label="Number of Previous Owners"
              type="number"
              value={(formData.previousOwners as string) || ''}
              onChange={(e) => onFieldChange('previousOwners', e.target.value)}
              placeholder="e.g., 1"
              error={errors.previousOwners}
            />
            <PremiumInput
              label="Insurance Validity"
              type="date"
              value={(formData.insuranceValidity as string) || ''}
              onChange={(e) => onFieldChange('insuranceValidity', e.target.value)}
              error={errors.insuranceValidity}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <PremiumInput
              label="RC Validity"
              type="date"
              value={(formData.rcValidity as string) || ''}
              onChange={(e) => onFieldChange('rcValidity', e.target.value)}
              helperText="Registration Certificate validity date"
              error={errors.rcValidity}
            />
            <PremiumSelect
              label="Seller Type"
              options={DEALER_TYPES}
              value={(formData.sellerType as string) || ''}
              onChange={(e) => onFieldChange('sellerType', e.target.value)}
              error={errors.sellerType}
            />
          </div>

          {/* Hypothecation Check */}
          <div className="mt-4 p-4 rounded-xl bg-white/[0.02]">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={(formData.hasHypothecation as boolean) || false}
                  onChange={(e) => onFieldChange('hasHypothecation', e.target.checked)}
                  className="sr-only"
                />
                <motion.div
                  className={cn(
                    'w-12 h-7 rounded-full transition-colors',
                    formData.hasHypothecation ? 'bg-amber-500' : 'bg-white/20'
                  )}
                >
                  <motion.div
                    className="w-5 h-5 rounded-full bg-white shadow-lg"
                    animate={{ x: formData.hasHypothecation ? 26 : 4, y: 4 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.div>
              </div>
              <div>
                <span className="text-sm font-medium text-white">Existing Hypothecation</span>
                <p className="text-xs text-white/50">Is there an existing loan on this vehicle?</p>
              </div>
            </label>

            <AnimatePresence>
              {formData.hasHypothecation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-4"
                >
                  <PremiumInput
                    label="Current Financier Name"
                    value={(formData.currentFinancier as string) || ''}
                    onChange={(e) => onFieldChange('currentFinancier', e.target.value)}
                    placeholder="Bank / NBFC name"
                    error={errors.currentFinancier}
                  />
                  <PremiumCurrencyInput
                    label="Outstanding Amount"
                    value={(formData.outstandingAmount as string) || ''}
                    onChange={(e) => onFieldChange('outstandingAmount', e.target.value)}
                    placeholder="e.g., 2,50,000"
                    error={errors.outstandingAmount}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Pricing Section */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
        <h4 className="text-sm font-medium text-white mb-4">Pricing Details</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PremiumCurrencyInput
            label={isUsedCar ? 'Agreed Purchase Price' : 'Ex-Showroom Price'}
            value={(formData.exShowroomPrice as string) || ''}
            onChange={(e) => onFieldChange('exShowroomPrice', e.target.value)}
            placeholder="e.g., 8,50,000"
            required
            error={errors.exShowroomPrice}
          />
          {isNewVehicle && (
            <PremiumCurrencyInput
              label="On-Road Price"
              value={(formData.onRoadPrice as string) || ''}
              onChange={(e) => onFieldChange('onRoadPrice', e.target.value)}
              placeholder="e.g., 10,25,000"
              helperText="Including registration, insurance, etc."
              error={errors.onRoadPrice}
            />
          )}
        </div>

        {isNewVehicle && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <PremiumCurrencyInput
              label="Insurance"
              value={(formData.insuranceAmount as string) || ''}
              onChange={(e) => onFieldChange('insuranceAmount', e.target.value)}
              placeholder="e.g., 45,000"
            />
            <PremiumCurrencyInput
              label="Road Tax & Registration"
              value={(formData.roadTax as string) || ''}
              onChange={(e) => onFieldChange('roadTax', e.target.value)}
              placeholder="e.g., 85,000"
            />
            <PremiumCurrencyInput
              label="Accessories (if any)"
              value={(formData.accessories as string) || ''}
              onChange={(e) => onFieldChange('accessories', e.target.value)}
              placeholder="e.g., 25,000"
            />
          </div>
        )}
      </div>

      {/* Dealer Information */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <ShieldIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">
              {isUsedCar ? 'Seller Information' : 'Dealer Information'}
            </h4>
            <p className="text-xs text-white/50">Where are you purchasing from?</p>
          </div>
        </div>

        <div className="space-y-4">
          <PremiumInput
            label={isUsedCar ? 'Seller / Dealer Name' : 'Dealer Name'}
            value={(formData.dealerName as string) || ''}
            onChange={(e) => onFieldChange('dealerName', e.target.value)}
            placeholder="Enter dealer/seller name"
            required
            error={errors.dealerName}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PremiumInput
              label="City"
              value={(formData.dealerCity as string) || ''}
              onChange={(e) => onFieldChange('dealerCity', e.target.value)}
              placeholder="Enter city"
              error={errors.dealerCity}
            />
            <PremiumInput
              label="Contact Number"
              value={(formData.dealerContact as string) || ''}
              onChange={(e) => onFieldChange('dealerContact', e.target.value.replace(/\D/g, ''))}
              placeholder="Enter contact number"
              maxLength={10}
              error={errors.dealerContact}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default VehicleDetailsSection;
