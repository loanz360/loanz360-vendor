export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// GET - Export offers to CSV
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active' or 'expired'

    // Build query
    let query = supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: offers, error } = await query

    if (error) throw error

    // Generate CSV content
    const headers = [
      'Title',
      'Bank/NBFC',
      'Status',
      'Description',
      'Start Date',
      'End Date',
      'States',
      'Image URL',
      'Image Source',
      'Created At',
      'Updated At'
    ]

    const csvRows = [
      headers.join(','),
      ...offers.map(offer => {
        const esc = (val: string | null | undefined) => `"${(val || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`
        return [
          esc(offer.offer_title),
          esc(offer.rolled_out_by),
          offer.status || '',
          esc(offer.description),
          offer.start_date || '',
          offer.end_date || '',
          `"${(offer.states_applicable || []).join(', ')}"`,
          offer.offer_image_url || '',
          offer.image_source || 'upload',
          offer.created_at ? new Date(offer.created_at).toISOString() : '',
          offer.updated_at ? new Date(offer.updated_at).toISOString() : ''
        ].join(',')
      })
    ]

    const csvContent = csvRows.join('\n')

    // Set headers for CSV download
    const filename = `offers-${status || 'all'}-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error exporting offers', error)
    logApiError(error as Error, request, { action: 'export' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
