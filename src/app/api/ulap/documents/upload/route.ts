
/**
 * ULAP Document Upload API
 * POST /api/ulap/documents/upload
 *
 * Handles document uploads for ULAP lead applications
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadLeadDocument } from '@/lib/aws/document-upload';
import { createServerClient } from '@/lib/supabase/server';
import { apiLogger } from '@/lib/utils/logger'

// Maximum file size: 20MB
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Document type to category mapping
const DOCUMENT_CATEGORIES: Record<string, string> = {
  pan_card: 'identity',
  aadhaar_front: 'identity',
  aadhaar_back: 'identity',
  photo: 'identity',
  bank_statement: 'bank',
  salary_slip: 'income',
  itr: 'income',
  itr_2_years: 'income',
  gst_certificate: 'income',
  business_proof: 'income',
  property_documents: 'property',
  property_tax_receipt: 'property',
  building_plan: 'property',
  vehicle_rc: 'property',
  vehicle_quotation: 'property',
  other: 'other',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Get form fields
    const file = formData.get('file') as File | null;
    const leadId = formData.get('leadId') as string | null;
    const leadNumber = formData.get('leadNumber') as string | null;
    const documentType = formData.get('documentType') as string | null;
    const documentCategory = formData.get('documentCategory') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type is required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' is not allowed. Allowed types: PDF, JPG, PNG, DOCX, XLSX` },
        { status: 400 }
      );
    }

    // Determine uploader information
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    let uploadedById = 'public';
    let uploadedByType: 'CUSTOMER' | 'PARTNER' | 'EMPLOYEE' = 'CUSTOMER';
    let uploadedByName = 'Public User';

    if (user) {
      uploadedById = user.id;
      // Check user type from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        uploadedByName = profile.full_name || user.email || 'Unknown';
        uploadedByType = profile.role?.includes('partner') ? 'PARTNER' :
                        profile.role?.includes('employee') ? 'EMPLOYEE' : 'CUSTOMER';
      }
    }

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, lead_number, customer_id')
      .eq('id', leadId)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine document category
    const category = documentCategory || DOCUMENT_CATEGORIES[documentType] || 'other';

    // Check if this document type already exists for the lead
    const { data: existingDoc } = await supabase
      .from('lead_documents')
      .select('id')
      .eq('lead_id', leadId)
      .eq('document_type', documentType)
      .maybeSingle();

    // If exists, we'll replace it (the old one will be soft deleted)
    if (existingDoc) {
      await supabase
        .from('lead_documents')
        .update({
          is_active: false,
          replaced_at: new Date().toISOString()
        })
        .eq('id', existingDoc.id);
    }

    // Upload document
    const uploadResult = await uploadLeadDocument({
      leadId,
      customerId: lead.customer_id,
      uploadedById,
      uploadedByType,
      uploadedByName,
      documentType,
      documentCategory: category,
      file: buffer,
      fileName: file.name,
      mimeType: file.type,
      isRequired: isRequiredDocument(documentType),
      compress: true,
      generateThumbnail: file.type.startsWith('image/'),
      uploadIp: request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                'unknown',
      uploadUserAgent: request.headers.get('user-agent') || 'unknown',
    });

    if (!uploadResult.success) {
      apiLogger.error('Document upload failed', uploadResult.error);
      return NextResponse.json(
        { error: uploadResult.error || 'Upload failed', validationErrors: uploadResult.validationErrors },
        { status: 500 }
      );
    }

    // Update lead's collected_data to track uploaded documents
    const { data: currentLead } = await supabase
      .from('leads')
      .select('collected_data')
      .eq('id', leadId)
      .maybeSingle();

    const currentData = (currentLead?.collected_data as Record<string, unknown>) || {};
    const uploadedDocuments = (currentData.uploaded_documents as string[]) || [];

    if (!uploadedDocuments.includes(documentType)) {
      uploadedDocuments.push(documentType);
    }

    await supabase
      .from('leads')
      .update({
        collected_data: {
          ...currentData,
          uploaded_documents: uploadedDocuments,
          last_document_upload: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      document: uploadResult.document,
    });

  } catch (error) {
    apiLogger.error('Document upload error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to check if document type is required
function isRequiredDocument(documentType: string): boolean {
  const requiredTypes = [
    'pan_card',
    'aadhaar_front',
    'aadhaar_back',
    'photo',
    'bank_statement',
    'salary_slip',
  ];
  return requiredTypes.includes(documentType);
}
