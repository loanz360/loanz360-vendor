
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Export businesses data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const city = searchParams.get('city')
    const pincode = searchParams.get('pincode')
    const keyword = searchParams.get('keyword')
    const hasPhone = searchParams.get('hasPhone')
    const hasEmail = searchParams.get('hasEmail')

    // Build query
    let query = supabase
      .from('google_maps_businesses')
      .select('*')
      .order('scraped_at', { ascending: false })

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

    const { data, error } = await query

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data to export' },
        { status: 404 }
      )
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Business Name',
        'Category',
        'Phone Numbers',
        'Email Addresses',
        'Website',
        'Full Address',
        'City',
        'State',
        'Pincode',
        'Rating',
        'Review Count',
        'Google Maps URL',
        'Search Keyword',
        'Scraped At'
      ]

      const rows = data.map(business => [
        escapeCSV(business.business_name || ''),
        escapeCSV(business.category || ''),
        escapeCSV((business.phone_numbers || []).join('; ')),
        escapeCSV((business.email_addresses || []).join('; ')),
        escapeCSV(business.website_url || ''),
        escapeCSV(business.full_address || ''),
        escapeCSV(business.city || ''),
        escapeCSV(business.state || ''),
        escapeCSV(business.pincode || ''),
        business.rating || '',
        business.review_count || '',
        escapeCSV(business.google_maps_url || ''),
        escapeCSV(business.search_keyword || ''),
        business.scraped_at || ''
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="google-maps-data-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else if (format === 'excel' || format === 'xlsx') {
      // For Excel, we'll return JSON that can be converted client-side
      // In production, you'd use a library like xlsx or exceljs
      const excelData = data.map(business => ({
        'Business Name': business.business_name || '',
        'Category': business.category || '',
        'Phone Numbers': (business.phone_numbers || []).join('; '),
        'Email Addresses': (business.email_addresses || []).join('; '),
        'Website': business.website_url || '',
        'Full Address': business.full_address || '',
        'City': business.city || '',
        'State': business.state || '',
        'Pincode': business.pincode || '',
        'Rating': business.rating || '',
        'Review Count': business.review_count || '',
        'Google Maps URL': business.google_maps_url || '',
        'Search Keyword': business.search_keyword || '',
        'Scraped At': business.scraped_at || ''
      }))

      // Return as JSON for now - client can convert to Excel
      return NextResponse.json({
        success: true,
        data: excelData,
        format: 'json-for-excel'
      })
    } else if (format === 'json') {
      return NextResponse.json({
        success: true,
        data,
        total: data.length
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid format. Use csv, excel, or json' },
      { status: 400 }
    )
  } catch (error: unknown) {
    apiLogger.error('Error exporting data', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function escapeCSV(value: string): string {
  if (!value) return ''
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
