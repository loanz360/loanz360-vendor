import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from "next/server"
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { checkHRAccess } from "@/lib/auth/hr-access"
import { apiLogger } from "@/lib/utils/logger"
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// ── Constants: Single source of truth for leave defaults ──────────────────
// These defaults are used when no leave_balance record exists yet for an employee.
// They match the leave_types table configuration.
const LEAVE_DEFAULTS: Record<string, { available: number; total: number; label: string }> = {
  cl: { available: 12, total: 12, label: 'Casual Leave' },
  sl: { available: 12, total: 12, label: 'Sick Leave' },
  el: { available: 15, total: 15, label: 'Earned Leave' },
  mat_pat: { available: 0, total: 0, label: 'Maternity/Paternity Leave' },
  comp_off: { available: 0, total: 0, label: 'Compensatory Off' },
}

const VALID_LEAVE_TYPES = Object.keys(LEAVE_DEFAULTS)

interface EmployeeProfileRow {
  user_id: string
  employee_id: string
  full_name: string
  department: string
}

interface LeaveBalanceRow {
  user_id: string
  leave_type: string
  available_days: number
  total_days: number
}

interface CarryForwardRow {
  user_id: string
  el_carried_forward: number | null
  comp_off_carried_forward: number | null
  el_encashed: number | null
  encashment_date: string | null
  employee_profile: {
    employee_id: string
    full_name: string
  }
}

// ── GET Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const hrAccess = await checkHRAccess(supabase, user.id)
    if (!hrAccess.hasAccess) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode") || "balances"
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))
    const department = searchParams.get("department") || "all"
    const search = searchParams.get("search") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const pageSize = 20
    const offset = (page - 1) * pageSize

    // ── Mode: departments ──
    if (mode === "departments") {
      const { data, error } = await adminClient
        .from("employee_profile")
        .select("department")
        .not("department", "is", null)
        .order("department")
      if (error) throw error
      const depts = [...new Set((data || []).map((r: { department: string }) => r.department).filter(Boolean))]
      return NextResponse.json({ success: true, data: depts })
    }

    // ── Mode: leave_defaults (API endpoint for defaults - single source of truth) ──
    if (mode === "leave_defaults") {
      return NextResponse.json({
        success: true,
        data: Object.entries(LEAVE_DEFAULTS).map(([type, def]) => ({
          type,
          label: def.label,
          default_available: def.available,
          default_total: def.total,
        }))
      })
    }

    // ── Mode: accrual_rules ──
    if (mode === "accrual_rules") {
      const { data: leaveTypes, error: ltError } = await adminClient
        .from("leave_types")
        .select("id, name, max_days_per_year, carry_forward, description, requires_documentation")
        .order("name")
      if (ltError) {
        apiLogger.warn("leave_types query failed, returning empty", { error: ltError.message })
        return NextResponse.json({ success: true, data: [] })
      }
      return NextResponse.json({ success: true, data: leaveTypes || [] })
    }

    // ── Mode: carryforward ──
    if (mode === "carryforward") {
      try {
        const cfQuery = adminClient
          .from("leave_balance")
          .select("user_id, el_carried_forward, comp_off_carried_forward, el_encashed, encashment_date, employee_profile!inner(employee_id, full_name)", { count: "exact" })
          .eq("year", year)
          .range(offset, offset + pageSize - 1)
        const { data: cfData, error: cfError, count: cfCount } = await cfQuery
        if (cfError) {
          // Carry-forward columns may not exist — fall back to simpler query
          apiLogger.warn("leave-balance carryforward query failed, trying fallback without carry-forward columns", { error: cfError.message })
          const { data: fallbackData, error: fallbackError, count: fallbackCount } = await adminClient
            .from("leave_balance")
            .select("user_id, employee_profile!inner(employee_id, full_name)", { count: "exact" })
            .eq("year", year)
            .range(offset, offset + pageSize - 1)
          if (fallbackError) {
            apiLogger.warn("leave-balance carryforward fallback also failed", { error: fallbackError.message })
            return NextResponse.json({ success: true, data: [], meta: { total: 0, total_pages: 1, page, page_size: pageSize } })
          }
          const fallbackRecords = (fallbackData || []).map((r: { user_id: string; employee_profile: { employee_id: string; full_name: string } }) => {
            const ep = r.employee_profile
            return { user_id: r.user_id, employee_id: ep?.employee_id || "", name: ep?.full_name || "Unknown", el_carried: 0, comp_off_carried: 0, encashed: 0, encashment_date: null }
          })
          const fbTotal = fallbackCount || 0
          return NextResponse.json({ success: true, data: fallbackRecords, meta: { total: fbTotal, total_pages: Math.max(1, Math.ceil(fbTotal / pageSize)), page, page_size: pageSize } })
        }
        const cfRecords = (cfData || []).map((r: CarryForwardRow) => {
          const ep = r.employee_profile
          return { user_id: r.user_id, employee_id: ep?.employee_id || "", name: ep?.full_name || "Unknown", el_carried: r.el_carried_forward || 0, comp_off_carried: r.comp_off_carried_forward || 0, encashed: r.el_encashed || 0, encashment_date: r.encashment_date || null }
        })
        const cfTotal = cfCount || 0
        return NextResponse.json({ success: true, data: cfRecords, meta: { total: cfTotal, total_pages: Math.max(1, Math.ceil(cfTotal / pageSize)), page, page_size: pageSize } })
      } catch (cfCatchErr) {
        apiLogger.warn("leave-balance carryforward unexpected error", { error: cfCatchErr })
        return NextResponse.json({ success: true, data: [], meta: { total: 0, total_pages: 1, page, page_size: pageSize } })
      }
    }

    // ── Default: balances ──
    let empQuery = adminClient
      .from("employee_profile")
      .select("user_id, employee_id, full_name, department", { count: "exact" })
      .eq("status", "active")
    if (department !== "all") empQuery = empQuery.eq("department", department)
    if (search) {
      const sanitizedSearch = search.replace(/[%_\\'"();]/g, '').trim().slice(0, 100)
      if (sanitizedSearch) {
        empQuery = empQuery.or(`full_name.ilike.%${sanitizedSearch}%,employee_id.ilike.%${sanitizedSearch}%`)
      }
    }
    empQuery = empQuery.order("full_name").range(offset, offset + pageSize - 1)

    const { data: emps, error: empError, count: empCount } = await empQuery
    if (empError) throw empError

    if (!emps || emps.length === 0) {
      return NextResponse.json({ success: true, data: [], meta: { total: 0, total_pages: 1, page, page_size: pageSize } })
    }

    const userIds = emps.map((e: EmployeeProfileRow) => e.user_id)
    const { data: balances } = await adminClient
      .from("leave_balance")
      .select("user_id, leave_type, available_days, total_days")
      .eq("year", year)
      .in("user_id", userIds)

    const balMap: Record<string, Record<string, { available: number; total: number }>> = {}
    for (const b of (balances || []) as LeaveBalanceRow[]) {
      if (!balMap[b.user_id]) balMap[b.user_id] = {}
      balMap[b.user_id][b.leave_type] = { available: Number(b.available_days) || 0, total: Number(b.total_days) || 0 }
    }

    const result = (emps as EmployeeProfileRow[]).map(e => {
      const m = balMap[e.user_id] || {}
      const hasAnyBalance = Object.keys(m).length > 0
      const cl = m.cl || { available: LEAVE_DEFAULTS.cl.available, total: LEAVE_DEFAULTS.cl.total }
      const sl = m.sl || { available: LEAVE_DEFAULTS.sl.available, total: LEAVE_DEFAULTS.sl.total }
      const el = m.el || { available: LEAVE_DEFAULTS.el.available, total: LEAVE_DEFAULTS.el.total }
      const mat_pat = m.mat_pat || { available: LEAVE_DEFAULTS.mat_pat.available, total: LEAVE_DEFAULTS.mat_pat.total }
      const comp_off = m.comp_off || { available: LEAVE_DEFAULTS.comp_off.available, total: LEAVE_DEFAULTS.comp_off.total }
      const total_available = cl.available + sl.available + el.available + mat_pat.available + comp_off.available
      return {
        user_id: e.user_id, employee_id: e.employee_id, name: e.full_name, department: e.department,
        cl: { ...cl, is_default: !m.cl },
        sl: { ...sl, is_default: !m.sl },
        el: { ...el, is_default: !m.el },
        mat_pat: { ...mat_pat, is_default: !m.mat_pat },
        comp_off: { ...comp_off, is_default: !m.comp_off },
        total_available,
        is_default: !hasAnyBalance,
        balance_status: hasAnyBalance ? 'credited' : 'not_yet_credited',
      }
    })

    const total = empCount || 0
    return NextResponse.json({ success: true, data: result, meta: { total, total_pages: Math.max(1, Math.ceil(total / pageSize)), page, page_size: pageSize } })
  } catch (err) {
    apiLogger.error("leave-balance GET", { err })
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// ── POST Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const hrAccess = await checkHRAccess(supabase, user.id)
    if (!hrAccess.hasAccess) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

    const bodySchema = z.object({


      employee_id: z.string().uuid().optional(),


      leave_type: z.string().optional(),


      adjustment_type: z.string().optional(),


      days: z.string().optional(),


      reason: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { employee_id, leave_type, adjustment_type, days, reason } = body

    // ── Validation ──
    if (!employee_id || !leave_type || !adjustment_type || !days || !reason) {
      return NextResponse.json({ success: false, error: "Missing required fields: employee_id, leave_type, adjustment_type, days, reason" }, { status: 400 })
    }
    const numDays = Number(days)
    if (isNaN(numDays) || numDays <= 0 || numDays > 365) {
      return NextResponse.json({ success: false, error: "Days must be a positive number (max 365)" }, { status: 400 })
    }
    if (!VALID_LEAVE_TYPES.includes(leave_type)) {
      return NextResponse.json({ success: false, error: `Invalid leave type. Must be one of: ${VALID_LEAVE_TYPES.join(', ')}` }, { status: 400 })
    }
    if (!["credit", "debit"].includes(adjustment_type)) {
      return NextResponse.json({ success: false, error: "Invalid adjustment type. Must be 'credit' or 'debit'" }, { status: 400 })
    }

    const year = new Date().getFullYear()
    const delta = adjustment_type === "credit" ? numDays : -numDays

    // ── Read current balance ──
    const { data: existing } = await adminClient
      .from("leave_balance")
      .select("id, available_days, total_days")
      .eq("user_id", employee_id)
      .eq("leave_type", leave_type)
      .eq("year", year)
      .maybeSingle()

    let warning: string | null = null

    if (existing) {
      const currentAvailable = Number(existing.available_days) || 0
      const currentTotal = Number(existing.total_days) || 0
      const newAvailable = Math.max(0, currentAvailable + delta)
      const newTotal = adjustment_type === "credit" ? currentTotal + numDays : currentTotal

      // Warn if debiting more than available (H8 fix)
      if (adjustment_type === "debit" && numDays > currentAvailable) {
        warning = `Debit of ${numDays} days exceeds available balance of ${currentAvailable} days. Balance will be set to 0.`
      }

      // Retry loop for optimistic concurrency (C6 fix - max 3 attempts)
      let updated = false
      for (let attempt = 0; attempt < 3; attempt++) {
        // Re-read on retry
        const freshData = attempt > 0
          ? await adminClient.from("leave_balance").select("id, available_days, total_days").eq("id", existing.id).maybeSingle()
          : { data: existing }

        if (!freshData.data) {
          return NextResponse.json({ success: false, error: "Leave balance record not found" }, { status: 404 })
        }

        const freshAvailable = Number(freshData.data.available_days) || 0
        const freshTotal = Number(freshData.data.total_days) || 0
        const calcAvailable = Math.max(0, freshAvailable + delta)
        const calcTotal = adjustment_type === "credit" ? freshTotal + numDays : freshTotal

        const { data: updateResult, error: updateError } = await adminClient
          .from("leave_balance")
          .update({ available_days: calcAvailable, total_days: calcTotal, updated_at: new Date().toISOString() })
          .eq("id", freshData.data.id)
          .eq("available_days", freshData.data.available_days) // Optimistic lock
          .select("id")

        if (updateError) throw updateError
        if (updateResult && updateResult.length > 0) {
          updated = true
          break
        }
        // Concurrency conflict - retry
        await new Promise(r => setTimeout(r, 50 * (attempt + 1)))
      }

      if (!updated) {
        return NextResponse.json({ success: false, error: "Leave balance was modified concurrently. Please refresh and retry." }, { status: 409 })
      }
    } else {
      // New balance entry
      const def = LEAVE_DEFAULTS[leave_type]
      const baseTotal = def?.total || 0
      const baseAvailable = def?.available || 0
      const available = Math.max(0, baseAvailable + delta)
      const total = adjustment_type === "credit" ? baseTotal + numDays : baseTotal

      if (adjustment_type === "debit" && numDays > baseAvailable) {
        warning = `Debit of ${numDays} days exceeds default balance of ${baseAvailable} days. Balance will be set to 0.`
      }

      const { error } = await adminClient
        .from("leave_balance")
        .insert({ user_id: employee_id, leave_type, year, available_days: available, total_days: total })
      if (error) throw error
    }

    // ── Audit logging (non-blocking) ──
    const leaveLabel = LEAVE_DEFAULTS[leave_type]?.label || leave_type
    const description = `${adjustment_type === "credit" ? "Credited" : "Debited"} ${numDays} day(s) of ${leaveLabel} - ${reason}`

    adminClient.from("employee_activity_logs").insert({
      user_id: employee_id,
      performed_by: user.id,
      action_type: adjustment_type === "credit" ? "CREDIT" : "DEBIT",
      module_name: "leave_management",
      description,
      metadata: { leave_type, adjustment_type, days: numDays, reason, year }
    }).then(() => {}).catch(() => { /* Non-critical */ })

    try {
      await adminClient.from("audit_logs").insert({
        user_id: user.id,
        action: adjustment_type === "credit" ? "CREATE" : "UPDATE",
        entity_type: "leave_balance",
        entity_id: employee_id,
        description,
        details: { employee_id, leave_type, adjustment_type, days: numDays, reason, year }
      })
    } catch (auditErr) {
      apiLogger.error('Audit log failed for leave balance adjustment', { employee_id, leave_type, adjustment_type, days: numDays, error: auditErr })
    }

    const msg = adjustment_type === "credit" ? "Leave balance credited successfully" : "Leave balance debited successfully"
    return NextResponse.json({
      success: true,
      message: msg,
      ...(warning ? { warning } : {})
    })
  } catch (err) {
    apiLogger.error("leave-balance POST", { err })
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
