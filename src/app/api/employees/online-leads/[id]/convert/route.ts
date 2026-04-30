
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyEmployee } from '@/lib/auth/verify-employee'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// POST - Convert online lead to a deal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const employee = await verifyEmployee(request)
    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const {
      loan_type,
      loan_amount,
      preferred_bank,
      notes
    } = body

    const supabase = await createClient()

    // Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('online_leads')
      .select('*')
      .eq('id', id)
      .eq('assigned_to', employee.id)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    if (lead.status === 'converted') {
      return NextResponse.json(
        { success: false, error: 'Lead already converted' },
        { status: 400 }
      )
    }

    // Generate deal reference number
    const referenceNumber = `DEAL${Date.now().toString(36).toUpperCase()}`

    // Create the deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        reference_number: referenceNumber,
        customer_name: lead.customer_name,
        phone: lead.phone,
        email: lead.email,
        loan_type: loan_type || lead.collected_data?.loan_type || 'personal_loan',
        loan_amount: loan_amount || lead.collected_data?.loan_amount || 0,
        preferred_bank: preferred_bank || lead.collected_data?.preferred_bank || null,
        status: 'lead',
        source: 'online_chatbot',
        source_reference: lead.reference_number,
        assigned_to: employee.id,
        assigned_at: new Date().toISOString(),
        created_by: employee.id,
        additional_data: {
          converted_from_online_lead: true,
          online_lead_id: lead.id,
          chatbot_id: lead.chatbot_id,
          collected_data: lead.collected_data,
          utm_source: lead.utm_source,
          utm_medium: lead.utm_medium,
          utm_campaign: lead.utm_campaign
        },
        notes_timeline: [
          {
            id: `note-${Date.now()}`,
            type: 'system',
            content: `Deal created from online lead ${lead.reference_number}`,
            created_at: new Date().toISOString()
          },
          ...(notes ? [{
            id: `note-${Date.now() + 1}`,
            type: 'note',
            content: notes,
            created_by: employee.id,
            created_at: new Date().toISOString()
          }] : [])
        ]
      })
      .select()
      .maybeSingle()

    if (dealError) {
      apiLogger.error('Error creating deal', dealError)
      throw dealError
    }

    // Update online lead status to converted
    const { error: updateError } = await supabase
      .from('online_leads')
      .update({
        status: 'converted',
        converted_deal_id: deal.id,
        updated_at: new Date().toISOString(),
        notes_timeline: [
          ...(lead.notes_timeline || []),
          {
            id: `convert-${Date.now()}`,
            type: 'conversion',
            content: `Converted to deal ${referenceNumber}`,
            created_by: employee.id,
            created_at: new Date().toISOString()
          }
        ]
      })
      .eq('id', id)

    if (updateError) {
      apiLogger.error('Error updating lead status', updateError)
    }

    return NextResponse.json({
      success: true,
      data: {
        deal,
        message: 'Lead successfully converted to deal'
      }
    })
  } catch (error) {
    apiLogger.error('Error converting lead', error)
    return NextResponse.json(
      { success: false, error: 'Failed to convert lead' },
      { status: 500 }
    )
  }
}
