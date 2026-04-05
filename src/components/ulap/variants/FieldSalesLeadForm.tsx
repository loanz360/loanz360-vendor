/**
 * Field Sales Lead Form - Field Sales Agent Lead Capture Form
 * Wrapper around ULAPDynamicForm for Field Sales-specific features
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { ULAPDynamicForm } from '../ULAPDynamicForm';
import type { ULAPFormData, ULAPLoanSubcategory } from '../types';

interface FieldSalesLeadFormProps {
  /** Field Sales Employee ID */
  employeeId: string;
  /** Field Sales Employee Name */
  employeeName: string;
  /** Current visit/location info */
  visitInfo?: {
    id: string;
    customerName?: string;
    address?: string;
    scheduledTime?: string;
  };
  /** Pre-selected loan subcategory */
  subcategoryId?: string;
  /** Available loan subcategories */
  loanSubcategories?: ULAPLoanSubcategory[];
  /** Callback when lead is submitted */
  onSubmit: (data: ULAPFormData & { source: 'FIELD_SALES'; employeeId: string; visitId?: string; location?: GeolocationCoordinates }) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback when draft is saved */
  onSaveDraft?: (data: ULAPFormData) => Promise<void>;
  /** Callback to log check-in */
  onCheckIn?: (location: GeolocationCoordinates) => void;
  /** Additional CSS classes */
  className?: string;
}

// Icons
const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const CameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const LoadingIcon = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export function FieldSalesLeadForm({
  employeeId,
  employeeName,
  visitInfo,
  subcategoryId: initialSubcategoryId,
  loanSubcategories = [],
  onSubmit,
  onCancel,
  onSaveDraft,
  onCheckIn,
  className,
}: FieldSalesLeadFormProps) {
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(
    initialSubcategoryId
  );
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Get current location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(position.coords);
        },
        (error) => {
          setLocationError(error.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setLocationError('Geolocation not supported');
    }
  }, []);

  // Handle check-in
  const handleCheckIn = useCallback(async () => {
    if (!location) return;

    setIsCheckingIn(true);
    try {
      await onCheckIn?.(location);
      setIsCheckedIn(true);
    } finally {
      setIsCheckingIn(false);
    }
  }, [location, onCheckIn]);

  // Handle form submission
  const handleSubmit = useCallback(async (data: ULAPFormData) => {
    await onSubmit({
      ...data,
      source: 'FIELD_SALES',
      employeeId,
      visitId: visitInfo?.id,
      location: location || undefined,
      loan_subcategory_id: selectedSubcategoryId,
    });
  }, [onSubmit, employeeId, visitInfo?.id, location, selectedSubcategoryId]);

  return (
    <div className={cn('min-h-screen bg-zinc-950', className)}>
      {/* Field Sales Header */}
      <div className="sticky top-0 z-50 bg-zinc-900 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Agent & Visit Info */}
            <div className="flex items-center gap-4">
              {/* Agent Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                <UserIcon className="w-4 h-4 text-teal-400" />
                <span className="text-sm text-teal-300">{employeeName}</span>
              </div>

              {/* Visit Info */}
              {visitInfo && (
                <div className="flex items-center gap-4 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  {visitInfo.customerName && (
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-white/50" />
                      <span className="text-sm text-white/70">{visitInfo.customerName}</span>
                    </div>
                  )}
                  {visitInfo.scheduledTime && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-white/50" />
                      <span className="text-sm text-white/70">{visitInfo.scheduledTime}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Location & Actions */}
            <div className="flex items-center gap-3">
              {/* Location Status */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                  location
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
                )}
              >
                <MapPinIcon className={cn('w-4 h-4', location ? 'text-green-400' : 'text-red-400')} />
                <span className={cn('text-sm', location ? 'text-green-300' : 'text-red-300')}>
                  {location
                    ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                    : locationError || 'Getting location...'}
                </span>
              </div>

              {/* Check-in Button */}
              {onCheckIn && !isCheckedIn && (
                <motion.button
                  onClick={handleCheckIn}
                  disabled={!location || isCheckingIn}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    location && !isCheckingIn
                      ? 'bg-teal-500 text-white hover:bg-teal-600'
                      : 'bg-white/10 text-white/50 cursor-not-allowed'
                  )}
                >
                  {isCheckingIn ? (
                    <LoadingIcon className="w-4 h-4" />
                  ) : (
                    <MapPinIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm">Check In</span>
                </motion.button>
              )}

              {/* Checked-in Badge */}
              {isCheckedIn && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-300">Checked In</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visit Address Banner */}
      {visitInfo?.address && (
        <div className="bg-teal-500/5 border-b border-teal-500/20">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-start gap-3">
              <MapPinIcon className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white/70">{visitInfo.address}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Type Selector */}
      {loanSubcategories.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="relative w-fit">
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
        </div>
      )}

      {/* Dynamic Form */}
      <ULAPDynamicForm
        source="FIELD_SALES"
        subcategoryId={selectedSubcategoryId}
        initialData={visitInfo?.customerName ? { full_name: visitInfo.customerName } : {}}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        onSaveDraft={onSaveDraft}
        showCoApplicant={true}
      />
    </div>
  );
}

export default FieldSalesLeadForm;
