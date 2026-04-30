
/**
 * Document Requirement Individual Operations API
 * SuperAdmin endpoint for updating/deleting individual document requirements
 *
 * GET    - Fetch single document requirement
 * PUT    - Update document requirement
 * DELETE - Delete document requirement
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const updateDocumentSchema = z.object({
  document_name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  category: z.enum(['IDENTITY', 'ADDRESS', 'INCOME', 'BUSINESS', 'PROPERTY', 'OTHER']).optional(),
  is_mandatory: z.boolean().optional(),
  max_file_size_mb: z.number().min(1).max(50).optional(),
  allowed_formats: z.array(z.string()).optional(),
  applicable_to: z.object({
    income_categories: z.array(z.string()).optional(),
    entity_types: z.array(z.string()).optional(),
    loan_types: z.array(z.string()).optional(),
  }).optional(),
  verification_required: z.boolean().optional(),
  auto_verification: z.boolean().optional(),
  display_order: z.number().optional(),
  is_active: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/superadmin/customer-management/document-requirements/[id]
 * Fetch single document requirement
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: document, error } = await supabaseAdmin
      .from('document_requirements')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !document) {
      return NextResponse.json(
        { success: false, error: 'Document requirement not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: document,
    })

  } catch (error) {
    apiLogger.error('Document Requirement GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/customer-management/document-requirements/[id]
 * Update document requirement
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get existing document
    const { data: existing } = await supabaseAdmin
      .from('document_requirements')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Document requirement not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = updateDocumentSchema.parse(body)

    // Update document
    const { data: updatedDocument, error: updateError } = await supabaseAdmin
      .from('document_requirements')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating document requirement', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update document requirement' },
        { status: 500 }
      )
    }

    // Determine action type for audit
    let action = 'UPDATE'
    if (validatedData.is_active !== undefined && validatedData.is_active !== existing.is_active) {
      action = validatedData.is_active ? 'ENABLE' : 'DISABLE'
    }

    // Log to audit
    await supabaseAdmin
      .from('config_audit_log')
      .insert({
        action,
        entity_type: 'DOCUMENT_REQUIREMENT',
        entity_id: id,
        entity_name: updatedDocument.document_name,
        old_value: existing,
        new_value: updatedDocument,
        changed_by: auth.userId,
        changed_by_email: auth.email,
      })

    return NextResponse.json({
      success: true,
      data: updatedDocument,
      message: 'Document requirement updated successfully',
    })

  } catch (error) {
    apiLogger.error('Document Requirement PUT error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/customer-management/document-requirements/[id]
 * Delete document requirement
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get existing document
    const { data: existing } = await supabaseAdmin
      .from('document_requirements')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Document requirement not found' },
        { status: 404 }
      )
    }

    // Delete document
    const { error: deleteError } = await supabaseAdmin
      .from('document_requirements')
      .delete()
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting document requirement', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete document requirement' },
        { status: 500 }
      )
    }

    // Log to audit
    await supabaseAdmin
      .from('config_audit_log')
      .insert({
        action: 'DELETE',
        entity_type: 'DOCUMENT_REQUIREMENT',
        entity_id: id,
        entity_name: existing.document_name,
        old_value: existing,
        new_value: null,
        changed_by: auth.userId,
        changed_by_email: auth.email,
      })

    return NextResponse.json({
      success: true,
      message: 'Document requirement deleted successfully',
    })

  } catch (error) {
    apiLogger.error('Document Requirement DELETE error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
