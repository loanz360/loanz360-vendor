/**
 * Credit Appraisal Engine (CAE) Module
 * Main export file for CAE functionality
 *
 * This module provides a comprehensive credit appraisal system with:
 * - Multi-provider credit bureau integration (CIBIL, Experian, Equifax)
 * - Identity verification (DigiLocker, Aadhar e-KYC)
 * - Income verification (GST, ITR)
 * - Document OCR and processing
 * - Configurable business rules engine
 * - Data validation and sanitization
 * - Security and encryption utilities
 */

// Types
export * from './types'

// Credit Bureau Adapters
export * from './adapters'

// Core Services
export { CAEService, caeService } from './cae-service'
export { createCAMService, type CreditAppraisalMemo } from './cam-service'

// CAM Export Service
export {
  CAMExportService,
  createCAMExportService,
  type CAMExportData,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
} from './cam-export-service'

// Verification Orchestration Service
export {
  VerificationService,
  verificationService,
  createVerificationService,
  type VerificationType,
  type VerificationStatus,
  type VerificationRequest,
  type VerificationResult,
  type ComprehensiveVerificationResult,
  type ApplicantDetails,
  type LoanDetails as VerificationLoanDetails,
  type RiskFlag as VerificationRiskFlag,
} from './verification-service'

// Rules Engine
export {
  RulesEngine,
  createRulesEngine,
  RULE_TEMPLATES,
  type BusinessRule,
  type RuleCondition,
  type RuleActionConfig,
  type RulesEngineResult,
  type RuleContext,
  type RuleType,
  type RuleOperator,
  type RuleAction,
} from './rules-engine'

// OCR Service
export {
  OCRService,
  createOCRService,
  type OCRConfig,
  type OCRProvider,
  type DocumentInput,
  type OCRResult,
  type ExtractedField,
  type DocumentVerificationResult,
  type DocumentCategory,
} from './ocr-service'

// Validation Engine
export {
  ValidationEngine,
  createValidationEngine,
  type ValidationRule,
  type ValidationResult,
  type ValidationError,
  type ValidationType,
  type FieldType,
  type SanitizationOptions,
} from './validation-engine'

// Security Utilities
export {
  encrypt,
  decrypt,
  hash,
  generateSecureToken,
  mask,
  maskSensitiveData,
  sanitize,
  sanitizeUrl,
  isIPAllowed,
  SecureKeyStore,
  secureKeyStore,
  RateLimiter,
  AuditLogger,
  auditLogger,
  type AuditLogEntry,
} from './security'

// Document Intelligence
export { createDocumentIntelligenceService } from './document-intelligence'

// ============================================================================
// Universal CAM System (New)
// ============================================================================
// Universal CAM Generator with 9-section structure and lender matching
export {
  // Main Generator
  UniversalCAMGenerator,
  createUniversalCAMGenerator,
  // Individual Modules
  ApplicantProfileModule,
  applicantProfileModule,
  EmploymentIncomeModule,
  employmentIncomeModule,
  CreditAnalysisModule,
  creditAnalysisModule,
  FinancialAnalysisModule,
  financialAnalysisModule,
  RiskAssessmentModule,
  riskAssessmentModule,
  EligibilityCalculatorModule,
  eligibilityCalculatorModule,
  LenderMatcherModule,
  lenderMatcherModule,
  // Types
  type UniversalCAM,
  type CAMGenerationInput,
  type CAMGenerationResult,
  type ApplicantProfile,
  type EmploymentIncome,
  type CreditAnalysis,
  type FinancialAnalysis,
  type RiskAssessment,
  type RiskComponent,
  type RiskFlag,
  type EligibilityCalculation,
  type LenderRecommendation,
  type DocumentStatus,
  type FinalAssessment,
  type Address,
  type SalariedDetails,
  type BusinessDetails,
  type ExistingLoan,
  type DocumentItem,
  type PendingAction,
} from './universal-cam'

// Auto-Assignment Engine
export {
  AutoAssignmentEngine,
  createAutoAssignmentEngine,
} from './auto-assignment-engine'
