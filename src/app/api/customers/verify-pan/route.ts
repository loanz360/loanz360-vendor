import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { createDigiLockerAdapter, DigiLockerConfig } from '@/lib/cae/adapters/digilocker-adapter'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/verify-pan
 *
 * Verifies PAN card via DigiLocker API (CAE Module Integration).
 * Uses the Credit Appraiser Engine's DigiLocker adapter for verification.
 * Supports both sandbox (development) and production modes.
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

    const bodySchema = z.object({


      pan_number: z.string(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { pan_number } = body

    if (!pan_number) {
      return NextResponse.json(
        { success: false, error: 'PAN number is required' },
        { status: 400 }
      )
    }

    // Validate PAN format using CAE validation pattern
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    const panUpper = pan_number.toUpperCase().replace(/[^A-Z0-9]/g, '')

    if (!panRegex.test(panUpper)) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Invalid PAN format. Expected format: ABCDE1234F'
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

    // Get user's profile to use their name for verification
    const { data: profile } = await supabaseAdmin
      .from('customer_profiles')
      .select('full_name, date_of_birth, father_name')
      .eq('customer_id', user.id)
      .maybeSingle()

    // Determine environment and create DigiLocker adapter
    const isProduction = process.env.NODE_ENV === 'production' && providerConfig?.api_key_encrypted
    const environment = isProduction ? 'production' : 'sandbox'

    const digiLockerConfig: DigiLockerConfig = {
      id: providerConfig?.id || 'digilocker-customer',
      name: 'DigiLocker PAN Verification',
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

    // Verify PAN using DigiLocker adapter
    const verificationResult = await digiLockerAdapter.verifyDocument({
      docType: 'PAN',
      docNumber: panUpper,
      name: profile?.full_name || user.user_metadata?.full_name,
      dateOfBirth: profile?.date_of_birth,
      fatherName: profile?.father_name
    })

    if (verificationResult.verified && verificationResult.data) {
      // Update profile with verified PAN
      const holderName = verificationResult.data.name || profile?.full_name || 'VERIFIED USER'

      await supabaseAdmin
        .from('customer_profiles')
        .update({
          pan_number: panUpper,
          pan_verified: true,
          pan_verified_at: new Date().toISOString(),
          pan_holder_name: holderName.toUpperCase(),
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', user.id)

      // Log verification in CAE audit trail
      await supabaseAdmin.from('cae_verification_logs').insert({
        customer_id: user.id,
        verification_type: 'PAN',
        provider: 'DIGILOCKER',
        document_number_masked: verificationResult.data.maskedNumber,
        status: 'VERIFIED',
        verification_time: verificationResult.verificationTime,
        environment
      }).catch(() => {
        // Silently ignore if table doesn't exist
      })

      return NextResponse.json({
        success: true,
        verified: true,
        holder_name: holderName.toUpperCase(),
        pan_status: 'VALID',
        masked_pan: verificationResult.data.maskedNumber,
        message: environment === 'sandbox' ? '[SANDBOX] PAN verified successfully' : 'PAN verified successfully'
      })
    } else {
      // Verification failed
      return NextResponse.json({
        success: false,
        verified: false,
        error: verificationResult.error?.message || 'PAN verification failed'
      })
    }
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/verify-pan', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
