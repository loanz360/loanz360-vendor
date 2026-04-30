
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { createDigiLockerAdapter, DigiLockerConfig } from '@/lib/cae/adapters/digilocker-adapter'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/verify-aadhaar
 *
 * Verifies Aadhaar via DigiLocker e-KYC API (CAE Module Integration).
 * Uses the Credit Appraiser Engine's DigiLocker adapter for verification.
 *
 * Flow:
 * - Without OTP: Initiates e-KYC and sends OTP (Step 1)
 * - With OTP: Completes e-KYC verification (Step 2)
 * - In sandbox mode: Skips OTP and verifies directly
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { aadhaar_number, otp, txn_id } = body

    if (!aadhaar_number) {
      return NextResponse.json(
        { success: false, error: 'Aadhaar number is required' },
        { status: 400 }
      )
    }

    // Validate Aadhaar format (12 digits) using CAE validation pattern
    const aadhaarClean = aadhaar_number.replace(/[^0-9]/g, '')
    if (!/^\d{12}$/.test(aadhaarClean)) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Invalid Aadhaar format. Expected 12 digits.'
      })
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Fetch DigiLocker provider configuration from CAE
    const { data: providerConfig } = await supabaseAdmin
      .from('cae_providers')
      .select('*')
      .eq('provider_code', 'DIGILOCKER')
      .eq('is_active', true)
      .maybeSingle()

    // Get user's profile
    const { data: profile } = await supabaseAdmin
      .from('customer_profiles')
      .select('full_name')
      .eq('customer_id', user.id)
      .maybeSingle()

    // Determine environment and create DigiLocker adapter
    const isProduction = process.env.NODE_ENV === 'production' && providerConfig?.api_key_encrypted
    const environment = isProduction ? 'production' : 'sandbox'

    const digiLockerConfig: DigiLockerConfig = {
      id: providerConfig?.id || 'digilocker-customer',
      name: 'DigiLocker Aadhaar e-KYC',
      provider_type: 'INTERNAL',
      is_active: true,
      priority: 1,
      timeout_ms: providerConfig?.timeout_ms || 30000,
      retry_count: providerConfig?.retry_count || 3,
      api_key: providerConfig?.api_key_encrypted || '',
      config: {
        client_id: providerConfig?.config_json?.client_id || process.env.DIGILOCKER_CLIENT_ID || '',
        client_secret: providerConfig?.config_json?.client_secret || process.env.DIGILOCKER_CLIENT_SECRET || '',
        redirect_uri: providerConfig?.config_json?.redirect_uri || '',
        environment
      }
    }

    const digiLockerAdapter = createDigiLockerAdapter(digiLockerConfig)

    // In sandbox mode, skip OTP and verify directly
    if (environment === 'sandbox') {
      const ekycResult = await digiLockerAdapter.performEKYC(aadhaarClean)

      if (ekycResult.verified && ekycResult.data) {
        const holderName = ekycResult.data.name || profile?.full_name || 'VERIFIED USER'

        // Update profile with verified Aadhaar
        await supabaseAdmin
          .from('customer_profiles')
          .update({
            aadhaar_number: aadhaarClean,
            aadhaar_verified: true,
            aadhaar_verified_at: new Date().toISOString(),
            aadhaar_holder_name: holderName.toUpperCase(),
            // Optionally store address from Aadhaar
            ...(ekycResult.data.address && {
              aadhaar_address: `${ekycResult.data.address.house || ''} ${ekycResult.data.address.street || ''}, ${ekycResult.data.address.locality || ''}, ${ekycResult.data.address.district || ''}, ${ekycResult.data.address.state || ''} - ${ekycResult.data.address.pincode || ''}`.trim()
            }),
            updated_at: new Date().toISOString()
          })
          .eq('customer_id', user.id)

        // Log verification in CAE audit trail
        await supabaseAdmin.from('cae_verification_logs').insert({
          customer_id: user.id,
          verification_type: 'AADHAAR',
          provider: 'DIGILOCKER',
          document_number_masked: ekycResult.data.maskedAadhar,
          status: 'VERIFIED',
          verification_time: new Date().toISOString(),
          environment
        }).catch(() => {
          // Silently ignore if table doesn't exist
        })

        return NextResponse.json({
          success: true,
          verified: true,
          holder_name: holderName.toUpperCase(),
          masked_aadhaar: ekycResult.data.maskedAadhar,
          message: '[SANDBOX] Aadhaar verified successfully via e-KYC'
        })
      } else {
        return NextResponse.json({
          success: false,
          verified: false,
          error: ekycResult.error?.message || 'Aadhaar verification failed'
        })
      }
    }

    // Production mode: OTP-based e-KYC flow
    if (!otp || !txn_id) {
      // Step 1: Initiate OTP
      const otpResult = await digiLockerAdapter.initiateEKYCOTP(aadhaarClean)

      if (otpResult.success && otpResult.txnId) {
        return NextResponse.json({
          success: true,
          verified: false,
          txn_id: otpResult.txnId,
          message: 'OTP sent to Aadhaar-registered mobile number'
        })
      } else {
        return NextResponse.json({
          success: false,
          verified: false,
          error: otpResult.error || 'Failed to send OTP'
        })
      }
    } else {
      // Step 2: Verify OTP and complete e-KYC
      const ekycResult = await digiLockerAdapter.performEKYC(aadhaarClean, otp)

      if (ekycResult.verified && ekycResult.data) {
        const holderName = ekycResult.data.name || profile?.full_name || 'VERIFIED USER'

        // Update profile with verified Aadhaar
        await supabaseAdmin
          .from('customer_profiles')
          .update({
            aadhaar_number: aadhaarClean,
            aadhaar_verified: true,
            aadhaar_verified_at: new Date().toISOString(),
            aadhaar_holder_name: holderName.toUpperCase(),
            ...(ekycResult.data.address && {
              aadhaar_address: `${ekycResult.data.address.house || ''} ${ekycResult.data.address.street || ''}, ${ekycResult.data.address.locality || ''}, ${ekycResult.data.address.district || ''}, ${ekycResult.data.address.state || ''} - ${ekycResult.data.address.pincode || ''}`.trim()
            }),
            updated_at: new Date().toISOString()
          })
          .eq('customer_id', user.id)

        // Log verification in CAE audit trail
        await supabaseAdmin.from('cae_verification_logs').insert({
          customer_id: user.id,
          verification_type: 'AADHAAR',
          provider: 'DIGILOCKER',
          document_number_masked: ekycResult.data.maskedAadhar,
          status: 'VERIFIED',
          verification_time: new Date().toISOString(),
          environment
        }).catch(() => {
          // Silently ignore if table doesn't exist
        })

        return NextResponse.json({
          success: true,
          verified: true,
          holder_name: holderName.toUpperCase(),
          masked_aadhaar: ekycResult.data.maskedAadhar,
          message: 'Aadhaar verified successfully via e-KYC'
        })
      } else {
        return NextResponse.json({
          success: false,
          verified: false,
          error: ekycResult.error?.message || 'OTP verification failed'
        })
      }
    }
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/verify-aadhaar', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
