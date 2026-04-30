/**
 * API Route: DSE Lead Duplicate Pre-Check
 * GET /api/employees/dse/leads/check-duplicate?mobile=9876543210
 *
 * Quick check before form submission to detect existing leads.
 * Saves DSE time by catching duplicates before they fill the full form.
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'


const MOBILE_REGEX = /^\+?91?[6-9]\d{9}$/

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { searchParams } = new URL(request.url)
    const mobile = searchParams.get('mobile')?.trim()

    if (!mobile || !MOBILE_REGEX.test(mobile)) {
      return NextResponse.json(
        { success: false, error: 'Valid 10-digit Indian mobile number required (optionally with +91 prefix)' },
        { status: 400 }
      )
    }

    // Normalize: strip +91 or 91 prefix to get bare 10 digits, then add +91
    const bareMobile = mobile.replace(/^\+?91/, '')
    const normalizedMobile = `+91${bareMobile}`

    // Check unified leads table
    const { data: existingLeads, error: leadsError } = await supabase
      .from('leads')
      .select('lead_number, customer_name, loan_type, form_status, lead_status, created_at, lead_generator_id, employee_id')
      .or(`customer_mobile.eq.${normalizedMobile},customer_mobile.eq.${mobile}`)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5)

    if (leadsError) {
      apiLogger.error('Duplicate check error (leads)', leadsError)
    }

    // Check DSE leads table
    const { data: dseLeads, error: dseError } = await supabase
      .from('dse_leads')
      .select('lead_id, customer_name, lead_type, lead_stage, created_at, dse_user_id')
      .or(`mobile.eq.${normalizedMobile},mobile.eq.${mobile}`)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(5)

    if (dseError) {
      apiLogger.error('Duplicate check error (dse_leads)', dseError)
    }

    // Merge and deduplicate results
    const duplicates: Array<{
      lead_number: string
      customer_name: string | null
      loan_type: string | null
      status: string
      created_at: string
      is_mine: boolean
    }> = []

    if (existingLeads) {
      for (const lead of existingLeads) {
        duplicates.push({
          lead_number: lead.lead_number || 'N/A',
          customer_name: lead.customer_name,
          loan_type: lead.loan_type,
          status: lead.form_status || lead.lead_status || 'UNKNOWN',
          created_at: lead.created_at,
          is_mine: lead.lead_generator_id === user.id || lead.employee_id === user.id,
        })
      }
    }

    if (dseLeads) {
      for (const lead of dseLeads) {
        // Avoid duplicating if already in unified leads
        const alreadyListed = duplicates.some(d => d.lead_number === lead.lead_id)
        if (!alreadyListed) {
          duplicates.push({
            lead_number: lead.lead_id || 'N/A',
            customer_name: lead.customer_name,
            loan_type: lead.lead_type,
            status: lead.lead_stage || 'UNKNOWN',
            created_at: lead.created_at,
            is_mine: lead.dse_user_id === user.id,
          })
        }
      }
    }

    const hasDuplicate = duplicates.length > 0
    const hasOthersDuplicate = duplicates.some(d => !d.is_mine)

    let message = ''
    if (!hasDuplicate) {
      message = 'No existing leads found for this mobile number. You can proceed.'
    } else if (hasOthersDuplicate) {
      message = 'A lead for this customer already exists under another team member. Submitting may create a duplicate.'
    } else {
      message = 'You have already submitted a lead for this customer. Consider checking Lead Status instead.'
    }

    return NextResponse.json({
      success: true,
      data: {
        has_duplicate: hasDuplicate,
        duplicates,
        can_proceed: !hasOthersDuplicate, // Block if another DSE owns it
        message,
      },
    })
  } catch (error) {
    apiLogger.error('Duplicate check error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
