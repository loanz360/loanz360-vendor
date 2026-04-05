/**
 * External API Integrations Index
 *
 * All integration services are designed as infrastructure-ready stubs.
 * They return structured responses and are ready to connect to actual
 * API providers when credentials are configured.
 *
 * Integration Status:
 * ✅ OTP/2FA         — DB + verification logic ready, needs SMS provider (Twilio/MSG91)
 * ✅ WhatsApp        — Template system ready, needs Meta Business API credentials
 * ✅ Credit Bureau   — Interface ready, needs ULI Hub or direct CIBIL/Experian API
 * ✅ eSign/eStamp    — Interface ready, needs Digio/Setu API credentials
 * ✅ eNACH/AutoPay   — Interface ready, needs Razorpay/Cashfree API credentials
 * ✅ Document OCR    — Interface ready, needs Google Vision/AWS Textract API
 *
 * To activate any integration:
 * 1. Configure API credentials in Supabase project settings (env vars)
 * 2. Uncomment the actual API call in the respective service file
 * 3. Test in sandbox/staging before production
 */

export { sendOTP, verifyOTP } from './otp-service'
export type { OTPPurpose } from './otp-service'

export { sendWhatsAppMessage, sendEMIReminder, sendApplicationUpdate } from './whatsapp-service'
export type { WhatsAppTemplate } from './whatsapp-service'

export { fetchCreditScore, fetchCreditReport, getScoreGrade } from './credit-bureau-service'
export type { CreditBureau, CreditScore } from './credit-bureau-service'

export { createESignRequest, checkESignStatus, createEStamp } from './esign-service'
export type { SignatureType } from './esign-service'

export { createMandate, checkMandateStatus, cancelMandate } from './enach-service'
export type { MandateType } from './enach-service'

export { extractDocumentData, validatePAN, validateAadhaar, maskExtractedField } from './ocr-service'
export type { DocumentType, OCRResult } from './ocr-service'
