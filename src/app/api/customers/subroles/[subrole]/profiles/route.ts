
/**
 * Customer Profiles by Subrole API
 * GET /api/customers/subroles/[subrole]/profiles - List all profiles for a specific subrole
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfilesBySubrole, getSubroleByKey, CUSTOMER_PROFILES } from '@/lib/constants/customer-subroles'
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{
    subrole: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { subrole } = await params
    const subroleKey = subrole.toUpperCase().replace(/-/g, '_')

    // Validate subrole exists
    const subroleData = getSubroleByKey(subroleKey)
    if (!subroleData) {
      return NextResponse.json({
        success: false,
        error: `Invalid subrole: ${subrole}`
      }, { status: 400 })
    }

    // Try to fetch from database first
    const supabase = await createClient()

    // Get subrole ID from database
    const { data: dbSubrole, error: subroleError } = await supabase
      .from('customer_subroles')
      .select('id')
      .eq('key', subroleKey)
      .maybeSingle()

    if (subroleError || !dbSubrole) {
      // Fallback to constants
      const profiles = getProfilesBySubrole(subroleKey)

      return NextResponse.json({
        success: true,
        subrole: {
          key: subroleData.key,
          name: subroleData.name,
          description: subroleData.description
        },
        profiles: profiles.map(p => ({
          key: p.key,
          name: p.name,
          description: p.description,
          icon: p.icon,
          display_order: p.displayOrder
        })),
        source: 'constants'
      })
    }

    // Fetch profiles from database
    const { data: dbProfiles, error: profilesError } = await supabase
      .from('customer_profile_definitions')
      .select('*')
      .eq('subrole_id', dbSubrole.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (profilesError) {
      // Fallback to constants
      const profiles = getProfilesBySubrole(subroleKey)

      return NextResponse.json({
        success: true,
        subrole: {
          key: subroleData.key,
          name: subroleData.name,
          description: subroleData.description
        },
        profiles: profiles.map(p => ({
          key: p.key,
          name: p.name,
          description: p.description,
          icon: p.icon,
          display_order: p.displayOrder
        })),
        source: 'constants_fallback'
      })
    }

    // Return database profiles
    return NextResponse.json({
      success: true,
      subrole: {
        key: subroleData.key,
        name: subroleData.name,
        description: subroleData.description
      },
      profiles: dbProfiles,
      source: 'database'
    })

  } catch (error) {
    apiLogger.error('Error fetching profiles for subrole', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch profiles'
    }, { status: 500 })
  }
}
