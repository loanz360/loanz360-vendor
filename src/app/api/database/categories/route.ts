import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
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
      logger.warn('Unauthorized categories access attempt', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/database/categories GET'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Categories fetch error', error instanceof Error ? error : undefined, {
        context: 'categories-GET'
      })
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: categories || []
    })

  } catch (error) {
    logger.error('Categories API error', error instanceof Error ? error : undefined, {
      context: 'categories-GET'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
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
      logger.warn('Unauthorized category create attempt', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/database/categories POST'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 }
      )
    }

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (error) {
      logger.error('Category create error', error instanceof Error ? error : undefined, {
        context: 'categories-POST'
      })
      return NextResponse.json(
        { error: 'Failed to create category' },
        { status: 500 }
      )
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'CREATE_CATEGORY',
      entity_type: 'CATEGORY',
      entity_id: category.id,
      details: { name: category.name }
    })

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Category created successfully'
    })

  } catch (error) {
    logger.error('Create category error', error instanceof Error ? error : undefined, {
      context: 'categories-POST'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { id, name, description } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
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
      logger.warn('Unauthorized category update attempt', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/database/categories PUT'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Check for duplicate name (excluding current category)
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', name.trim())
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 }
      )
    }

    const { data: category, error } = await supabase
      .from('categories')
      .update({
        name: name.trim(),
        description: description?.trim() || null
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      logger.error('Category update error', error instanceof Error ? error : undefined, {
        context: 'categories-PUT'
      })
      return NextResponse.json(
        { error: 'Failed to update category' },
        { status: 500 }
      )
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'UPDATE_CATEGORY',
      entity_type: 'CATEGORY',
      entity_id: category.id,
      details: { name: category.name }
    })

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Category updated successfully'
    })

  } catch (error) {
    logger.error('Update category error', error instanceof Error ? error : undefined, {
      context: 'categories-PUT'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
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
      logger.warn('Unauthorized category delete attempt', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/database/categories DELETE'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Check if category is in use
    const { count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete category. It is assigned to ${count} contact(s)` },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Category delete error', error instanceof Error ? error : undefined, {
        context: 'categories-DELETE'
      })
      return NextResponse.json(
        { error: 'Failed to delete category' },
        { status: 500 }
      )
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'DELETE_CATEGORY',
      entity_type: 'CATEGORY',
      entity_id: id,
      details: {}
    })

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    })

  } catch (error) {
    logger.error('Delete category error', error instanceof Error ? error : undefined, {
      context: 'categories-DELETE'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
