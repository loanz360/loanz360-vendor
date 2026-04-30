
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/superadmin/departments
 * Fetch all departments
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()

    // Fetch all departments
    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name, description')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch departments'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        departments: departments || []
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/superadmin/departments', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
