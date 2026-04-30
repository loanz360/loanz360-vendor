import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Document Requirements Management API
 * SuperAdmin endpoint for managing document requirements per income category/entity type
 *
 * GET  - Fetch all document requirements with filters
 * POST - Create new document requirement
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

// Validation schemas
const createDocumentSchema = z.object({
  document_name: z.string().min(1).max(100),
  document_code: z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'Code must be uppercase with underscores'),
  description: z.string().optional(),
  category: z.enum(['IDENTITY', 'ADDRESS', 'INCOME', 'BUSINESS', 'PROPERTY', 'OTHER']),
  is_mandatory: z.boolean().optional().default(true),
  max_file_size_mb: z.number().min(1).max(50).optional().default(5),
  allowed_formats: z.array(z.string()).optional().default(['pdf', 'jpg', 'png']),
  applicable_to: z.object({
    income_categories: z.array(z.string()).optional(),
    entity_types: z.array(z.string()).optional(),
    loan_types: z.array(z.string()).optional(),
  }).optional(),
  verification_required: z.boolean().optional().default(true),
  auto_verification: z.boolean().optional().default(false),
  display_order: z.number().optional().default(0),
  is_active: z.boolean().optional().default(true),
})

const querySchema = z.object({
  category: z.string().optional(),
  mandatory: z.enum(['all', 'mandatory', 'optional']).optional(),
  search: z.string().optional(),
})

/**
 * GET /api/superadmin/customer-management/document-requirements
 * Fetch all document requirements
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = querySchema.parse({
      category: searchParams.get('category'),
      mandatory: searchParams.get('mandatory') || 'all',
      search: searchParams.get('search'),
    })

    // Build query
    let query = supabaseAdmin
      .from('document_requirements')
      .select('*')
      .order('display_order', { ascending: true })

    // Apply category filter
    if (params.category && params.category !== 'all') {
      query = query.eq('category', params.category)
    }

    // Apply mandatory filter
    if (params.mandatory === 'mandatory') {
      query = query.eq('is_mandatory', true)
    } else if (params.mandatory === 'optional') {
      query = query.eq('is_mandatory', false)
    }

    // Apply search filter
    if (params.search) {
      query = query.or(`document_name.ilike.%${params.search}%,document_code.ilike.%${params.search}%`)
    }

    const { data: documents, error } = await query

    if (error) {
      apiLogger.error('Error fetching document requirements', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch document requirements' },
        { status: 500 }
      )
    }

    // Calculate statistics
    const allDocs = documents || []
    const statistics = {
      total_documents: allDocs.length,
      mandatory_documents: allDocs.filter(d => d.is_mandatory).length,
      optional_documents: allDocs.filter(d => !d.is_mandatory).length,
      identity_docs: allDocs.filter(d => d.category === 'IDENTITY').length,
      address_docs: allDocs.filter(d => d.category === 'ADDRESS').length,
      income_docs: allDocs.filter(d => d.category === 'INCOME').length,
      business_docs: allDocs.filter(d => d.category === 'BUSINESS').length,
      property_docs: allDocs.filter(d => d.category === 'PROPERTY').length,
      verification_enabled: allDocs.filter(d => d.verification_required).length,
      auto_verification: allDocs.filter(d => d.auto_verification).length,
    }

    return NextResponse.json({
      success: true,
      data: documents,
      statistics,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    apiLogger.error('Document Requirements GET error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
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
 * POST /api/superadmin/customer-management/document-requirements
 * Create a new document requirement
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = createDocumentSchema.parse(body)

    // Check for duplicate code
    const { data: existing } = await supabaseAdmin
      .from('document_requirements')
      .select('id')
      .eq('document_code', validatedData.document_code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Document code already exists' },
        { status: 409 }
      )
    }

    // Create document requirement
    const { data: newDocument, error: insertError } = await supabaseAdmin
      .from('document_requirements')
      .insert({
        document_name: validatedData.document_name,
        document_code: validatedData.document_code,
        description: validatedData.description || null,
        category: validatedData.category,
        is_mandatory: validatedData.is_mandatory,
        max_file_size_mb: validatedData.max_file_size_mb,
        allowed_formats: validatedData.allowed_formats,
        applicable_to: validatedData.applicable_to || {},
        verification_required: validatedData.verification_required,
        auto_verification: validatedData.auto_verification,
        display_order: validatedData.display_order,
        is_active: validatedData.is_active,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating document requirement', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create document requirement' },
        { status: 500 }
      )
    }

    // Log to audit
    await supabaseAdmin
      .from('config_audit_log')
      .insert({
        action: 'CREATE',
        entity_type: 'DOCUMENT_REQUIREMENT',
        entity_id: newDocument.id,
        entity_name: newDocument.document_name,
        new_value: newDocument,
        changed_by: auth.userId,
        changed_by_email: auth.email,
      })

    return NextResponse.json({
      success: true,
      data: newDocument,
      message: 'Document requirement created successfully',
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Document Requirements POST error', error)

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
