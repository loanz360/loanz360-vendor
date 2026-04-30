
import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 })
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, lead_number, customer_name, customer_mobile, customer_email, loan_type, loan_amount, lead_status, status, priority, assigned_cro_id, assigned_bde_name, source_type, state, city, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()

    if (leadError) {
      apiLogger.error('Error fetching lead', leadError)
      return NextResponse.json({ success: false, error: 'Failed to fetch lead' }, { status: 500 })
    }

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: lead })
  } catch (error) {
    apiLogger.error('Error fetching lead', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch lead details' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    if (!id) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      apiLogger.error('Error updating lead', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Lead updated successfully' })
  } catch (error) {
    apiLogger.error('Error updating lead', error)
    return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { action, ...data } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 })
    }

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'change_status':
        updateFields.lead_status = data.status
        break
      case 'assign':
        updateFields.assigned_cro_id = data.assignedTo
        break
      case 'change_priority':
        updateFields.priority = data.priority
        break
      default:
        Object.assign(updateFields, data)
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update(updateFields)
      .eq('id', id)

    if (updateError) {
      apiLogger.error('Error patching lead', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Lead updated successfully' })
  } catch (error) {
    apiLogger.error('Error patching lead', error)
    return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('leads')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting lead', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Lead deleted successfully' })
  } catch (error) {
    apiLogger.error('Error deleting lead', error)
    return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 })
  }
}
