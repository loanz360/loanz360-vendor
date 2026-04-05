export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { z } from 'zod'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

const vendorProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  mobile_number: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number').optional().or(z.literal('')),
  profile_photo_url: z.string().url().optional().or(z.literal('')).or(z.null()),
  company_name: z.string().min(2).max(200).optional().or(z.literal('')),
  service_type: z.string().max(100).optional().or(z.literal('')),
  gst_number: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/).optional().or(z.literal('')),
  pan_number: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  pincode: z.string().regex(/^[1-9]\d{5}$/).optional().or(z.literal('')),
})


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user (secure server-side validation)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch vendor profile
    const { data: profile, error } = await supabase
      .from('vendor_profiles')
      .select('*')
      .eq('vendor_id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error
      apiLogger.error('Error fetching vendor profile', { error, userId: user.id })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: profile || null,
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/profile', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user (secure server-side validation)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const rawBody = await request.json()
    const parseResult = vendorProfileSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const body = parseResult.data

    // Upsert vendor profile
    const { data, error } = await supabase
      .from('vendor_profiles')
      .upsert(
        {
          vendor_id: user.id,
          full_name: body.full_name,
          email: body.email,
          mobile_number: body.mobile_number,
          profile_photo_url: body.profile_photo_url,
          company_name: body.company_name,
          service_type: body.service_type,
          gst_number: body.gst_number,
          pan_number: body.pan_number,
          address: body.address,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'vendor_id',
        }
      )
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error saving vendor profile', { error, userId: user.id })
      return NextResponse.json(
        { success: false, error: 'Failed to save profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: data,
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/profile', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
