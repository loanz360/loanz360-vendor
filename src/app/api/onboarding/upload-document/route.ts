
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's onboarding record
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentTypeId = formData.get('document_type_id') as string;

    if (!file || !documentTypeId) {
      return NextResponse.json(
        { success: false, error: 'File and document type are required' },
        { status: 400 }
      );
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${documentTypeId}-${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      apiLogger.error('Error uploading file', uploadError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get file size in KB
    const fileSizeKB = Math.round(file.size / 1024);

    // Check if document already exists for this type
    const { data: existingDoc } = await supabase
      .from('employee_onboarding_documents')
      .select('id')
      .eq('onboarding_id', onboarding.id)
      .eq('document_type_id', documentTypeId)
      .maybeSingle();

    if (existingDoc) {
      // Update existing document
      const { data: updated, error: updateError } = await supabase
        .from('employee_onboarding_documents')
        .update({
          file_name: file.name,
          file_path: uploadData.path,
          storage_path: fileName,
          storage_bucket: 'employee-documents',
          file_size_kb: fileSizeKB,
          file_type: file.type,
          uploaded_at: new Date().toISOString(),
          is_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDoc.id)
        .select()
        .maybeSingle();

      if (updateError) {
        apiLogger.error('Error updating document record', updateError);
        // Delete uploaded file
        await supabase.storage.from('employee-documents').remove([fileName]);
        return NextResponse.json(
          { success: false, error: 'Failed to update document record' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Document replaced successfully',
        data: updated,
      });
    } else {
      // Create new document record
      const { data: newDoc, error: insertError } = await supabase
        .from('employee_onboarding_documents')
        .insert({
          onboarding_id: onboarding.id,
          document_type_id: documentTypeId,
          file_name: file.name,
          file_path: uploadData.path,
          storage_path: fileName,
          storage_bucket: 'employee-documents',
          file_size_kb: fileSizeKB,
          file_type: file.type,
          is_verified: false,
        })
        .select()
        .maybeSingle();

      if (insertError) {
        apiLogger.error('Error creating document record', insertError);
        // Delete uploaded file
        await supabase.storage.from('employee-documents').remove([fileName]);
        return NextResponse.json(
          { success: false, error: 'Failed to create document record' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Document uploaded successfully',
        data: newDoc,
      });
    }
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
