import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const maxDuration = 60

/**
 * GET /api/public/upload?token=xxx
 *
 * Validates an upload token and returns upload metadata.
 * Public endpoint - no auth required.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: uploadToken, error } = await supabase
      .from('document_upload_tokens')
      .select('id, lead_id, customer_name, loan_type, expires_at, max_uploads, upload_count')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !uploadToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired upload link' },
        { status: 404 }
      )
    }

    // Check expiry
    if (new Date(uploadToken.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This upload link has expired' },
        { status: 410 }
      )
    }

    // Check upload limit
    if (uploadToken.upload_count >= uploadToken.max_uploads) {
      return NextResponse.json(
        { success: false, error: 'Upload limit reached for this link' },
        { status: 429 }
      )
    }

    // Fetch the loan type schema for document checklist
    let documentChecklist: unknown[] = []
    if (uploadToken.loan_type) {
      const { data: schema } = await supabase
        .from('loan_type_field_schemas')
        .select('document_checklist')
        .eq('loan_type', uploadToken.loan_type)
        .eq('is_active', true)
        .maybeSingle()

      if (schema?.document_checklist) {
        documentChecklist = schema.document_checklist
      }
    }

    // Fetch already uploaded documents for this lead
    const { data: leadData } = await supabase
      .from('crm_leads')
      .select('documents')
      .eq('id', uploadToken.lead_id)
      .maybeSingle()

    const existingDocs = (leadData?.documents || []) as Array<Record<string, unknown>>

    return NextResponse.json({
      success: true,
      data: {
        customerName: uploadToken.customer_name,
        loanType: uploadToken.loan_type,
        remainingUploads: uploadToken.max_uploads - uploadToken.upload_count,
        documentChecklist,
        existingDocuments: existingDocs.map((d) => ({
          name: d.name,
          doc_key: d.doc_key,
          uploaded_at: d.uploaded_at,
        })),
      },
    })
  } catch (error) {
    apiLogger.error('Error validating upload token:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/public/upload
 *
 * Uploads a document to a lead's document list.
 * Token-based authentication (no user session required).
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const formData = await request.formData()
    const token = formData.get('token') as string
    const file = formData.get('file') as File
    const docKey = formData.get('doc_key') as string | null
    const docLabel = formData.get('doc_label') as string | null

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File too large (max 10MB)' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Validate token
    const { data: uploadToken, error: tokenError } = await supabase
      .from('document_upload_tokens')
      .select('id, lead_id, cro_id, customer_name, expires_at, max_uploads, upload_count')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle()

    if (tokenError || !uploadToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired upload link' },
        { status: 404 }
      )
    }

    if (new Date(uploadToken.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Upload link has expired' },
        { status: 410 }
      )
    }

    if (uploadToken.upload_count >= uploadToken.max_uploads) {
      return NextResponse.json(
        { success: false, error: 'Upload limit reached' },
        { status: 429 }
      )
    }

    // Upload file to Supabase Storage
    const ext = file.name.split('.').pop() || 'pdf'
    const storagePath = `lead-documents/${uploadToken.lead_id}/${Date.now()}_${docKey || 'doc'}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      apiLogger.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('documents').getPublicUrl(storagePath)

    // Add document to lead's documents array
    const docEntry = {
      id: crypto.randomUUID(),
      name: docLabel || file.name,
      type: ext,
      url: publicUrl,
      size: file.size,
      doc_key: docKey || undefined,
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'customer',
      uploaded_by_name: uploadToken.customer_name,
    }

    // Fetch current documents
    const { data: lead } = await supabase
      .from('crm_leads')
      .select('documents, notes_timeline')
      .eq('id', uploadToken.lead_id)
      .maybeSingle()

    const currentDocs = (lead?.documents || []) as unknown[]
    const currentNotes = (lead?.notes_timeline || []) as unknown[]

    // Add system event note
    const systemNote = {
      id: crypto.randomUUID(),
      type: 'document_uploaded',
      content: `Customer uploaded: ${docLabel || file.name}`,
      created_by: 'customer',
      created_by_name: uploadToken.customer_name,
      created_at: new Date().toISOString(),
    }

    // Update lead
    await supabase
      .from('crm_leads')
      .update({
        documents: [...currentDocs, docEntry],
        notes_timeline: [...currentNotes, systemNote],
        updated_at: new Date().toISOString(),
      })
      .eq('id', uploadToken.lead_id)

    // Increment upload count
    await supabase
      .from('document_upload_tokens')
      .update({ upload_count: uploadToken.upload_count + 1 })
      .eq('id', uploadToken.id)

    // Fire-and-forget: trigger OCR processing via internal API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/ai-crm/cro/document-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'lead',
        entity_id: uploadToken.lead_id,
        document_id: docEntry.id,
        doc_key: docKey || undefined,
      }),
    }).catch(() => { /* Non-critical side effect */ })

    // Fire-and-forget: create push notification for CRO
    fetch(`${baseUrl}/api/ai-crm/cro/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'document_uploaded',
        cro_id: uploadToken.cro_id,
        title: 'New Document Uploaded',
        message: `${uploadToken.customer_name} uploaded: ${docLabel || file.name}`,
        entity_type: 'lead',
        entity_id: uploadToken.lead_id,
      }),
    }).catch(() => { /* Non-critical side effect */ })

    return NextResponse.json({
      success: true,
      data: {
        document: { name: docEntry.name, doc_key: docEntry.doc_key },
        remainingUploads: uploadToken.max_uploads - uploadToken.upload_count - 1,
      },
      message: 'Document uploaded successfully',
    })
  } catch (error) {
    apiLogger.error('Error uploading document:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
