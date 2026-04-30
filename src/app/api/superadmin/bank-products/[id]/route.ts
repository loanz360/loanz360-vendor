/**
 * Bank Products Management API - Single Product Operations
 * GET: Get single product by ID
 * PUT: Update a bank product
 * DELETE: Delete a bank product (soft delete by setting is_active=false, or hard delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN']

async function verifyAdminAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized', status: 401, user: null, role: null }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!userData || !ALLOWED_ROLES.includes(userData.role)) {
    return { error: 'Access denied', status: 403, user: null, role: null }
  }

  return { error: null, status: 200, user, role: userData.role }
}

// =====================================================
// GET: Get single product
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { error: authErr, status } = await verifyAdminAccess(supabase)
    if (authErr) return NextResponse.json({ success: false, error: authErr }, { status })

    const { id } = await params

    const { data: product, error } = await supabase
      .from('loan_products')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    apiLogger.error('Get bank product error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// PUT: Update a bank product
// =====================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { error: authErr, status, user } = await verifyAdminAccess(supabase)
    if (authErr) return NextResponse.json({ success: false, error: authErr }, { status })

    const { id } = await params
    const body = await request.json()

    // Check product exists
    const { data: existing } = await supabase
      .from('loan_products')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    // Build update data - only include fields that are provided
    const updateData: Record<string, unknown> = { updated_by: user!.id }

    const stringFields = [
      'bank_name', 'bank_code', 'bank_logo_url', 'name', 'loan_type',
      'description', 'product_code', 'interest_rate_type', 'processing_fee',
      'prepayment_charges', 'foreclosure_charges', 'notes', 'effective_from', 'effective_until'
    ]
    const numericFields = [
      'min_amount', 'max_amount', 'min_interest_rate', 'max_interest_rate',
      'processing_fee_percentage', 'processing_fee_min', 'processing_fee_max',
      'min_income', 'max_ltv'
    ]
    const intFields = ['min_tenure', 'max_tenure', 'min_cibil', 'min_age', 'max_age', 'display_order', 'popularity_score']
    const boolFields = [
      'is_active', 'featured', 'has_collateral', 'prepayment_allowed',
      'top_up_available', 'balance_transfer_available', 'tax_benefit_eligible'
    ]
    const arrayFields = ['employment_types', 'tax_sections']

    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] === '' ? null : String(body[field]).trim()
      }
    }
    for (const field of numericFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] === null ? null : parseFloat(body[field])
      }
    }
    for (const field of intFields) {
      if (body[field] !== undefined) {
        updateData[field] = parseInt(body[field])
      }
    }
    for (const field of boolFields) {
      if (body[field] !== undefined) {
        updateData[field] = Boolean(body[field])
      }
    }
    for (const field of arrayFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data: product, error } = await supabase
      .from('loan_products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      apiLogger.error('Failed to update bank product:', error)
      return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    })
  } catch (error) {
    apiLogger.error('Update bank product error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// DELETE: Delete a bank product
// =====================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { error: authErr, status, user } = await verifyAdminAccess(supabase)
    if (authErr) return NextResponse.json({ success: false, error: authErr }, { status })

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    // Check product exists
    const { data: existing } = await supabase
      .from('loan_products')
      .select('id, name, bank_name')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    }

    if (hardDelete) {
      // Permanent delete
      const { error } = await supabase
        .from('loan_products')
        .delete()
        .eq('id', id)

      if (error) {
        apiLogger.error('Failed to hard delete bank product:', error)
        return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Product "${existing.name}" from ${existing.bank_name} permanently deleted`,
      })
    } else {
      // Soft delete - deactivate
      const { error } = await supabase
        .from('loan_products')
        .update({ is_active: false, updated_by: user!.id })
        .eq('id', id)

      if (error) {
        apiLogger.error('Failed to deactivate bank product:', error)
        return NextResponse.json({ success: false, error: 'Failed to deactivate product' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Product "${existing.name}" from ${existing.bank_name} deactivated`,
      })
    }
  } catch (error) {
    apiLogger.error('Delete bank product error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
