/**
 * BDM Team Targets - Target Templates API
 * GET: List all available templates
 * POST: Create new template
 * BDM access only
 *
 * Rate Limit: 60 requests per minute (GET), 30 requests per minute (POST)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getTemplatesHandler(req)
  })
}

export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await createTemplateHandler(req)
  })
}

async function getTemplatesHandler(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // =====================================================
    // 2. FETCH TEMPLATES
    // =====================================================

    // Get templates that are either public or created by this BDM
    const { data: templates, error: templatesError } = await supabase
      .from('target_templates')
      .select(`
        id,
        template_name,
        template_description,
        created_by,
        is_default,
        is_public,
        daily_conversion_target,
        monthly_conversion_target,
        monthly_revenue_target,
        incentive_multiplier,
        created_at,
        updated_at
      `)
      .or(`is_public.eq.true,created_by.eq.${bdmUserId}`)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('template_name', { ascending: true })

    if (templatesError) {
      apiLogger.error('Error fetching templates', templatesError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch templates',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 3. FORMAT RESPONSE
    // =====================================================

    const formattedTemplates = templates?.map((template) => ({
      id: template.id,
      name: template.template_name,
      description: template.template_description,
      isDefault: template.is_default,
      isPublic: template.is_public,
      dailyConversionTarget: template.daily_conversion_target,
      monthlyConversionTarget: template.monthly_conversion_target,
      monthlyRevenueTarget: template.monthly_revenue_target,
      incentiveMultiplier: template.incentive_multiplier,
      createdAt: template.created_at,
      isOwnTemplate: template.created_by === bdmUserId,
    }))

    return NextResponse.json({
      success: true,
      data: {
        templates: formattedTemplates || [],
        count: formattedTemplates?.length || 0,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getTemplatesHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

async function createTemplateHandler(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // =====================================================
    // 2. PARSE REQUEST BODY
    // =====================================================

    const body = await request.json()
    const {
      templateName,
      templateDescription,
      dailyConversionTarget,
      monthlyConversionTarget,
      monthlyRevenueTarget,
      incentiveMultiplier,
      isPublic,
    } = body

    // Validate required fields
    if (!templateName || !monthlyConversionTarget || !monthlyRevenueTarget) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: templateName, monthlyConversionTarget, monthlyRevenueTarget',
        },
        { status: 400 }
      )
    }

    // =====================================================
    // 3. CREATE TEMPLATE
    // =====================================================

    const templateData = {
      template_name: templateName,
      template_description: templateDescription || null,
      created_by: bdmUserId,
      is_default: false, // Only system can create default templates
      is_public: isPublic || false,
      daily_conversion_target: dailyConversionTarget || null,
      monthly_conversion_target: monthlyConversionTarget,
      monthly_revenue_target: monthlyRevenueTarget,
      incentive_multiplier: incentiveMultiplier || 1.0,
      is_active: true,
    }

    const { data: template, error: templateError } = await supabase
      .from('target_templates')
      .insert(templateData)
      .select()
      .maybeSingle()

    if (templateError) {
      apiLogger.error('Error creating template', templateError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create template',
          },
        { status: 500 }
      )
    }

    // =====================================================
    // 4. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        template: {
          id: template.id,
          name: template.template_name,
          description: template.template_description,
          dailyConversionTarget: template.daily_conversion_target,
          monthlyConversionTarget: template.monthly_conversion_target,
          monthlyRevenueTarget: template.monthly_revenue_target,
          incentiveMultiplier: template.incentive_multiplier,
          isPublic: template.is_public,
          createdAt: template.created_at,
        },
        message: 'Template created successfully',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in createTemplateHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
