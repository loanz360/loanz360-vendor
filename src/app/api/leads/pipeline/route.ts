
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'

const PIPELINE_STAGES = [
  { name: 'NEW', label: 'New Lead', color: '#6366f1', order: 1 },
  { name: 'CONTACTED', label: 'Contacted', color: '#8b5cf6', order: 2 },
  { name: 'QUALIFIED', label: 'Qualified', color: '#a855f7', order: 3 },
  { name: 'DOCUMENTATION', label: 'Documentation', color: '#d946ef', order: 4 },
  { name: 'PROCESSING', label: 'Processing', color: '#ec4899', order: 5 },
  { name: 'SANCTIONED', label: 'Sanctioned', color: '#f43f5e', order: 6 },
  { name: 'DISBURSED', label: 'Disbursed', color: '#22c55e', order: 7 },
  { name: 'COMPLETED', label: 'Closed Won', color: '#10b981', order: 8 },
  { name: 'REJECTED', label: 'Closed Lost', color: '#ef4444', order: 9 },
]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const loanType = searchParams.get('loanType')

    let query = supabase
      .from('leads')
      .select('id, lead_number, customer_name, loan_type, loan_amount, status, priority, assigned_cro_id, updated_at, created_at')

    if (loanType && loanType !== 'all') {
      query = query.eq('loan_type', loanType)
    }

    const { data: leads, error } = await query

    if (error) {
      apiLogger.error('Error fetching pipeline leads', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch pipeline data' }, { status: 500 })
    }

    const allLeads = leads || []

    const stages = PIPELINE_STAGES.map(stage => {
      const stageLeads = allLeads.filter(l => l.status === stage.name)
      return {
        id: `stage-${stage.order}`,
        name: stage.label,
        order: stage.order,
        color: stage.color,
        leads: stageLeads.map(l => ({
          id: l.id,
          name: l.customer_name,
          loanType: l.loan_type,
          loanAmount: l.loan_amount,
          assignedTo: l.assigned_cro_id || '',
          priority: l.priority || 'MEDIUM',
          lastActivity: l.updated_at,
        })),
        count: stageLeads.length,
        totalValue: stageLeads.reduce((sum, l) => sum + (l.loan_amount || 0), 0),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        stages,
        summary: {
          totalLeads: allLeads.length,
          totalValue: allLeads.reduce((sum, l) => sum + (l.loan_amount || 0), 0),
          stageCount: stages.length,
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching pipeline', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pipeline data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { leadId, toStage, reason } = body

    if (!leadId || !toStage) {
      return NextResponse.json(
        { success: false, error: 'Lead ID and target stage are required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('leads')
      .update({ status: toStage, updated_at: new Date().toISOString() })
      .eq('id', leadId)

    if (error) {
      apiLogger.error('Error moving lead', error)
      return NextResponse.json({ success: false, error: 'Failed to move lead' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Lead moved to ${toStage}`,
      data: { leadId, toStage, movedAt: new Date().toISOString(), reason }
    })
  } catch (error: unknown) {
    apiLogger.error('Error moving lead', error)
    return NextResponse.json(
      { success: false, error: 'Failed to move lead' },
      { status: 500 }
    )
  }
}
