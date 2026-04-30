import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Helper function to verify DSM role
async function verifyDSMRole(supabase: unknown, userId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { isValid: false, error: 'User profile not found' }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_MANAGER') {
    return { isValid: false, error: 'Access denied. This feature is only available for Direct Sales Managers.' }
  }

  return { isValid: true, profile }
}

// GET - List all DSE team members reporting to the DSM
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSM role
    const roleCheck = await verifyDSMRole(supabase, user.id)
    if (!roleCheck.isValid) {
      return NextResponse.json({ success: false, error: roleCheck.error }, { status: 403 })
    }

    // Get all DSEs reporting to this DSM
    const { data: teamMembers, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone_number, employee_id, created_at')
      .eq('role', 'EMPLOYEE')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('manager_user_id', user.id)
      .order('full_name', { ascending: true })

    if (error) {
      throw error
    }

    // Transform to simpler format
    const simplifiedTeamMembers = teamMembers?.map(member => ({
      user_id: member.id,
      full_name: member.full_name,
      email: member.email,
      phone_number: member.phone_number,
      employee_id: member.employee_id,
    })) || []

    return NextResponse.json({
      success: true,
      data: simplifiedTeamMembers
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching team members', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
