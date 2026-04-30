
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get user's onboarding record
    const { data: onboarding } = await supabase
      .from('employee_onboarding')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Only allow deletion if onboarding is in progress
    if (onboarding.status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete documents after submission' },
        { status: 403 }
      );
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('employee_onboarding_documents')
      .select('*')
      .eq('id', params.id)
      .eq('onboarding_id', onboarding.id)
      .maybeSingle();

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete file from storage
    if (document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('employee-documents')
        .remove([document.storage_path]);

      if (storageError) {
        apiLogger.error('Error deleting file from storage', storageError);
      }
    }

    // Delete document record
    const { error: deleteError } = await supabase
      .from('employee_onboarding_documents')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      apiLogger.error('Error deleting document record', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
