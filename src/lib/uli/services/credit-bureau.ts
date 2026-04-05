/**
 * ULI Service: Credit Bureau
 * Services: CIBIL Score, Experian, CRIF, Equifax
 * RBIH ULI API Paths: /v1/credit-bureau/*
 */

import { callULIService, type ULICallResult } from '../uli-client'
import { getEnabledULIService } from './service-registry'

export interface CreditBureauRequest {
  pan: string
  name: string
  dob: string        // YYYY-MM-DD
  mobile?: string
  consent: 'Y'
}

export interface CreditAccount {
  account_type: string
  bank_name: string
  account_status: string
  opened_date: string
  credit_limit?: number
  outstanding_balance: number
  overdue_amount: number
  emi_amount?: number
  dpd_history: number[]  // Days Past Due last 24 months
}

export interface CreditBureauReport {
  bureau: 'CIBIL' | 'EXPERIAN' | 'CRIF' | 'EQUIFAX'
  score: number         // 300-900
  score_band: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NO_HISTORY'
  report_date: string
  name: string
  pan: string
  dob: string
  total_accounts: number
  active_accounts: number
  closed_accounts: number
  overdue_accounts: number
  total_outstanding: number
  total_overdue: number
  total_monthly_emi: number
  enquiries_last_30_days: number
  enquiries_last_12_months: number
  accounts: CreditAccount[]
  flags: string[]       // e.g., 'WRITTEN_OFF', 'SETTLEMENT', 'BANKRUPTCY'
}

// ─── CIBIL ───────────────────────────────────────────────────────────────────

export async function fetchCIBILReport(
  request: CreditBureauRequest,
  context?: { lead_id?: string; appraisal_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: CreditBureauReport }> {
  const service = await getEnabledULIService('CIBIL_SCORE')
  const result = await callULIService({
    service,
    payload: {
      pan: request.pan.toUpperCase(),
      name: request.name,
      dob: request.dob,
      mobile: request.mobile,
      consent: 'Y',
      bureau: 'CIBIL',
    },
    context: { ...context, triggered_by_module: 'credit-bureau' },
  })
  if (result.success) {
    return { ...result, parsed: normalizeBureauResponse(result.data, 'CIBIL') }
  }
  return result
}

// ─── EXPERIAN ─────────────────────────────────────────────────────────────────

export async function fetchExperianReport(
  request: CreditBureauRequest,
  context?: { lead_id?: string; appraisal_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: CreditBureauReport }> {
  const service = await getEnabledULIService('EXPERIAN_SCORE')
  const result = await callULIService({
    service,
    payload: {
      pan: request.pan.toUpperCase(),
      name: request.name,
      dob: request.dob,
      mobile: request.mobile,
      consent: 'Y',
      bureau: 'EXPERIAN',
    },
    context: { ...context, triggered_by_module: 'credit-bureau' },
  })
  if (result.success) {
    return { ...result, parsed: normalizeBureauResponse(result.data, 'EXPERIAN') }
  }
  return result
}

// ─── SCORE BAND HELPER ────────────────────────────────────────────────────────

export function getScoreBand(score: number): CreditBureauReport['score_band'] {
  if (score >= 750) return 'EXCELLENT'
  if (score >= 700) return 'GOOD'
  if (score >= 650) return 'FAIR'
  if (score >= 300) return 'POOR'
  return 'NO_HISTORY'
}

// ─── RESPONSE NORMALIZER ─────────────────────────────────────────────────────

function normalizeBureauResponse(
  data: Record<string, unknown>,
  bureau: CreditBureauReport['bureau']
): CreditBureauReport {
  const score = Number(data.score || data.credit_score || 0)
  return {
    bureau,
    score,
    score_band: getScoreBand(score),
    report_date: String(data.report_date || data.generated_at || new Date().toISOString()),
    name: String(data.name || ''),
    pan: String(data.pan || ''),
    dob: String(data.dob || ''),
    total_accounts: Number(data.total_accounts || 0),
    active_accounts: Number(data.active_accounts || 0),
    closed_accounts: Number(data.closed_accounts || 0),
    overdue_accounts: Number(data.overdue_accounts || 0),
    total_outstanding: Number(data.total_outstanding || 0),
    total_overdue: Number(data.total_overdue || 0),
    total_monthly_emi: Number(data.total_monthly_emi || data.total_emi || 0),
    enquiries_last_30_days: Number(data.enquiries_30_days || 0),
    enquiries_last_12_months: Number(data.enquiries_12_months || 0),
    accounts: Array.isArray(data.accounts) ? data.accounts as CreditAccount[] : [],
    flags: Array.isArray(data.flags) ? data.flags as string[] : [],
  }
}
