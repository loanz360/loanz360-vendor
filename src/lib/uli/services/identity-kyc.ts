/**
 * ULI Service: Identity & KYC
 * Services: PAN Verify, Aadhaar eKYC, Face Match, DigiLocker, Voter ID, Passport, DL
 * RBIH ULI API Paths: /v1/kyc/*
 */

import { callULIService, type ULICallResult } from '../uli-client'
import { getEnabledULIService } from './service-registry'

// ─── PAN VERIFICATION ────────────────────────────────────────────────────────

export interface PANVerifyRequest {
  pan: string
  name?: string
  dob?: string // YYYY-MM-DD
}

export interface PANVerifyResponse {
  pan: string
  name_on_card: string
  status: 'VALID' | 'INVALID' | 'NOT_FOUND'
  pan_type: 'INDIVIDUAL' | 'COMPANY' | 'HUF' | 'FIRM' | 'AOP' | 'BOI' | 'LOCAL_AUTHORITY' | 'ARTIFICIAL_JURIDICAL_PERSON' | 'TRUST'
  aadhaar_linked: boolean
  name_match_score?: number // 0-100 if name provided
}

export async function verifyPAN(
  request: PANVerifyRequest,
  context?: { lead_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: PANVerifyResponse }> {
  const service = await getEnabledULIService('PAN_VERIFY')
  const result = await callULIService({
    service,
    payload: {
      pan: request.pan.toUpperCase(),
      name: request.name,
      dob: request.dob,
    },
    context: { ...context, triggered_by_module: 'identity-kyc' },
  })

  if (result.success) {
    return { ...result, parsed: result.data as unknown as PANVerifyResponse }
  }
  return result
}

// ─── AADHAAR EKYK ────────────────────────────────────────────────────────────

export interface AadhaarOTPRequest {
  aadhaar_number: string
  consent: 'Y' // Mandatory
}

export interface AadhaarOTPResponse {
  transaction_id: string
  status: 'OTP_SENT' | 'FAILED'
  mobile_hint: string // Last 2 digits of registered mobile
}

export interface AadhaarVerifyOTPRequest {
  transaction_id: string
  otp: string
  consent: 'Y'
}

export interface AadhaarVerifyResponse {
  status: 'SUCCESS' | 'FAILED' | 'OTP_EXPIRED'
  name: string
  dob: string
  gender: 'M' | 'F' | 'T'
  address: {
    house: string
    street: string
    landmark: string
    locality: string
    district: string
    state: string
    pincode: string
    country: string
  }
  photo?: string // Base64
  mobile_verified: boolean
  email_verified: boolean
}

export async function sendAadhaarOTP(
  request: AadhaarOTPRequest,
  context?: { lead_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: AadhaarOTPResponse }> {
  const service = await getEnabledULIService('AADHAAR_OTP')
  const result = await callULIService({
    service,
    payload: { aadhaar_number: request.aadhaar_number, consent: 'Y' },
    context: { ...context, triggered_by_module: 'identity-kyc' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as AadhaarOTPResponse }
  }
  return result
}

export async function verifyAadhaarOTP(
  request: AadhaarVerifyOTPRequest,
  context?: { lead_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: AadhaarVerifyResponse }> {
  const service = await getEnabledULIService('AADHAAR_VERIFY')
  const result = await callULIService({
    service,
    payload: {
      transaction_id: request.transaction_id,
      otp: request.otp,
      consent: 'Y',
    },
    context: { ...context, triggered_by_module: 'identity-kyc' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as AadhaarVerifyResponse }
  }
  return result
}

// ─── DRIVING LICENCE ─────────────────────────────────────────────────────────

export interface DLVerifyRequest {
  dl_number: string
  dob: string // YYYY-MM-DD
}

export interface DLVerifyResponse {
  dl_number: string
  name: string
  dob: string
  valid_from: string
  valid_to: string
  vehicle_classes: string[]
  issuing_authority: string
  status: 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'NOT_FOUND'
}

export async function verifyDrivingLicence(
  request: DLVerifyRequest,
  context?: { lead_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: DLVerifyResponse }> {
  const service = await getEnabledULIService('DL_VERIFY')
  const result = await callULIService({
    service,
    payload: { dl_number: request.dl_number.toUpperCase(), dob: request.dob },
    context: { ...context, triggered_by_module: 'identity-kyc' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as DLVerifyResponse }
  }
  return result
}

// ─── VOTER ID ────────────────────────────────────────────────────────────────

export interface VoterIDVerifyRequest {
  voter_id: string
}

export interface VoterIDVerifyResponse {
  voter_id: string
  name: string
  father_name: string
  dob: string
  gender: 'M' | 'F' | 'O'
  address: string
  constituency: string
  state: string
  status: 'VALID' | 'NOT_FOUND'
}

export async function verifyVoterID(
  request: VoterIDVerifyRequest,
  context?: { lead_id?: string; triggered_by_user_id?: string }
): Promise<ULICallResult & { parsed?: VoterIDVerifyResponse }> {
  const service = await getEnabledULIService('VOTER_ID_VERIFY')
  const result = await callULIService({
    service,
    payload: { voter_id: request.voter_id.toUpperCase() },
    context: { ...context, triggered_by_module: 'identity-kyc' },
  })
  if (result.success) {
    return { ...result, parsed: result.data as unknown as VoterIDVerifyResponse }
  }
  return result
}
