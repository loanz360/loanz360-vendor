import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * SMART ASSIGNMENT Algorithm for CRO Contact Assignment
 *
 * Assignment Priority:
 * 1. Match location AND loan type (highest priority)
 * 2. Match location OR loan type (medium priority)
 * 3. Any available CRO (lowest priority)
 *
 * Load Balancing:
 * - Among matching CROs, assign to the one with least active contacts
 *
 * POST /api/ai-crm/admin/assign-contacts
 * Body: {
 *   contact_ids: string[]  // Array of unassigned contact IDs from master_contacts
 * }
 *
 * Admin/HR only
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is Super Admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Only Super Admin can assign contacts' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { contact_ids } = body

    // Validate inputs
    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'contact_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    // Fetch contacts to assign
    const { data: contacts, error: contactsError } = await supabase
      .from('master_contacts')
      .select('*')
      .in('id', contact_ids)

    if (contactsError || !contacts || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contacts found with provided IDs' },
        { status: 404 }
      )
    }

    // Fetch all active CROs with their preferences
    const { data: cros, error: crosError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        cro_preferences (
          loan_type_preferences,
          preferred_locations
        )
      `)
      .eq('sub_role', 'CRO')
      .eq('is_active', true)

    if (crosError || !cros || cros.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active CROs available for assignment' },
        { status: 400 }
      )
    }

    // Get current contact counts for each CRO (for load balancing)
    const { data: contactCounts } = await supabase
      .from('crm_contacts')
      .select('cro_id')

    const croWorkload = new Map<string, number>()
    cros.forEach((cro) => croWorkload.set(cro.id, 0))

    contactCounts?.forEach((contact) => {
      if (contact.cro_id && croWorkload.has(contact.cro_id)) {
        croWorkload.set(contact.cro_id, (croWorkload.get(contact.cro_id) || 0) + 1)
      }
    })

    // Assignment results
    const assignments: Array<{
      contact_id: string
      contact_name: string
      assigned_to_cro: string
      assigned_to_cro_name: string
      match_type: 'location_and_loan' | 'location_or_loan' | 'any_available'
      contact_location?: string
      contact_loan_type?: string
    }> = []

    // Process each contact
    for (const contact of contacts) {
      let assignedCro: any = null
      let matchType: 'location_and_loan' | 'location_or_loan' | 'any_available' = 'any_available'

      // Step 1: Try to find CRO matching BOTH location AND loan type
      const bothMatchCros = cros.filter((cro) => {
        const prefs = cro.cro_preferences?.[0]
        if (!prefs) return false

        const locationMatch =
          !prefs.preferred_locations ||
          prefs.preferred_locations.length === 0 ||
          prefs.preferred_locations.includes(contact.city) ||
          prefs.preferred_locations.includes(contact.state) ||
          prefs.preferred_locations.includes(contact.location)

        const loanMatch =
          !prefs.loan_type_preferences ||
          prefs.loan_type_preferences.length === 0 ||
          prefs.loan_type_preferences.includes(contact.loan_type)

        return locationMatch && loanMatch
      })

      if (bothMatchCros.length > 0) {
        // Assign to least loaded CRO from both-match candidates
        assignedCro = bothMatchCros.reduce((leastLoaded, cro) => {
          const currentLoad = croWorkload.get(cro.id) || 0
          const leastLoad = croWorkload.get(leastLoaded.id) || 0
          return currentLoad < leastLoad ? cro : leastLoaded
        }, bothMatchCros[0])
        matchType = 'location_and_loan'
      } else {
        // Step 2: Try to find CRO matching location OR loan type
        const eitherMatchCros = cros.filter((cro) => {
          const prefs = cro.cro_preferences?.[0]
          if (!prefs) return false

          const locationMatch =
            prefs.preferred_locations &&
            prefs.preferred_locations.length > 0 &&
            (prefs.preferred_locations.includes(contact.city) ||
              prefs.preferred_locations.includes(contact.state) ||
              prefs.preferred_locations.includes(contact.location))

          const loanMatch =
            prefs.loan_type_preferences &&
            prefs.loan_type_preferences.length > 0 &&
            prefs.loan_type_preferences.includes(contact.loan_type)

          return locationMatch || loanMatch
        })

        if (eitherMatchCros.length > 0) {
          // Assign to least loaded CRO from either-match candidates
          assignedCro = eitherMatchCros.reduce((leastLoaded, cro) => {
            const currentLoad = croWorkload.get(cro.id) || 0
            const leastLoad = croWorkload.get(leastLoaded.id) || 0
            return currentLoad < leastLoad ? cro : leastLoaded
          }, eitherMatchCros[0])
          matchType = 'location_or_loan'
        } else {
          // Step 3: Assign to any available CRO (least loaded)
          assignedCro = cros.reduce((leastLoaded, cro) => {
            const currentLoad = croWorkload.get(cro.id) || 0
            const leastLoad = croWorkload.get(leastLoaded.id) || 0
            return currentLoad < leastLoad ? cro : leastLoaded
          }, cros[0])
          matchType = 'any_available'
        }
      }

      // Update master_contacts with assignment
      const { error: updateError } = await supabase
        .from('master_contacts')
        .update({
          assigned_to_cro: assignedCro.id,
          assigned_to_cro_name: assignedCro.full_name,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id)

      if (updateError) {
        apiLogger.error('Error assigning contact', updateError)
        continue
      }

      // Create crm_contact entry
      const { error: createError } = await supabase.from('crm_contacts').insert({
        master_contact_id: contact.id,
        cro_id: assignedCro.id,
        name: contact.name,
        phone: contact.phone,
        alternate_phone: contact.alternate_phone,
        email: contact.email,
        location: contact.location,
        city: contact.city,
        state: contact.state,
        loan_type: contact.loan_type,
        loan_amount: contact.loan_amount,
        business_name: contact.business_name,
        business_type: contact.business_type,
        status: 'pending',
        call_count: 0,
        notes_timeline: [],
      })

      if (createError) {
        apiLogger.error('Error creating crm_contact', createError)
        continue
      }

      // Update workload for next assignment
      croWorkload.set(assignedCro.id, (croWorkload.get(assignedCro.id) || 0) + 1)

      // Track assignment
      assignments.push({
        contact_id: contact.id,
        contact_name: contact.name,
        assigned_to_cro: assignedCro.id,
        assigned_to_cro_name: assignedCro.full_name,
        match_type: matchType,
        contact_location: contact.city || contact.state || contact.location,
        contact_loan_type: contact.loan_type,
      })
    }

    // Summary statistics
    const summary = {
      total_contacts: contacts.length,
      assigned: assignments.length,
      failed: contacts.length - assignments.length,
      by_match_type: {
        location_and_loan: assignments.filter((a) => a.match_type === 'location_and_loan').length,
        location_or_loan: assignments.filter((a) => a.match_type === 'location_or_loan').length,
        any_available: assignments.filter((a) => a.match_type === 'any_available').length,
      },
    }

    return NextResponse.json({
      success: true,
      data: {
        assignments,
        summary,
      },
      message: `Successfully assigned ${assignments.length} out of ${contacts.length} contacts`,
    })
  } catch (error) {
    apiLogger.error('Error in assign-contacts API', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
