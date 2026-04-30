
/**
 * ULAP Lead Phase 2 Submission API
 * PUT /api/ulap/lead/[leadNumber]/phase2
 *
 * Submit Phase 2 application (complete application)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { apiLogger } from '@/lib/utils/logger'
import { createULAPPipelineService } from '@/lib/services/ulap-pipeline-service'

interface RouteParams {
  params: Promise<{ leadNumber: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { leadNumber } = await params;
    const body = await request.json();

    if (!leadNumber) {
      return NextResponse.json(
        { error: 'Lead number is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Fetch existing lead
    const { data: existingLead, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('lead_number', leadNumber)
      .maybeSingle();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Don't allow re-submission
    if (existingLead.form_status === 'PHASE_2_SUBMITTED') {
      return NextResponse.json(
        { error: 'Application has already been submitted' },
        { status: 400 }
      );
    }

    // Validate required documents
    const documents = body.documents || [];
    const requiredDocTypes = ['pan_card', 'aadhaar_front', 'aadhaar_back', 'photo', 'bank_statement'];

    // Get uploaded documents from database
    const { data: uploadedDocs } = await supabase
      .from('lead_documents')
      .select('document_type')
      .eq('lead_id', existingLead.id)
      .eq('is_active', true);

    const uploadedDocTypes = uploadedDocs?.map((d) => d.document_type) || [];
    const missingDocs = requiredDocTypes.filter((type) => !uploadedDocTypes.includes(type));

    if (missingDocs.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required documents',
          missingDocuments: missingDocs,
        },
        { status: 400 }
      );
    }

    // Merge all collected data
    const currentData = (existingLead.collected_data as Record<string, unknown>) || {};
    const newData = body.collected_data || {};

    const completedData = {
      ...currentData,
      ...newData,
      phase2_submitted_at: new Date().toISOString(),
      submitted_documents: uploadedDocTypes,
    };

    // Update lead status to Phase 2 Submitted
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        collected_data: completedData,
        form_status: 'PHASE_2_SUBMITTED',
        application_phase: 2,
        form_completion_percentage: 100,
        submission_ip: request.headers.get('x-forwarded-for') ||
                       request.headers.get('x-real-ip') ||
                       'unknown',
        submission_user_agent: request.headers.get('user-agent') || 'unknown',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingLead.id);

    if (updateError) {
      apiLogger.error('Lead update error', updateError);
      return NextResponse.json(
        { error: 'Failed to submit application' },
        { status: 500 }
      );
    }

    // Trigger automated CAM pipeline (async — don't wait)
    // Flow: Bridge to partner_leads → Generate CAM → Create Deal → Assign BDE
    const pipelineService = createULAPPipelineService(supabase);
    pipelineService.triggerCAMPipeline(existingLead.id).catch(err =>
      apiLogger.error('CAM pipeline failed', err)
    );

    // Send notification to partner if source_id exists
    if (existingLead.source_id) {
      sendPartnerNotification(
        existingLead.source_id,
        existingLead.source_type,
        leadNumber,
        supabase
      ).catch(err => apiLogger.error('Partner notification failed', err));
    }

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully. CAM generation has been initiated.',
      leadNumber: leadNumber,
      status: 'PHASE_2_SUBMITTED',
      pipeline_status: 'CAM_BRIDGED',
    });
  } catch (error) {
    apiLogger.error('Phase 2 submission error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Send notification to partner about Phase 2 completion
async function sendPartnerNotification(
  partnerId: string,
  sourceType: string,
  leadNumber: string,
  supabase: any
) {
  try {
    const partnerType = sourceType === 'BA' ? 'Business Associate' : 'Bank Partner';

    await supabase
      .from('notifications')
      .insert({
        user_id: partnerId,
        title: 'Application Completed',
        message: `Your customer has completed their loan application (${leadNumber}). The lead has been submitted for processing.`,
        type: 'LEAD_PHASE2_COMPLETED',
        data: { lead_number: leadNumber },
        is_read: false,
      });
  } catch (error) {
    apiLogger.error('Partner notification error', error);
  }
}
