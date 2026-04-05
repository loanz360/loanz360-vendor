/**
 * ULI Services — Barrel Export
 * All 10 service categories re-exported from one place
 */

// Identity & KYC
export * from './identity-kyc'

// Credit Bureau
export * from './credit-bureau'

// GST & Compliance
export * from './gst-compliance'

// Employment & Income
export * from './employment-income'

// Service Registry (feature flag checks)
export { getEnabledULIService, isULIServiceEnabled, isULICategoryEnabled, invalidateServiceCache } from './service-registry'
