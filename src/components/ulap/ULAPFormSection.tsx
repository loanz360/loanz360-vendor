/**
 * ULAP Form Section Component
 * Renders a collapsible section with grouped fields
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { ULAPSectionProps } from './types';
import { ULAPFieldRenderer } from './ULAPFieldRenderer';

// Icons
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

// Icon mapping
const SECTION_ICONS: Record<string, React.FC<{ className?: string }>> = {
  User: UserIcon,
  Users: UsersIcon,
  Currency: CurrencyIcon,
  FileText: DocumentIcon,
};

// Section color mapping
const SECTION_COLORS: Record<string, { gradient: string; bg: string; border: string }> = {
  applicant: {
    gradient: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  coapplicant: {
    gradient: 'from-purple-500 to-purple-600',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  loan: {
    gradient: 'from-green-500 to-green-600',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
  other: {
    gradient: 'from-amber-500 to-amber-600',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
};

export function ULAPFormSection({
  title,
  description,
  icon,
  fields,
  formData,
  errors,
  verifications,
  onFieldChange,
  onVerify,
  disabled = false,
  isExpanded = true,
  onToggle,
}: ULAPSectionProps) {
  // Determine section type from fields
  const sectionType = fields[0]?.field_section || 'other';
  const colors = SECTION_COLORS[sectionType] || SECTION_COLORS.other;

  // Get default icon if not provided
  const IconComponent = icon || (() => {
    const iconName = sectionType === 'applicant' ? 'User' :
                     sectionType === 'coapplicant' ? 'Users' :
                     sectionType === 'loan' ? 'Currency' : 'FileText';
    const Component = SECTION_ICONS[iconName];
    return Component ? <Component className="w-5 h-5" /> : null;
  })();

  // Count completed fields
  const completedFields = fields.filter((f) => {
    const value = formData[f.field_name];
    return value !== undefined && value !== null && value !== '';
  }).length;
  const totalFields = fields.length;
  const progress = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;

  // Check if section has errors
  const hasErrors = fields.some((f) => errors[f.field_name]);

  if (fields.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl overflow-hidden',
        'bg-white/[0.02] backdrop-blur-sm',
        'border transition-all duration-300',
        hasErrors ? 'border-red-500/30' : colors.border
      )}
    >
      {/* Section Header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between p-5',
          'transition-all duration-200',
          isExpanded && colors.bg
        )}
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            `bg-gradient-to-br ${colors.gradient}`,
            'text-white shadow-lg'
          )}>
            {IconComponent}
          </div>

          {/* Title & Description */}
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              {title}
              {hasErrors && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                  Has errors
                </span>
              )}
            </h3>
            {description && (
              <p className="text-sm text-white/50">{description}</p>
            )}
          </div>
        </div>

        {/* Progress & Toggle */}
        <div className="flex items-center gap-4">
          {/* Progress Indicator */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={cn(
                  'h-full rounded-full',
                  `bg-gradient-to-r ${colors.gradient}`
                )}
              />
            </div>
            <span className="text-xs text-white/50 whitespace-nowrap">
              {completedFields}/{totalFields}
            </span>
          </div>

          {/* Toggle Icon */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white/50"
          >
            <ChevronDownIcon className="w-5 h-5" />
          </motion.div>
        </div>
      </button>

      {/* Section Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-2">
              {/* Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className={cn(
                      // Full width for textarea and certain field types
                      ['textarea', 'file'].includes(field.field_type) && 'md:col-span-2'
                    )}
                  >
                    <ULAPFieldRenderer
                      field={field}
                      value={formData[field.field_name]}
                      error={errors[field.field_name]}
                      verification={verifications[field.field_name]}
                      onChange={(value) => onFieldChange(field.field_name, value)}
                      onVerify={onVerify ? () => onVerify(field.field_name) : undefined}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ULAPFormSection;
