/**
 * API Route: ULI Bulk Service Operations
 * PATCH /api/superadmin/uli-hub/services/bulk — Bulk enable/disable services
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, is_enabled, category } = body

    const supabase = createAdminClient()

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Bulk update by IDs
      const { error } = await supabase
        .from('uli_services')
        .update({ is_enabled })
        .in('id', ids)

      if (error) throw error
    } else if (category) {
      // Bulk update by category
      const { error } = await supabase
        .from('uli_services')
        .update({ is_enabled })
        .eq('category', category)

      if (error) throw error
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide either ids array or category' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('ULI bulk update error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to bulk update ULI services' },
      { status: 500 }
    )
  }
}
