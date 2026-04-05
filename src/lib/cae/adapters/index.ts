/**
 * CAE Adapters Index
 * Exports all CAE provider adapters
 */

// Base adapter
export { BaseCAEAdapter } from './base-adapter'

// Credit Bureau Adapters
export { MockCAEAdapter } from './mock-adapter'
export { CIBILAdapter } from './cibil-adapter'
export { ExperianAdapter } from './experian-adapter'
export { EquifaxAdapter } from './equifax-adapter'

// Identity Verification Adapters
export {
  DigiLockerAdapter,
  createDigiLockerAdapter,
  type DigiLockerConfig,
  type DigiLockerDocument,
  type DigiLockerDocType,
  type DigiLockerVerificationResult,
  type DigiLockerEKYCResult,
} from './digilocker-adapter'

// Income Verification Adapters
export {
  GSTITRAdapter,
  createGSTITRAdapter,
  type GSTITRConfig,
  type GSTVerificationRequest,
  type GSTVerificationResult,
  type ITRVerificationRequest,
  type ITRVerificationResult,
  type ITRHistoryResult,
} from './gst-itr-adapter'

// Bank Statement Analysis Adapter
export {
  BankStatementAdapter,
  createBankStatementAdapter,
  type BankStatementConfig,
  type BankStatementUploadRequest,
  type BankStatementAnalysisResult,
  type TransactionCategory,
  type SalaryCredit,
  type BounceTransaction,
} from './bank-statement-adapter'

// Account Aggregator Adapter (RBI-mandated)
export {
  AccountAggregatorAdapter,
  createAccountAggregatorAdapter,
  type AccountAggregatorConfig,
  type ConsentRequest,
  type ConsentResponse,
  type DataFetchRequest,
  type DataFetchResponse,
  type FinancialAccount,
  type DepositAccountData,
  type MutualFundData,
  type InsurancePolicyData,
  type ConsentPurpose,
  type FIType,
} from './account-aggregator-adapter'

// Penny Drop / Bank Account Verification Adapter
export {
  PennyDropAdapter,
  createPennyDropAdapter,
  type PennyDropConfig,
  type BankAccountVerificationRequest,
  type BankAccountVerificationResult,
  type BulkVerificationRequest,
  type BulkVerificationResult,
} from './penny-drop-adapter'

// MCA Company Verification Adapter
export {
  MCAAdapter,
  createMCAAdapter,
  type MCAConfig,
  type CompanySearchRequest,
  type DirectorSearchRequest,
  type CompanyDetails,
  type DirectorInfo,
  type ChargeDetails,
  type CompanyVerificationResult,
  type DirectorVerificationResult,
  type UdyamVerificationResult,
  type CompanyType,
  type CompanyStatus,
} from './mca-adapter'

// AML/PEP Screening Adapter
export {
  AMLScreeningAdapter,
  createAMLScreeningAdapter,
  type AMLScreeningConfig,
  type ScreeningRequest,
  type ScreeningResult,
  type MatchedEntity,
  type ScreeningType,
  type RiskLevel,
  type OngoingMonitoringConfig,
  type MonitoringAlert,
} from './aml-screening-adapter'

// CERSAI Collateral Verification Adapter
export {
  CERSAIAdapter,
  createCERSAIAdapter,
  type CERSAIConfig,
  type AssetSearchRequest,
  type CERSAISearchResult,
  type RegisteredCharge,
  type ChargeRegistrationRequest,
  type ChargeRegistrationResult,
  type AssetType,
  type ChargeType,
} from './cersai-adapter'

// Court Records / Litigation Check Adapter
export {
  CourtRecordsAdapter,
  createCourtRecordsAdapter,
  type CourtRecordsConfig,
  type CourtSearchRequest,
  type CourtSearchResult,
  type CourtCase,
  type CaseDetailResult,
  type CaseType,
  type CaseStatus,
  type PartyRole,
} from './court-records-adapter'
