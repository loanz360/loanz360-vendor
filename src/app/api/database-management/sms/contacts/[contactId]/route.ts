export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth/check-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/database-management/sms/contacts/[contactId]
 * Get single SMS contact details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    // Check authentication
    const authResult = await checkAuth(['SUPER_ADMIN'])
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sms_database_contacts')
      .select('*, folders:sms_database_contact_folders(folder:sms_database_folders(*))')
      .eq('id', params.contactId)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Contact not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching SMS contact', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/database-management/sms/contacts/[contactId]
 * Update SMS contact
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    // Check authentication
    const authResult = await checkAuth(['SUPER_ADMIN'])
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    const body = await request.json()

    // Don't allow mobile_number update (it's unique identifier)
    delete body.mobile_number

    // Update contact
    const { data, error } = await supabase
      .from('sms_database_contacts')
      .update({
        name: body.name,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
        company: body.company,
        designation: body.designation,
        location_city: body.location_city,
        location_state: body.location_state,
        country_code: body.country_code,
        is_dnd: body.is_dnd,
        opt_in_at: body.opt_in_at,
        opt_out_at: body.opt_out_at,
        notes: body.notes,
        tags: body.tags,
        custom_fields: body.custom_fields,
        status: body.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.contactId)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('Error updating SMS contact', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/database-management/sms/contacts/[contactId]
 * Delete single SMS contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    // Check authentication
    const authResult = await checkAuth(['SUPER_ADMIN'])
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Delete folder mappings first
    await supabase
      .from('sms_database_contact_folders')
      .delete()
      .eq('contact_id', params.contactId)

    // Delete contact
    const { error } = await supabase
      .from('sms_database_contacts')
      .delete()
      .eq('id', params.contactId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error deleting SMS contact', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
