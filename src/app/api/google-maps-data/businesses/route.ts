import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch scraped businesses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const city = searchParams.get('city')
    const pincode = searchParams.get('pincode')
    const keyword = searchParams.get('keyword')
    const hasPhone = searchParams.get('hasPhone')
    const hasEmail = searchParams.get('hasEmail')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('google_maps_businesses')
      .select('*', { count: 'exact' })
      .order('scraped_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`business_name.ilike.%${safeSearch}%,full_address.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%`)
      }
    }

    if (city) {
      const safeCity = sanitizeSearchInput(city)
      if (safeCity) {
        query = query.ilike('city', `%${safeCity}%`)
      }
    }

    if (pincode) {
      query = query.eq('pincode', pincode)
    }

    if (keyword) {
      const safeKeyword = sanitizeSearchInput(keyword)
      if (safeKeyword) {
        query = query.ilike('search_keyword', `%${safeKeyword}%`)
      }
    }

    if (hasPhone === 'true') {
      query = query.not('phone_numbers', 'is', null)
    }

    if (hasEmail === 'true') {
      query = query.not('email_addresses', 'is', null)
    }

    const { data, count, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count,
        limit,
        offset
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching businesses', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add scraped businesses (called by Lambda)
export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { businesses, job_id, keyword_id } = body

    if (!Array.isArray(businesses) || businesses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No businesses provided' },
        { status: 400 }
      )
    }

    let inserted = 0
    let duplicates = 0
    const duplicateRecords: any[] = []

    for (const business of businesses) {
      // Check for duplicates by place_id
      if (business.place_id) {
        const { data: existing } = await supabase
          .from('google_maps_businesses')
          .select('id')
          .eq('place_id', business.place_id)
          .maybeSingle()

        if (existing) {
          duplicates++
          duplicateRecords.push({
            original_business_id: existing.id,
            duplicate_place_id: business.place_id,
            matched_on: 'place_id',
            keyword_id
          })
          continue
        }
      }

      // Check for duplicates by phone number
      if (business.phone_numbers && business.phone_numbers.length > 0) {
        const { data: existingByPhone } = await supabase
          .from('google_maps_businesses')
          .select('id')
          .contains('phone_numbers', [business.phone_numbers[0]])
          .maybeSingle()

        if (existingByPhone) {
          duplicates++
          duplicateRecords.push({
            original_business_id: existingByPhone.id,
            duplicate_phone: business.phone_numbers[0],
            matched_on: 'phone',
            keyword_id
          })
          continue
        }
      }

      // Insert new business
      const { error: insertError } = await supabase
        .from('google_maps_businesses')
        .insert({
          ...business,
          job_id,
          keyword_id,
          scraped_at: new Date().toISOString()
        })

      if (!insertError) {
        inserted++
      }
    }

    // Record duplicates
    if (duplicateRecords.length > 0) {
      await supabase
        .from('google_maps_duplicates')
        .insert(duplicateRecords)
    }

    // Update job stats
    if (job_id) {
      const { data: job } = await supabase
        .from('google_maps_jobs')
        .select('total_businesses, duplicate_count')
        .eq('id', job_id)
        .maybeSingle()

      if (job) {
        await supabase
          .from('google_maps_jobs')
          .update({
            total_businesses: (job.total_businesses || 0) + inserted,
            duplicate_count: (job.duplicate_count || 0) + duplicates
          })
          .eq('id', job_id)
      }
    }

    // Update keyword stats
    if (keyword_id) {
      const { data: keyword } = await supabase
        .from('google_maps_keywords')
        .select('scraped_count')
        .eq('id', keyword_id)
        .maybeSingle()

      if (keyword) {
        await supabase
          .from('google_maps_keywords')
          .update({
            scraped_count: (keyword.scraped_count || 0) + inserted,
            last_scraped_at: new Date().toISOString()
          })
          .eq('id', keyword_id)
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      duplicates,
      message: `Inserted ${inserted} businesses, skipped ${duplicates} duplicates`
    })
  } catch (error: unknown) {
    apiLogger.error('Error adding businesses', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete business(es)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const ids = searchParams.get('ids')

    if (ids) {
      const idArray = ids.split(',')
      const { error } = await supabase
        .from('google_maps_businesses')
        .delete()
        .in('id', idArray)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: `${idArray.length} businesses deleted`
      })
    } else if (id) {
      const { error } = await supabase
        .from('google_maps_businesses')
        .delete()
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Business deleted'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'No ID provided' },
        { status: 400 }
      )
    }
  } catch (error: unknown) {
    apiLogger.error('Error deleting businesses', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
