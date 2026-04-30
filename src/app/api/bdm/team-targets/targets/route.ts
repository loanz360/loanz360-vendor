
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    // Note: bde_targets table doesn't exist yet - returning placeholder
    // Use target_templates + daily_achievements for now
    const month = request.nextUrl.searchParams.get('month') || new Date().toISOString().split('T')[0]
    
    const { data: templates } = await supabase.from('target_templates').select('*').eq('is_active', true)
    
    return NextResponse.json({ 
      success: true, 
      data: { targets: [], templates: templates || [] },
      message: 'Note: bde_targets table not created yet. Using templates as fallback.'
    })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
