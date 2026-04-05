export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('profile_type') // 'INDIVIDUAL', 'ENTITY', or 'BOTH'

    let query = supabase
      .from('document_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Filter by profile type if provided
    if (profileType) {
      query = query.or(`profile_type.eq.${profileType},profile_type.eq.BOTH`)
    }

    const { data: categories, error } = await query

    if (error) {
      apiLogger.error('Error fetching document categories', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch document categories' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      categories: categories || []
    })
  } catch (error) {
    apiLogger.error('Error in document categories API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
