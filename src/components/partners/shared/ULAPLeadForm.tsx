/**
 * ULAP Lead Form Component
 *
 * Shared component for BA/BP portals to submit leads
 * Handles both Phase 1 (Basic Lead Info) and Phase 2 (Detailed Application)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  User,
  Briefcase,
  IndianRupee,
  FileText,
  AlertCircle,
  CheckCircle2,
  Home,
  Car,
  Building2,
  GraduationCap,
  Landmark,
  Users,
  Copy,
  ExternalLink,
} from 'lucide-react';

// Types
interface LoanCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}

interface LoanSubcategory {
  id: string;
  name: string;
  slug?: string;
  code?: string;
  category_id: string;
  description?: string;
  min_amount?: number;
  max_amount?: number;
}

interface BasicLeadField {
  id: string;
  field_key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'currency' | 'select' | 'radio' | 'checkbox' | 'date' | 'textarea';
  placeholder?: string;
  help_text?: string;
  options?: { value: string; label: string }[];
  validation: {
    required?: boolean;
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    pattern?: string;
    pattern_message?: string;
  };
  display_order: number;
  is_visible: boolean;
  is_editable: boolean;
}

interface ULAPLeadFormProps {
  partnerType: 'BA' | 'BP';
  partnerId: string;
  partnerName: string;
  onSuccess?: (leadData: { lead_id: string; lead_number: string; shareable_link?: string }) => void;
  resumeLeadId?: string; // If resuming an existing lead
}

// Step configuration
type FormStep = 'category' | 'loanType' | 'phase1' | 'phase2' | 'success';

const STEPS: { key: FormStep; label: string; description: string }[] = [
  { key: 'category', label: 'Loan Category', description: 'Select the loan category' },
  { key: 'loanType', label: 'Loan Type', description: 'Choose specific loan type' },
  { key: 'phase1', label: 'Basic Details', description: 'Enter customer information' },
  { key: 'phase2', label: 'Full Application', description: 'Complete application details' },
  { key: 'success', label: 'Complete', description: 'Lead submitted successfully' },
];

// Category icons mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'personal-loans': <User className="w-6 h-6" />,
  'business-loans': <Briefcase className="w-6 h-6" />,
  'home-loans': <Home className="w-6 h-6" />,
  'mortgage-lap': <Building2 className="w-6 h-6" />,
  'vehicle-loans': <Car className="w-6 h-6" />,
  'educational-loans': <GraduationCap className="w-6 h-6" />,
  'professional-loans': <Briefcase className="w-6 h-6" />,
  'working-capital': <Landmark className="w-6 h-6" />,
  default: <FileText className="w-6 h-6" />,
};

// Default basic fields (fallback if API fails)
const DEFAULT_BASIC_FIELDS: BasicLeadField[] = [
  {
    id: 'customer_name',
    field_key: 'customer_name',
    label: 'Full Name',
    type: 'text',
    placeholder: 'Enter customer full name',
    validation: { required: true, min_length: 2, max_length: 100 },
    display_order: 1,
    is_visible: true,
    is_editable: true,
  },
  {
    id: 'customer_mobile',
    field_key: 'customer_mobile',
    label: 'Mobile Number',
    type: 'phone',
    placeholder: '10-digit mobile number',
    validation: { required: true, pattern: '^[6-9]\\d{9}$', pattern_message: 'Enter valid 10-digit mobile number' },
    display_order: 2,
    is_visible: true,
    is_editable: true,
  },
  {
    id: 'customer_email',
    field_key: 'customer_email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'customer@example.com',
    validation: { required: false },
    display_order: 3,
    is_visible: true,
    is_editable: true,
  },
  {
    id: 'loan_amount',
    field_key: 'loan_amount',
    label: 'Required Loan Amount',
    type: 'currency',
    placeholder: 'Enter amount',
    help_text: 'Approximate loan amount needed',
    validation: { required: true, min_value: 10000 },
    display_order: 4,
    is_visible: true,
    is_editable: true,
  },
  {
    id: 'customer_city',
    field_key: 'customer_city',
    label: 'City',
    type: 'text',
    placeholder: 'Enter city',
    validation: { required: true },
    display_order: 5,
    is_visible: true,
    is_editable: true,
  },
  {
    id: 'employment_type',
    field_key: 'employment_type',
    label: 'Employment Type',
    type: 'select',
    placeholder: 'Select employment type',
    options: [
      { value: 'SALARIED', label: 'Salaried' },
      { value: 'SELF_EMPLOYED_BUSINESS', label: 'Self Employed - Business' },
      { value: 'SELF_EMPLOYED_PROFESSIONAL', label: 'Self Employed - Professional' },
      { value: 'RETIRED', label: 'Retired' },
      { value: 'OTHER', label: 'Other' },
    ],
    validation: { required: true },
    display_order: 6,
    is_visible: true,
    is_editable: true,
  },
  {
    id: 'monthly_income',
    field_key: 'monthly_income',
    label: 'Monthly Income',
    type: 'currency',
    placeholder: 'Enter monthly income',
    validation: { required: false },
    display_order: 7,
    is_visible: true,
    is_editable: true,
  },
  {
    id: 'loan_purpose',
    field_key: 'loan_purpose',
    label: 'Loan Purpose',
    type: 'textarea',
    placeholder: 'Describe the purpose of the loan...',
    validation: { required: false, max_length: 500 },
    display_order: 8,
    is_visible: true,
    is_editable: true,
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ULAPLeadForm({ partnerType, partnerId, partnerName, onSuccess, resumeLeadId }: ULAPLeadFormProps) {
  // State
  const [currentStep, setCurrentStep] = useState<FormStep>('category');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [categories, setCategories] = useState<LoanCategory[]>([]);
  const [subcategories, setSubcategories] = useState<LoanSubcategory[]>([]);
  const [basicFields, setBasicFields] = useState<BasicLeadField[]>(DEFAULT_BASIC_FIELDS);

  // Selection state
  const [selectedCategory, setSelectedCategory] = useState<LoanCategory | null>(null);
  const [selectedLoanType, setSelectedLoanType] = useState<LoanSubcategory | null>(null);

  // Form data state
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [phase2Data, setPhase2Data] = useState<Record<string, unknown>>({});

  // Result state
  const [submittedLead, setSubmittedLead] = useState<{
    lead_id: string;
    lead_number: string;
    shareable_link?: string;
  } | null>(null);

  // Inline notification state (replaces alert())
  const [notification, setNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
    fetchBasicFields();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory.id);
    }
  }, [selectedCategory]);

  // Load resume lead data if provided
  useEffect(() => {
    if (resumeLeadId) {
      loadResumeLeadData(resumeLeadId);
    }
  }, [resumeLeadId]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/ulap/loan-categories?include_subcategories=true');
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchSubcategories = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/ulap/loan-subcategories?category_id=${categoryId}`);
      const data = await response.json();
      if (data.subcategories) {
        setSubcategories(data.subcategories);
      }
    } catch (err) {
      console.error('Error fetching subcategories:', err);
    }
  };

  const fetchBasicFields = async () => {
    try {
      const response = await fetch('/api/ulap/basic-fields');
      const data = await response.json();
      if (data.fields && data.fields.length > 0) {
        setBasicFields(data.fields);
      }
    } catch (err) {
      console.error('Error fetching basic fields, using defaults:', err);
    }
  };

  const loadResumeLeadData = async (leadId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/ulap/get-lead?id=${leadId}`);
      const data = await response.json();

      if (data.success && data.data) {
        const lead = data.data;

        // Set form data from lead
        setFormData({
          customer_name: lead.customer_name,
          customer_mobile: lead.customer_mobile,
          customer_email: lead.customer_email,
          customer_city: lead.customer_city,
          loan_amount: lead.loan_amount,
          employment_type: lead.customer_subrole,
          monthly_income: lead.monthly_income,
          loan_purpose: lead.loan_purpose,
          ...lead.phase_1_data,
        });

        // Set phase 2 data if exists
        if (lead.phase_2_data) {
          setPhase2Data(lead.phase_2_data);
        }

        // Determine which step to go to
        if (lead.form_status === 'PHASE_1_SUBMITTED') {
          setCurrentStep('phase2');
        } else if (lead.form_status === 'PHASE_2_IN_PROGRESS') {
          setCurrentStep('phase2');
        }

        // Set submitted lead for reference
        setSubmittedLead({
          lead_id: lead.id,
          lead_number: lead.lead_number,
          shareable_link: lead.short_link,
        });
      }
    } catch (err) {
      console.error('Error loading resume lead:', err);
      setError('Failed to load lead data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
  }, []);

  const handlePhase2FieldChange = useCallback((fieldKey: string, value: unknown) => {
    setPhase2Data(prev => ({ ...prev, [fieldKey]: value }));
  }, []);

  const validatePhase1 = (): boolean => {
    const visibleFields = basicFields.filter(f => f.is_visible);

    for (const field of visibleFields) {
      if (field.validation.required) {
        const value = formData[field.field_key];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          setError(`${field.label} is required`);
          return false;
        }
      }

      // Pattern validation
      if (field.validation.pattern && formData[field.field_key]) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(String(formData[field.field_key]))) {
          setError(field.validation.pattern_message || `Invalid ${field.label}`);
          return false;
        }
      }
    }

    setError(null);
    return true;
  };

  const submitPhase1 = async () => {
    if (!validatePhase1()) return;
    if (!selectedCategory || !selectedLoanType) {
      setError('Please select loan category and type');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ulap/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          loan_category_id: selectedCategory.id,
          loan_category_code: selectedCategory.slug,
          loan_subcategory_id: selectedLoanType.id,
          loan_subcategory_code: selectedLoanType.slug || selectedLoanType.code,
          loan_type: selectedLoanType.name,
          form_source: 'ULAP_PARTNER_LINK',
          source_partner_type: partnerType,
          partner_name: partnerName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmittedLead({
          lead_id: data.data.id,
          lead_number: data.data.lead_number,
          shareable_link: data.data.shareable_link,
        });
        setCurrentStep('phase2');
      } else {
        setError(data.error || 'Failed to submit lead');
      }
    } catch (err) {
      console.error('Error submitting phase 1:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitPhase2 = async (isComplete: boolean) => {
    if (!submittedLead) {
      setError('Lead ID not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ulap/update-lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: submittedLead.lead_id,
          ...phase2Data,
          is_complete: isComplete,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (isComplete) {
          setCurrentStep('success');
          onSuccess?.(submittedLead);
        } else {
          // Saved for later
          setError(null);
          setNotification({ type: 'success', message: 'Progress saved! You can continue later from Lead Status.' });
        }
      } else {
        setError(data.error || 'Failed to update lead');
      }
    } catch (err) {
      console.error('Error submitting phase 2:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const goToStep = (step: FormStep) => {
    setError(null);
    setCurrentStep(step);
  };

  const copyShareableLink = () => {
    if (submittedLead?.shareable_link) {
      navigator.clipboard.writeText(submittedLead.shareable_link);
      setNotification({ type: 'info', message: 'Link copied to clipboard!' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Progress Header */}
      <div className="bg-zinc-900/50 border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-white">Submit a Lead</h1>
            {submittedLead && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-300">Lead ID: {submittedLead.lead_number}</span>
              </div>
            )}
          </div>

          {/* Step Progress */}
          <div className="flex items-center gap-2">
            {STEPS.slice(0, -1).map((step, index) => (
              <React.Fragment key={step.key}>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                    index < currentStepIndex
                      ? 'bg-green-500/20 text-green-400'
                      : index === currentStepIndex
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-white/5 text-white/40'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center text-xs font-medium rounded-full bg-current/20">
                      {index + 1}
                    </span>
                  )}
                  <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                </div>
                {index < STEPS.length - 2 && (
                  <ChevronRight className="w-4 h-4 text-white/20" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-6 p-4 rounded-xl flex items-center justify-between gap-3 ${
                notification.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-blue-500/10 border border-blue-500/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${
                  notification.type === 'success' ? 'text-green-400' : 'text-blue-400'
                }`} />
                <p className={`text-sm ${
                  notification.type === 'success' ? 'text-green-300' : 'text-blue-300'
                }`}>{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <span className="sr-only">Dismiss</span>
                &times;
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Category Selection */}
          {currentStep === 'category' && (
            <motion.div
              key="category"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-bold text-white mb-2">Select Loan Category</h2>
              <p className="text-white/60 mb-6">Choose the type of loan your customer needs</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category);
                      setSelectedLoanType(null);
                      goToStep('loanType');
                    }}
                    className={`p-4 rounded-xl border transition-all text-left hover:scale-[1.02] ${
                      selectedCategory?.id === category.id
                        ? 'bg-orange-500/20 border-orange-500/50'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-white/10 w-fit mb-3 text-white/70">
                      {CATEGORY_ICONS[category.slug] || CATEGORY_ICONS.default}
                    </div>
                    <h3 className="font-medium text-white mb-1">{category.name}</h3>
                    {category.description && (
                      <p className="text-xs text-white/50 line-clamp-2">{category.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Loan Type Selection */}
          {currentStep === 'loanType' && (
            <motion.div
              key="loanType"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button
                onClick={() => goToStep('category')}
                className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Categories
              </button>

              <h2 className="text-2xl font-bold text-white mb-2">Select Loan Type</h2>
              <p className="text-white/60 mb-6">
                {selectedCategory?.name} - Choose specific loan product
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subcategories.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    onClick={() => {
                      setSelectedLoanType(subcategory);
                      goToStep('phase1');
                    }}
                    className={`p-4 rounded-xl border transition-all text-left hover:scale-[1.02] ${
                      selectedLoanType?.id === subcategory.id
                        ? 'bg-orange-500/20 border-orange-500/50'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <h3 className="font-medium text-white mb-1">{subcategory.name}</h3>
                    {subcategory.description && (
                      <p className="text-xs text-white/50 mb-2">{subcategory.description}</p>
                    )}
                    {(subcategory.min_amount || subcategory.max_amount) && (
                      <p className="text-xs text-orange-400">
                        {subcategory.min_amount && `Min: ₹${subcategory.min_amount.toLocaleString()}`}
                        {subcategory.min_amount && subcategory.max_amount && ' - '}
                        {subcategory.max_amount && `Max: ₹${subcategory.max_amount.toLocaleString()}`}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Phase 1 - Basic Details */}
          {currentStep === 'phase1' && (
            <motion.div
              key="phase1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button
                onClick={() => goToStep('loanType')}
                className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Loan Types
              </button>

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Basic Lead Information</h2>
                <p className="text-white/60">
                  {selectedCategory?.name} → {selectedLoanType?.name}
                </p>
              </div>

              <div className="space-y-6">
                {basicFields
                  .filter(f => f.is_visible)
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((field) => (
                    <DynamicField
                      key={field.id}
                      field={field}
                      value={formData[field.field_key]}
                      onChange={(value) => handleFieldChange(field.field_key, value)}
                    />
                  ))}
              </div>

              <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-white/10">
                <button
                  onClick={submitPhase1}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continue to Full Application
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Phase 2 - Full Application */}
          {currentStep === 'phase2' && (
            <motion.div
              key="phase2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Lead ID Badge */}
              {submittedLead && (
                <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-300 mb-1">Lead Created Successfully!</p>
                      <p className="text-lg font-semibold text-white">Lead ID: {submittedLead.lead_number}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyShareableLink}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/70 hover:text-white transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <h2 className="text-2xl font-bold text-white mb-2">Complete Application</h2>
              <p className="text-white/60 mb-6">
                Fill in the remaining details or save and continue later
              </p>

              {/* Phase 2 Form Sections */}
              <div className="space-y-8">
                {/* Applicant Extended Details */}
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                    <h3 className="font-medium text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-orange-400" />
                      Extended Applicant Details
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/70 mb-1.5">PAN Number</label>
                      <input
                        type="text"
                        value={String(phase2Data.customer_pan || '')}
                        onChange={(e) => handlePhase2FieldChange('customer_pan', e.target.value.toUpperCase())}
                        placeholder="ABCDE1234F"
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1.5">Date of Birth</label>
                      <input
                        type="date"
                        value={String(phase2Data.customer_dob || '')}
                        onChange={(e) => handlePhase2FieldChange('customer_dob', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1.5">Gender</label>
                      <select
                        value={String(phase2Data.customer_gender || '')}
                        onChange={(e) => handlePhase2FieldChange('customer_gender', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        <option value="">Select Gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1.5">Marital Status</label>
                      <select
                        value={String(phase2Data.customer_marital_status || '')}
                        onChange={(e) => handlePhase2FieldChange('customer_marital_status', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        <option value="">Select Status</option>
                        <option value="SINGLE">Single</option>
                        <option value="MARRIED">Married</option>
                        <option value="DIVORCED">Divorced</option>
                        <option value="WIDOWED">Widowed</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-white/70 mb-1.5">Full Address</label>
                      <textarea
                        value={String(phase2Data.customer_address || '')}
                        onChange={(e) => handlePhase2FieldChange('customer_address', e.target.value)}
                        placeholder="Enter complete address"
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Income Details */}
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                    <h3 className="font-medium text-white flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-orange-400" />
                      Income Details
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-white/70 mb-1.5">Annual Income</label>
                      <input
                        type="number"
                        value={String(phase2Data.annual_income || '')}
                        onChange={(e) => handlePhase2FieldChange('annual_income', Number(e.target.value))}
                        placeholder="Enter annual income"
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1.5">Other Income</label>
                      <input
                        type="number"
                        value={String(phase2Data.other_income || '')}
                        onChange={(e) => handlePhase2FieldChange('other_income', Number(e.target.value))}
                        placeholder="Enter other income (if any)"
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1.5">Income Proof Type</label>
                      <select
                        value={String(phase2Data.income_proof_type || '')}
                        onChange={(e) => handlePhase2FieldChange('income_proof_type', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        <option value="">Select Proof Type</option>
                        <option value="SALARY_SLIP">Salary Slip</option>
                        <option value="BANK_STATEMENT">Bank Statement</option>
                        <option value="ITR">Income Tax Return</option>
                        <option value="FORM_16">Form 16</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1.5">Loan Tenure (Months)</label>
                      <input
                        type="number"
                        value={String(phase2Data.loan_tenure_months || '')}
                        onChange={(e) => handlePhase2FieldChange('loan_tenure_months', Number(e.target.value))}
                        placeholder="Enter preferred tenure"
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Co-Applicant Details */}
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                    <h3 className="font-medium text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-orange-400" />
                      Co-Applicant Details (Optional)
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="has_co_applicant"
                        checked={Boolean(phase2Data.has_co_applicant)}
                        onChange={(e) => handlePhase2FieldChange('has_co_applicant', e.target.checked)}
                        className="w-4 h-4 rounded bg-white/10 border-white/20 text-orange-500 focus:ring-orange-500/50"
                      />
                      <label htmlFor="has_co_applicant" className="text-sm text-white">
                        Add Co-Applicant
                      </label>
                    </div>

                    {phase2Data.has_co_applicant && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-white/70 mb-1.5">Co-Applicant Name</label>
                          <input
                            type="text"
                            value={String(phase2Data.co_applicant_name || '')}
                            onChange={(e) => handlePhase2FieldChange('co_applicant_name', e.target.value)}
                            placeholder="Enter name"
                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-white/70 mb-1.5">Co-Applicant Mobile</label>
                          <input
                            type="tel"
                            value={String(phase2Data.co_applicant_mobile || '')}
                            onChange={(e) => handlePhase2FieldChange('co_applicant_mobile', e.target.value)}
                            placeholder="10-digit mobile"
                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-white/70 mb-1.5">Relationship</label>
                          <select
                            value={String(phase2Data.co_applicant_relationship || '')}
                            onChange={(e) => handlePhase2FieldChange('co_applicant_relationship', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          >
                            <option value="">Select Relationship</option>
                            <option value="SPOUSE">Spouse</option>
                            <option value="PARENT">Parent</option>
                            <option value="SIBLING">Sibling</option>
                            <option value="CHILD">Child</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-white/70 mb-1.5">Co-Applicant Income</label>
                          <input
                            type="number"
                            value={String(phase2Data.co_applicant_income || '')}
                            onChange={(e) => handlePhase2FieldChange('co_applicant_income', Number(e.target.value))}
                            placeholder="Monthly income"
                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-white/10">
                <button
                  onClick={() => submitPhase2(false)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save & Continue Later'}
                </button>
                <button
                  onClick={() => submitPhase2(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Submit Application
                      <Check className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Success */}
          {currentStep === 'success' && submittedLead && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Lead Submitted Successfully!</h2>
              <p className="text-white/60 mb-6">
                Your lead application has been submitted and is now being processed.
              </p>

              <div className="max-w-md mx-auto p-6 rounded-xl bg-white/5 border border-white/10">
                <div className="text-left space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/60">Lead ID:</span>
                    <span className="text-white font-medium">{submittedLead.lead_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Customer:</span>
                    <span className="text-white font-medium">{String(formData.customer_name || '-')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Loan Type:</span>
                    <span className="text-white font-medium">{selectedLoanType?.name || '-'}</span>
                  </div>
                </div>

                {submittedLead.shareable_link && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-sm text-white/60 mb-2">Shareable Link:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={submittedLead.shareable_link}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm"
                      />
                      <button
                        onClick={copyShareableLink}
                        className="p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => {
                    setCurrentStep('category');
                    setSelectedCategory(null);
                    setSelectedLoanType(null);
                    setFormData({});
                    setPhase2Data({});
                    setSubmittedLead(null);
                  }}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                >
                  Submit Another Lead
                </button>
                <a
                  href={`/partners/${partnerType.toLowerCase()}/leads/status`}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
                >
                  View All Leads
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Dynamic Field Component
interface DynamicFieldProps {
  field: BasicLeadField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function DynamicField({ field, value, onChange }: DynamicFieldProps) {
  const baseInputClass = "w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-colors";

  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1.5">
        {field.label}
        {field.validation.required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {field.type === 'text' && (
        <input
          type="text"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={baseInputClass}
        />
      )}

      {field.type === 'email' && (
        <input
          type="email"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={baseInputClass}
        />
      )}

      {field.type === 'phone' && (
        <input
          type="tel"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder={field.placeholder}
          className={baseInputClass}
        />
      )}

      {(field.type === 'number' || field.type === 'currency') && (
        <input
          type="number"
          value={String(value || '')}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={field.placeholder}
          className={baseInputClass}
        />
      )}

      {field.type === 'select' && (
        <select
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        >
          <option value="">{field.placeholder || 'Select...'}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === 'textarea' && (
        <textarea
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={baseInputClass}
        />
      )}

      {field.type === 'date' && (
        <input
          type="date"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        />
      )}

      {field.help_text && (
        <p className="mt-1 text-xs text-white/40">{field.help_text}</p>
      )}
    </div>
  );
}

export default ULAPLeadForm;
