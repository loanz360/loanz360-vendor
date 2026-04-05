/**
 * ULAP Components - Public Exports
 * Unified Loan Application Platform
 */

// Main Form Component
export { ULAPDynamicForm } from './ULAPDynamicForm';
export { default as ULAPDynamicFormDefault } from './ULAPDynamicForm';

// Form Section Component
export { ULAPFormSection } from './ULAPFormSection';
export { default as ULAPFormSectionDefault } from './ULAPFormSection';

// Field Renderer Component
export { ULAPFieldRenderer } from './ULAPFieldRenderer';
export { default as ULAPFieldRendererDefault } from './ULAPFieldRenderer';

// Lead Submission Wizard (Card-based multi-step form)
export { default as ULAPLeadSubmissionWizard } from './ULAPLeadSubmissionWizard';

// Lead Status Table (Unified CRM leads display)
export { ULAPLeadStatusTable } from './ULAPLeadStatusTable';
export { default as ULAPLeadStatusTableDefault } from './ULAPLeadStatusTable';

// Phase 2 Form Component
export { ULAPPhase2Form } from './ULAPPhase2Form';
export { default as ULAPPhase2FormDefault } from './ULAPPhase2Form';
export type { ULAPPhase2FormProps, ULAPFormField, LeadData } from './ULAPPhase2Form';

// Document Upload Component
export { ULAPDocumentUpload, LOAN_DOCUMENTS } from './ULAPDocumentUpload';
export { default as ULAPDocumentUploadDefault } from './ULAPDocumentUpload';
export type {
  ULAPDocumentUploadProps,
  DocumentTypeConfig,
  DocumentUploadStatus,
} from './ULAPDocumentUpload';

// Shared Card Components - Glassmorphism Design
export {
  ULAPCategoryCard,
  ULAPSubcategoryCard,
  getCategoryIcon,
  getCategoryColor,
  CATEGORY_COLORS,
} from './shared/ULAPCategoryCard';
export type {
  ULAPCategoryCardProps,
  ULAPSubcategoryCardProps,
} from './shared/ULAPCategoryCard';

// Source-specific Form Wrappers
export { BALeadForm } from './variants/BALeadForm';
export { BPLeadForm } from './variants/BPLeadForm';
export { DSELeadForm } from './variants/DSELeadForm';
export { CustomerLeadForm } from './variants/CustomerLeadForm';
export { TelecallerLeadForm } from './variants/TelecallerLeadForm';
export { FieldSalesLeadForm } from './variants/FieldSalesLeadForm';

// Types
export type {
  ULAPFieldType,
  ULAPFieldSection,
  ULAPLeadSource,
  ULAPProfileField,
  ULAPFormData,
  ULAPFormErrors,
  ULAPVerificationStatus,
  ULAPGroupedFields,
  ULAPProfileFieldsResponse,
  ULAPLoanCategory,
  ULAPLoanSubcategory,
  ULAPDynamicFormProps,
  ULAPFieldRendererProps,
  ULAPSectionProps,
  ULAPFormStep,
  ValidationRules,
  SelectOption,
} from './types';

// Constants
export {
  VALIDATION_PATTERNS,
  VALIDATION_MESSAGES,
  SOURCE_CONFIG,
  DEFAULT_FORM_STEPS,
} from './types';
