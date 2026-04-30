import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// EMPLOYEE REIMBURSEMENTS API
// GET: List reimbursement claims
// POST: Submit new reimbursement claim
// PATCH: Approve/reject claim (Manager/Finance)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getEmployeeId(supabase: SupabaseClient, userId: string) {
  const { data: employee } = await supabase
    .from('employees')
    .select('id, sub_role')
    .eq('user_id', userId)
    .maybeSingle()

  return employee
}

// GET: List reimbursements
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const categoryId = searchParams.get('category_id')

    // Check if user is Finance/HR
    const isFinanceOrHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'FINANCE_EXECUTIVE', 'ACCOUNTS_EXECUTIVE'].includes(employee.sub_role)

    let query = supabase
      .from('employee_reimbursements')
      .select(`
        *,
        employee:employees!employee_reimbursements_employee_id_fkey(
          id,
          employee_id,
          full_name,
          work_email
        ),
        category:reimbursement_categories(
          category_code,
          category_name,
          category_type,
          max_amount_per_claim
        )
      `)
      .order('created_at', { ascending: false })

    // Filter by employee if not Finance/HR
    if (!isFinanceOrHR) {
      query = query.eq('employee_id', employee.id)
    }

    if (status) {
      query = query.eq('approval_status', status)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data: reimbursements, error: reimbError } = await query

    if (reimbError) {
      apiLogger.error('Reimbursements fetch error', reimbError)
      return NextResponse.json({ success: false, error: 'Failed to fetch reimbursements' }, { status: 500 })
    }

    // Get categories
    const { data: categories } = await supabase
      .from('reimbursement_categories')
      .select('*')
      .eq('is_active', true)
      .order('category_name')

    // Calculate summary
    const summary = {
      total_claims: reimbursements.length,
      pending_claims: reimbursements.filter((r) => r.approval_status === 'PENDING').length,
      approved_claims: reimbursements.filter((r) => ['APPROVED', 'MANAGER_APPROVED', 'FINANCE_APPROVED'].includes(r.approval_status)).length,
      total_claimed: reimbursements.reduce((sum: number, r) => sum + (parseFloat(r.claim_amount) || 0), 0),
      total_approved: reimbursements
        .filter((r) => r.approval_status === 'APPROVED')
        .reduce((sum: number, r) => sum + (parseFloat(r.approved_amount || r.claim_amount) || 0), 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        reimbursements,
        categories,
        summary
      }
    })
  } catch (error) {
    apiLogger.error('Reimbursements GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Submit reimbursement claim
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      category_id,
      claim_date,
      claim_amount,
      claim_description,
      receipt_urls,
      additional_documents
    } = body

    // Validation
    if (!category_id || !claim_amount || !claim_description || !receipt_urls || receipt_urls.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields: category_id, claim_amount, claim_description, receipt_urls'
      }, { status: 400 })
    }

    // Get category to check limits
    const { data: category, error: catError } = await supabase
      .from('reimbursement_categories')
      .select('*')
      .eq('id', category_id)
      .maybeSingle()

    if (catError || !category) {
      return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 })
    }

    // Check max amount per claim
    if (category.max_amount_per_claim && claim_amount > category.max_amount_per_claim) {
      return NextResponse.json({ success: false, error: `Claim amount exceeds maximum allowed (₹${category.max_amount_per_claim})`
      }, { status: 400 })
    }

    // Check max claims per month
    if (category.max_claims_per_month) {
      const currentMonth = new Date().toISOString().slice(0, 7)
      const { data: monthClaims } = await supabase
        .from('employee_reimbursements')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('category_id', category_id)
        .gte('claim_date', `${currentMonth}-01`)

      if (monthClaims && monthClaims.length >= category.max_claims_per_month) {
        return NextResponse.json({ success: false, error: `Maximum ${category.max_claims_per_month} claims per month allowed for this category`
        }, { status: 400 })
      }
    }

    // Check max amount per month
    if (category.max_amount_per_month) {
      const currentMonth = new Date().toISOString().slice(0, 7)
      const { data: monthClaims } = await supabase
        .from('employee_reimbursements')
        .select('claim_amount')
        .eq('employee_id', employee.id)
        .eq('category_id', category_id)
        .gte('claim_date', `${currentMonth}-01`)

      const monthTotal = (monthClaims || []).reduce((sum: number, c: { claim_amount: string }) => sum + parseFloat(c.claim_amount), 0)

      if (monthTotal + claim_amount > category.max_amount_per_month) {
        return NextResponse.json({ success: false, error: `Monthly limit of ₹${category.max_amount_per_month} exceeded for this category`
        }, { status: 400 })
      }
    }

    // Create reimbursement claim
    const { data: claim, error: insertError } = await supabase
      .from('employee_reimbursements')
      .insert({
        employee_id: employee.id,
        category_id,
        claim_date: claim_date || new Date().toISOString().split('T')[0],
        claim_amount,
        claim_description,
        receipt_urls,
        additional_documents: additional_documents || [],
        approval_status: 'PENDING',
        manager_approval_status: category.requires_manager_approval ? 'PENDING' : 'NOT_REQUIRED',
        finance_approval_status: category.requires_finance_approval ? 'PENDING' : 'NOT_REQUIRED'
      })
      .select(`
        *,
        category:reimbursement_categories(category_name, category_type)
      `)
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Reimbursement insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create reimbursement claim' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: claim,
      message: 'Reimbursement claim submitted successfully'
    })
  } catch (error) {
    apiLogger.error('Reimbursements POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Approve/reject reimbursement
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { reimbursement_id, action, ...actionData } = body

    if (!reimbursement_id || !action) {
      return NextResponse.json({ success: false, error: 'reimbursement_id and action required' }, { status: 400 })
    }

    // Get reimbursement
    const { data: reimbursement, error: fetchError } = await supabase
      .from('employee_reimbursements')
      .select('*, category:reimbursement_categories(*)')
      .eq('id', reimbursement_id)
      .maybeSingle()

    if (fetchError || !reimbursement) {
      return NextResponse.json({ success: false, error: 'Reimbursement not found' }, { status: 404 })
    }

    const isFinance = ['FINANCE_EXECUTIVE', 'ACCOUNTS_EXECUTIVE'].includes(employee.sub_role)

    if (action === 'MANAGER_APPROVE') {
      // Manager approval
      const { data: updated, error: updateError } = await supabase
        .from('employee_reimbursements')
        .update({
          manager_approval_status: 'APPROVED',
          manager_approved_by: user.id,
          manager_approved_at: new Date().toISOString(),
          manager_comments: actionData.comments || null,
          approval_status: reimbursement.category.requires_finance_approval ? 'MANAGER_APPROVED' : 'APPROVED',
          approved_amount: actionData.approved_amount || reimbursement.claim_amount
        })
        .eq('id', reimbursement_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: reimbursement.category.requires_finance_approval
          ? 'Manager approved. Awaiting finance approval.'
          : 'Reimbursement approved'
      })
    } else if (action === 'FINANCE_APPROVE') {
      if (!isFinance) {
        return NextResponse.json({ success: false, error: 'Only finance team can approve' }, { status: 403 })
      }

      const { data: updated, error: updateError } = await supabase
        .from('employee_reimbursements')
        .update({
          finance_approval_status: 'APPROVED',
          finance_approved_by: user.id,
          finance_approved_at: new Date().toISOString(),
          finance_comments: actionData.comments || null,
          approval_status: 'APPROVED',
          approved_amount: actionData.approved_amount || reimbursement.approved_amount || reimbursement.claim_amount
        })
        .eq('id', reimbursement_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Reimbursement approved by finance'
      })
    } else if (action === 'REJECT') {
      const { rejection_reason } = actionData

      const { data: updated, error: updateError } = await supabase
        .from('employee_reimbursements')
        .update({
          approval_status: 'REJECTED',
          rejection_reason,
          [isFinance ? 'finance_approval_status' : 'manager_approval_status']: 'REJECTED',
          [isFinance ? 'finance_approved_by' : 'manager_approved_by']: user.id,
          [isFinance ? 'finance_approved_at' : 'manager_approved_at']: new Date().toISOString()
        })
        .eq('id', reimbursement_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Reimbursement rejected'
      })
    } else if (action === 'MARK_PAID') {
      if (!isFinance) {
        return NextResponse.json({ success: false, error: 'Only finance team can mark as paid' }, { status: 403 })
      }

      const { payment_method, payment_reference } = actionData

      const { data: updated, error: updateError } = await supabase
        .from('employee_reimbursements')
        .update({
          payment_status: 'PAID',
          payment_date: new Date().toISOString().split('T')[0],
          payment_method,
          payment_reference
        })
        .eq('id', reimbursement_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Reimbursement marked as paid'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Reimbursements PATCH Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
