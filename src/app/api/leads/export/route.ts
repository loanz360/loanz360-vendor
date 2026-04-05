export const dynamic = 'force-dynamic'

import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const availableFields = [
  { id: 'name', label: 'Customer Name', category: 'basic' },
  { id: 'email', label: 'Email Address', category: 'basic' },
  { id: 'phone', label: 'Phone Number', category: 'basic' },
  { id: 'status', label: 'Lead Status', category: 'basic' },
  { id: 'source', label: 'Lead Source', category: 'basic' },
  { id: 'loanType', label: 'Loan Type', category: 'loan' },
  { id: 'loanAmount', label: 'Loan Amount', category: 'loan' },
  { id: 'assignedTo', label: 'Assigned Agent', category: 'assignment' },
  { id: 'createdAt', label: 'Created Date', category: 'dates' },
  { id: 'updatedAt', label: 'Last Updated', category: 'dates' },
]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'fields') {
      const categories = [...new Set(availableFields.map(f => f.category))]
      const groupedFields = categories.map(cat => ({
        category: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        fields: availableFields.filter(f => f.category === cat)
      }))
      return NextResponse.json({
        success: true,
        data: {
          fields: availableFields,
          groupedFields,
          formats: [
            { id: 'csv', label: 'CSV', description: 'Comma-separated values' },
            { id: 'xlsx', label: 'Excel', description: 'Native Excel format' },
            { id: 'pdf', label: 'PDF Report', description: 'Formatted report' }
          ]
        }
      })
    }

    // Return empty export history
    return NextResponse.json({
      success: true,
      data: {
        jobs: [],
        quotas: { dailyLimit: 10, usedToday: 0, maxRecordsPerExport: 50000 }
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching export data', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch export data' },
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

    return NextResponse.json({
      success: false,
      error: 'Lead export not yet implemented',
    }, { status: 501 })
  } catch (error) {
    apiLogger.error('Error creating export job', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create export job' },
      { status: 500 }
    )
  }
}
