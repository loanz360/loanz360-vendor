export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const supabase = await createClient()

    const { data: field, error } = await supabase
      .from('profile_field_definitions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !field) {
      return NextResponse.json({ success: false, error: 'Profile field not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: field })
  } catch (error) {
    apiLogger.error('Error fetching profile field', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Build update object with only provided fields (using actual schema)
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'field_label', 'field_type', 'profile_type', 'field_section', 'field_group',
      'is_core_field', 'applies_to_all_categories', 'income_category_ids', 'income_profile_ids',
      'applies_to_all_entity_types', 'entity_type_ids', 'is_required', 'is_required_for_loan',
      'verification_source', 'auto_lock_on_verify', 'validation_rules', 'options',
      'placeholder', 'help_text', 'display_order', 'is_visible', 'is_active', 'depends_on'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    updateData.updated_at = new Date().toISOString()

    const { data: updatedField, error } = await supabase
      .from('profile_field_definitions')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating profile field', error)
      return NextResponse.json({ success: false, error: 'Failed to update profile field' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: updatedField })
  } catch (error) {
    apiLogger.error('Error in profile-field PUT', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('profile_field_definitions')
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('Error deleting profile field', error)
      return NextResponse.json({ success: false, error: 'Failed to delete profile field' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Error in profile-field DELETE', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
