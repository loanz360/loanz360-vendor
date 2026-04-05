/**
 * Contact Import API - Import contacts from SuperAdmin pool
 *
 * Enforces business rules:
 * - Max 100 contacts per import batch
 * - Max 250 contacts per day per CRO
 * - Only unassigned master_contacts can be imported
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { getTodayStartIST } from '@/lib/constants/sales-pipeline'

export const dynamic = 'force-dynamic'

const importSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1, 'Select at least one contact').max(100, 'Maximum 100 contacts per import'),
})

const DAILY_IMPORT_LIMIT = 250

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    const body = await request.json()
    const parsed = importSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid request',
        code: 'VALIDATION_ERROR',
      }, { status: 400 })
    }

    const { contact_ids } = parsed.data

    // Check daily import limit (IST-aware start of day)
    const todayStartISO = getTodayStartIST()

    const { count: todayImportCount } = await supabase
      .from('crm_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('cro_id', user.id)
      .gte('created_at', todayStartISO)

    const currentDailyCount = todayImportCount || 0

    if (currentDailyCount + contact_ids.length > DAILY_IMPORT_LIMIT) {
      const remaining = Math.max(0, DAILY_IMPORT_LIMIT - currentDailyCount)
      return NextResponse.json({
        success: false,
        error: `Daily import limit reached. You can import ${remaining} more contacts today (${currentDailyCount}/${DAILY_IMPORT_LIMIT} used).`,
        code: 'DAILY_LIMIT_EXCEEDED',
        data: { daily_used: currentDailyCount, daily_limit: DAILY_IMPORT_LIMIT, remaining },
      }, { status: 429 })
    }

    // Fetch the selected master_contacts (only unassigned ones)
    const { data: masterContacts, error: fetchError } = await supabase
      .from('master_contacts')
      .select('*')
      .in('id', contact_ids)
      .is('assigned_to_cro', null)
      .eq('current_stage', 'contact')

    if (fetchError) {
      logApiError(fetchError as Error, request, { action: 'import_contacts_fetch', requestId })
      return createErrorResponse('Failed to fetch contacts for import', 500, requestId)
    }

    if (!masterContacts || masterContacts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No available contacts found. They may have already been assigned.',
        code: 'NO_CONTACTS_AVAILABLE',
      }, { status: 400 })
    }

    // Get user's full name for assignment
    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const croName = userData?.full_name || 'Unknown CRO'

    // Create crm_contacts entries and update master_contacts in a transaction-like manner
    const crmContacts = masterContacts.map(mc => ({
      master_contact_id: mc.id,
      data_point_id: mc.data_point_id,
      cro_id: user.id,
      name: mc.name,
      phone: mc.phone,
      alternate_phone: mc.alternate_phone,
      email: mc.email,
      location: mc.location || mc.city,
      city: mc.city,
      state: mc.state,
      loan_type: mc.loan_type,
      loan_amount: mc.loan_amount,
      business_name: mc.business_name,
      business_type: mc.business_type,
      assigned_to_cro: user.id,
      assigned_at: new Date().toISOString(),
      status: 'new',
      call_count: 0,
      notes_timeline: [],
      metadata: { imported_from_pool: true, imported_at: new Date().toISOString() },
    }))

    // Insert into crm_contacts
    const { data: insertedContacts, error: insertError } = await supabase
      .from('crm_contacts')
      .insert(crmContacts)
      .select('id')

    if (insertError) {
      logApiError(insertError as Error, request, { action: 'import_contacts_insert', requestId })
      return createErrorResponse('Failed to import contacts', 500, requestId)
    }

    // Update master_contacts to mark as assigned
    const masterContactIds = masterContacts.map(mc => mc.id)
    const { error: updateError } = await supabase
      .from('master_contacts')
      .update({
        assigned_to_cro: user.id,
        assigned_to_cro_name: croName,
        assigned_at: new Date().toISOString(),
      })
      .in('id', masterContactIds)

    if (updateError) {
      logApiError(updateError as Error, request, { action: 'import_contacts_update_master', requestId })
      apiLogger.error('master_contacts update failed, attempting rollback of inserted crm_contacts:', updateError)
      // Rollback: delete the inserted crm_contacts to keep data consistent
      const insertedIds = insertedContacts?.map(c => c.id) || []
      if (insertedIds.length > 0) {
        const { error: rollbackError } = await supabase
          .from('crm_contacts')
          .delete()
          .in('id', insertedIds)
        if (rollbackError) {
          apiLogger.error('Rollback of crm_contacts also failed - manual cleanup needed:', rollbackError)
        }
      }
      return createErrorResponse('Failed to complete import - master contacts update failed', 500, requestId)
    }

    // Update data_points assigned counts
    const dataPointIds = [...new Set(masterContacts.map(mc => mc.data_point_id).filter(Boolean))]
    for (const dpId of dataPointIds) {
      const assignedInBatch = masterContacts.filter(mc => mc.data_point_id === dpId).length
      await supabase.rpc('increment_assigned_records', {
        dp_id: dpId,
        increment_by: assignedInBatch,
      }).catch(() => {
        // Non-critical - just log
      })
    }

    const importedCount = insertedContacts?.length || masterContacts.length
    const newDailyTotal = currentDailyCount + importedCount

    return NextResponse.json({
      success: true,
      data: {
        imported: importedCount,
        requested: contact_ids.length,
        skipped: contact_ids.length - masterContacts.length,
        daily_used: newDailyTotal,
        daily_limit: DAILY_IMPORT_LIMIT,
        daily_remaining: Math.max(0, DAILY_IMPORT_LIMIT - newDailyTotal),
      },
      message: `Successfully imported ${importedCount} contacts`,
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'import_contacts', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}

// GET endpoint to check daily import status
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    const todayStartISO = getTodayStartIST()

    const { count: todayImportCount } = await supabase
      .from('crm_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('cro_id', user.id)
      .gte('created_at', todayStartISO)

    const used = todayImportCount || 0

    return NextResponse.json({
      success: true,
      data: {
        daily_used: used,
        daily_limit: DAILY_IMPORT_LIMIT,
        daily_remaining: Math.max(0, DAILY_IMPORT_LIMIT - used),
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'check_import_status', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
