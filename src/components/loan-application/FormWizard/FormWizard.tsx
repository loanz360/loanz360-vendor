/**
 * Form Wizard Component
 * Orchestrates the multi-step loan application form
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type {
  LoanTypeCode,
  LoanTypeConfig,
  FormStepConfig,
  ApplicationState,
  VerificationStatus,
  UserContext,
  DocumentConfig,
  UploadedDocument,
  DocumentType,
} from '../types';
import { getLoanTypeConfig, DOCUMENT_CONFIGS } from '../constants';
import { ProgressIndicator } from './ProgressIndicator';

// Form Sections
import {
  CustomerDetailsSection,
  EmploymentDetailsSection,
  LoanRequirementsSection,
  ExistingLoansSection,
  CoApplicantSection,
  DocumentUploadSection,
  PropertyDetailsSection,
  VehicleDetailsSection,
  EducationLoanSection,
  GoldLoanSection,
  BusinessLoanSection,
} from '../FormSections';

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

// =====================================================
// TYPES
// =====================================================

interface FormWizardProps {
  loanType: LoanTypeCode;
  userContext: UserContext;
  onComplete?: (applicationId: string) => void;
  onCancel?: () => void;
  onSaveDraft?: (state: ApplicationState) => void;
  className?: string;
}

// =====================================================
// STEP CONFIGURATION GENERATOR
// =====================================================

const generateStepsForLoanType = (loanConfig: LoanTypeConfig): FormStepConfig[] => {
  const steps: FormStepConfig[] = [];

  // Common steps for all loans
  steps.push({
    id: 'customer_details',
    title: 'Personal Details',
    shortTitle: 'Personal',
    description: 'Your identity and contact information',
    icon: 'User',
    estimatedTime: '3 min',
    isOptional: false,
    fields: [],
  });

  steps.push({
    id: 'employment_details',
    title: 'Employment & Income',
    shortTitle: 'Employment',
    description: 'Your occupation and income details',
    icon: 'Briefcase',
    estimatedTime: '4 min',
    isOptional: false,
    fields: [],
  });

  // Loan-specific step
  const loanCategory = loanConfig.category;
  const loanCode = loanConfig.code;

  // Property loans
  if (['HOME_LOAN', 'LAP', 'MORTGAGE_LOAN', 'LEASE_RENTAL_DISCOUNTING'].includes(loanCode)) {
    steps.push({
      id: 'property_details',
      title: 'Property Details',
      shortTitle: 'Property',
      description: 'Details about the property',
      icon: 'Home',
      estimatedTime: '5 min',
      isOptional: false,
      fields: [],
    });
  }

  // Vehicle loans
  if (['NEW_CAR_LOAN', 'USED_CAR_LOAN', 'TOPUP_VEHICLE_LOAN'].includes(loanCode)) {
    steps.push({
      id: 'vehicle_details',
      title: 'Vehicle Details',
      shortTitle: 'Vehicle',
      description: 'Details about the vehicle',
      icon: 'Car',
      estimatedTime: '4 min',
      isOptional: false,
      fields: [],
    });
  }

  // Education loan
  if (loanCode === 'EDUCATION_LOAN') {
    steps.push({
      id: 'course_details',
      title: 'Course & Institution',
      shortTitle: 'Course',
      description: 'Educational program details',
      icon: 'Academic',
      estimatedTime: '5 min',
      isOptional: false,
      fields: [],
    });
  }

  // Gold loan
  if (loanCode === 'GOLD_LOAN') {
    steps.push({
      id: 'gold_details',
      title: 'Gold Details',
      shortTitle: 'Gold',
      description: 'Gold ornament details',
      icon: 'Gold',
      estimatedTime: '4 min',
      isOptional: false,
      fields: [],
    });
  }

  // Business loans
  if (['BUSINESS_LOAN', 'WORKING_CAPITAL', 'MACHINERY_LOAN', 'OVERDRAFT', 'CASH_CREDIT', 'BILL_DISCOUNTING'].includes(loanCode)) {
    steps.push({
      id: 'business_details',
      title: 'Business Details',
      shortTitle: 'Business',
      description: 'Your business information',
      icon: 'Building',
      estimatedTime: '6 min',
      isOptional: false,
      fields: [],
    });
  }

  // Loan requirements (all loans)
  steps.push({
    id: 'loan_requirements',
    title: 'Loan Requirements',
    shortTitle: 'Requirements',
    description: 'Amount, tenure, and purpose',
    icon: 'Currency',
    estimatedTime: '2 min',
    isOptional: false,
    fields: [],
  });

  // Existing loans
  steps.push({
    id: 'existing_loans',
    title: 'Existing Obligations',
    shortTitle: 'Obligations',
    description: 'Your current loan commitments',
    icon: 'Bank',
    estimatedTime: '3 min',
    isOptional: true,
    fields: [],
  });

  // Co-applicant (optional or required based on loan type)
  if (loanConfig.requiresCoApplicant || ['HOME_LOAN', 'EDUCATION_LOAN'].includes(loanCode)) {
    steps.push({
      id: 'co_applicant',
      title: 'Co-Applicant / Guarantor',
      shortTitle: 'Co-Applicant',
      description: 'Add a co-applicant or guarantor',
      icon: 'Users',
      estimatedTime: '5 min',
      isOptional: !loanConfig.requiresCoApplicant,
      fields: [],
    });
  }

  // Documents
  steps.push({
    id: 'documents',
    title: 'Document Upload',
    shortTitle: 'Documents',
    description: 'Upload required documents',
    icon: 'Document',
    estimatedTime: '5 min',
    isOptional: false,
    fields: [],
  });

  // Review
  steps.push({
    id: 'review',
    title: 'Review & Submit',
    shortTitle: 'Review',
    description: 'Review your application',
    icon: 'Check',
    estimatedTime: '2 min',
    isOptional: false,
    fields: [],
  });

  return steps;
};

// =====================================================
// STEP CONTENT RENDERER
// =====================================================

interface StepContentProps {
  step: FormStepConfig;
  loanConfig: LoanTypeConfig;
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  verifications: Record<string, VerificationStatus>;
  documents: UploadedDocument[];
  requiredDocuments: DocumentConfig[];
  onFieldChange: (field: string, value: unknown) => void;
  onVerify: (field: string) => Promise<void>;
  onDocumentUpload: (type: DocumentType, file: File) => Promise<void>;
  onDocumentDelete: (documentId: string) => void;
}

const StepContent = ({
  step,
  loanConfig,
  formData,
  errors,
  verifications,
  documents,
  requiredDocuments,
  onFieldChange,
  onVerify,
  onDocumentUpload,
  onDocumentDelete,
}: StepContentProps) => {
  const commonProps = { formData, errors, onFieldChange };

  switch (step.id) {
    case 'customer_details':
      return <CustomerDetailsSection {...commonProps} verifications={verifications} onVerify={onVerify} />;

    case 'employment_details':
      return <EmploymentDetailsSection {...commonProps} verifications={verifications} onVerify={onVerify} />;

    case 'property_details':
      return (
        <PropertyDetailsSection
          {...commonProps}
          loanType={loanConfig.code as 'HOME_LOAN' | 'LAP' | 'MORTGAGE_LOAN' | 'LEASE_RENTAL_DISCOUNTING'}
        />
      );

    case 'vehicle_details':
      return (
        <VehicleDetailsSection
          {...commonProps}
          loanType={loanConfig.code as 'NEW_CAR_LOAN' | 'USED_CAR_LOAN' | 'TWO_WHEELER_LOAN'}
        />
      );

    case 'course_details':
      return <EducationLoanSection {...commonProps} />;

    case 'gold_details':
      return <GoldLoanSection {...commonProps} />;

    case 'business_details':
      return (
        <BusinessLoanSection
          {...commonProps}
          verifications={verifications}
          onVerify={onVerify}
          loanType={loanConfig.code as 'BUSINESS_LOAN' | 'WORKING_CAPITAL' | 'MACHINERY_LOAN' | 'OVERDRAFT' | 'CASH_CREDIT'}
        />
      );

    case 'loan_requirements':
      return <LoanRequirementsSection {...commonProps} loanConfig={loanConfig} />;

    case 'existing_loans':
      return <ExistingLoansSection {...commonProps} />;

    case 'co_applicant':
      return (
        <CoApplicantSection
          {...commonProps}
          verifications={verifications}
          onVerify={onVerify}
          requiresCoApplicant={loanConfig.requiresCoApplicant}
        />
      );

    case 'documents':
      return (
        <DocumentUploadSection
          requiredDocuments={requiredDocuments}
          uploadedDocuments={documents}
          onUpload={onDocumentUpload}
          onDelete={onDocumentDelete}
          onVerify={async (docId) => {
            // Document verification logic
            console.log('Verifying document:', docId);
          }}
        />
      );

    case 'review':
      return (
        <div className="space-y-6">
          <div className="text-center py-8">
            <h3 className="text-xl font-semibold text-white mb-2">Review Your Application</h3>
            <p className="text-sm text-white/60">Please review all the information before submitting</p>
          </div>
          {/* Review content would go here - showing summary of all entered data */}
        </div>
      );

    default:
      return (
        <div className="text-center py-12">
          <p className="text-white/60">Step content not found</p>
        </div>
      );
  }
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export function FormWizard({
  loanType,
  userContext,
  onComplete,
  onCancel,
  onSaveDraft,
  className,
}: FormWizardProps) {
  // Get loan configuration
  const loanConfig = useMemo(() => getLoanTypeConfig(loanType), [loanType]);

  // Generate steps
  const steps = useMemo(() => {
    if (!loanConfig) return [];
    return generateStepsForLoanType(loanConfig);
  }, [loanConfig]);

  // Get required documents
  const requiredDocuments = useMemo(() => {
    if (!loanConfig) return [];
    return loanConfig.requiredDocuments
      .map(docType => DOCUMENT_CONFIGS.find(d => d.type === docType))
      .filter(Boolean) as DocumentConfig[];
  }, [loanConfig]);

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [verifications, setVerifications] = useState<Record<string, VerificationStatus>>({});
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Handlers
  const handleFieldChange = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const handleVerify = useCallback(async (field: string) => {
    setVerifications(prev => ({ ...prev, [field]: 'IN_PROGRESS' }));
    try {
      // Simulate API verification
      await new Promise(resolve => setTimeout(resolve, 2000));
      setVerifications(prev => ({ ...prev, [field]: 'VERIFIED' }));
    } catch {
      setVerifications(prev => ({ ...prev, [field]: 'FAILED' }));
    }
  }, []);

  const handleDocumentUpload = useCallback(async (type: DocumentType, file: File) => {
    // Simulate upload
    const newDoc: UploadedDocument = {
      id: `doc_${Date.now()}`,
      type,
      fileName: file.name,
      fileSize: file.size,
      fileUrl: URL.createObjectURL(file),
      uploadedAt: new Date(),
      verificationStatus: 'PENDING',
    };
    setDocuments(prev => [...prev.filter(d => d.type !== type), newDoc]);
  }, []);

  const handleDocumentDelete = useCallback((documentId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== documentId));
  }, []);

  const validateStep = useCallback((stepIndex: number): boolean => {
    // Add validation logic here
    return true;
  }, []);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  }, [currentStep, steps.length, validateStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleStepClick = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    setIsSaving(true);
    try {
      const state: ApplicationState = {
        loanType,
        currentStep,
        completedSteps,
        formData,
        documents,
        verifications,
        status: 'DRAFT',
        isDraft: true,
        lastSavedAt: new Date(),
        errors: {},
      };
      await onSaveDraft?.(state);
    } finally {
      setIsSaving(false);
    }
  }, [loanType, currentStep, completedSteps, formData, documents, verifications, onSaveDraft]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Submit logic
      await new Promise(resolve => setTimeout(resolve, 2000));
      onComplete?.(`APP_${Date.now()}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [onComplete]);

  if (!loanConfig || steps.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60">Invalid loan type</p>
      </div>
    );
  }

  const currentStepConfig = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className={cn('min-h-screen bg-zinc-950', className)}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Loan Type Badge */}
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                `bg-gradient-to-br ${loanConfig.gradient}`
              )}>
                <span className="text-lg text-white">💰</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{loanConfig.name}</h2>
                <p className="text-xs text-white/50">Application in progress</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Save Draft */}
              <motion.button
                onClick={handleSaveDraft}
                disabled={isSaving}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10
                         text-white/70 hover:text-white transition-colors"
              >
                {isSaving ? (
                  <LoadingIcon className="w-4 h-4" />
                ) : (
                  <SaveIcon className="w-4 h-4" />
                )}
                <span className="text-sm">Save Draft</span>
              </motion.button>

              {/* Cancel */}
              <motion.button
                onClick={onCancel}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 rounded-xl text-white/50 hover:text-white transition-colors"
              >
                <span className="text-sm">Cancel</span>
              </motion.button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6">
            <ProgressIndicator
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              variant="compact"
              onStepClick={handleStepClick}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <StepContent
              step={currentStepConfig}
              loanConfig={loanConfig}
              formData={formData}
              errors={errors}
              verifications={verifications}
              documents={documents}
              requiredDocuments={requiredDocuments}
              onFieldChange={handleFieldChange}
              onVerify={handleVerify}
              onDocumentUpload={handleDocumentUpload}
              onDocumentDelete={handleDocumentDelete}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="sticky bottom-0 bg-zinc-950/90 backdrop-blur-xl border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Previous Button */}
            <motion.button
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
            <div className="text-center">
              <p className="text-xs text-white/40">
                Step {currentStep + 1} of {steps.length}
              </p>
              <p className="text-sm text-white/70">{currentStepConfig.title}</p>
            </div>

            {/* Next / Submit Button */}
            {isLastStep ? (
              <motion.button
                onClick={handleSubmit}
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-2 px-8 py-3 rounded-xl font-medium',
                  'bg-gradient-to-r from-brand-primary to-orange-500 text-white',
                  'shadow-lg shadow-brand-primary/25',
                  isSubmitting && 'opacity-70 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <>
                    <LoadingIcon className="w-5 h-5" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Application</span>
                )}
              </motion.button>
            ) : (
              <motion.button
                onClick={handleNext}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-2 px-8 py-3 rounded-xl font-medium',
                  'bg-gradient-to-r from-brand-primary to-orange-500 text-white',
                  'shadow-lg shadow-brand-primary/25'
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

export default FormWizard;
