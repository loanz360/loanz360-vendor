import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verify if the user is a Channel Partner Executive
 * Checks multiple sources: employee_profile, users table, and user metadata
 */
export async function verifyCPERole(
  supabase: SupabaseClient,
  user: { id: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }
): Promise<boolean> {
  // First check employee_profile table
  const { data: employeeProfile } = await supabase
    .from('employee_profile')
    .select('subrole')
    .eq('user_id', user.id)
    .maybeSingle()

  if (employeeProfile?.subrole === 'CHANNEL_PARTNER_EXECUTIVE') {
    return true
  }

  // If not found in employee_profile, check users table
  const { data: userData } = await supabase
    .from('users')
    .select('sub_role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.sub_role === 'CHANNEL_PARTNER_EXECUTIVE') {
    return true
  }

  // Also check user metadata as fallback
  const metaSubRole = user.user_metadata?.sub_role || user.app_metadata?.sub_role
  if (metaSubRole === 'CHANNEL_PARTNER_EXECUTIVE') {
    return true
  }

  return false
}
