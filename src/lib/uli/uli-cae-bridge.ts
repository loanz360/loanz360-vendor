/**
 * ULI-CAE Bridge — Allows CAE to route API calls through ULI
 *
 * Bridge logic:
 *   CAE needs credit data → Bridge checks if ULI is enabled for that service
 *     → YES: Bridge calls ULI Client → ULI calls RBIH → data returns to CAE
 *     → NO: Returns null (CAE falls back to existing cae_providers)
 *
 * This is NON-BREAKING — existing CAE behavior continues if ULI is disabled.
 */

import { callULIService, type ULICallResult } from './uli-client'
import { getServiceByCode, isServiceEnabled } from './uli-service-registry'

export interface CAEBridgeRequest {
  /** ULI service code (e.g., CIBIL_SCORE, PAN_VERIFY) */
  service_code: string
  /** Request payload for the ULI API */
  payload: Record<string, unknown>
  /** Lead context for logging */
  lead_id?: string
  /** Appraisal context for logging */
  appraisal_id?: string
  /** User who triggered this (for audit) */
  user_id?: string
}

export interface CAEBridgeResult {
  /** Whether ULI handled the request */
  handled: boolean
  /** The response data (null if ULI didn't handle it) */
  data: Record<string, unknown> | null
  /** ULI call details (null if not handled) */
  uli_result: ULICallResult | null
  /** Reason if not handled */
  reason?: string
}

/**
 * Route a CAE data request through ULI if the service is enabled
 * Returns { handled: false } if ULI should not handle this request,
 * allowing CAE to fall back to its existing providers.
 */
export async function bridgeCAEToULI(request: CAEBridgeRequest): Promise<CAEBridgeResult> {
  const { service_code, payload, lead_id, appraisal_id, user_id } = request

  // Check if ULI has this service enabled
  const enabled = await isServiceEnabled(service_code)
  if (!enabled) {
    return {
      handled: false,
      data: null,
      uli_result: null,
      reason: `ULI service ${service_code} is not enabled`,
    }
  }

  // Get the full service config
  const service = await getServiceByCode(service_code)
  if (!service) {
    return {
      handled: false,
      data: null,
      uli_result: null,
      reason: `ULI service ${service_code} not found in registry`,
    }
  }

  // Execute the ULI call
  const result = await callULIService({
    service,
    payload,
    context: {
      lead_id,
      appraisal_id,
      triggered_by_user_id: user_id,
      triggered_by_module: 'CAE_BRIDGE',
    },
  })

  return {
    handled: true,
    data: result.success ? result.data : null,
    uli_result: result,
    reason: result.success ? undefined : result.error,
  }
}

/**
 * Map of CAE check types to ULI service codes
 * Used by CAE to determine which ULI service to call for each check
 */
export const CAE_TO_ULI_SERVICE_MAP: Record<string, string> = {
  // Credit Bureau checks
  cibil_score: 'CIBIL_SCORE',
  experian_score: 'EXPERIAN_SCORE',
  crif_score: 'CRIF_SCORE',
  equifax_score: 'EQUIFAX_SCORE',

  // Identity checks
  pan_verify: 'PAN_VERIFY',
  aadhaar_verify: 'AADHAAR_VERIFY',
  voter_id_verify: 'VOTER_ID_VERIFY',
  passport_verify: 'PASSPORT_VERIFY',
  driving_license_verify: 'DL_VERIFY',

  // Financial checks
  bank_statement: 'BANK_STATEMENT_ANALYSIS',
  itr_pull: 'ITR_PULL',
  form_26as: 'FORM_26AS',
  gst_returns: 'GST_RETURNS',

  // Employment checks
  epfo_verify: 'EPFO_VERIFY',
  employment_verify: 'EMPLOYMENT_VERIFY',

  // Business checks
  mca_roc: 'MCA_ROC_CHECK',
  msme_verify: 'MSME_VERIFY',

  // Property checks
  cersai_check: 'CERSAI_CHECK',
  property_search: 'PROPERTY_SEARCH',

  // Digital signing
  esign: 'AADHAAR_ESIGN',
  estamp: 'ESTAMP',
}
