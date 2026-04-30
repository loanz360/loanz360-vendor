
/**
 * ULAP Module Configuration API
 * GET - Fetch all module configurations
 * POST - Update module configurations
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// Types
interface ModuleConfig {
  context: string
  displayName: string
  category: 'partner' | 'employee' | 'customer'
  features: {
    showSubmitLead: boolean
    showShareLink: boolean
    showLeadStatus: boolean
    allowBulkUpload: boolean
    requireApproval: boolean
  }
  labels: {
    moduleTitle: string
    submitTabLabel: string
    shareTabLabel: string
    statusTabLabel: string
  }
  restrictions: {
    maxLeadsPerDay: number
    maxShareLinksPerDay: number
    shareLinkExpiryDays: number
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPERADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Fetch configs from database
    const { data: configs, error } = await supabase
      .from('ulap_module_configs')
      .select('*')
      .order('context')

    if (error) {
      // Table might not exist yet - return empty array
      return NextResponse.json({ configs: [] })
    }

    // Transform database format to API format
    const formattedConfigs = configs?.map(c => ({
      context: c.context,
      displayName: c.display_name,
      category: c.category,
      features: c.features,
      labels: c.labels,
      restrictions: c.restrictions,
    })) || []

    return NextResponse.json({ configs: formattedConfigs })
  } catch (error) {
    apiLogger.error('Error fetching module configs', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is superadmin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPERADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { configs } = body as { configs: ModuleConfig[] }

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json({ success: false, error: 'Invalid configs array' }, { status: 400 })
    }

    // Upsert each config
    for (const config of configs) {
      const { error } = await supabase
        .from('ulap_module_configs')
        .upsert({
          context: config.context,
          display_name: config.displayName,
          category: config.category,
          features: config.features,
          labels: config.labels,
          restrictions: config.restrictions,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        }, {
          onConflict: 'context'
        })

      if (error) {
        apiLogger.error(`Error upserting config for ${config.context}:`, error)
        // Continue with other configs even if one fails
      }
    }

    return NextResponse.json({ success: true, message: 'Configurations saved' })
  } catch (error) {
    apiLogger.error('Error saving module configs', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
