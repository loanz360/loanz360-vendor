import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createOCRService, type DocumentCategory } from '@/lib/cae/ocr-service'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Maps common file extensions / doc_key values to OCR document types and categories
 */
const DOC_TYPE_MAP: Record<string, { documentType: string; category: DocumentCategory }> = {
  pan: { documentType: 'PAN_CARD', category: 'IDENTITY' },
  pan_card: { documentType: 'PAN_CARD', category: 'IDENTITY' },
  aadhaar: { documentType: 'AADHAR_CARD', category: 'IDENTITY' },
  aadhaar_card: { documentType: 'AADHAR_CARD', category: 'IDENTITY' },
  aadhar: { documentType: 'AADHAR_CARD', category: 'IDENTITY' },
  aadhar_card: { documentType: 'AADHAR_CARD', category: 'IDENTITY' },
  salary_slip: { documentType: 'SALARY_SLIP', category: 'INCOME' },
  salary_slips: { documentType: 'SALARY_SLIP', category: 'INCOME' },
  bank_statement: { documentType: 'BANK_STATEMENT', category: 'BANK_STATEMENT' },
  bank_statements: { documentType: 'BANK_STATEMENT', category: 'BANK_STATEMENT' },
  itr: { documentType: 'ITR_FORM', category: 'TAX' },
  itr_form: { documentType: 'ITR_FORM', category: 'TAX' },
  gst: { documentType: 'GST_CERTIFICATE', category: 'BUSINESS' },
  gst_certificate: { documentType: 'GST_CERTIFICATE', category: 'BUSINESS' },
  address_proof: { documentType: 'ADDRESS_PROOF', category: 'ADDRESS' },
  photo: { documentType: 'PHOTO', category: 'IDENTITY' },
  passport_photo: { documentType: 'PHOTO', category: 'IDENTITY' },
}

function detectDocType(docKey?: string, fileName?: string): { documentType: string; category: DocumentCategory } {
  // Try doc_key first
  if (docKey) {
    const key = docKey.toLowerCase().replace(/[\s-]+/g, '_')
    if (DOC_TYPE_MAP[key]) return DOC_TYPE_MAP[key]

    // Partial match
    for (const [mapKey, value] of Object.entries(DOC_TYPE_MAP)) {
      if (key.includes(mapKey) || mapKey.includes(key)) return value
    }
  }

  // Try filename
  if (fileName) {
    const name = fileName.toLowerCase().replace(/[\s-]+/g, '_')
    for (const [mapKey, value] of Object.entries(DOC_TYPE_MAP)) {
      if (name.includes(mapKey)) return value
    }
  }

  return { documentType: 'OTHER', category: 'OTHER' }
}

/**
 * POST /api/ai-crm/cro/document-process
 *
 * Trigger OCR processing for an uploaded CRM document.
 *
 * Body: {
 *   entity_type: 'lead' | 'deal',
 *   entity_id: string,
 *   document_id: string,        // ID within the documents JSONB array
 *   doc_key?: string,            // e.g., 'pan_card', 'salary_slip'
 * }
 *
 * The endpoint reads the document from the entity's documents array,
 * runs OCR, and updates the document entry with extracted_data.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { entity_type, entity_id, document_id, doc_key } = body

    if (!entity_type || !entity_id || !document_id) {
      return NextResponse.json(
        { success: false, error: 'Missing entity_type, entity_id, or document_id' },
        { status: 400 }
      )
    }

    const tableMap: Record<string, string> = {
      lead: 'crm_leads',
      deal: 'crm_deals',
    }
    const tableName = tableMap[entity_type]
    if (!tableName) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity_type' },
        { status: 400 }
      )
    }

    // Fetch entity documents
    const { data: entity, error: fetchError } = await supabase
      .from(tableName)
      .select('documents')
      .eq('id', entity_id)
      .maybeSingle()

    if (fetchError || !entity) {
      return NextResponse.json(
        { success: false, error: `${entity_type} not found` },
        { status: 404 }
      )
    }

    const documents = (entity.documents || []) as Array<Record<string, unknown>>
    const docIndex = documents.findIndex((d) => d.id === document_id)

    if (docIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Document not found in entity' },
        { status: 404 }
      )
    }

    const doc = documents[docIndex]
    const { documentType, category } = detectDocType(
      (doc_key || doc.doc_key || '') as string,
      (doc.name || '') as string
    )

    // Create OCR service in sandbox mode (uses internal mock provider)
    const ocrService = createOCRService(supabase, {
      provider: (process.env.OCR_PROVIDER as 'TEXTRACT' | 'GOOGLE_DOC_AI' | 'AZURE_FORM' | 'INTERNAL') || 'INTERNAL',
      environment: (process.env.OCR_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      region: process.env.OCR_REGION || 'ap-south-1',
    })

    // Run OCR extraction
    const ocrResult = await ocrService.extractStructuredData({
      documentId: document_id,
      fileName: (doc.name || 'unknown') as string,
      fileType: (doc.type || 'application/pdf') as string,
      fileUrl: (doc.url || '') as string,
      category,
      documentType,
    })

    // Update document entry with OCR results
    const updatedDoc = {
      ...doc,
      ocr_status: ocrResult.success ? 'completed' : 'failed',
      ocr_confidence: ocrResult.confidence,
      extracted_data: ocrResult.data,
      ocr_document_type: documentType,
      ocr_category: category,
      ocr_processed_at: new Date().toISOString(),
    }

    documents[docIndex] = updatedDoc

    // Save back to entity
    await supabase
      .from(tableName)
      .update({
        documents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity_id)

    return NextResponse.json({
      success: true,
      data: {
        document_id,
        document_type: documentType,
        category,
        ocr_status: updatedDoc.ocr_status,
        confidence: ocrResult.confidence,
        extracted_data: ocrResult.data,
      },
      message: ocrResult.success
        ? `OCR completed: ${documentType} processed with ${Math.round(ocrResult.confidence * 100)}% confidence`
        : 'OCR processing failed',
    })
  } catch (error) {
    apiLogger.error('Error in document-process:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai-crm/cro/document-process?entity_type=lead&entity_id=xxx
 *
 * Returns OCR processing status for all documents in an entity.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')

    if (!entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'Missing entity_type or entity_id' },
        { status: 400 }
      )
    }

    const tableMap: Record<string, string> = {
      lead: 'crm_leads',
      deal: 'crm_deals',
    }
    const tableName = tableMap[entityType]
    if (!tableName) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity_type' },
        { status: 400 }
      )
    }

    const { data: entity, error: fetchError } = await supabase
      .from(tableName)
      .select('documents')
      .eq('id', entityId)
      .maybeSingle()

    if (fetchError || !entity) {
      return NextResponse.json(
        { success: false, error: `${entityType} not found` },
        { status: 404 }
      )
    }

    const documents = (entity.documents || []) as Array<Record<string, unknown>>

    const summary = {
      total: documents.length,
      processed: documents.filter((d) => d.ocr_status === 'completed').length,
      failed: documents.filter((d) => d.ocr_status === 'failed').length,
      pending: documents.filter((d) => !d.ocr_status).length,
      documents: documents.map((d) => ({
        id: d.id,
        name: d.name,
        doc_key: d.doc_key,
        ocr_status: d.ocr_status || 'pending',
        ocr_confidence: d.ocr_confidence,
        ocr_document_type: d.ocr_document_type,
        extracted_data: d.extracted_data,
        ocr_processed_at: d.ocr_processed_at,
      })),
    }

    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    apiLogger.error('Error in document-process GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
