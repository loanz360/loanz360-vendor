/**
 * Loan Application Module - Main Exports
 * Premium Loan Application System
 */

// Types
export * from './types';

// Constants & Configurations
export * from './constants';

// Loan Type Selector Components
export { LoanTypeSelector } from './LoanTypeSelector';
export { LoanTypeCard } from './LoanTypeSelector/LoanTypeCard';
export { LoanCategorySection } from './LoanTypeSelector/LoanCategorySection';
export { LoanTypeGrid } from './LoanTypeSelector/LoanTypeGrid';

// Form Sections
export {
  PremiumInput,
  PremiumSelect,
  PremiumTextarea,
  PremiumPhoneInput,
  PremiumCurrencyInput,
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
} from './FormSections';

// Form Wizard
export { FormWizard, ProgressIndicator } from './FormWizard';

// Success Screen
export { SuccessScreen } from './SuccessScreen';

// Default export - Main Application Component
import { LoanTypeSelector } from './LoanTypeSelector';
import { FormWizard } from './FormWizard';
import { SuccessScreen } from './SuccessScreen';

export default {
  LoanTypeSelector,
  FormWizard,
  SuccessScreen,
};
