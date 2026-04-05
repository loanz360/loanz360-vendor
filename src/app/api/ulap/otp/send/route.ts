export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Send OTP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile_number, lead_id, otp_type = 'VERIFICATION' } = body;

    if (!mobile_number) {
      return NextResponse.json({ success: false, error: 'Mobile number is required' }, { status: 400 });
    }

    // Validate mobile number format (Indian 10-digit)
    const mobileRegex = /^[6-9][0-9]{9}$/;
    if (!mobileRegex.test(mobile_number)) {
      return NextResponse.json({ success: false, error: 'Invalid mobile number format' }, { status: 400 });
    }

    // Check rate limiting (max 3 OTPs per 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('ulap_otp_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('mobile_number', mobile_number)
      .gte('created_at', fiveMinutesAgo);

    if (count && count >= 3) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again in 5 minutes.' },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

    // Store OTP in database
    const { error: insertError } = await supabase.from('ulap_otp_verifications').insert({
      lead_id: lead_id || null,
      mobile_number,
      otp_code: otpCode,
      otp_type,
      expires_at: expiresAt,
    });

    if (insertError) {
      apiLogger.error('Error storing OTP', insertError);
      return NextResponse.json({ success: false, error: 'Failed to generate OTP' }, { status: 500 });
    }

    // Send OTP via SMS using the unified SMS service
    let smsSent = false;
    let smsError: string | undefined;

    try {
      const { smsService } = await import('@/lib/communication/unified-sms-service');

      const result = await smsService.sendOTP({
        phone: mobile_number,
        otp: otpCode,
        validity: 10, // 10 minutes
        templateCode: 'ULAP_OTP_VERIFICATION', // Use ULAP-specific template or fallback
      });

      smsSent = result.success;
      if (!result.success) {
        smsError = result.error || result.description;
      }
    } catch (smsErr) {
      apiLogger.error('SMS service error', smsErr);
      smsError = smsErr instanceof Error ? smsErr.message : 'SMS service unavailable';
      // Don't fail the API - OTP is stored, SMS just didn't send
    }

    // Log activity if lead_id provided
    if (lead_id) {
      await supabase.from('ulap_lead_activity').insert({
        lead_id,
        activity_type: 'OTP_SENT',
        activity_data: {
          mobile_number,
          otp_type,
          sms_sent: smsSent,
          sms_error: smsError,
        },
      });
    }

    // In development mode, return OTP for testing even if SMS fails
    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json({
      success: true,
      message: smsSent ? 'OTP sent successfully' : 'OTP generated (SMS delivery pending)',
      expiresAt,
      smsSent,
      // Only return OTP in development for testing
      ...(isDev && { otp: otpCode }),
      // Include SMS error in dev mode for debugging
      ...(isDev && smsError && { smsDebug: smsError }),
    });
  } catch (error) {
    apiLogger.error('Error in send OTP API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
