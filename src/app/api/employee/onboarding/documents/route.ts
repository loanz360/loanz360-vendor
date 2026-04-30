
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

// Validation schema for document upload
const documentUploadSchema = z.object({
  document_type_id: z.string().uuid(),
  file_path: z.string().min(1),
  file_size_kb: z.number().positive(),
  file_type: z.string().min(1),
});

/**
 * GET /api/employee/onboarding/documents
 * Get employee's uploaded documents and required document types
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get employee's onboarding record
    const { data: onboarding } = await supabase
      .from('employee_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Get all required document types
    const { data: documentTypes, error: typesError } = await supabase
      .from('onboarding_document_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (typesError) {
      apiLogger.error('Error fetching document types', typesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch document types' },
        { status: 500 }
      );
    }

    // Get employee's uploaded documents
    const { data: uploadedDocuments, error: docsError } = await supabase
      .from('employee_onboarding_documents')
      .select(`
        *,
        document_type:onboarding_document_types(
          id,
          document_name,
          document_code,
          description,
          is_mandatory
        ),
        verified_by_user:employee_profile!verified_by(
          user_id,
          first_name,
          last_name
        )
      `)
      .eq('employee_onboarding_id', onboarding.id);

    if (docsError) {
      apiLogger.error('Error fetching documents', docsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Map uploaded documents to their types
    const documentStatus = documentTypes.map(type => {
      const uploaded = uploadedDocuments?.find(doc => doc.document_type.id === type.id);

      return {
        document_type: type,
        uploaded: !!uploaded,
        document: uploaded ? {
          id: uploaded.id,
          document_name: uploaded.document_name,
          file_path: uploaded.file_path,
          file_size_kb: uploaded.file_size_kb,
          file_type: uploaded.file_type,
          is_verified: uploaded.is_verified,
          verification_notes: uploaded.verification_notes,
          uploaded_at: uploaded.uploaded_at,
          verified_by: uploaded.verified_by_user ? {
            id: uploaded.verified_by_user.user_id,
            name: `${uploaded.verified_by_user.first_name} ${uploaded.verified_by_user.last_name}`,
          } : null,
        } : null,
      };
    });

    // Calculate completion percentage
    const mandatoryDocs = documentTypes.filter(dt => dt.is_mandatory);
    const uploadedMandatory = mandatoryDocs.filter(dt =>
      uploadedDocuments?.some(doc => doc.document_type.id === dt.id)
    );
    const completionPercentage = mandatoryDocs.length > 0
      ? Math.round((uploadedMandatory.length / mandatoryDocs.length) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        documents: documentStatus,
        summary: {
          total_required: documentTypes.length,
          mandatory_required: mandatoryDocs.length,
          total_uploaded: uploadedDocuments?.length || 0,
          mandatory_uploaded: uploadedMandatory.length,
          completion_percentage: completionPercentage,
          all_mandatory_uploaded: uploadedMandatory.length === mandatoryDocs.length,
        },
      },
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/employee/onboarding/documents
 * Upload document (file upload should be done via Supabase Storage first)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get employee's onboarding record
    const { data: onboarding } = await supabase
      .from('employee_onboarding')
      .select('id, onboarding_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Only allow uploads if status is appropriate
    if (!['pending', 'profile_incomplete', 'documents_pending'].includes(onboarding.onboarding_status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Documents cannot be uploaded in current status',
          current_status: onboarding.onboarding_status
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = documentUploadSchema.parse(body);

    // Get document type details
    const { data: documentType, error: typeError } = await supabase
      .from('onboarding_document_types')
      .select('*')
      .eq('id', validatedData.document_type_id)
      .eq('is_active', true)
      .maybeSingle();

    if (typeError || !documentType) {
      return NextResponse.json(
        { success: false, error: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Check if document already exists for this type
    const { data: existing } = await supabase
      .from('employee_onboarding_documents')
      .select('id')
      .eq('employee_onboarding_id', onboarding.id)
      .eq('document_type_id', validatedData.document_type_id)
      .maybeSingle();

    let result;

    if (existing) {
      // Update existing document
      const { data: updated, error: updateError } = await supabase
        .from('employee_onboarding_documents')
        .update({
          document_name: documentType.document_name,
          file_path: validatedData.file_path,
          file_size_kb: validatedData.file_size_kb,
          file_type: validatedData.file_type,
          is_verified: false, // Reset verification status
          verified_by: null,
          verified_at: null,
          verification_notes: null,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user.id,
        })
        .eq('id', existing.id)
        .select()
        .maybeSingle();

      if (updateError) {
        apiLogger.error('Error updating document', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update document' },
          { status: 500 }
        );
      }

      result = updated;
    } else {
      // Insert new document
      const { data: inserted, error: insertError } = await supabase
        .from('employee_onboarding_documents')
        .insert({
          employee_onboarding_id: onboarding.id,
          document_type_id: validatedData.document_type_id,
          document_name: documentType.document_name,
          file_path: validatedData.file_path,
          file_size_kb: validatedData.file_size_kb,
          file_type: validatedData.file_type,
          uploaded_by: user.id,
        })
        .select()
        .maybeSingle();

      if (insertError) {
        apiLogger.error('Error inserting document', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to upload document' },
          { status: 500 }
        );
      }

      result = inserted;
    }

    return NextResponse.json({
      success: true,
      message: existing ? 'Document updated successfully' : 'Document uploaded successfully',
      data: result,
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
