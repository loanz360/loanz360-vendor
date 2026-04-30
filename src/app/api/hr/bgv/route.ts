
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeInput } from '@/lib/validation/input-validation'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

const DEFAULT_CHECKS = ['identity', 'education', 'employment_history', 'criminal', 'address', 'reference']

interface BGVCheck {
  status: string
  risk_level?: string
  check_type?: string
}

function computeOverallStatus(checks: BGVCheck[]): string {
  if (!checks || checks.length === 0) return 'pending'
  const statuses = checks.map((c: BGVCheck) => c.status)
  if (statuses.some((s: string) => s === 'failed')) return 'failed'
  if (statuses.every((s: string) => s === 'verified')) return 'completed'
  if (statuses.some((s: string) => ['in_progress', 'verified'].includes(s))) return 'in_progress'
  return 'pending'
}

function computeRiskScore(checks: BGVCheck[]): number {
  if (!checks || checks.length === 0) return 0
  const total = checks.length
  const failedCount = checks.filter((c: BGVCheck) => c.status === 'failed').length
  const verifiedCount = checks.filter((c: BGVCheck) => c.status === 'verified').length
  return Math.round((failedCount / total) * 70 + (1 - verifiedCount / total) * 30)
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    if (id) {
      const { data: bgv, error: bgvErr } = await adminClient
        .from('bgv_requests')
        .select('*, employee_profile:employee_id ( id, first_name, last_name, employee_id, designation, department )')
        .eq('id', id)
        .maybeSingle()
      if (bgvErr) throw bgvErr
      if (!bgv) return NextResponse.json({ success: false, error: 'BGV request not found' }, { status: 404 })
      const { data: checks } = await adminClient.from('bgv_checks').select('*').eq('bgv_request_id', bgv.id).order('created_at')
      return NextResponse.json({ success: true, data: { bgv, checks: checks || [] } })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)))

    let bgvQuery = adminClient
      .from('bgv_requests')
      .select('*, employee_profile:employee_id ( first_name, last_name, employee_id, designation )', { count: 'exact' })
      .order('initiated_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (status) bgvQuery = bgvQuery.eq('overall_status', status)

    if (search) {
      const safeSearch = sanitizeInput(search, 100).replace(/[%_\\'"(),.]/g, '')
      const likeSearch = '%' + safeSearch + '%'
      const { data: matchedEmps } = await adminClient
        .from('employee_profile')
        .select('id')
        .or('first_name.ilike.' + likeSearch + ',last_name.ilike.' + likeSearch + ',employee_id.ilike.' + likeSearch)
        .limit(100)
      const empIds = (matchedEmps || []).map((e: { id: string }) => e.id)
      if (empIds.length === 0) return NextResponse.json({ success: true, data: [], meta: { total: 0, page, page_size: pageSize } })
      bgvQuery = bgvQuery.in('employee_id', empIds)
    }

    const { data: bgvList, error: bgvErr, count } = await bgvQuery
    if (bgvErr) throw bgvErr

    const bgvIds = (bgvList || []).map((b: { id: string }) => b.id)
    const { data: allChecks } = bgvIds.length > 0
      ? await adminClient.from('bgv_checks').select('bgv_request_id, status').in('bgv_request_id', bgvIds)
      : { data: [] }

    const checkMap: Record<string, { total: number; verified: number }> = {}
    for (const c of (allChecks || [])) {
      if (!checkMap[c.bgv_request_id]) checkMap[c.bgv_request_id] = { total: 0, verified: 0 }
      checkMap[c.bgv_request_id].total++
      if (c.status === 'verified') checkMap[c.bgv_request_id].verified++
    }

    const enriched = (bgvList || []).map((b: { id: string }) => ({ ...b, check_counts: checkMap[b.id] || { total: 0, verified: 0 } }))
    return NextResponse.json({ success: true, data: enriched, meta: { total: count || 0, page, page_size: pageSize } })
  } catch (error: unknown) {
    const errorId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    apiLogger.error('GET /api/hr/bgv', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const body = await request.json()
    const { employee_id, vendor, check_types, remarks } = body
    if (!employee_id) return NextResponse.json({ success: false, error: 'Employee ID required' }, { status: 400 })

    const checksToRun: string[] = Array.isArray(check_types) && check_types.length > 0 ? check_types : DEFAULT_CHECKS

    const { data: bgvRequest, error: bgvErr } = await adminClient
      .from('bgv_requests')
      .insert({
        employee_id, initiated_by: user.id,
        vendor: vendor || 'Internal',
        overall_status: 'pending',
        remarks: remarks || null
      })
      .select()
      .maybeSingle()
    if (bgvErr) throw bgvErr
    if (!bgvRequest) throw new Error('Failed to create BGV request')

    const checkInserts = checksToRun.map((ct: string) => ({
      bgv_request_id: bgvRequest.id, check_type: ct, status: 'pending'
    }))
    const { error: checksErr } = await adminClient.from('bgv_checks').insert(checkInserts)
    if (checksErr) throw checksErr

    return NextResponse.json({ success: true, data: bgvRequest }, { status: 201 })
  } catch (error: unknown) {
    const errorId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    apiLogger.error('POST /api/hr/bgv', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const body = await request.json()
    const { check_id, bgv_request_id, status, notes, verified_by } = body
    if (!check_id) return NextResponse.json({ success: false, error: 'Check ID required' }, { status: 400 })
    if (!bgv_request_id) return NextResponse.json({ success: false, error: 'BGV Request ID required' }, { status: 400 })

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status) updatePayload.status = status
    if (notes !== undefined) updatePayload.notes = notes
    if (verified_by !== undefined) updatePayload.verified_by = verified_by
    if (status === 'verified' || status === 'failed') updatePayload.verified_at = new Date().toISOString()

    const { error: checkErr } = await adminClient.from('bgv_checks').update(updatePayload).eq('id', check_id)
    if (checkErr) throw checkErr

    const { data: allChecks } = await adminClient.from('bgv_checks').select('*').eq('bgv_request_id', bgv_request_id)
    const newOverallStatus = computeOverallStatus(allChecks || [])
    const newRiskScore = computeRiskScore(allChecks || [])

    const bgvUpdate: Record<string, unknown> = {
      overall_status: newOverallStatus, risk_score: newRiskScore,
      updated_at: new Date().toISOString()
    }
    if (newOverallStatus === 'completed') bgvUpdate.completed_at = new Date().toISOString()

    const { data: updatedBgv, error: bgvErr } = await adminClient
      .from('bgv_requests')
      .update(bgvUpdate)
      .eq('id', bgv_request_id)
      .select('*, employee_profile:employee_id ( first_name, last_name, employee_id )')
      .maybeSingle()
    if (bgvErr) throw bgvErr

    return NextResponse.json({ success: true, data: { bgv: updatedBgv, checks: allChecks || [] } })
  } catch (error: unknown) {
    const errorId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    apiLogger.error('PATCH /api/hr/bgv', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
