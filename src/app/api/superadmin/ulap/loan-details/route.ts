import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * ULAP Loan Details Management API
 * CRUD operations for loan eligibility, documents, and features
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch loan details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subcategoryId = searchParams.get('subcategory_id')

    let query = supabase
      .from('ulap_loan_details')
      .select(`
        *,
        ulap_loan_subcategories (
          id,
          name,
          slug,
          category_id,
          ulap_loan_categories (
            id,
            name,
            slug
          )
        )
      `)

    if (subcategoryId) {
      query = query.eq('subcategory_id', subcategoryId)
    }

    const { data: loanDetails, error } = await query

    if (error) {
      apiLogger.error('Error fetching loan details', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch loan details' }, { status: 500 })
    }

    return NextResponse.json({ loanDetails })
  } catch (error) {
    apiLogger.error('Loan Details API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update loan details
export async function POST(request: NextRequest) {
  try {
    const bodySchema = z.object({

      subcategory_id: z.string().uuid(),

      eligibility: z.string().optional(),

      documents: z.array(z.unknown()).optional(),

      features: z.string().optional(),

      min_amount: z.string().optional(),

      max_amount: z.string().optional(),

      tenure: z.number().optional(),

      interest_range: z.string().optional(),

      additional_info: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      subcategory_id,
      eligibility,
      documents,
      features,
      min_amount,
      max_amount,
      tenure,
      interest_range,
      additional_info
    } = body

    if (!subcategory_id) {
      return NextResponse.json({ success: false, error: 'Subcategory ID is required' }, { status: 400 })
    }

    // Check if details already exist for this subcategory
    const { data: existingDetails } = await supabase
      .from('ulap_loan_details')
      .select('id')
      .eq('subcategory_id', subcategory_id)
      .maybeSingle()

    const detailsData = {
      subcategory_id,
      eligibility: eligibility || [],
      documents: documents || [],
      features: features || [],
      min_amount,
      max_amount,
      tenure,
      interest_range,
      additional_info: additional_info || {}
    }

    if (existingDetails) {
      // Update existing
      const { data: updatedDetails, error: updateError } = await supabase
        .from('ulap_loan_details')
        .update(detailsData)
        .eq('id', existingDetails.id)
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Error updating loan details', updateError)
        return NextResponse.json({ success: false, error: 'Failed to update loan details' }, { status: 500 })
      }

      return NextResponse.json({ loanDetails: updatedDetails, updated: true })
    } else {
      // Create new
      const { data: newDetails, error: insertError } = await supabase
        .from('ulap_loan_details')
        .insert(detailsData)
        .select()
        .maybeSingle()

      if (insertError) {
        apiLogger.error('Error creating loan details', insertError)
        return NextResponse.json({ success: false, error: 'Failed to create loan details' }, { status: 500 })
      }

      return NextResponse.json({ loanDetails: newDetails, created: true }, { status: 201 })
    }
  } catch (error) {
    apiLogger.error('Loan Details API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete loan details
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Loan details ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ulap_loan_details')
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('Error deleting loan details', error)
      return NextResponse.json({ success: false, error: 'Failed to delete loan details' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Loan Details API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
