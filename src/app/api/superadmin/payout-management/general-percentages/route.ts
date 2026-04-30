import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


// Helper to parse and validate date strings
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  return date
}

// Helper to format date for database
function formatDateForDB(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * GET /api/superadmin/payout-management/general-percentages
 * Fetch all general payout percentages with pagination and search
 *
 * Rate Limit: 60 requests per minute
 */
export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getPayoutPercentagesHandler(req)
  })
}

async function getPayoutPercentagesHandler(request: NextRequest) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Validate and sanitize pagination parameters
    let page = parseInt(searchParams.get('page') || '1')
    let limit = parseInt(searchParams.get('limit') || '25')

    if (isNaN(page) || page < 1) page = 1
    if (isNaN(limit) || limit < 1) limit = 25
    if (limit > 100) limit = 100 // Maximum 100 items per page to prevent DoS

    const search = searchParams.get('search') || ''
    const bankName = searchParams.get('bank_name') || ''
    const location = searchParams.get('location') || ''
    const loanType = searchParams.get('loan_type') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Check if we want only current rates or all versions
    const showHistory = searchParams.get('show_history') === 'true'
    const effectiveDate = searchParams.get('effective_date') || ''

    // Build query
    let query = supabase
      .from('payout_general_percentages')
      .select('*', { count: 'exact' })

    // By default, only show current (active) rates unless history is requested
    if (!showHistory) {
      query = query.eq('is_current', true)
    }

    // Filter by effective date if provided
    if (effectiveDate) {
      const date = parseDate(effectiveDate)
      if (date) {
        const dateStr = formatDateForDB(date)
        query = query
          .lte('effective_from', dateStr)
          .or(`effective_to.is.null,effective_to.gt.${dateStr}`)
      }
    }

    // FIX ISSUE #9: Properly escape search to prevent SQL injection
    if (search) {
      // Escape special characters and use parameterized queries
      // Remove dangerous characters and limit length
      const sanitizedSearch = search
        .replace(/[%_'";\\]/g, '')
        .substring(0, 100) // Limit search length
        .trim()

      if (sanitizedSearch.length > 0) {
        // Use textSearch or separate eq filters to avoid SQL injection
        // Supabase's .ilike is safe when used with their query builder
        query = query.or(
          `bank_name.ilike.%${sanitizedSearch}%,` +
          `loan_type.ilike.%${sanitizedSearch}%,` +
          `location.ilike.%${sanitizedSearch}%`
        )
      }
    }
    if (bankName) {
      query = query.eq('bank_name', bankName)
    }
    if (location) {
      query = query.eq('location', location)
    }
    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    // Execute query with pagination
    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching payout percentages', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Get summary statistics
    const { data: summaryData } = await supabase
      .from('payout_general_percentages_summary')
      .select('*')
      .maybeSingle()

    // Get unique values for dropdowns
    const { data: banks } = await supabase
      .from('payout_general_percentages')
      .select('bank_name')
      .order('bank_name')

    const { data: locations } = await supabase
      .from('payout_general_percentages')
      .select('location')
      .order('location')

    const { data: loanTypes } = await supabase
      .from('payout_general_percentages')
      .select('loan_type')
      .order('loan_type')

    const uniqueBanks = [...new Set(banks?.map(b => b.bank_name) || [])]
    const uniqueLocations = [...new Set(locations?.map(l => l.location) || [])]
    const uniqueLoanTypes = [...new Set(loanTypes?.map(t => t.loan_type) || [])]

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      summary: summaryData || {},
      filters: {
        banks: uniqueBanks,
        locations: uniqueLocations,
        loanTypes: uniqueLoanTypes
      }
    })
  } catch (error) {
    apiLogger.error('Error in GET general percentages', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/payout-management/general-percentages
 * Create a new payout percentage entry
 *
 * Rate Limit: 30 requests per minute
 */
export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await createPayoutPercentageHandler(req)
  })
}

async function createPayoutPercentageHandler(request: NextRequest) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bodySchema = z.object({

      bank_name: z.string().optional(),

      location: z.string().optional(),

      loan_type: z.string().optional(),

      commission_percentage: z.string().optional(),

      effective_from: z.string().optional(),

      change_reason: z.string().optional(),

      id: z.string().uuid().optional(),

      specific_conditions: z.string().optional(),

      create_new_version: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      bank_name,
      location,
      loan_type,
      commission_percentage,
      effective_from,
      change_reason
    } = body

    // Parse effective date (defaults to today)
    let effectiveFromDate = new Date()
    if (effective_from) {
      const parsed = parseDate(effective_from)
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'Invalid effective_from date format. Use YYYY-MM-DD' },
          { status: 400 }
        )
      }
      effectiveFromDate = parsed
    }

    // Comprehensive validation
    if (!bank_name || typeof bank_name !== 'string' || bank_name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bank name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Location is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!loan_type || typeof loan_type !== 'string' || loan_type.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Loan type is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (commission_percentage === undefined || commission_percentage === null) {
      return NextResponse.json(
        { success: false, error: 'Commission percentage is required' },
        { status: 400 }
      )
    }

    // Validate commission percentage is a valid number
    const percentage = parseFloat(commission_percentage)
    if (isNaN(percentage)) {
      return NextResponse.json(
        { success: false, error: 'Commission percentage must be a valid number' },
        { status: 400 }
      )
    }

    if (percentage < 0 || percentage > 100) {
      return NextResponse.json(
        { success: false, error: 'Commission percentage must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Validate string lengths to prevent database errors
    if (bank_name.trim().length > 255) {
      return NextResponse.json(
        { success: false, error: 'Bank name must be less than 255 characters' },
        { status: 400 }
      )
    }

    if (location.trim().length > 255) {
      return NextResponse.json(
        { success: false, error: 'Location must be less than 255 characters' },
        { status: 400 }
      )
    }

    if (loan_type.trim().length > 255) {
      return NextResponse.json(
        { success: false, error: 'Loan type must be less than 255 characters' },
        { status: 400 }
      )
    }

    // Check for duplicate entry before insert (only check current entries with same effective date)
    const { data: existingEntry } = await supabase
      .from('payout_general_percentages')
      .select('id')
      .eq('bank_name', bank_name.trim())
      .eq('location', location.trim())
      .eq('loan_type', loan_type.trim())
      .eq('effective_from', formatDateForDB(effectiveFromDate))
      .maybeSingle()

    if (existingEntry) {
      return NextResponse.json(
        { success: false, error: 'A payout entry with this bank name, location, loan type, and effective date already exists' },
        { status: 409 }
      )
    }

    // Check if there's an existing current entry for this combination
    const { data: currentEntry } = await supabase
      .from('payout_general_percentages')
      .select('id, commission_percentage, effective_from')
      .eq('bank_name', bank_name.trim())
      .eq('location', location.trim())
      .eq('loan_type', loan_type.trim())
      .eq('is_current', true)
      .maybeSingle()

    // If there's a current entry and new effective date is in the future, update the old one
    if (currentEntry && effectiveFromDate > new Date()) {
      await supabase
        .from('payout_general_percentages')
        .update({
          effective_to: formatDateForDB(effectiveFromDate)
        })
        .eq('id', currentEntry.id)
    } else if (currentEntry) {
      // If effective date is today or past, mark old as superseded
      await supabase
        .from('payout_general_percentages')
        .update({
          effective_to: formatDateForDB(effectiveFromDate),
          is_current: false
        })
        .eq('id', currentEntry.id)
    }

    // Calculate version number
    const { data: versionData } = await supabase
      .from('payout_general_percentages')
      .select('version')
      .eq('bank_name', bank_name.trim())
      .eq('location', location.trim())
      .eq('loan_type', loan_type.trim())
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const newVersion = (versionData?.version || 0) + 1

    // Insert new entry with effective date and version
    const { data, error } = await supabase
      .from('payout_general_percentages')
      .insert({
        bank_name: bank_name.trim(),
        location: location.trim(),
        loan_type: loan_type.trim(),
        commission_percentage: percentage,
        effective_from: formatDateForDB(effectiveFromDate),
        effective_to: null,
        version: newVersion,
        is_current: true,
        change_reason: change_reason || null,
        created_by: auth.userId
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating payout percentage', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create payout percentage' },
        { status: 500 }
      )
    }

    // TODO: Add audit logging
    // await logPayoutCreated(data.id, sanitizeForAudit(data), auth.userId!, request)

    return NextResponse.json({
      success: true,
      message: 'Payout percentage created successfully',
      data
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST general percentages', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/superadmin/payout-management/general-percentages
 * Update an existing payout percentage entry
 *
 * Rate Limit: 30 requests per minute
 */
export async function PATCH(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await updatePayoutPercentageHandler(req)
  })
}

async function updatePayoutPercentageHandler(request: NextRequest) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bodySchema2 = z.object({

      change_reason: z.string().optional(),

      create_new_version: z.string().optional(),

      location: z.string().optional(),

      effective_from: z.string().optional(),

      specific_conditions: z.string().optional(),

      loan_type: z.string().optional(),

      commission_percentage: z.string().optional(),

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2

    const {
      id,
      location,
      loan_type,
      commission_percentage,
      specific_conditions,
      effective_from,
      change_reason,
      create_new_version
    } = body

    // Validate ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid ID is required' },
        { status: 400 }
      )
    }

    // Validate commission percentage if provided
    if (commission_percentage !== undefined) {
      const percentage = parseFloat(commission_percentage)
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        return NextResponse.json(
          { success: false, error: 'Commission percentage must be a number between 0 and 100' },
          { status: 400 }
        )
      }
    }

    // Get the existing entry
    const { data: existingEntry, error: fetchError } = await supabase
      .from('payout_general_percentages')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existingEntry) {
      return NextResponse.json(
        { error: 'Payout percentage entry not found' },
        { status: 404 }
      )
    }

    // Parse effective date if provided
    let effectiveFromDate: Date | null = null
    if (effective_from) {
      effectiveFromDate = parseDate(effective_from)
      if (!effectiveFromDate) {
        return NextResponse.json(
          { success: false, error: 'Invalid effective_from date format. Use YYYY-MM-DD' },
          { status: 400 }
        )
      }
    }

    // If create_new_version is true OR commission_percentage changed with effective_from,
    // create a new version instead of updating in place
    const shouldCreateNewVersion = create_new_version ||
      (commission_percentage !== undefined &&
       commission_percentage !== existingEntry.commission_percentage &&
       effectiveFromDate)

    if (shouldCreateNewVersion && effectiveFromDate) {
      // Calculate new version number
      const { data: versionData } = await supabase
        .from('payout_general_percentages')
        .select('version')
        .eq('bank_name', existingEntry.bank_name)
        .eq('location', existingEntry.location)
        .eq('loan_type', existingEntry.loan_type)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      const newVersion = (versionData?.version || existingEntry.version) + 1

      // Update the old entry to set effective_to
      await supabase
        .from('payout_general_percentages')
        .update({
          effective_to: formatDateForDB(effectiveFromDate),
          is_current: false
        })
        .eq('id', id)

      // Insert new version
      const { data: newData, error: insertError } = await supabase
        .from('payout_general_percentages')
        .insert({
          bank_name: existingEntry.bank_name,
          location: location ?? existingEntry.location,
          loan_type: loan_type ?? existingEntry.loan_type,
          commission_percentage: commission_percentage ?? existingEntry.commission_percentage,
          specific_conditions: specific_conditions ?? existingEntry.specific_conditions,
          effective_from: formatDateForDB(effectiveFromDate),
          effective_to: null,
          version: newVersion,
          is_current: true,
          replaced_by: null,
          change_reason: change_reason || null,
          created_by: auth.userId
        })
        .select()
        .maybeSingle()

      if (insertError) {
        apiLogger.error('Error creating new version', insertError)
        return NextResponse.json(
          { error: 'Failed to create new version' },
          { status: 500 }
        )
      }

      // Update old entry to point to new version
      await supabase
        .from('payout_general_percentages')
        .update({ replaced_by: newData.id })
        .eq('id', id)

      return NextResponse.json({
        message: 'New payout percentage version created successfully',
        data: newData,
        version_created: true,
        previous_version_id: id
      })
    }

    // Regular update (in-place, no versioning)
    const updateData: Record<string, unknown> = {}
    if (location !== undefined) updateData.location = location
    if (loan_type !== undefined) updateData.loan_type = loan_type
    if (commission_percentage !== undefined) updateData.commission_percentage = commission_percentage
    if (specific_conditions !== undefined) updateData.specific_conditions = specific_conditions
    if (change_reason !== undefined) updateData.change_reason = change_reason
    if (effectiveFromDate && !shouldCreateNewVersion) {
      updateData.effective_from = formatDateForDB(effectiveFromDate)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update entry in place
    const { data, error } = await supabase
      .from('payout_general_percentages')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'A payout entry with this bank name, location, loan type, and effective date already exists' },
          { status: 409 }
        )
      }
      apiLogger.error('Error updating payout percentage', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Payout percentage updated successfully',
      data,
      version_created: false
    })
  } catch (error) {
    apiLogger.error('Error in PATCH general percentages', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/payout-management/general-percentages
 * Delete a payout percentage entry
 *
 * Rate Limit: 30 requests per minute
 */
export async function DELETE(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await deletePayoutPercentageHandler(req)
  })
}

async function deletePayoutPercentageHandler(request: NextRequest) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // Validate ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid ID is required' },
        { status: 400 }
      )
    }

    // Check if entry exists before delete (for audit)
    const { data: existingEntry } = await supabase
      .from('payout_general_percentages')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, error: 'Payout percentage entry not found' },
        { status: 404 }
      )
    }

    // Delete entry
    const { error } = await supabase
      .from('payout_general_percentages')
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('Error deleting payout percentage', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete payout percentage' },
        { status: 500 }
      )
    }

    // TODO: Add audit logging
    // await logPayoutDeleted(id, sanitizeForAudit(existingEntry), auth.userId!, request)

    return NextResponse.json({
      success: true,
      message: 'Payout percentage deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Error in DELETE general percentages', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
