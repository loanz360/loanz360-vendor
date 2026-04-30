import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth/check-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/database-management/email/contacts/[contactId]
 * Get single email contact details
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
      .from('email_database_contacts')
      .select('*, folders:email_database_contact_folders(folder:email_database_folders(*))')
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
    apiLogger.error('Error fetching email contact', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/database-management/email/contacts/[contactId]
 * Update email contact
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
    const bodySchema = z.object({

      email: z.string().email().optional(),

      name: z.string().optional(),

      first_name: z.string().optional(),

      last_name: z.string().optional(),

      phone: z.string().min(10).optional(),

      company: z.string().optional(),

      designation: z.string().optional(),

      location_city: z.string().optional(),

      location_state: z.string().optional(),

      website: z.string().optional(),

      linkedin_url: z.string().optional(),

      notes: z.string().optional(),

      tags: z.array(z.unknown()).optional(),

      custom_fields: z.string().optional(),

      status: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Don't allow email update (it's unique identifier)
    delete body.email

    // Update contact
    const { data, error } = await supabase
      .from('email_database_contacts')
      .update({
        name: body.name,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
        company: body.company,
        designation: body.designation,
        location_city: body.location_city,
        location_state: body.location_state,
        website: body.website,
        linkedin_url: body.linkedin_url,
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
    apiLogger.error('Error updating email contact', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/database-management/email/contacts/[contactId]
 * Delete single email contact
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
      .from('email_database_contact_folders')
      .delete()
      .eq('contact_id', params.contactId)

    // Delete contact
    const { error } = await supabase
      .from('email_database_contacts')
      .delete()
      .eq('id', params.contactId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error deleting email contact', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
