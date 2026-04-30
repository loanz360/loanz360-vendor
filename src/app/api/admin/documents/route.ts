import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const category = searchParams.get('category') || ''
    const offset = (page - 1) * limit

    let query = supabase
      .from('customer_documents')
      .select(`
        id, document_type, document_status, upload_date, verification_date,
        verified_by, rejection_reason, document_url, file_format, file_size,
        customer_id, entity_id, created_at, updated_at
      `, { count: 'exact' })

    if (status) query = query.eq('document_status', status)
    if (category) query = query.eq('document_type', category)

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: docs, error, count } = await query

    if (error) {
      // Fallback to individual_entity_documents
      const { data: altDocs, error: altErr, count: altCount } = await supabase
        .from('individual_entity_documents')
        .select('id, document_type, document_status, upload_date, verification_date, verified_by, rejection_reason, document_url, file_format, file_size, customer_id, entity_id, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (altErr) {
        return NextResponse.json({ success: false, error: 'Failed to fetch documents' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: altDocs || [],
        total: altCount || 0,
        page, limit,
        totalPages: Math.ceil((altCount || 0) / limit)
      })
    }

    // Enrich with customer names
    const customerIds = (docs || []).map((d: any) => d.customer_id).filter(Boolean)
    let customerMap: Record<string, string> = {}
    if (customerIds.length > 0) {
      try {
        const { data: customers } = await supabase
          .from('customer_identities')
          .select('id, full_name, unique_id')
          .in('id', customerIds)
        if (customers) {
          customers.forEach((c: any) => {
            customerMap[c.id] = `${c.full_name} (${c.unique_id})`
          })
        }
      } catch { /* ignore */ }
    }

    // Status counts for summary - parallel queries instead of fetching all rows
    const statusTypes = ['VERIFIED', 'PENDING_VERIFICATION', 'UNDER_REVIEW', 'REJECTED'] as const
    let statusCounts: Record<string, number> = {}
    try {
      const countResults = await Promise.all(
        statusTypes.map(s =>
          supabase.from('customer_documents').select('id', { count: 'exact', head: true }).eq('document_status', s)
        )
      )
      statusTypes.forEach((s, i) => {
        statusCounts[s] = countResults[i].count || 0
      })
    } catch { /* ignore */ }

    const enriched = (docs || []).map((d: any) => ({
      ...d,
      customerName: customerMap[d.customer_id] || 'Unknown Customer',
      name: d.document_type?.replace(/_/g, ' ') || 'Document',
      status: d.document_status,
      category: d.document_type
    }))

    return NextResponse.json({
      success: true,
      data: enriched,
      total: count || 0,
      page, limit,
      totalPages: Math.ceil((count || 0) / limit),
      statusCounts
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const body = await request.json()
    const { id, action, rejection_reason } = body

    if (!id || !action) {
      return NextResponse.json({ success: false, error: 'id and action required' }, { status: 400 })
    }

    const updateData: any = { updated_at: new Date().toISOString() }
    if (action === 'verify') {
      updateData.document_status = 'VERIFIED'
      updateData.verification_date = new Date().toISOString()
    } else if (action === 'reject') {
      updateData.document_status = 'REJECTED'
      updateData.rejection_reason = rejection_reason || 'Rejected by admin'
    } else if (action === 'review') {
      updateData.document_status = 'UNDER_REVIEW'
    }

    const { error } = await supabase.from('customer_documents').update(updateData).eq('id', id)
    if (error) return NextResponse.json({ success: false, error: 'Failed to update document' }, { status: 500 })

    return NextResponse.json({ success: true, message: `Document ${action}d successfully` })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
