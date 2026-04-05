export const dynamic = 'force-dynamic'

/**
 * ULAP Bank Rates Management API
 * CRUD operations for interest rates with history tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch all bank rates with bank and subcategory info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subcategoryId = searchParams.get('subcategory_id')
    const bankId = searchParams.get('bank_id')

    let query = supabase
      .from('ulap_bank_rates')
      .select(`
        *,
        ulap_banks (
          id,
          name,
          short_code,
          logo_url,
          type
        ),
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
      .order('last_updated_at', { ascending: false })

    if (subcategoryId) {
      query = query.eq('subcategory_id', subcategoryId)
    }

    if (bankId) {
      query = query.eq('bank_id', bankId)
    }

    const { data: rates, error } = await query

    if (error) {
      apiLogger.error('Error fetching rates', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch rates' }, { status: 500 })
    }

    return NextResponse.json({ rates })
  } catch (error) {
    apiLogger.error('Rates API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update bank rate
export async function POST(request: NextRequest) {
  try {
        const body = await request.json()

    const {
      bank_id,
      subcategory_id,
      interest_rate_min,
      interest_rate_max,
      processing_fee,
      max_amount,
      max_tenure,
      updated_by
    } = body

    if (!bank_id || !subcategory_id || interest_rate_min === undefined || interest_rate_max === undefined) {
      return NextResponse.json({ success: false, error: 'Bank ID, subcategory ID, and interest rates are required'
      }, { status: 400 })
    }

    // Check if rate already exists
    const { data: existingRate } = await supabase
      .from('ulap_bank_rates')
      .select('*')
      .eq('bank_id', bank_id)
      .eq('subcategory_id', subcategory_id)
      .maybeSingle()

    if (existingRate) {
      // Update existing rate and log history
      const { data: updatedRate, error: updateError } = await supabase
        .from('ulap_bank_rates')
        .update({
          interest_rate_min,
          interest_rate_max,
          processing_fee,
          max_amount,
          max_tenure,
          last_updated_at: new Date().toISOString(),
          updated_by
        })
        .eq('id', existingRate.id)
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Error updating rate', updateError)
        return NextResponse.json({ success: false, error: 'Failed to update rate' }, { status: 500 })
      }

      // Log rate change history
      await supabase
        .from('ulap_rate_history')
        .insert({
          bank_rate_id: existingRate.id,
          bank_id,
          subcategory_id,
          old_rate_min: existingRate.interest_rate_min,
          old_rate_max: existingRate.interest_rate_max,
          new_rate_min: interest_rate_min,
          new_rate_max: interest_rate_max,
          old_processing_fee: existingRate.processing_fee,
          new_processing_fee: processing_fee,
          changed_by: updated_by
        })

      return NextResponse.json({ rate: updatedRate, updated: true })
    } else {
      // Create new rate
      const { data: newRate, error: insertError } = await supabase
        .from('ulap_bank_rates')
        .insert({
          bank_id,
          subcategory_id,
          interest_rate_min,
          interest_rate_max,
          processing_fee,
          max_amount,
          max_tenure,
          is_active: true,
          updated_by
        })
        .select()
        .maybeSingle()

      if (insertError) {
        apiLogger.error('Error creating rate', insertError)
        return NextResponse.json({ success: false, error: 'Failed to create rate' }, { status: 500 })
      }

      // Log initial rate in history
      await supabase
        .from('ulap_rate_history')
        .insert({
          bank_rate_id: newRate.id,
          bank_id,
          subcategory_id,
          new_rate_min: interest_rate_min,
          new_rate_max: interest_rate_max,
          new_processing_fee: processing_fee,
          changed_by: updated_by,
          change_reason: 'Initial rate entry'
        })

      return NextResponse.json({ rate: newRate, created: true }, { status: 201 })
    }
  } catch (error) {
    apiLogger.error('Rates API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update rate status (activate/deactivate)
export async function PATCH(request: NextRequest) {
  try {
        const body = await request.json()

    const { id, is_active } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Rate ID is required' }, { status: 400 })
    }

    const { data: rate, error } = await supabase
      .from('ulap_bank_rates')
      .update({ is_active, last_updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating rate status', error)
      return NextResponse.json({ success: false, error: 'Failed to update rate' }, { status: 500 })
    }

    return NextResponse.json({ rate })
  } catch (error) {
    apiLogger.error('Rates API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete bank rate
export async function DELETE(request: NextRequest) {
  try {
        const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Rate ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ulap_bank_rates')
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('Error deleting rate', error)
      return NextResponse.json({ success: false, error: 'Failed to delete rate' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Rates API error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
