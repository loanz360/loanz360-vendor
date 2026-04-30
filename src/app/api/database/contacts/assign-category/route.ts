import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { contactIds, categoryId } = body

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // SECURITY FIX CRITICAL-02: Check authentication and authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is SUPER_ADMIN
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized category assignment attempt', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/database/contacts/assign-category'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // If categoryId is null, we're removing the category
    const updateData = categoryId ? { category_id: categoryId } : { category_id: null }

    const { error } = await supabase
      .from('contacts')
      .update(updateData)
      .in('id', contactIds)

    if (error) {
      logger.error('Category assignment error', error instanceof Error ? error : undefined, {
        context: 'assign-category-POST',
        contactCount: contactIds.length
      })
      return NextResponse.json(
        { error: 'Failed to assign category' },
        { status: 500 }
      )
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'ASSIGN_CATEGORY',
      entity_type: 'CONTACT',
      details: {
        contact_count: contactIds.length,
        category_id: categoryId
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${contactIds.length} contact(s)`
    })

  } catch (error) {
    logger.error('Assign category error', error instanceof Error ? error : undefined, {
      context: 'assign-category-POST'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
