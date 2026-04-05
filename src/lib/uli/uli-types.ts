/**
 * ULI Hub Type Definitions
 * Matches database schema from 20260215000001_uli_hub_system.sql
 */

export type ULIServiceCategory =
  | 'IDENTITY_KYC'
  | 'ACCOUNT_AGGREGATOR'
  | 'CREDIT_BUREAU'
  | 'GST_COMPLIANCE'
  | 'BANK_FINANCIAL'
  | 'PROPERTY_LAND'
  | 'ESIGN_ESTAMP'
  | 'BUSINESS_VERIFICATION'
  | 'EMPLOYMENT_INCOME'
  | 'GEOSPATIAL'

export type ULIHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN'
export type ULIEnvironment = 'SANDBOX' | 'PRODUCTION'

export interface ULIService {
  id: string
  service_code: string
  service_name: string
  service_description: string | null
  category: ULIServiceCategory
  uli_api_path: string | null
  uli_api_method: string
  uli_api_version: string
  request_schema: Record<string, unknown>
  response_schema: Record<string, unknown>
  is_enabled: boolean
  is_sandbox_only: boolean
  requires_consent: boolean
  timeout_ms: number
  retry_count: number
  retry_delay_ms: number
  rate_limit_per_minute: number
  rate_limit_per_day: number
  cost_per_call: number
  total_calls_this_month: number
  total_cost_this_month: number
  avg_response_time_ms: number | null
  success_rate: number
  last_called_at: string | null
  is_healthy: boolean
  last_health_check_at: string | null
  health_status: ULIHealthStatus
  feature_flag_key: string | null
  config_overrides: Record<string, unknown>
  display_order: number
  icon_name: string | null
  created_at: string
  updated_at: string
}

export interface ULIApiLog {
  id: string
  service_id: string | null
  service_code: string
  category: ULIServiceCategory
  lead_id: string | null
  appraisal_id: string | null
  triggered_by_user_id: string | null
  triggered_by_module: string | null
  request_id: string | null
  environment: ULIEnvironment
  request_url: string | null
  request_method: string | null
  request_headers: Record<string, unknown>
  request_payload: Record<string, unknown>
  request_timestamp: string
  response_payload: Record<string, unknown>
  response_timestamp: string | null
  response_time_ms: number | null
  http_status_code: number | null
  is_success: boolean
  error_code: string | null
  error_message: string | null
  cost: number
  created_at: string
}

export interface ULIEnvironmentConfig {
  id: string
  active_environment: ULIEnvironment
  sandbox_base_url: string
  sandbox_client_id: string | null
  sandbox_client_secret_encrypted: string | null
  sandbox_jwt_token: string | null
  sandbox_jwt_expires_at: string | null
  production_base_url: string
  production_client_id: string | null
  production_client_secret_encrypted: string | null
  production_jwt_token: string | null
  production_jwt_expires_at: string | null
  default_timeout_ms: number
  default_retry_count: number
  enable_request_logging: boolean
  enable_cost_tracking: boolean
  monthly_budget_limit: number
  alert_threshold_percentage: number
  updated_at: string
}

/** Category display metadata */
export const ULI_CATEGORY_META: Record<ULIServiceCategory, { label: string; description: string; featureFlagKey: string }> = {
  IDENTITY_KYC: { label: 'Identity & KYC', description: 'PAN, Aadhaar, Face Match, DigiLocker, Voter ID, Passport, DL', featureFlagKey: 'uli-identity-kyc' },
  ACCOUNT_AGGREGATOR: { label: 'Account Aggregator', description: 'Consent-based financial data from banks', featureFlagKey: 'uli-account-aggregator' },
  CREDIT_BUREAU: { label: 'Credit Bureau', description: 'CIBIL, Experian, CRIF, Equifax score and report', featureFlagKey: 'uli-credit-bureau' },
  GST_COMPLIANCE: { label: 'GST & Compliance', description: 'GSTN Verification, GST Returns, E-Invoice', featureFlagKey: 'uli-gst-compliance' },
  BANK_FINANCIAL: { label: 'Bank & Financial', description: 'Bank Statement Analysis, NACH, UPI Verify', featureFlagKey: 'uli-bank-financial' },
  PROPERTY_LAND: { label: 'Property & Land', description: 'Land Records, Property Search, Encumbrance', featureFlagKey: 'uli-property-land' },
  ESIGN_ESTAMP: { label: 'eSign & eStamp', description: 'Aadhaar eSign, eStamp, Digital Agreements', featureFlagKey: 'uli-esign-estamp' },
  BUSINESS_VERIFICATION: { label: 'Business Verification', description: 'MCA/ROC, MSME, Shop & Establishment', featureFlagKey: 'uli-business-verification' },
  EMPLOYMENT_INCOME: { label: 'Employment & Income', description: 'ITR Pull, Form 26AS, Employment Verify', featureFlagKey: 'uli-employment-income' },
  GEOSPATIAL: { label: 'Geospatial (ISRO)', description: 'Satellite imagery, crop and property assessment', featureFlagKey: 'uli-geospatial' },
}
