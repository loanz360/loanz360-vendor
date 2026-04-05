export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Verify OTP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile_number, otp_code, lead_id } = body;

    if (!mobile_number || !otp_code) {
      return NextResponse.json(
        { error: 'Mobile number and OTP code are required' },
        { status: 400 }
      );
    }

    // Find the most recent unexpired, unverified OTP for this mobile
    const { data: otpRecord, error: findError } = await supabase
      .from('ulap_otp_verifications')
      .select('*')
      .eq('mobile_number', mobile_number)
      .eq('is_verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !otpRecord) {
      return NextResponse.json(
        { error: 'No valid OTP found. Please request a new OTP.' },
        { status: 400 }
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return NextResponse.json(
        { error: 'Maximum attempts exceeded. Please request a new OTP.' },
        { status: 400 }
      );
    }

    // Increment attempts
    await supabase
      .from('ulap_otp_verifications')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id);

    // Verify OTP
    if (otpRecord.otp_code !== otp_code) {
      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
      return NextResponse.json(
        {
          error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
          remainingAttempts,
        },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await supabase
      .from('ulap_otp_verifications')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', otpRecord.id);

    // Update lead status if lead_id provided
    if (lead_id || otpRecord.lead_id) {
      const targetLeadId = lead_id || otpRecord.lead_id;

      await supabase
        .from('ulap_leads')
        .update({
          otp_verified: true,
          otp_verified_at: new Date().toISOString(),
          status: 'OTP_VERIFIED',
        })
        .eq('id', targetLeadId);

      // Log activity
      await supabase.from('ulap_lead_activity').insert({
        lead_id: targetLeadId,
        activity_type: 'OTP_VERIFIED',
        activity_data: { mobile_number },
      });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    apiLogger.error('Error in verify OTP API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
