/**
 * ULI Service: Employment & Income
 * Services: ITR Pull, Form 26AS, EPFO Balance, Employment Verify, Salary Verify
 * RBIH ULI API Paths: /v1/income/*
 */

import { callULIService, type ULICallResult } from '../uli-client'
import { getEnabledULIService } from './service-registry'

// ─── ITR PULL ────────────────────────────────────────────────────────────────

export interface ITRPullRequest {
  pan: string
  assessment_years: string[]  // e.g., ['2023-24', '2022-23']
  consent: 'Y'
}

export interface ITRData {
  assessment_year: string
  itr_type: string
  filing_date: string
  gross_total_income: number
  total_income: number
  total_tax_payable: number
  refund_amount: number
  source_of_income: {
    salary?: number
    business?: number
    capital_gains?: number
    other_sources?: number
    house_property?: number
  }
}

export interface ITRPullResponse {
  pan: string
  name: string
  itr_records: ITRData[]
  avg_annual_income: number
  income_trend: 'GROWING' | 'STABLE' | 'DECLINING'
}

export async function fetchITRData(
  request: ITRPullRequest,
  context?: { lead_id?: string; appraisal_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: ITRPullResponse }> {
  const service = await getEnabledULIService('ITR_PULL')
  const result = await callULIService({
    service,
    payload: {
      pan: request.pan.toUpperCase(),
      assessment_years: request.assessment_years,
      consent: 'Y',
    },
    context: { ...context, triggered_by_module: 'employment-income' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as ITRPullResponse }
  }
  return result
}

// ─── FORM 26AS ────────────────────────────────────────────────────────────────

export interface Form26ASRequest {
  pan: string
  assessment_year: string // e.g., '2023-24'
  consent: 'Y'
}

export interface Form26ASEntry {
  deductor_name: string
  deductor_tan: string
  gross_amount: number
  tds_deposited: number
}

export interface Form26ASResponse {
  pan: string
  assessment_year: string
  total_tds: number
  total_income_declared: number
  entries: Form26ASEntry[]
}

export async function fetchForm26AS(
  request: Form26ASRequest,
  context?: { lead_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: Form26ASResponse }> {
  const service = await getEnabledULIService('FORM_26AS')
  const result = await callULIService({
    service,
    payload: {
      pan: request.pan.toUpperCase(),
      assessment_year: request.assessment_year,
      consent: 'Y',
    },
    context: { ...context, triggered_by_module: 'employment-income' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as Form26ASResponse }
  }
  return result
}

// ─── EPFO BALANCE ─────────────────────────────────────────────────────────────

export interface EPFORequest {
  uan: string
  mobile: string
  consent: 'Y'
}

export interface EPFOResponse {
  uan: string
  member_name: string
  current_employer: string
  date_of_joining: string
  pf_balance: number
  pension_balance: number
  total_pf_balance: number
  monthly_contribution: number
  years_of_service: number
}

export async function fetchEPFOBalance(
  request: EPFORequest,
  context?: { lead_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: EPFOResponse }> {
  const service = await getEnabledULIService('EPFO_BALANCE')
  const result = await callULIService({
    service,
    payload: {
      uan: request.uan,
      mobile: request.mobile,
      consent: 'Y',
    },
    context: { ...context, triggered_by_module: 'employment-income' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as EPFOResponse }
  }
  return result
}
