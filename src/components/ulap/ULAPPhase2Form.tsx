'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  CreditCard,
  Home,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Save,
  Send,
  Loader2,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';

// Types
export interface ULAPFormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  field_section: string;
  field_tab: number;
  placeholder?: string;
  help_text?: string;
  default_value?: string;
  is_required: boolean;
  is_required_for_phase: number;
  validation_rules?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    patternMessage?: string;
  };
  options?: Array<{ value: string; label: string; description?: string }>;
  depends_on?: string;
  depends_value?: string;
  display_order: number;
  css_class?: string;
}

export interface LeadData {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_mobile: string;
  customer_email?: string;
  customer_city?: string;
  customer_pincode?: string;
  loan_type?: string;
  loan_category_code?: string;
  loan_subcategory_code?: string;
  form_status: string;
  application_phase: number;
  collected_data?: Record<string, unknown>;
  requires_property_details?: boolean;
}

export interface ULAPPhase2FormProps {
  leadData: LeadData;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onSaveDraft?: (data: Record<string, unknown>) => Promise<void>;
  onBack?: () => void;
  isPublicForm?: boolean;
}

// Tab configuration
const TABS = [
  { id: 1, name: 'Applicant Details', icon: User, section: 'applicant' },
  { id: 2, name: 'Loan Details', icon: CreditCard, section: 'loan' },
  { id: 3, name: 'Property Details', icon: Home, section: 'property' },
  { id: 4, name: 'Present Loans', icon: FileText, section: 'present_loans' },
  { id: 5, name: 'Documents', icon: Upload, section: 'documents' },
];

export function ULAPPhase2Form({
  leadData,
  onSubmit,
  onSaveDraft,
  onBack,
  isPublicForm = false,
}: ULAPPhase2FormProps) {
  const [activeTab, setActiveTab] = useState(1);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [fields, setFields] = useState<ULAPFormField[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedTabs, setCompletedTabs] = useState<Set<number>>(new Set());
  const [showPropertyTab, setShowPropertyTab] = useState(false);

  // Load form fields from API
  useEffect(() => {
    const loadFields = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/ulap/profile-fields?subcategory_code=${leadData.loan_subcategory_code || ''}`);
        const data = await response.json();

        if (data.fields) {
          setFields(data.fields);
        }

        // Check if property tab should be shown
        if (leadData.requires_property_details) {
          setShowPropertyTab(true);
        }

        // Pre-fill form data from lead
        const initialData: Record<string, unknown> = {
          customer_name: leadData.customer_name,
          customer_mobile: leadData.customer_mobile,
          customer_email: leadData.customer_email || '',
          customer_city: leadData.customer_city || '',
          customer_pincode: leadData.customer_pincode || '',
          ...(leadData.collected_data || {}),
        };
        setFormData(initialData);
      } catch (error) {
        console.error('Error loading form fields:', error);
        // Use default fields on error
        setFields(getDefaultFields());
      } finally {
        setIsLoading(false);
      }
    };

    loadFields();
  }, [leadData]);

  // Get fields for current tab
  const getTabFields = useCallback(
    (tabId: number): ULAPFormField[] => {
      return fields
        .filter((field) => field.field_tab === tabId)
        .filter((field) => {
          // Check conditional display
          if (field.depends_on && field.depends_value) {
            const dependentValue = formData[field.depends_on];
            return dependentValue === field.depends_value;
          }
          return true;
        })
        .sort((a, b) => a.display_order - b.display_order);
    },
    [fields, formData]
  );

  // Validate field
  const validateField = (field: ULAPFormField, value: unknown): string | null => {
    const stringValue = String(value || '').trim();

    // Required check
    if (field.is_required && !stringValue) {
      return `${field.field_label} is required`;
    }

    // Skip validation if empty and not required
    if (!stringValue) return null;

    const rules = field.validation_rules;
    if (!rules) return null;

    // Min length
    if (rules.minLength && stringValue.length < rules.minLength) {
      return `${field.field_label} must be at least ${rules.minLength} characters`;
    }

    // Max length
    if (rules.maxLength && stringValue.length > rules.maxLength) {
      return `${field.field_label} must be at most ${rules.maxLength} characters`;
    }

    // Pattern
    if (rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(stringValue)) {
        return rules.patternMessage || `${field.field_label} format is invalid`;
      }
    }

    // Number min/max
    if (field.field_type === 'number' || field.field_type === 'currency') {
      const numValue = parseFloat(stringValue.replace(/[₹,]/g, ''));
      if (!isNaN(numValue)) {
        if (rules.min !== undefined && numValue < rules.min) {
          return `${field.field_label} must be at least ${rules.min}`;
        }
        if (rules.max !== undefined && numValue > rules.max) {
          return `${field.field_label} must be at most ${rules.max}`;
        }
      }
    }

    return null;
  };

  // Validate tab
  const validateTab = (tabId: number): boolean => {
    const tabFields = getTabFields(tabId);
    const newErrors: Record<string, string> = {};
    let isValid = true;

    tabFields.forEach((field) => {
      const error = validateField(field, formData[field.field_name]);
      if (error) {
        newErrors[field.field_name] = error;
        isValid = false;
      }
    });

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return isValid;
  };

  // Handle field change
  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setTouchedFields((prev) => new Set(prev).add(fieldName));

    // Clear error for this field
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Handle field blur
  const handleFieldBlur = (field: ULAPFormField) => {
    const error = validateField(field, formData[field.field_name]);
    if (error) {
      setErrors((prev) => ({ ...prev, [field.field_name]: error }));
    }
  };

  // Navigate to next tab
  const handleNextTab = () => {
    if (validateTab(activeTab)) {
      setCompletedTabs((prev) => new Set(prev).add(activeTab));

      // Skip property tab if not needed
      let nextTab = activeTab + 1;
      if (nextTab === 3 && !showPropertyTab) {
        nextTab = 4;
      }

      if (nextTab <= 5) {
        setActiveTab(nextTab);
      }
    }
  };

  // Navigate to previous tab
  const handlePrevTab = () => {
    let prevTab = activeTab - 1;
    if (prevTab === 3 && !showPropertyTab) {
      prevTab = 2;
    }
    if (prevTab >= 1) {
      setActiveTab(prevTab);
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    setIsSaving(true);
    try {
      await onSaveDraft(formData);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit form
  const handleSubmit = async () => {
    // Validate all tabs
    let allValid = true;
    const tabsToValidate = showPropertyTab ? [1, 2, 3, 4, 5] : [1, 2, 4, 5];

    for (const tabId of tabsToValidate) {
      if (!validateTab(tabId)) {
        allValid = false;
        setActiveTab(tabId);
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
  };

  // Render field based on type
  const renderField = (field: ULAPFormField) => {
    const value = formData[field.field_name] || '';
    const error = errors[field.field_name];
    const isTouched = touchedFields.has(field.field_name);

    const baseInputClass = `w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
      ${error && isTouched ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'}`;

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'pan':
      case 'aadhaar':
      case 'pincode':
        return (
          <input
            type={field.field_type === 'email' ? 'email' : 'text'}
            value={String(value)}
            onChange={(e) => {
              let val = e.target.value;
              if (field.field_type === 'pan') val = val.toUpperCase();
              if (field.field_type === 'aadhaar') val = val.replace(/\D/g, '').slice(0, 12);
              if (field.field_type === 'pincode') val = val.replace(/\D/g, '').slice(0, 6);
              handleFieldChange(field.field_name, val);
            }}
            onBlur={() => handleFieldBlur(field)}
            placeholder={field.placeholder}
            className={baseInputClass}
            maxLength={
              field.field_type === 'pan' ? 10 :
              field.field_type === 'aadhaar' ? 12 :
              field.field_type === 'pincode' ? 6 : undefined
            }
          />
        );

      case 'phone':
        return (
          <div className="flex">
            <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-500">
              +91
            </span>
            <input
              type="tel"
              value={String(value)}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                handleFieldChange(field.field_name, val);
              }}
              onBlur={() => handleFieldBlur(field)}
              placeholder={field.placeholder}
              className={`${baseInputClass} rounded-l-none`}
              maxLength={10}
            />
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={String(value)}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            onBlur={() => handleFieldBlur(field)}
            placeholder={field.placeholder}
            className={baseInputClass}
            min={field.validation_rules?.min}
            max={field.validation_rules?.max}
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
            <input
              type="text"
              value={String(value)}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d]/g, '');
                handleFieldChange(field.field_name, val);
              }}
              onBlur={() => handleFieldBlur(field)}
              placeholder={field.placeholder}
              className={`${baseInputClass} pl-8`}
            />
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={String(value)}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            onBlur={() => handleFieldBlur(field)}
            className={baseInputClass}
          />
        );

      case 'select':
        return (
          <select
            value={String(value)}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            onBlur={() => handleFieldBlur(field)}
            className={baseInputClass}
          >
            <option value="">{field.placeholder || 'Select an option'}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="flex gap-4">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.field_name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        const checkedValues = Array.isArray(value) ? value : [];
        return (
          <div className="grid grid-cols-2 gap-2">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  value={option.value}
                  checked={checkedValues.includes(option.value)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...checkedValues, option.value]
                      : checkedValues.filter((v: string) => v !== option.value);
                    handleFieldChange(field.field_name, newValues);
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'textarea':
        return (
          <textarea
            value={String(value)}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            onBlur={() => handleFieldBlur(field)}
            placeholder={field.placeholder}
            className={`${baseInputClass} min-h-[100px]`}
            rows={3}
          />
        );

      case 'file':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer">
            <input
              type="file"
              id={field.field_name}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFieldChange(field.field_name, file);
              }}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <label htmlFor={field.field_name} className="cursor-pointer">
              {value ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>{(value as File).name || 'File uploaded'}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload className="w-8 h-8" />
                  <span>Click to upload or drag and drop</span>
                  <span className="text-xs">PDF, JPG, PNG (max 5MB)</span>
                </div>
              )}
            </label>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        );
    }
  };

  // Get visible tabs
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === 3 && !showPropertyTab) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Complete Your Application</h2>
        <p className="text-gray-600 mt-1">
          Lead Number: <span className="font-semibold text-blue-600">{leadData.lead_number}</span>
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isCompleted = completedTabs.has(tab.id);
            const isAccessible = index === 0 || completedTabs.has(visibleTabs[index - 1]?.id);

            return (
              <button
                key={tab.id}
                onClick={() => isAccessible && setActiveTab(tab.id)}
                disabled={!isAccessible}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-lg'
                    : isCompleted
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : isAccessible
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {isCompleted && !isActive ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{index + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl shadow-sm border p-6"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            {(() => {
              const currentTab = TABS.find((t) => t.id === activeTab);
              const Icon = currentTab?.icon || User;
              return (
                <>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{currentTab?.name}</h3>
                    <p className="text-sm text-gray-500">
                      {activeTab === 1 && 'Personal, employment, and income details'}
                      {activeTab === 2 && 'Loan amount, tenure, and purpose'}
                      {activeTab === 3 && 'Property details for secured loans'}
                      {activeTab === 4 && 'Existing loans and credit card details'}
                      {activeTab === 5 && 'Upload required documents'}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Fields */}
          <div className="grid gap-6">
            {getTabFields(activeTab).map((field) => (
              <div key={field.id} className={field.css_class || ''}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.field_label}
                  {field.is_required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {renderField(field)}

                {/* Help text */}
                {field.help_text && (
                  <p className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    {field.help_text}
                  </p>
                )}

                {/* Error message */}
                {errors[field.field_name] && touchedFields.has(field.field_name) && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1 text-sm text-red-600 flex items-center gap-1"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors[field.field_name]}
                  </motion.p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-3">
          {activeTab > 1 && (
            <button
              onClick={handlePrevTab}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>
          )}
          {onBack && activeTab === 1 && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {onSaveDraft && (
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Draft
            </button>
          )}

          {activeTab < 5 ? (
            <button
              onClick={handleNextTab}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Submit Application
            </button>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>Application Progress</span>
          <span>{Math.round((completedTabs.size / visibleTabs.length) * 100)}% Complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${(completedTabs.size / visibleTabs.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

// Default fields when API fails
function getDefaultFields(): ULAPFormField[] {
  return [
    // Tab 1: Applicant Details
    { id: '1', field_name: 'customer_name', field_label: 'Full Name (as per PAN)', field_type: 'text', field_section: 'applicant', field_tab: 1, placeholder: 'Enter full name', is_required: true, is_required_for_phase: 1, display_order: 1 },
    { id: '2', field_name: 'customer_mobile', field_label: 'Mobile Number', field_type: 'phone', field_section: 'applicant', field_tab: 1, placeholder: '10-digit mobile', is_required: true, is_required_for_phase: 1, display_order: 2 },
    { id: '3', field_name: 'customer_email', field_label: 'Email Address', field_type: 'email', field_section: 'applicant', field_tab: 1, placeholder: 'your.email@example.com', is_required: false, is_required_for_phase: 2, display_order: 3 },
    { id: '4', field_name: 'customer_pan', field_label: 'PAN Number', field_type: 'pan', field_section: 'applicant', field_tab: 1, placeholder: 'ABCDE1234F', is_required: true, is_required_for_phase: 2, display_order: 4, validation_rules: { pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', patternMessage: 'Enter valid PAN' } },
    { id: '5', field_name: 'customer_dob', field_label: 'Date of Birth', field_type: 'date', field_section: 'applicant', field_tab: 1, is_required: true, is_required_for_phase: 2, display_order: 5 },
    { id: '6', field_name: 'customer_gender', field_label: 'Gender', field_type: 'select', field_section: 'applicant', field_tab: 1, placeholder: 'Select gender', is_required: true, is_required_for_phase: 2, display_order: 6, options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }] },
    { id: '7', field_name: 'customer_address', field_label: 'Current Address', field_type: 'textarea', field_section: 'applicant', field_tab: 1, placeholder: 'Enter address', is_required: true, is_required_for_phase: 2, display_order: 7 },
    { id: '8', field_name: 'customer_city', field_label: 'City', field_type: 'text', field_section: 'applicant', field_tab: 1, placeholder: 'City', is_required: true, is_required_for_phase: 1, display_order: 8 },
    { id: '9', field_name: 'customer_pincode', field_label: 'PIN Code', field_type: 'pincode', field_section: 'applicant', field_tab: 1, placeholder: '6-digit PIN', is_required: true, is_required_for_phase: 1, display_order: 9 },
    { id: '10', field_name: 'employment_type', field_label: 'Employment Type', field_type: 'select', field_section: 'applicant', field_tab: 1, placeholder: 'Select type', is_required: true, is_required_for_phase: 2, display_order: 10, options: [{ value: 'salaried', label: 'Salaried' }, { value: 'self_employed_business', label: 'Self Employed - Business' }, { value: 'self_employed_professional', label: 'Self Employed - Professional' }, { value: 'pensioner', label: 'Pensioner' }] },
    { id: '11', field_name: 'company_name', field_label: 'Company / Business Name', field_type: 'text', field_section: 'applicant', field_tab: 1, placeholder: 'Enter company name', is_required: true, is_required_for_phase: 2, display_order: 11 },
    { id: '12', field_name: 'monthly_income', field_label: 'Monthly Income', field_type: 'currency', field_section: 'applicant', field_tab: 1, placeholder: '₹', is_required: true, is_required_for_phase: 2, display_order: 12, help_text: 'Net monthly salary or business income' },

    // Tab 2: Loan Details
    { id: '20', field_name: 'loan_amount_required', field_label: 'Loan Amount Required', field_type: 'currency', field_section: 'loan', field_tab: 2, placeholder: '₹', is_required: true, is_required_for_phase: 2, display_order: 1, help_text: 'Enter the loan amount you need' },
    { id: '21', field_name: 'loan_tenure_months', field_label: 'Preferred Tenure (Months)', field_type: 'number', field_section: 'loan', field_tab: 2, placeholder: 'Months', is_required: true, is_required_for_phase: 2, display_order: 2 },
    { id: '22', field_name: 'loan_purpose', field_label: 'Purpose of Loan', field_type: 'select', field_section: 'loan', field_tab: 2, placeholder: 'Select purpose', is_required: true, is_required_for_phase: 2, display_order: 3, options: [{ value: 'home_purchase', label: 'Home Purchase' }, { value: 'business_expansion', label: 'Business Expansion' }, { value: 'debt_consolidation', label: 'Debt Consolidation' }, { value: 'personal_use', label: 'Personal Use' }, { value: 'other', label: 'Other' }] },

    // Tab 3: Property Details (conditional)
    { id: '30', field_name: 'property_type', field_label: 'Property Type', field_type: 'select', field_section: 'property', field_tab: 3, placeholder: 'Select type', is_required: true, is_required_for_phase: 2, display_order: 1, options: [{ value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }, { value: 'industrial', label: 'Industrial' }] },
    { id: '31', field_name: 'property_address', field_label: 'Property Address', field_type: 'textarea', field_section: 'property', field_tab: 3, placeholder: 'Complete address', is_required: true, is_required_for_phase: 2, display_order: 2 },
    { id: '32', field_name: 'property_value', field_label: 'Estimated Property Value', field_type: 'currency', field_section: 'property', field_tab: 3, placeholder: '₹', is_required: true, is_required_for_phase: 2, display_order: 3 },

    // Tab 4: Present Loans
    { id: '40', field_name: 'has_existing_loans', field_label: 'Do you have any existing loans?', field_type: 'radio', field_section: 'present_loans', field_tab: 4, is_required: true, is_required_for_phase: 2, display_order: 1, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { id: '41', field_name: 'total_existing_emis', field_label: 'Total Monthly EMI Amount', field_type: 'currency', field_section: 'present_loans', field_tab: 4, placeholder: '₹', is_required: false, is_required_for_phase: 2, display_order: 2, depends_on: 'has_existing_loans', depends_value: 'yes' },

    // Tab 5: Documents
    { id: '50', field_name: 'doc_pan_card', field_label: 'PAN Card', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: true, is_required_for_phase: 2, display_order: 1, help_text: 'Clear copy of PAN card (PDF/JPG, max 5MB)' },
    { id: '51', field_name: 'doc_aadhaar_front', field_label: 'Aadhaar Card (Front)', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: true, is_required_for_phase: 2, display_order: 2 },
    { id: '52', field_name: 'doc_bank_statement', field_label: 'Bank Statement (6 months)', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: true, is_required_for_phase: 2, display_order: 3, help_text: '6 months bank statement with salary credits' },
  ];
}

export default ULAPPhase2Form;
