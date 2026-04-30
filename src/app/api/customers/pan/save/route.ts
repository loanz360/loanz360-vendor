
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCreditBureauData } from '@/lib/credit-bureau/credit-bureau-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/pan/save
 * Save PAN number to customer profile and trigger credit bureau fetch
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { pan_number } = body

    if (!pan_number) {
      return NextResponse.json(
        { success: false, error: 'PAN number is required' },
        { status: 400 }
      )
    }

    // Validate PAN format: 5 letters + 4 digits + 1 letter
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    const normalizedPan = pan_number.toUpperCase().trim()

    if (!panRegex.test(normalizedPan)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PAN format. Expected: ABCDE1234F' },
        { status: 400 }
      )
    }

    // Check if customer profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('customer_profiles')
      .select('customer_id, pan_number')
      .eq('customer_id', user.id)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      apiLogger.error('Error checking customer profile', checkError)
      return NextResponse.json(
        { success: false, error: 'Failed to check customer profile' },
        { status: 500 }
      )
    }

    // Update or insert PAN number
    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('customer_profiles')
        .update({
          pan_number: normalizedPan,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', user.id)

      if (updateError) {
        apiLogger.error('Error updating PAN number', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to save PAN number' },
          { status: 500 }
        )
      }
    } else {
      // Create new profile with PAN
      const { error: insertError } = await supabase
        .from('customer_profiles')
        .insert({
          customer_id: user.id,
          pan_number: normalizedPan
        })

      if (insertError) {
        apiLogger.error('Error inserting PAN number', insertError)
        return NextResponse.json(
          { success: false, error: 'Failed to save PAN number' },
          { status: 500 }
        )
      }
    }

    // Trigger credit bureau fetch in background (non-blocking)
    let bureauFetchTriggered = false
    try {
      // Use the PAN number directly to fetch credit bureau data
      const fetchResult = await fetchCreditBureauData(
        user.id,
        'PAN_UPLOAD',
        false,
        normalizedPan
      )

      bureauFetchTriggered = fetchResult.success

      if (fetchResult.success) {
      } else {
      }
    } catch (fetchError) {
      apiLogger.error('Error triggering credit bureau fetch', fetchError)
      // Don't fail the PAN save if bureau fetch fails
    }

    return NextResponse.json({
      success: true,
      message: 'PAN number saved successfully',
      pan_number: maskPan(normalizedPan),
      credit_bureau_triggered: bureauFetchTriggered
    })
  } catch (error) {
    apiLogger.error('Error saving PAN', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Mask PAN number for display (show first 2 and last 2 characters)
 */
function maskPan(pan: string): string {
  if (!pan || pan.length !== 10) return '**********'
  return pan.slice(0, 2) + '******' + pan.slice(-2)
}
