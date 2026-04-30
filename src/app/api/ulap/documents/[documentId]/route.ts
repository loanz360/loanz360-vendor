
/**
 * ULAP Document API
 * GET/DELETE /api/ulap/documents/[documentId]
 *
 * Get or delete a specific document
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generatePresignedUrl, deleteFromS3 } from '@/lib/aws/s3-client';
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

// GET: Get document details with presigned URL
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get document details
    const { data: document, error } = await supabase
      .from('lead_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Generate presigned URL for secure access
    let presignedUrl = document.s3_url;
    if (document.s3_key) {
      const urlResult = await generatePresignedUrl({
        key: document.s3_key,
        expiresIn: 3600, // 1 hour
        operation: 'get',
      });

      if (urlResult.success && urlResult.url) {
        presignedUrl = urlResult.url;
      }
    }

    // Generate presigned URL for thumbnail if exists
    let thumbnailPresignedUrl = document.thumbnail_url;
    if (document.thumbnail_s3_key) {
      const thumbResult = await generatePresignedUrl({
        key: document.thumbnail_s3_key,
        expiresIn: 3600,
        operation: 'get',
      });

      if (thumbResult.success && thumbResult.url) {
        thumbnailPresignedUrl = thumbResult.url;
      }
    }

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        leadId: document.lead_id,
        documentType: document.document_type,
        documentCategory: document.document_category,
        fileName: document.file_name,
        originalFileName: document.original_file_name,
        fileSize: document.file_size_bytes,
        originalFileSize: document.original_file_size_bytes,
        fileType: document.file_type,
        mimeType: document.mime_type,
        isCompressed: document.is_compressed,
        compressionRatio: document.compression_ratio,
        isVerified: document.is_verified,
        verifiedAt: document.verified_at,
        verifiedBy: document.verified_by,
        isRequired: document.is_required,
        url: presignedUrl,
        thumbnailUrl: thumbnailPresignedUrl,
        uploadedAt: document.created_at,
        uploadedBy: document.uploaded_by_name,
      },
    });
  } catch (error) {
    apiLogger.error('Get document error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a document
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();

    // Get document details
    const { data: document, error } = await supabase
      .from('lead_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check authorization - only document uploader, lead owner, or admin can delete
    if (user && document.uploaded_by_id !== user.id) {
      // Check if user is associated with the lead
      const { data: lead } = await supabase
        .from('leads')
        .select('source_id, customer_id')
        .eq('id', document.lead_id)
        .maybeSingle();

      if (!lead || (lead.source_id !== user.id && lead.customer_id !== user.id)) {
        // Check if user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.role?.includes('admin')) {
          return NextResponse.json(
            { error: 'Not authorized to delete this document' },
            { status: 403 }
          );
        }
      }
    }

    // Soft delete from database (mark as inactive)
    const { error: updateError } = await supabase
      .from('lead_documents')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id || 'public',
      })
      .eq('id', documentId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    // Optionally delete from S3 (uncomment if immediate deletion is required)
    // if (document.s3_key) {
    //   await deleteFromS3(document.s3_key);
    // }
    // if (document.thumbnail_s3_key) {
    //   await deleteFromS3(document.thumbnail_s3_key);
    // }

    // Update lead's collected_data to remove from uploaded_documents
    const { data: lead } = await supabase
      .from('leads')
      .select('collected_data')
      .eq('id', document.lead_id)
      .maybeSingle();

    if (lead?.collected_data) {
      const currentData = lead.collected_data as Record<string, unknown>;
      const uploadedDocuments = (currentData.uploaded_documents as string[]) || [];
      const updatedDocuments = uploadedDocuments.filter(
        (dt) => dt !== document.document_type
      );

      await supabase
        .from('leads')
        .update({
          collected_data: {
            ...currentData,
            uploaded_documents: updatedDocuments,
          },
        })
        .eq('id', document.lead_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    apiLogger.error('Delete document error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: Update document verification status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;
    const body = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has verification permissions (employee/admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle();

    const isEmployee = profile?.role?.includes('employee') || profile?.role?.includes('admin');
    if (!isEmployee) {
      return NextResponse.json(
        { error: 'Only employees can verify documents' },
        { status: 403 }
      );
    }

    // Update document verification status
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.isVerified !== undefined) {
      updateData.is_verified = body.isVerified;
      updateData.verified_at = body.isVerified ? new Date().toISOString() : null;
      updateData.verified_by = body.isVerified ? user.id : null;
      updateData.verified_by_name = body.isVerified ? profile?.full_name : null;
    }

    if (body.rejectionReason !== undefined) {
      updateData.rejection_reason = body.rejectionReason;
      updateData.is_verified = false;
      updateData.verified_at = null;
      updateData.verified_by = null;
    }

    if (body.notes !== undefined) {
      updateData.verification_notes = body.notes;
    }

    const { data: document, error } = await supabase
      .from('lead_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: body.isVerified ? 'Document verified' : 'Document status updated',
      document: {
        id: document.id,
        isVerified: document.is_verified,
        verifiedAt: document.verified_at,
        verifiedBy: document.verified_by_name,
        rejectionReason: document.rejection_reason,
      },
    });
  } catch (error) {
    apiLogger.error('Update document error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
