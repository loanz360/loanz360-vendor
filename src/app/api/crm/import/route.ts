import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'


// POST /api/crm/import - Import leads from CSV
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // Only Super Admin can import leads
    if (profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Only Super Admin can import leads' }, { status: 403 })
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { leads, skip_duplicates, default_assigned_to } = body

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ success: false, error: 'leads array is required' }, { status: 400 })
    }

    // Create import batch record
    const { data: importBatch, error: batchError } = await supabase
      .from('crm_import_batches')
      .insert({
        imported_by: user.id,
        total_rows: leads.length,
        status: 'Processing',
        file_name: body.file_name || 'api_import.csv',
        source: 'api'
      })
      .select()
      .maybeSingle()

    if (batchError) {
      apiLogger.error('Error creating import batch', batchError)
      return NextResponse.json({ success: false, error: 'Failed to create import batch' }, { status: 500 })
    }

    // Process leads
    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      errors: [] as any[]
    }

    for (let i = 0; i < leads.length; i++) {
      const leadData = leads[i]

      try {
        // Validate required fields
        if (!leadData.customer_name || !leadData.customer_mobile || !leadData.loan_type) {
          results.failed++
          results.errors.push({
            row: i + 1,
            data: leadData,
            error: 'Missing required fields: customer_name, customer_mobile, loan_type'
          })
          continue
        }

        // Check for duplicates if skip_duplicates is enabled
        if (skip_duplicates) {
          const { data: existingLead } = await supabase
            .from('crm_leads')
            .select('id')
            .eq('phone', leadData.customer_mobile)
            .is('deleted_at', null)
            .maybeSingle()

          if (existingLead) {
            results.skipped++
            continue
          }
        }

        // Prepare lead data - map CSV input fields to crm_leads schema
        const newLeadData: any = {
          customer_name: leadData.customer_name,
          phone: leadData.customer_mobile,
          alternate_phone: leadData.alternate_phone || null,
          email: leadData.customer_email || null,
          location: leadData.customer_city || leadData.location || null,
          loan_type: leadData.loan_type,
          loan_amount: leadData.loan_amount_required || leadData.loan_amount || null,
          loan_purpose: leadData.loan_purpose || null,
          business_name: leadData.business_name || leadData.company_name || null,
          business_type: leadData.business_type || null,
          monthly_income: leadData.monthly_income || null,
          source: leadData.lead_source || 'CSV Import',
          status: (leadData.lead_status || 'active').toLowerCase(),
          stage: (leadData.priority || 'new').toLowerCase(),
          cro_id: leadData.assigned_to || default_assigned_to || user.id
        }

        // Insert lead
        const { error: insertError } = await supabase
          .from('crm_leads')
          .insert(newLeadData)

        if (insertError) {
          results.failed++
          results.errors.push({
            row: i + 1,
            data: leadData,
            error: insertError.message
          })
        } else {
          results.success++
        }

      } catch (error) {
        results.failed++
        results.errors.push({
          row: i + 1,
          data: leadData,
          error: String(error)
        })
      }
    }

    // Update import batch with results
    await supabase
      .from('crm_import_batches')
      .update({
        status: 'Completed',
        success_count: results.success,
        failed_count: results.failed,
        error_details: results.errors.length > 0 ? results.errors : null,
        completed_at: new Date().toISOString()
      })
      .eq('id', importBatch.id)

    return NextResponse.json({
      success: true,
      batch_id: importBatch.id,
      results: {
        total: leads.length,
        success: results.success,
        skipped: results.skipped,
        failed: results.failed,
        errors: results.errors
      }
    })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/import', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/crm/import - Get import batch history
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const offset = (page - 1) * limit

    // Fetch import batches
    const { data: batches, error: batchesError, count } = await supabase
      .from('crm_import_batches')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (batchesError) {
      apiLogger.error('Error fetching import batches', batchesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch import batches' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: batches,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/crm/import', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
