
/**
 * Superadmin ULAP Leads API
 *
 * This API now queries leads table (Unified CRM Pipeline) instead of ulap_leads.
 * ULAP leads are identified by form_source starting with 'ULAP_'.
 *
 * Note: This endpoint is maintained for backward compatibility.
 * Consider using /api/admin/leads or /api/unified-leads for full lead management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ULAP form_source values
const ULAP_FORM_SOURCES = [
  'ULAP_PUBLIC_FORM',
  'ULAP_PARTNER_LINK',
  'ULAP_EMPLOYEE',
  'ULAP_CUSTOMER_REFERRAL',
];

// GET - Fetch ULAP leads from leads with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const formSource = searchParams.get('form_source');
    const loanType = searchParams.get('loan_type');
    const createdByType = searchParams.get('created_by_type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Support both page-based and offset-based pagination
    const offsetParam = searchParams.get('offset');
    const pageParam = searchParams.get('page');
    const offset = offsetParam ? parseInt(offsetParam) : pageParam ? (parseInt(pageParam) - 1) * limit : 0;
    const page = Math.floor(offset / limit) + 1;

    // Query leads, filtering for ULAP-sourced leads
    let query = supabase
      .from('leads')
      .select(
        `
        id,
        lead_id,
        customer_name,
        customer_mobile,
        customer_email,
        customer_city,
        customer_state,
        loan_type,
        loan_amount,
        lead_status,
        form_status,
        form_source,
        form_completion_percentage,
        form_submitted_at,
        partner_id,
        partner_type,
        employee_id,
        employee_type,
        assigned_bde_id,
        assigned_bde_name,
        cam_status,
        collected_data,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .in('form_source', ULAP_FORM_SOURCES)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by lead_status if provided
    if (status) {
      query = query.eq('lead_status', status);
    }

    // Filter by form_source if provided
    if (formSource && ULAP_FORM_SOURCES.includes(formSource)) {
      query = query.eq('form_source', formSource);
    }

    // Filter by loan_type if provided
    if (loanType) {
      query = query.eq('loan_type', loanType);
    }

    // Filter by ULAP source type from collected_data (via created_by_type param)
    // This maps to the ulap_source_type stored in collected_data
    if (createdByType) {
      query = query.contains('collected_data', { ulap_source_type: createdByType });
    }

    // Search across multiple fields
    if (search) {
      const sanitizedSearch = search.replace(/[%_'";\\]/g, '');
      query = query.or(
        `customer_name.ilike.%${sanitizedSearch}%,customer_mobile.ilike.%${sanitizedSearch}%,lead_id.ilike.%${sanitizedSearch}%,customer_email.ilike.%${sanitizedSearch}%`
      );
    }

    const { data: leads, error, count } = await query;

    if (error) {
      apiLogger.error('Error fetching ULAP leads', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Transform leads to include ULAP-specific data from collected_data
    const transformedLeads = (leads || []).map((lead) => {
      const collectedData = (lead.collected_data as Record<string, unknown>) || {};
      const ulapData = (collectedData.ulap_data as Record<string, unknown>) || {};
      const createdBy = (collectedData.created_by as Record<string, unknown>) || {};

      return {
        ...lead,
        // Extract ULAP-specific fields from collected_data
        ulap_source_type: collectedData.ulap_source_type || null,
        ulap_category_name: ulapData.category_name || null,
        ulap_subcategory_name: ulapData.subcategory_name || null,
        created_by_type: createdBy.type || null,
        created_by_name: createdBy.name || null,
        created_by_mobile: createdBy.mobile || null,
        // Map lead_status to a simplified status for UI
        status: lead.lead_status,
      };
    });

    // Get stats for ULAP leads
    const { data: statsData } = await supabase
      .from('leads')
      .select('lead_status, form_source')
      .in('form_source', ULAP_FORM_SOURCES);

    const statusCounts: Record<string, number> = {};
    const sourceTypeCounts: Record<string, number> = {};

    (statsData || []).forEach((lead) => {
      // Count by status
      const status = lead.lead_status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Count by form_source
      const source = lead.form_source || 'UNKNOWN';
      sourceTypeCounts[source] = (sourceTypeCounts[source] || 0) + 1;
    });

    return NextResponse.json({
      leads: transformedLeads,
      total: count || 0,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: statusCounts,
      sourceStats: sourceTypeCounts,
      message: 'ULAP leads are now managed in the Unified CRM Pipeline. Consider using /superadmin/leads-management for full functionality.',
    });
  } catch (error) {
    apiLogger.error('Error in ULAP leads API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update ULAP lead status in leads
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, lead_status, internal_notes, remarks, updated_by_name } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Support both 'status' and 'lead_status' for backward compatibility
    if (status || lead_status) {
      const newStatus = status || lead_status;

      // Fetch current status for validation
      const { data: currentLead } = await supabase
        .from('leads')
        .select('lead_status')
        .eq('id', id)
        .maybeSingle();

      if (currentLead?.lead_status) {
        const { isValidTransition } = await import('@/lib/utils/lead-status-machine');
        if (!isValidTransition(currentLead.lead_status, newStatus)) {
          return NextResponse.json({ success: false, error: `Invalid status transition: ${currentLead.lead_status} → ${newStatus}`,
            current_status: currentLead.lead_status,
            allowed_transitions: (await import('@/lib/utils/lead-status-machine')).getNextStatuses(currentLead.lead_status),
          }, { status: 400 });
        }
      }

      updates.lead_status = newStatus;
    }

    if (internal_notes !== undefined || remarks !== undefined) {
      updates.remarks = internal_notes || remarks;
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error updating lead', error);
      return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lead: {
        id: lead.id,
        lead_id: lead.lead_id,
        lead_status: lead.lead_status,
        form_status: lead.form_status,
      },
    });
  } catch (error) {
    apiLogger.error('Error in update lead API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
