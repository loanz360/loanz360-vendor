
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/incentives/bulk-upload/[batchId]
 * Get batch status and results
 * Access: HR, Superadmin
 */
export async function GET(
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

    const batchId = params.batchId

    // Get batch with uploader info
    const { data: batch, error: batchError } = await supabase
      .from('bulk_upload_batches')
      .select('*, employees:uploaded_by(full_name, email)')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError || !batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const includeRows = searchParams.get('include_rows') === 'true'
    const rowsStatus = searchParams.get('rows_status') // 'error', 'success', 'warning', etc.

    let rows = null
    if (includeRows) {
      let query = supabase
        .from('bulk_upload_rows')
        .select('*')
        .eq('batch_id', batchId)
        .order('row_number')

      if (rowsStatus) {
        query = query.eq('status', rowsStatus)
      }

      const { data: rowsData, error: rowsError } = await query

      if (!rowsError) {
        rows = rowsData
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        batch,
        rows,
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching batch', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch batch' }, { status: 500 })
  }
}

/**
 * DELETE /api/incentives/bulk-upload/[batchId]
 * Delete a batch (only if not processed or completed)
 * Access: HR, Superadmin
 */
export async function DELETE(
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

    // Get batch
    const { data: batch, error: batchError } = await supabase
      .from('bulk_upload_batches')
      .select('status')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError || !batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    }

    if (batch.status === 'processing') {
      return NextResponse.json({ success: false, error: 'Cannot delete batch that is currently processing' }, { status: 400 })
    }

    // Delete batch (rows will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('bulk_upload_batches')
      .delete()
      .eq('id', batchId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Batch deleted successfully',
    })
  } catch (error) {
    apiLogger.error('Error deleting batch', error)
    return NextResponse.json({ success: false, error: 'Failed to delete batch' }, { status: 500 })
  }
}
