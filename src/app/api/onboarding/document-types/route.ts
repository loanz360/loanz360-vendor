export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch active document types
    const { data: documentTypes, error } = await supabase
      .from('onboarding_document_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      apiLogger.error('Error fetching document types', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch document types' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: documentTypes || [],
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
