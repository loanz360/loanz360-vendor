/**
 * ULI Service: GST & Compliance
 * Services: GSTN Verify, GST Returns, E-Invoice, E-Way Bill, GST Analytics
 * RBIH ULI API Paths: /v1/gst/*
 */

import { callULIService, type ULICallResult } from '../uli-client'
import { getEnabledULIService } from './service-registry'

// ─── GSTN VERIFICATION ───────────────────────────────────────────────────────

export interface GSTNVerifyRequest {
  gstin: string
}

export interface GSTNVerifyResponse {
  gstin: string
  legal_name: string
  trade_name: string
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'NOT_FOUND'
  registration_date: string
  cancellation_date?: string
  business_type: string
  taxpayer_type: string
  state: string
  pincode: string
  address: string
  primary_business: string
  hsn_codes: string[]
  last_filing_date?: string
}

export async function verifyGSTIN(
  request: GSTNVerifyRequest,
  context?: { lead_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: GSTNVerifyResponse }> {
  const service = await getEnabledULIService('GSTN_VERIFY')
  const result = await callULIService({
    service,
    payload: { gstin: request.gstin.toUpperCase() },
    context: { ...context, triggered_by_module: 'gst-compliance' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as GSTNVerifyResponse }
  }
  return result
}

// ─── GST RETURNS ─────────────────────────────────────────────────────────────

export interface GSTReturnsRequest {
  gstin: string
  from_period: string // MMYYYY
  to_period: string   // MMYYYY
  consent: 'Y'
}

export interface GSTReturnMonth {
  period: string
  return_type: 'GSTR1' | 'GSTR3B' | 'GSTR9'
  filing_status: 'FILED' | 'NOT_FILED' | 'PENDING'
  filing_date?: string
  taxable_turnover: number
  tax_liability: number
  late_fee?: number
}

export interface GSTReturnsResponse {
  gstin: string

  legal_name: string
  total_turnover: number
  avg_monthly_turnover: number
  returns: GSTReturnMonth[]
  compliance_score: number   // 0-100
  pending_returns: number
}

export async function fetchGSTReturns(
  request: GSTReturnsRequest,
  context?: { lead_id?: string; appraisal_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: GSTReturnsResponse }> {
  const service = await getEnabledULIService('GST_RETURNS')
  const result = await callULIService({
    service,
    payload: {
      gstin: request.gstin.toUpperCase(),
      from_period: request.from_period,
      to_period: request.to_period,
      consent: 'Y',
    },
    context: { ...context, triggered_by_module: 'gst-compliance' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as GSTReturnsResponse }
  }
  return result
}
