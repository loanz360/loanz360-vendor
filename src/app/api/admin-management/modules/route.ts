import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/modules
 * List all available system modules
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const is_active = searchParams.get('is_active')
    const is_visible = searchParams.get('is_visible')
    const category = searchParams.get('category')

    // Build query
    let query = supabase
      .from('system_modules')
      .select('*')

    // Apply filters
    if (is_active !== null && is_active !== '') {
      query = query.eq('is_active', is_active === 'true')
    }

    if (is_visible !== null && is_visible !== '') {
      query = query.eq('is_visible', is_visible === 'true')
    }

    if (category) {
      query = query.eq('module_category', category)
    }

    // Apply sorting
    query = query.order('module_order', { ascending: true })

    const { data: modules, error } = await query

    if (error) throw error

    // Group modules by category (optional)
    const groupedByCategory: Record<string, any[]> = {}
    modules?.forEach(module => {
      const cat = module.module_category || 'Uncategorized'
      if (!groupedByCategory[cat]) {
        groupedByCategory[cat] = []
      }
      groupedByCategory[cat].push(module)
    })

    return NextResponse.json({
      success: true,
      data: {
        modules: modules || [],
        total: modules?.length || 0,
        grouped_by_category: groupedByCategory,
        categories: Object.keys(groupedByCategory)
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error fetching modules', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin-management/modules
 * Create a new system module (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin()
    const bodySchema = z.object({

      module_key: z.string().optional(),

      module_name: z.string().optional(),

      module_description: z.string().optional(),

      module_icon: z.string().optional(),

      module_order: z.string().optional(),

      module_path: z.string().optional(),

      module_category: z.string().optional(),

      is_active: z.boolean().optional(),

      is_visible: z.boolean().optional(),

      sub_modules: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      module_key,
      module_name,
      module_description,
      module_icon,
      module_order,
      module_path,
      module_category,
      is_active,
      is_visible,
      sub_modules
    } = body

    // Validate required fields
    if (!module_key || !module_name || !module_path) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: module_key, module_name, module_path'
        },
        { status: 400 }
      )
    }

    // Check if module_key already exists
    const { data: existingModule } = await supabase
      .from('system_modules')
      .select('id')
      .eq('module_key', module_key)
      .maybeSingle()

    if (existingModule) {
      return NextResponse.json(
        {
          success: false,
          error: 'Module with this key already exists'
        },
        { status: 409 }
      )
    }

    // Create module
    const { data: newModule, error: createError } = await supabase
      .from('system_modules')
      .insert({
        module_key,
        module_name,
        module_description,
        module_icon,
        module_order: module_order || 0,
        module_path,
        module_category,
        is_active: is_active !== undefined ? is_active : true,
        is_visible: is_visible !== undefined ? is_visible : true,
        sub_modules: sub_modules || []
      })
      .select()
      .maybeSingle()

    if (createError) throw createError

    return NextResponse.json({
      success: true,
      data: newModule,
      message: 'Module created successfully'
    }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error creating module', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
