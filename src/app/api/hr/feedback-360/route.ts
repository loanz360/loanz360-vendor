import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'

const feedbackCreateSchema = z.object({
  employee_id: z.string().uuid(),
  manager_id: z.string().uuid().optional(),
  include_self: z.boolean().optional().default(true),
  peer_ids: z.array(z.string().uuid()).optional(),
  skip_level_id: z.string().uuid().optional(),
  due_date: z.string().min(1, 'Due date is required'),
  is_anonymous: z.boolean().optional().default(true),
})

interface Feedback360Request {
  id: string
  employee_id: string
  request_type: string
  include_self?: boolean
  is_anonymous?: boolean
  nominated_peers?: string[]
  nominated_skip_level?: string[]
  due_date: string | null
  status: string
  request_sent_at: string | null
  created_at: string
  [key: string]: unknown
}

interface Feedback360Response {
  id: string
  request_id: string
  feedback_giver_id: string
  relationship_to_employee: string
  overall_rating: number | null
  what_works_well: string | null
  what_could_improve: string | null
  additional_comments: string | null
  status: string
  [key: string]: unknown
}

interface ReviewerStatus {
  type: string
  label: string
  responded: boolean
  rating?: number | null
  strengths?: string | null
  improvements?: string | null
  comments?: string | null
}

interface EmployeeProfile {
  id: string
  first_name?: string
  last_name?: string
  designation?: string
  department?: string
  user_id?: string
}

function buildReviewerStatuses(dbRequest: Feedback360Request, responses: Feedback360Response[]): ReviewerStatus[] {
  const reviewers: ReviewerStatus[] = []
  // Read is_anonymous from the DB record (feedback_360_requests table), never from client payload
  const isAnonymous = dbRequest.is_anonymous === true
  if (dbRequest.include_self !== false) {
    const r = responses.find(x => x.relationship_to_employee === 'SELF')
    reviewers.push({ type: 'self', label: 'Self', responded: r?.status === 'SUBMITTED', rating: r?.overall_rating, strengths: r?.what_works_well, improvements: r?.what_could_improve, comments: r?.additional_comments })
  }
  const mgr = responses.find(x => x.relationship_to_employee === 'MANAGER')
  if (mgr) reviewers.push({ type: 'manager', label: 'Manager', responded: mgr.status === 'SUBMITTED', rating: mgr.overall_rating, strengths: mgr.what_works_well, improvements: mgr.what_could_improve, comments: isAnonymous ? null : mgr.additional_comments })
  const peers = Array.isArray(dbRequest.nominated_peers) ? dbRequest.nominated_peers : []
  peers.forEach((pid: string, i: number) => {
    const r = responses.find(x => x.relationship_to_employee === 'PEER' && x.feedback_giver_id === pid)
    reviewers.push({ type: 'peer_' + (i+1), label: 'Peer ' + (i+1), responded: r?.status === 'SUBMITTED', rating: r?.overall_rating, strengths: r?.what_works_well, improvements: r?.what_could_improve, comments: isAnonymous ? null : (r?.additional_comments || null) })
  })
  const skips = Array.isArray(dbRequest.nominated_skip_level) ? dbRequest.nominated_skip_level : []
  if (skips.length > 0) {
    const r = responses.find(x => x.relationship_to_employee === 'SKIP_LEVEL')
    reviewers.push({ type: 'skip_level', label: 'Skip-Level', responded: r?.status === 'SUBMITTED', rating: r?.overall_rating, strengths: r?.what_works_well, improvements: r?.what_could_improve, comments: isAnonymous ? null : r?.additional_comments })
  }
  return reviewers
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const sp = request.nextUrl.searchParams
    const status = sp.get('status') || 'active'
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
    const pageSize = Math.min(Math.max(1, parseInt(sp.get('page_size') || '10', 10)), 100)
    const offset = (page - 1) * pageSize
    const dbStatuses = status === 'active' ? ['PENDING', 'IN_PROGRESS'] : ['COMPLETED']

    const { data: requests, error: reqErr, count } = await adminClient
      .from('feedback_360_requests')
      .select('*', { count: 'exact' })
      .in('status', dbStatuses)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (reqErr) throw reqErr

    // Use head:true count query instead of fetching all rows
    const { count: totalCycles } = await adminClient
      .from('feedback_360_requests')
      .select('id', { count: 'exact', head: true })

    if (!requests || requests.length === 0) {
      return NextResponse.json({
        success: true, data: [],
        meta: { total: 0, page, page_size: pageSize },
        stats: { totalCycles: totalCycles || 0, pendingResponses: 0, completionRate: 0, avgRating: 0 },
      })
    }

    const empIds = [...new Set(requests.map(r => r.employee_id))]
    const { data: empProfiles } = await adminClient
      .from('employee_profile').select('id, first_name, last_name, designation, department').in('id', empIds)
    const empMap = new Map((empProfiles || []).map(e => [e.id, e]))

    const reqIds = requests.map((r: Feedback360Request) => r.id)
    const { data: responses } = await adminClient.from('feedback_360_responses').select('*').in('request_id', reqIds)
    const responsesByReq = new Map<string, Feedback360Response[]>()
    for (const r of ((responses || []) as Feedback360Response[])) {
      if (!responsesByReq.has(r.request_id)) responsesByReq.set(r.request_id, [])
      responsesByReq.get(r.request_id)!.push(r)
    }

    const cycles = (requests as Feedback360Request[]).map(req => {
      const emp = empMap.get(req.employee_id) as EmployeeProfile | undefined
      const empName = emp ? ((emp.first_name || '') + ' ' + (emp.last_name || '')).trim() : 'Unknown'
      const reqResponses = responsesByReq.get(req.id) || []
      const reviewers = buildReviewerStatuses(req, reqResponses)
      const respondedCount = reviewers.filter(r => r.responded).length
      const submitted = reqResponses.filter(r => r.status === 'SUBMITTED')
      const sum = submitted.reduce((s: number, r: Feedback360Response) => s + (r.overall_rating || 0), 0)
      const aggScore = submitted.length > 0 ? (sum / submitted.length) : null
      return {
        id: req.id, employee_id: req.employee_id, employee_name: empName,
        employee_designation: emp?.designation || null, employee_department: emp?.department || null,
        cycle_type: (req.request_type || 'annual').toLowerCase().replace(/^360$/, 'annual'),
        due_date: req.due_date, status: status === 'active' ? 'active' : 'completed',
        total_reviewers: reviewers.length, responded_count: respondedCount,
        aggregate_score: aggScore, reminder_sent_at: req.request_sent_at, created_at: req.created_at,
        reviewers,
      }
    })

    // Use count queries instead of fetching all response rows
    const [
      { count: totalResps },
      { count: submittedCount },
      { count: draftCount },
    ] = await Promise.all([
      adminClient.from('feedback_360_responses').select('id', { count: 'exact', head: true }),
      adminClient.from('feedback_360_responses').select('id', { count: 'exact', head: true }).eq('status', 'SUBMITTED'),
      adminClient.from('feedback_360_responses').select('id', { count: 'exact', head: true }).eq('status', 'DRAFT'),
    ])

    const totalRespsNum = totalResps || 0
    const submittedNum = submittedCount || 0
    const draftNum = draftCount || 0
    const completionRate = totalRespsNum > 0 ? Math.round((submittedNum / totalRespsNum) * 100) : 0

    // For avgRating we need actual values — fetch only submitted responses (capped at 1000)
    let avgRating = 0
    if (submittedNum > 0) {
      const { data: submittedResps } = await adminClient
        .from('feedback_360_responses')
        .select('overall_rating')
        .eq('status', 'SUBMITTED')
        .not('overall_rating', 'is', null)
        .limit(1000)
      if (submittedResps && submittedResps.length > 0) {
        const sum = submittedResps.reduce((s, r) => s + (r.overall_rating || 0), 0)
        avgRating = sum / submittedResps.length
      }
    }

    return NextResponse.json({
      success: true, data: cycles,
      meta: { total: count || 0, page, page_size: pageSize },
      stats: { totalCycles: totalCycles || 0, pendingResponses: draftNum, completionRate, avgRating: Math.round(avgRating * 100) / 100 },
    })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/feedback-360', { errorId, error: err })
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
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const parsed = feedbackCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { employee_id, manager_id, include_self, peer_ids, skip_level_id, due_date, is_anonymous } = parsed.data

    const { data: empProfile } = await adminClient.from('employee_profile').select('id, user_id').eq('id', employee_id).maybeSingle()

    if (!empProfile) {
      return NextResponse.json(
        { success: false, error: 'Employee profile not found' },
        { status: 404 }
      )
    }

    let managerUserId: string | null = null
    if (manager_id) {
      const { data: mgr } = await adminClient.from('employee_profile').select('user_id').eq('id', manager_id).maybeSingle()
      managerUserId = mgr?.user_id || null
    }

    const nominatedPeers: string[] = []
    if (peer_ids?.length > 0) {
      const { data: peerProfiles } = await adminClient.from('employee_profile').select('id, user_id').in('id', peer_ids)
      for (const pid of (peer_ids as string[])) {
        const pp = (peerProfiles || []).find((p: { id: string; user_id: string | null }) => p.id === pid)
        if (pp?.user_id) nominatedPeers.push(pp.user_id)
      }
    }

    let skipUserId: string | null = null
    if (skip_level_id) {
      const { data: slp } = await adminClient.from('employee_profile').select('user_id').eq('id', skip_level_id).maybeSingle()
      skipUserId = slp?.user_id || null
    }

    const { data: empRecord } = await adminClient.from('employees').select('id').eq('user_id', empProfile?.user_id || '').maybeSingle()
    const dbEmpId = empRecord?.id || employee_id

    const { data: newReq, error: createErr } = await adminClient
      .from('feedback_360_requests')
      .insert({
        employee_id: dbEmpId, request_type: 'ANNUAL', nominated_by: user.id,
        nominated_peers: nominatedPeers, nominated_skip_level: skipUserId ? [skipUserId] : [],
        status: 'IN_PROGRESS', due_date, is_anonymous: is_anonymous,
        request_sent_at: new Date().toISOString(),
      })
      .select().maybeSingle()

    if (createErr) throw createErr

    if (!newReq) {
      return NextResponse.json(
        { success: false, error: 'Failed to create feedback cycle - no record returned' },
        { status: 500 }
      )
    }

    const rows: Record<string, unknown>[] = []
    if (include_self !== false) rows.push({ request_id: newReq.id, employee_id: dbEmpId, feedback_giver_id: empProfile.user_id || user.id, relationship_to_employee: 'SELF', competency_ratings: {}, status: 'DRAFT', is_anonymous: false })
    if (managerUserId) rows.push({ request_id: newReq.id, employee_id: dbEmpId, feedback_giver_id: managerUserId, relationship_to_employee: 'MANAGER', competency_ratings: {}, status: 'DRAFT', is_anonymous: false })
    nominatedPeers.forEach(pUid => rows.push({ request_id: newReq.id, employee_id: dbEmpId, feedback_giver_id: pUid, relationship_to_employee: 'PEER', competency_ratings: {}, status: 'DRAFT', is_anonymous: true }))
    if (skipUserId) rows.push({ request_id: newReq.id, employee_id: dbEmpId, feedback_giver_id: skipUserId, relationship_to_employee: 'SKIP_LEVEL', competency_ratings: {}, status: 'DRAFT', is_anonymous: false })
    if (rows.length > 0) await adminClient.from('feedback_360_responses').insert(rows)

    apiLogger.info('Feedback 360 cycle created', { requestId: newReq.id, employeeId: employee_id })

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'feedback_360',
        entity_id: newReq.id,
        description: `Created 360 feedback cycle for employee ${employee_id} with ${rows.length} reviewers`,
        details: { employee_id, due_date, reviewers_count: rows.length }
      })
    } catch (auditErr) { apiLogger.warn('Audit log failed for feedback_360 create', auditErr) }

    return NextResponse.json({
      success: true, data: { id: newReq.id },
      message: 'Feedback cycle created with ' + rows.length + ' reviewers',
    }, { status: 201 })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('POST /api/hr/feedback-360', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json({ success: false, error: 'Use /api/hr/feedback-360/[id]/remind or /finalize routes' }, { status: 400 })
}
