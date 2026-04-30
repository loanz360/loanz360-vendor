
import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const targetFields = [
  { id: 'name', label: 'Customer Name', type: 'string', required: true },
  { id: 'email', label: 'Email Address', type: 'email', required: true },
  { id: 'phone', label: 'Phone Number', type: 'phone', required: true },
  { id: 'loanType', label: 'Loan Type', type: 'enum', required: false },
  { id: 'loanAmount', label: 'Loan Amount', type: 'number', required: false },
  { id: 'source', label: 'Lead Source', type: 'string', required: false },
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
      return NextResponse.json({
        success: true,
        data: { targetFields }
      })
    }

    // Return empty import history
    return NextResponse.json({
      success: true,
      data: {
        jobs: [],
        stats: { totalImports: 0, totalLeadsImported: 0, lastImportAt: null }
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching import data', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch import data' },
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
      error: 'Lead import not yet implemented',
    }, { status: 501 })
  } catch (error) {
    apiLogger.error('Error processing import', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process import' },
      { status: 500 }
    )
  }
}
