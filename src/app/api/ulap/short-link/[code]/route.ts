export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Resolve short link and return redirect URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json({ success: false, error: 'Short code is required' }, { status: 400 });
    }

    // Find the short link
    const { data: shortLink, error } = await supabase
      .from('ulap_short_links')
      .select(`
        id,
        lead_id,
        short_code,
        full_url,
        is_active,
        expires_at,
        max_uses,
        use_count
      `)
      .eq('short_code', code)
      .maybeSingle();

    if (error || !shortLink) {
      return NextResponse.json({ success: false, error: 'Link not found' }, { status: 404 });
    }

    // Check if link is active
    if (!shortLink.is_active) {
      return NextResponse.json({ success: false, error: 'This link is no longer active' }, { status: 400 });
    }

    // Check expiry
    if (shortLink.expires_at && new Date(shortLink.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: 'This link has expired' }, { status: 400 });
    }

    // Check max uses
    if (shortLink.max_uses && shortLink.use_count >= shortLink.max_uses) {
      return NextResponse.json({ success: false, error: 'This link has reached its usage limit' }, { status: 400 });
    }

    // Increment use count and update last_used_at
    await supabase
      .from('ulap_short_links')
      .update({
        use_count: shortLink.use_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', shortLink.id);

    // Update lead status to FORM_OPENED if it's LINK_SHARED
    if (shortLink.lead_id) {
      await supabase
        .from('ulap_leads')
        .update({ status: 'FORM_OPENED' })
        .eq('id', shortLink.lead_id)
        .eq('status', 'LINK_SHARED');

      // Log activity
      await supabase.from('ulap_lead_activity').insert({
        lead_id: shortLink.lead_id,
        activity_type: 'LINK_OPENED',
        activity_data: {
          short_code: code,
          use_count: shortLink.use_count + 1,
        },
      });
    }

    return NextResponse.json({
      success: true,
      redirectUrl: shortLink.full_url,
      leadId: shortLink.lead_id,
    });
  } catch (error) {
    apiLogger.error('Error in short link API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
