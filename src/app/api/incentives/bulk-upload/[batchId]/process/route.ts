
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/incentives/bulk-upload/[batchId]/process
 * Process validated batch and create incentive allocations
 * Access: HR, Superadmin
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role
    const { data: employee } = await supabase
      .from('employees')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const allowedRoles = ['HR_EXECUTIVE', 'HR_MANAGER', 'ADMIN_EXECUTIVE', 'ADMIN_MANAGER']
    if (!employee || !allowedRoles.includes(employee.sub_role)) {
      return NextResponse.json({ success: false, error: 'Forbidden: HR or Admin access required' }, { status: 403 })
    }

    const batchId = params.batchId

    // Get batch info
    const { data: batch, error: batchError } = await supabase
      .from('bulk_upload_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError || !batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    }

    if (batch.status === 'processing') {
      return NextResponse.json({ success: false, error: 'Batch is already being processed' }, { status: 400 })
    }

    if (batch.status === 'completed') {
      return NextResponse.json({ success: false, error: 'Batch has already been processed' }, { status: 400 })
    }

    // Update batch status to processing
    await supabase
      .from('bulk_upload_batches')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', batchId)

    // Get rows to process (only valid rows)
    const { data: rows, error: rowsError } = await supabase
      .from('bulk_upload_rows')
      .select('*')
      .eq('batch_id', batchId)
      .in('status', ['pending', 'warning'])
      .order('row_number')

    if (rowsError) {
      throw rowsError
    }

    if (!rows || rows.length === 0) {
      await supabase
        .from('bulk_upload_batches')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', batchId)

      return NextResponse.json({ success: false, error: 'No valid rows to process' }, { status: 400 })
    }

    const processingResults = []
    const startTime = Date.now()

    // Process each row
    for (const row of rows) {
      try {
        const rawData = row.raw_data as unknown

        // Update row status to processing
        await supabase
          .from('bulk_upload_rows')
          .update({ status: 'processing' })
          .eq('id', row.id)

        if (batch.upload_type === 'incentive_targets') {
          // Find employee by ID or email
          const { data: employeeData, error: empError } = await supabase
            .from('employees')
            .select('id, sub_role')
            .or(`email.eq.${rawData.employee_id},id.eq.${rawData.employee_id}`)
            .maybeSingle()

          if (empError || !employeeData) {
            throw new Error(`Employee not found: ${rawData.employee_id}`)
          }

          // Verify incentive exists
          const { data: incentive, error: incentiveError } = await supabase
            .from('incentives')
            .select('id, performance_criteria, reward_amount')
            .eq('id', rawData.incentive_id)
            .maybeSingle()

          if (incentiveError || !incentive) {
            throw new Error(`Incentive not found: ${rawData.incentive_id}`)
          }

          // Check if allocation already exists
          const { data: existingAllocation } = await supabase
            .from('incentive_allocations')
            .select('id')
            .eq('incentive_id', rawData.incentive_id)
            .eq('user_id', employeeData.id)
            .maybeSingle()

          if (existingAllocation) {
            throw new Error('Allocation already exists for this employee and incentive')
          }

          // Create allocation
          const performanceCriteria = {
            ...(incentive.performance_criteria as unknown),
            metric: rawData.target_metric,
            target_value: parseFloat(rawData.target_value),
          }

          const { data: allocation, error: allocationError } = await supabase
            .from('incentive_allocations')
            .insert({
              incentive_id: rawData.incentive_id,
              user_id: employeeData.id,
              is_eligible: true,
              eligibility_checked_at: new Date().toISOString(),
              current_progress: {
                [rawData.target_metric]: 0,
                percentage: 0,
                last_updated: new Date().toISOString(),
              },
              progress_percentage: 0,
              allocation_status: 'eligible',
              earned_amount: rawData.custom_reward_amount
                ? parseFloat(rawData.custom_reward_amount)
                : parseFloat(incentive.reward_amount || '0'),
            })
            .select()
            .maybeSingle()

          if (allocationError) {
            throw allocationError
          }

          // Update row as success
          await supabase
            .from('bulk_upload_rows')
            .update({
              status: 'success',
              processed_at: new Date().toISOString(),
              created_entity_id: allocation.id,
              created_entity_type: 'incentive_allocation',
              processed_data: {
                employee_id: employeeData.id,
                incentive_id: rawData.incentive_id,
                allocation_id: allocation.id,
              },
            })
            .eq('id', row.id)

          processingResults.push({
            row_number: row.row_number,
            status: 'success',
            allocation_id: allocation.id,
          })
        } else if (batch.upload_type === 'performance_update') {
          // Process performance update
          // Similar logic for updating progress
          // ... (implement based on requirements)
        }
      } catch (error) {
        // Mark row as error
        await supabase
          .from('bulk_upload_rows')
          .update({
            status: 'error',
            processed_at: new Date().toISOString(),
            error_code: 'PROCESSING_ERROR',
          })
          .eq('id', row.id)

        processingResults.push({
          row_number: row.row_number,
          status: 'error',
          error: 'Internal server error',
        })
      }
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    // Update batch as completed
    await supabase
      .from('bulk_upload_batches')
      .update({
        completed_at: new Date().toISOString(),
        processing_duration_ms: duration,
      })
      .eq('id', batchId)

    // Trigger stats update (will be done by trigger automatically)
    // Get final stats
    const { data: finalBatch } = await supabase
      .from('bulk_upload_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      summary: {
        total_rows: finalBatch?.total_rows || 0,
        success_count: finalBatch?.success_count || 0,
        error_count: finalBatch?.error_count || 0,
        warning_count: finalBatch?.warning_count || 0,
        processing_duration_ms: duration,
      },
      results: processingResults,
      message: `Processing completed: ${finalBatch?.success_count || 0} successful, ${finalBatch?.error_count || 0} failed`,
    })
  } catch (error) {
    apiLogger.error('Error processing batch', error)

    // Mark batch as failed
    await (await createClient())
      .from('bulk_upload_batches')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.batchId)

    return NextResponse.json({ success: false, error: 'Failed to process batch',
      }, { status: 500 })
  }
}
