
/**
 * ULAP Documents List API
 * GET /api/ulap/documents?leadId=xxx
 *
 * Lists all documents for a lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generatePresignedUrl } from '@/lib/aws/s3-client';
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const leadNumber = searchParams.get('leadNumber');

    if (!leadId && !leadNumber) {
      return NextResponse.json(
        { error: 'Lead ID or Lead Number is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Find lead
    let targetLeadId = leadId;
    if (!targetLeadId && leadNumber) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('lead_number', leadNumber)
        .maybeSingle();

      if (!lead) {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }
      targetLeadId = lead.id;
    }

    // Get documents
    const { data: documents, error } = await supabase
      .from('lead_documents')
      .select('*')
      .eq('lead_id', targetLeadId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      apiLogger.error('Error fetching documents', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Generate presigned URLs for each document
    const documentsWithUrls = await Promise.all(
      (documents || []).map(async (doc) => {
        let presignedUrl = doc.s3_url;
        let thumbnailPresignedUrl = doc.thumbnail_url;

        // Generate presigned URL for secure access
        if (doc.s3_key) {
          const urlResult = await generatePresignedUrl({
            key: doc.s3_key,
            expiresIn: 3600, // 1 hour
            operation: 'get',
          });

          if (urlResult.success && urlResult.url) {
            presignedUrl = urlResult.url;
          }
        }

        // Generate presigned URL for thumbnail
        if (doc.thumbnail_s3_key) {
          const thumbResult = await generatePresignedUrl({
            key: doc.thumbnail_s3_key,
            expiresIn: 3600,
            operation: 'get',
          });

          if (thumbResult.success && thumbResult.url) {
            thumbnailPresignedUrl = thumbResult.url;
          }
        }

        return {
          documentType: doc.document_type,
          fileName: doc.file_name,
          fileSize: doc.file_size_bytes,
          status: doc.is_verified ? 'verified' : doc.rejection_reason ? 'rejected' : 'uploaded',
          progress: 100,
          uploadedUrl: presignedUrl,
          documentId: doc.id,
          thumbnailUrl: thumbnailPresignedUrl,
          uploadedAt: doc.created_at,
          isVerified: doc.is_verified,
          verifiedAt: doc.verified_at,
          verifiedBy: doc.verified_by_name,
          rejectionReason: doc.rejection_reason,
          documentCategory: doc.document_category,
          isRequired: doc.is_required,
        };
      })
    );

    // Group by document type (latest only)
    const latestByType: Record<string, typeof documentsWithUrls[0]> = {};
    documentsWithUrls.forEach((doc) => {
      if (!latestByType[doc.documentType] ||
          new Date(doc.uploadedAt || 0) > new Date(latestByType[doc.documentType].uploadedAt || 0)) {
        latestByType[doc.documentType] = doc;
      }
    });

    return NextResponse.json({
      success: true,
      documents: Object.values(latestByType),
      total: Object.values(latestByType).length,
    });
  } catch (error) {
    apiLogger.error('List documents error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
