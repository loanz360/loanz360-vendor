/**
 * Real-Time Activity Feed Export API
 * Export activities to CSV, Excel, or JSON
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const format = searchParams.get('format') || 'json' // json, csv
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 10000)

    // Parse filters (same as main feed)
    const categories = searchParams.get('categories')?.split(',').filter(Boolean)
    const severityLevels = searchParams.get('severity_levels')?.split(',').filter(Boolean)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const securityOnly = searchParams.get('security_only') === 'true'

    // Build query
    let query = supabase
      .from('realtime_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (categories?.length) {
      query = query.in('event_category', categories)
    }

    if (severityLevels?.length) {
      query = query.in('severity_level', severityLevels)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    if (securityOnly) {
      query = query.eq('is_security_event', true)
    }

    const { data: activities, error } = await query

    if (error) {
      apiLogger.error('[Export API] Query error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activities for export' },
        { status: 500 }
      )
    }

    const data = activities || []

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'ID',
        'Created At',
        'Event Category',
        'Event Type',
        'Severity Level',
        'Status',
        'Title',
        'Description',
        'Actor Name',
        'Actor Email',
        'Actor Type',
        'Entity Type',
        'Entity ID',
        'Entity Name',
        'Module',
        'Source',
        'IP Address',
        'Country',
        'City',
        'Is Security Event',
        'Is Suspicious',
        'Threat Level'
      ]

      const rows = data.map(a => [
        a.id,
        a.created_at,
        a.event_category,
        a.event_type,
        a.severity_level,
        a.status,
        `"${(a.title || '').replace(/"/g, '""')}"`,
        `"${(a.description || '').replace(/"/g, '""')}"`,
        a.actor_name || '',
        a.actor_email || '',
        a.actor_type || '',
        a.entity_type || '',
        a.entity_id || '',
        a.entity_name || '',
        a.module || '',
        a.source,
        a.ip_address || '',
        a.country || '',
        a.city || '',
        a.is_security_event ? 'Yes' : 'No',
        a.is_suspicious ? 'Yes' : 'No',
        a.threat_level || 0
      ])

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="activity-feed-${new Date().toISOString().slice(0, 10)}.csv"`,
        }
      })
    }

    // Default: JSON format
    return NextResponse.json({
      success: true,
      export: {
        format: 'json',
        count: data.length,
        exported_at: new Date().toISOString(),
        activities: data
      }
    })
  } catch (error) {
    apiLogger.error('[Export API] Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
