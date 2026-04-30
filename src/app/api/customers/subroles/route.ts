
/**
 * Customer Subroles API
 * GET /api/customers/subroles - List all active customer subroles
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubroles, CUSTOMER_SUBROLES } from '@/lib/constants/customer-subroles'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Try to fetch from database first
    const supabase = await createClient()

    const { data: dbSubroles, error } = await supabase
      .from('customer_subroles')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      // Fallback to constants
      const subroles = getActiveSubroles().map(s => ({
        key: s.key,
        name: s.name,
        description: s.description,
        icon: s.icon.name || 'user',
        color: s.color,
        route: s.route,
        display_order: s.displayOrder,
        show_entity_profile: s.showEntityProfile
      }))

      return NextResponse.json({
        success: true,
        subroles,
        source: 'constants'
      })
    }

    // Return database subroles
    return NextResponse.json({
      success: true,
      subroles: dbSubroles,
      source: 'database'
    })

  } catch (error) {
    apiLogger.error('Error fetching customer subroles', error)

    // Final fallback to constants
    const subroles = getActiveSubroles().map(s => ({
      key: s.key,
      name: s.name,
      description: s.description,
      icon: s.icon.name || 'user',
      color: s.color,
      route: s.route,
      display_order: s.displayOrder,
      show_entity_profile: s.showEntityProfile
    }))

    return NextResponse.json({
      success: true,
      subroles,
      source: 'constants_fallback'
    })
  }
}
