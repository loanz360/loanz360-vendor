/**
 * eSign & eStamp Integration Service
 * Digital agreement signing for loan documents
 *
 * Providers: Digio, Setu, Leegality
 * TODO: Configure provider API credentials in Supabase env
 */

export type SignatureType = 'AADHAAR_ESIGN' | 'DSC' | 'ELECTRONIC'

export interface ESignRequest {
  documentUrl: string
  signerName: string
  signerEmail: string
  signerMobile: string
  signatureType: SignatureType
  signPositions: Array<{ page: number; x: number; y: number }>
  callbackUrl: string
}

export interface ESignResult {
  success: boolean
  requestId?: string
  signingUrl?: string
  error?: string
}

/**
 * Create eSign request for a document
 * TODO: Connect to Digio/Setu API
 */
export async function createESignRequest(request: ESignRequest): Promise<ESignResult> {
  // TODO: Replace with actual eSign provider API call
  return {
    success: false,
    error: 'eSign integration pending. Configure Digio/Setu API credentials to enable.',
  }
}

/**
 * Check eSign status
 */
export async function checkESignStatus(requestId: string): Promise<{
  success: boolean
  status: 'pending' | 'signed' | 'rejected' | 'expired'
  signedDocumentUrl?: string
}> {
  return {
    success: false,
    status: 'pending',
  }
}

/**
 * Create eStamp for a document
 */
export async function createEStamp(
  documentUrl: string,
  stampDuty: number,
  state: string
): Promise<{ success: boolean; stampCertificateId?: string; error?: string }> {
  return {
    success: false,
    error: 'eStamp integration pending. Configure provider API to enable.',
  }
}
