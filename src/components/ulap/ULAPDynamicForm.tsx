/**
 * ULAP Dynamic Form Component
 * Main form component that renders dynamic fields based on profile configuration
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type {
  ULAPDynamicFormProps,
  ULAPFormData,
  ULAPFormErrors,
  ULAPVerificationStatus,
  ULAPProfileField,
  ULAPGroupedFields,
  ULAPLeadSource,
} from './types';
import { VALIDATION_PATTERNS, VALIDATION_MESSAGES, SOURCE_CONFIG, DEFAULT_FORM_STEPS } from './types';
import { ULAPFormSection } from './ULAPFormSection';

// =====================================================
// ICONS
// =====================================================

const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const SaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
  </svg>
);

const LoadingIcon = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// =====================================================
// PROGRESS INDICATOR
// =====================================================

interface StepIndicatorProps {
  steps: typeof DEFAULT_FORM_STEPS;
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (index: number) => void;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}) => (
  <div className="flex items-center justify-between w-full">
    {steps.map((step, index) => {
      const isCompleted = completedSteps.has(index);
      const isCurrent = index === currentStep;
      const isPast = index < currentStep;

      return (
        <React.Fragment key={step.id}>
          {/* Step Circle */}
          <motion.button
            type="button"
            onClick={() => onStepClick(index)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300',
              'border-2 font-medium text-sm',
              isCompleted && 'bg-green-500 border-green-500 text-white',
              isCurrent && !isCompleted && 'bg-brand-primary border-brand-primary text-white',
              !isCurrent && !isCompleted && 'bg-white/5 border-white/20 text-white/50 hover:border-white/40'
            )}
          >
            {isCompleted ? (
              <CheckIcon className="w-5 h-5" />
            ) : (
              <span>{index + 1}</span>
            )}

            {/* Step Label */}
            <span
              className={cn(
                'absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs',
                isCurrent || isCompleted ? 'text-white/80' : 'text-white/40'
              )}
            >
              {step.shortTitle}
            </span>
          </motion.button>

          {/* Connector Line */}
          {index < steps.length - 1 && (
            <div className="flex-1 h-0.5 mx-2 bg-white/10 relative overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: isPast || isCompleted ? '100%' : '0%' }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-brand-primary"
              />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ULAPDynamicForm({
  source,
  subcategoryId,
  initialData = {},
  onSubmit,
  onCancel,
  onSaveDraft,
  showCoApplicant = false,
  readOnly = false,
  className,
}: ULAPDynamicFormProps) {
  // State
  const [fields, setFields] = useState<ULAPGroupedFields | null>(null);
  const [formData, setFormData] = useState<ULAPFormData>(initialData);
  const [errors, setErrors] = useState<ULAPFormErrors>({});
  const [verifications, setVerifications] = useState<ULAPVerificationStatus>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['applicant', 'loan']));

  // Get source configuration
  const sourceConfig = SOURCE_CONFIG[source];

  // Filter steps based on available sections
  const activeSteps = useMemo(() => {
    if (!fields) return DEFAULT_FORM_STEPS;

    return DEFAULT_FORM_STEPS.filter((step) => {
      // Always show applicant and loan sections
      if (['applicant', 'loan'].includes(step.id)) return true;
      // Show co-applicant only if enabled and has fields
      if (step.id === 'coapplicant') return showCoApplicant && fields.coapplicant.length > 0;
      // Show other sections only if they have fields
      if (step.id === 'other') return fields.other.length > 0;
      return true;
    });
  }, [fields, showCoApplicant]);

  // Load profile fields
  useEffect(() => {
    const loadFields = async () => {
      try {
        setIsLoading(true);
        const url = subcategoryId
          ? `/api/ulap/profile-fields?subcategory_id=${subcategoryId}`
          : '/api/ulap/profile-fields';

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load form fields');

        const data = await response.json();
        setFields(data.fields);
      } catch (error) {
        console.error('Error loading form fields:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFields();
  }, [subcategoryId]);

  // Validate a single field
  const validateField = useCallback((field: ULAPProfileField, value: unknown): string | null => {
    // Required check
    if (field.is_required && (value === undefined || value === null || value === '')) {
      return VALIDATION_MESSAGES.required;
    }

    if (!value) return null;

    const strValue = String(value);
    const rules = field.validation_rules;

    // Type-specific validation
    switch (field.field_type) {
      case 'email':
        if (!VALIDATION_PATTERNS.email.test(strValue)) {
          return VALIDATION_MESSAGES.email;
        }
        break;
      case 'phone':
        if (!VALIDATION_PATTERNS.phone.test(strValue)) {
          return VALIDATION_MESSAGES.phone;
        }
        break;
      case 'pan':
        if (!VALIDATION_PATTERNS.pan.test(strValue)) {
          return VALIDATION_MESSAGES.pan;
        }
        break;
      case 'aadhaar':
        if (!VALIDATION_PATTERNS.aadhaar.test(strValue)) {
          return VALIDATION_MESSAGES.aadhaar;
        }
        break;
      case 'pincode':
        if (!VALIDATION_PATTERNS.pincode.test(strValue)) {
          return VALIDATION_MESSAGES.pincode;
        }
        break;
    }

    // Custom validation rules
    if (rules) {
      if (rules.minLength && strValue.length < rules.minLength) {
        return VALIDATION_MESSAGES.minLength(rules.minLength);
      }
      if (rules.maxLength && strValue.length > rules.maxLength) {
        return VALIDATION_MESSAGES.maxLength(rules.maxLength);
      }
      if (rules.min !== undefined && Number(value) < rules.min) {
        return VALIDATION_MESSAGES.min(rules.min);
      }
      if (rules.max !== undefined && Number(value) > rules.max) {
        return VALIDATION_MESSAGES.max(rules.max);
      }
      if (rules.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(strValue)) {
          return rules.patternMessage || 'Invalid format';
        }
      }
    }

    return null;
  }, []);

  // Validate current step
  const validateStep = useCallback((stepIndex: number): boolean => {
    if (!fields) return false;

    const step = activeSteps[stepIndex];
    const stepFields: ULAPProfileField[] = [];

    step.sections.forEach((section) => {
      const sectionFields = fields[section as keyof ULAPGroupedFields] || [];
      stepFields.push(...sectionFields);
    });

    const newErrors: ULAPFormErrors = {};
    let isValid = true;

    stepFields.forEach((field) => {
      const error = validateField(field, formData[field.field_name]);
      if (error) {
        newErrors[field.field_name] = error;
        isValid = false;
      }
    });

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return isValid;
  }, [fields, activeSteps, formData, validateField]);

  // Handle field change
  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    // Clear error when field is changed
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [errors]);

  // Handle field verification
  const handleVerify = useCallback(async (fieldName: string) => {
    setVerifications((prev) => ({ ...prev, [fieldName]: 'verifying' }));

    try {
      // Simulate API verification
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // For demo, randomly succeed or fail
      const success = Math.random() > 0.2;
      setVerifications((prev) => ({
        ...prev,
        [fieldName]: success ? 'verified' : 'failed',
      }));
    } catch {
      setVerifications((prev) => ({ ...prev, [fieldName]: 'failed' }));
    }
  }, []);

  // Handle section toggle
  const handleSectionToggle = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Handle next step
  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      if (currentStep < activeSteps.length - 1) {
        setCurrentStep(currentStep + 1);
        // Expand the section for the new step
        const nextStep = activeSteps[currentStep + 1];
        setExpandedSections(new Set(nextStep.sections));
      }
    }
  }, [currentStep, activeSteps, validateStep]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      const prevStep = activeSteps[currentStep - 1];
      setExpandedSections(new Set(prevStep.sections));
    }
  }, [currentStep, activeSteps]);

  // Handle step click
  const handleStepClick = useCallback((stepIndex: number) => {
    // Allow clicking on completed steps or adjacent steps
    if (completedSteps.has(stepIndex) || stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
      const step = activeSteps[stepIndex];
      setExpandedSections(new Set(step.sections));
    }
  }, [completedSteps, currentStep, activeSteps]);

  // Handle save draft
  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) return;

    setIsSaving(true);
    try {
      await onSaveDraft(formData);
    } finally {
      setIsSaving(false);
    }
  }, [formData, onSaveDraft]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    // Validate all steps
    let allValid = true;
    for (let i = 0; i < activeSteps.length; i++) {
      if (!validateStep(i)) {
        allValid = false;
        setCurrentStep(i);
        break;
      }
    }

    if (!allValid) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeSteps, validateStep, formData, onSubmit]);

  // Get fields for current step
  const getCurrentStepFields = useCallback(() => {
    if (!fields) return { applicant: [], coapplicant: [], loan: [], other: [] };

    const step = activeSteps[currentStep];
    const result: ULAPGroupedFields = {
      applicant: [],
      coapplicant: [],
      loan: [],
      other: [],
    };

    step.sections.forEach((section) => {
      result[section as keyof ULAPGroupedFields] = fields[section as keyof ULAPGroupedFields] || [];
    });

    return result;
  }, [fields, activeSteps, currentStep]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <LoadingIcon className="w-12 h-12 text-brand-primary" />
          <p className="text-white/60">Loading form...</p>
        </div>
      </div>
    );
  }

  // No fields state
  if (!fields || Object.values(fields).every((arr) => arr.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-white/60">No form fields configured.</p>
          <p className="text-sm text-white/40 mt-2">
            Please configure profile fields in the SuperAdmin panel.
          </p>
        </div>
      </div>
    );
  }

  const currentStepData = activeSteps[currentStep];
  const currentStepFields = getCurrentStepFields();
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === activeSteps.length - 1;

  return (
    <div className={cn('min-h-screen bg-zinc-950', className)}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Source Badge */}
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  `bg-gradient-to-br ${sourceConfig.color}`
                )}
              >
                <span className="text-xl text-white">
                  {source === 'BA' && '🏢'}
                  {source === 'BP' && '🏦'}
                  {source === 'DSE' && '👤'}
                  {source === 'TELECALLER' && '📞'}
                  {source === 'FIELD_SALES' && '📍'}
                  {source === 'CUSTOMER' && '🙋'}
                  {source === 'REFERRAL' && '🎁'}
                  {source === 'WEBSITE' && '🌐'}
                  {source === 'WALK_IN' && '🏪'}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">New Lead Application</h2>
                <p className="text-xs text-white/50">via {sourceConfig.name}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Save Draft */}
              {onSaveDraft && (
                <motion.button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSaving || readOnly}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10
                           text-white/70 hover:text-white transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <LoadingIcon className="w-4 h-4" />
                  ) : (
                    <SaveIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm hidden sm:inline">Save Draft</span>
                </motion.button>
              )}

              {/* Cancel */}
              {onCancel && (
                <motion.button
                  type="button"
                  onClick={onCancel}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Step Progress */}
          <div className="mt-8 mb-2 px-4">
            <StepIndicator
              steps={activeSteps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={handleStepClick}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Step Header */}
        <div className="mb-8">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h3 className="text-2xl font-bold text-white">{currentStepData.title}</h3>
            <p className="text-white/50 mt-1">{currentStepData.description}</p>
          </motion.div>
        </div>

        {/* Form Sections */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {currentStepData.sections.map((section) => {
              const sectionFields = currentStepFields[section as keyof ULAPGroupedFields];
              if (!sectionFields || sectionFields.length === 0) return null;

              return (
                <ULAPFormSection
                  key={section}
                  title={
                    section === 'applicant' ? 'Applicant Information' :
                    section === 'coapplicant' ? 'Co-Applicant Information' :
                    section === 'loan' ? 'Loan Requirements' :
                    'Additional Details'
                  }
                  description={
                    section === 'applicant' ? 'Basic details of the primary applicant' :
                    section === 'coapplicant' ? 'Details of the co-applicant or guarantor' :
                    section === 'loan' ? 'Loan amount, tenure, and purpose' :
                    'Other relevant information'
                  }
                  fields={sectionFields}
                  formData={formData}
                  errors={errors}
                  verifications={verifications}
                  onFieldChange={handleFieldChange}
                  onVerify={handleVerify}
                  disabled={readOnly}
                  isExpanded={expandedSections.has(section)}
                  onToggle={() => handleSectionToggle(section)}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="sticky bottom-0 bg-zinc-950/90 backdrop-blur-xl border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Previous Button */}
            <motion.button
              type="button"
              onClick={handlePrevious}
              disabled={isFirstStep}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200',
                isFirstStep
                  ? 'opacity-50 cursor-not-allowed'
                  : 'bg-white/5 hover:bg-white/10 text-white'
              )}
            >
              <ChevronLeftIcon className="w-5 h-5" />
              <span>Previous</span>
            </motion.button>

            {/* Step Info */}
            <div className="text-center hidden sm:block">
              <p className="text-xs text-white/40">
                Step {currentStep + 1} of {activeSteps.length}
              </p>
              <p className="text-sm text-white/70">{currentStepData.title}</p>
            </div>

            {/* Next / Submit Button */}
            {isLastStep ? (
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || readOnly}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-2 px-8 py-3 rounded-xl font-medium',
                  'bg-gradient-to-r from-brand-primary to-orange-500 text-white',
                  'shadow-lg shadow-brand-primary/25',
                  (isSubmitting || readOnly) && 'opacity-70 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <>
                    <LoadingIcon className="w-5 h-5" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    <span>Submit Application</span>
                  </>
                )}
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={handleNext}
                disabled={readOnly}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-2 px-8 py-3 rounded-xl font-medium',
                  'bg-gradient-to-r from-brand-primary to-orange-500 text-white',
                  'shadow-lg shadow-brand-primary/25',
                  readOnly && 'opacity-70 cursor-not-allowed'
                )}
              >
                <span>Continue</span>
                <ChevronRightIcon className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ULAPDynamicForm;
