/**
 * Form Sections - Module Exports
 * All form section components for loan application wizard
 */

// Premium Input Components
export {
  PremiumInput,
  PremiumSelect,
  PremiumTextarea,
  PremiumPhoneInput,
  PremiumCurrencyInput,
} from './PremiumInput';

// Common Form Sections
export { CustomerDetailsSection } from './CustomerDetailsSection';
export { EmploymentDetailsSection } from './EmploymentDetailsSection';
export { LoanRequirementsSection } from './LoanRequirementsSection';
export { ExistingLoansSection } from './ExistingLoansSection';
export { CoApplicantSection } from './CoApplicantSection';
export { default as CoApplicantConsentSection } from './CoApplicantConsentSection';
export { DocumentUploadSection } from './DocumentUploadSection';

// Loan-Specific Form Sections
export { PropertyDetailsSection } from './PropertyDetailsSection';
export { VehicleDetailsSection } from './VehicleDetailsSection';
export { EducationLoanSection } from './EducationLoanSection';
export { GoldLoanSection } from './GoldLoanSection';
export { BusinessLoanSection } from './BusinessLoanSection';

// Default export for lazy loading
export default {
  // Common Sections
  CustomerDetailsSection: () => import('./CustomerDetailsSection'),
  EmploymentDetailsSection: () => import('./EmploymentDetailsSection'),
  LoanRequirementsSection: () => import('./LoanRequirementsSection'),
  ExistingLoansSection: () => import('./ExistingLoansSection'),
  CoApplicantSection: () => import('./CoApplicantSection'),
  CoApplicantConsentSection: () => import('./CoApplicantConsentSection'),
  DocumentUploadSection: () => import('./DocumentUploadSection'),
  // Loan-Specific Sections
  PropertyDetailsSection: () => import('./PropertyDetailsSection'),
  VehicleDetailsSection: () => import('./VehicleDetailsSection'),
  EducationLoanSection: () => import('./EducationLoanSection'),
  GoldLoanSection: () => import('./GoldLoanSection'),
  BusinessLoanSection: () => import('./BusinessLoanSection'),
};
