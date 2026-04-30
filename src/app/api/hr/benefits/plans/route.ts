
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'

const benefitCreateSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  type: z.string().min(1, 'Plan type is required'),
  description: z.string().optional(),
  provider: z.string().optional(),
  coverage_amount: z.union([z.number().positive(), z.string()]).optional().nullable(),
  employer_contribution: z.union([z.number(), z.string()]).optional().nullable(),
  employee_contribution: z.union([z.number(), z.string()]).optional().nullable(),
  is_mandatory: z.boolean().optional(),
  policy_document_url: z.string().optional().nullable(),
})

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
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('page_size') || '50', 10)
    const offset = (page - 1) * pageSize

    const { data, error, count } = await adminClient
      .from('benefit_plans')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    const planIds = (data || []).map((p: { id: string }) => p.id)
    const { data: enrData } = planIds.length > 0
      ? await adminClient.from('employee_benefit_enrollments').select('plan_id').in('plan_id', planIds).eq('status', 'active')
      : { data: [] }

    const countMap: Record<string, number> = {}
    for (const e of (enrData || [])) {
      countMap[e.plan_id] = (countMap[e.plan_id] || 0) + 1
    }

    const plans = (data || []).map((p: { id: string }) => ({ ...p, enrolled_count: countMap[p.id] || 0 }))
    return NextResponse.json({ success: true, data: plans, meta: { total: count || 0, page, page_size: pageSize } })
  } catch (error: unknown) {
    apiLogger.error('GET /api/hr/benefits/plans', error)
    const errorId = crypto.randomUUID(); return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
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
    const parsed = benefitCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { name, type, description, provider, coverage_amount, employer_contribution, employee_contribution, is_mandatory, policy_document_url } = parsed.data

    const { data, error } = await adminClient
      .from('benefit_plans')
      .insert({
        name: name.trim(), type,
        description: description || null,
        provider: provider || null,
        coverage_amount: coverage_amount != null ? Number(coverage_amount) : null,
        employer_contribution: employer_contribution != null ? Number(employer_contribution) : null,
        employee_contribution: employee_contribution != null ? Number(employee_contribution) : null,
        is_mandatory: !!is_mandatory,
        policy_document_url: policy_document_url || null,
        is_active: true,
        created_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('POST /api/hr/benefits/plans', error)
    const errorId = crypto.randomUUID(); return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
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
    const { id } = body
    if (!id) return NextResponse.json({ success: false, error: 'Plan ID required' }, { status: 400 })

    // Validate plan exists before update
    const { data: existingPlan, error: lookupError } = await adminClient
      .from('benefit_plans')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!existingPlan) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 })

    // Whitelist allowed fields to prevent arbitrary field injection
    const allowedFields = ['name', 'type', 'description', 'provider', 'coverage_amount', 'employer_contribution', 'employee_contribution', 'is_mandatory', 'is_active', 'policy_document_url']
    const cleanUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in body) cleanUpdates[key] = body[key]
    }
    if ('coverage_amount' in body) cleanUpdates.coverage_amount = body.coverage_amount != null ? Number(body.coverage_amount) : null
    if ('employer_contribution' in body) cleanUpdates.employer_contribution = body.employer_contribution != null ? Number(body.employer_contribution) : null
    if ('employee_contribution' in body) cleanUpdates.employee_contribution = body.employee_contribution != null ? Number(body.employee_contribution) : null

    const { data, error } = await adminClient.from('benefit_plans').update(cleanUpdates).eq('id', id).select().maybeSingle()
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    apiLogger.error('PATCH /api/hr/benefits/plans', error)
    const errorId = crypto.randomUUID(); return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}