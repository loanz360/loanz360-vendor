export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/employee/onboarding/submit
 * Submit onboarding for HR approval
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
    const { data: onboarding, error: onboardingError } = await supabase
      .from('employee_onboarding')
      .select('id, onboarding_status, profile_completed_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (onboardingError || !onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Check if status allows submission
    if (!['documents_pending', 'profile_incomplete'].includes(onboarding.onboarding_status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Onboarding cannot be submitted in current status',
          current_status: onboarding.onboarding_status
        },
        { status: 400 }
      );
    }

    // Check if profile is completed
    if (!onboarding.profile_completed_at) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please complete your profile before submitting',
          missing: 'profile_completion'
        },
        { status: 400 }
      );
    }

    // Get all mandatory document types
    const { data: mandatoryDocTypes, error: typesError } = await supabase
      .from('onboarding_document_types')
      .select('id, document_name, document_code')
      .eq('is_mandatory', true)
      .eq('is_active', true);

    if (typesError) {
      apiLogger.error('Error fetching document types', typesError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify document requirements' },
        { status: 500 }
      );
    }

    // Get employee's uploaded documents
    const { data: uploadedDocs, error: docsError } = await supabase
      .from('employee_onboarding_documents')
      .select('document_type_id')
      .eq('employee_onboarding_id', onboarding.id);

    if (docsError) {
      apiLogger.error('Error fetching uploaded documents', docsError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify uploaded documents' },
        { status: 500 }
      );
    }

    // Check if all mandatory documents are uploaded
    const uploadedTypeIds = uploadedDocs?.map(doc => doc.document_type_id) || [];
    const missingDocs = mandatoryDocTypes.filter(
      docType => !uploadedTypeIds.includes(docType.id)
    );

    if (missingDocs.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please upload all mandatory documents before submitting',
          missing_documents: missingDocs.map(doc => ({
            name: doc.document_name,
            code: doc.document_code
          }))
        },
        { status: 400 }
      );
    }

    // Update onboarding status to submitted for HR review
    const { data: updated, error: updateError } = await supabase
      .from('employee_onboarding')
      .update({
        onboarding_status: 'documents_submitted',
        documents_submitted_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating onboarding status', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to submit onboarding' },
        { status: 500 }
      );
    }

    // TODO: Send notification to HR for review
    // This should be implemented using your notification system

    return NextResponse.json({
      success: true,
      message: 'Onboarding submitted successfully for HR review',
      data: {
        onboarding_status: updated.onboarding_status,
        submitted_at: updated.documents_submitted_at,
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
