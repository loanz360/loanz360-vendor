export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from "next/server"
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/middleware/rateLimit"
import { csrfProtection } from "@/lib/middleware/csrf"
import { logApiError } from "@/lib/monitoring/errorLogger"
import { sanitizeInput } from '@/lib/validation/input-validation'
import { checkHRAccess } from '@/lib/auth/hr-access'

export async function GET(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: "Access denied. HR only." }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const letter_type = searchParams.get("letter_type")
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 20
    const offset = (page - 1) * limit

    let query = adminClient.from("generated_letters").select("id, employee_id, letter_type, template_name, subject, rendered_body, status, generated_by, generated_by_name, sent_at, signed_at, document_url, created_at, updated_at, employee_profile:employee_id ( first_name, last_name, employee_id, department, designation )", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1)

    if (letter_type) query = query.eq("letter_type", letter_type)
    if (status) query = query.eq("status", status)
    if (search) {
      const safeSearch = sanitizeInput(search, 100).replace(/[%_\\'"(),.]/g, '')
      if (!safeSearch) {
        return NextResponse.json({ success: true, data: [], meta: { total: 0, page, limit } })
      }
      const { data: empData } = await adminClient.from("employee_profile").select("user_id").or(`first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,employee_id.ilike.%${safeSearch}%`)
      if (empData && empData.length > 0) {
        const ids = empData.map((e: { user_id: string }) => e.user_id).filter(Boolean)
        query = query.in("employee_id", ids)
      } else {
        return NextResponse.json({ success: true, data: [], meta: { total: 0, page, limit } })
      }
    }

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: data || [], meta: { total: count || 0, page, limit } })
  } catch (err) {
    logApiError(err as Error, request as unknown as Parameters<typeof logApiError>[1], { action: 'get_letter_history' })
    return NextResponse.json({ success: false, error: "Failed to load letter history" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const csrf = await csrfProtection(request as Parameters<typeof csrfProtection>[0])
  if (csrf) return csrf
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: "Access denied. HR only." }, { status: 403 })

    const body = await request.json()
    const { id, status } = body
    if (!id || !status) return NextResponse.json({ success: false, error: "id and status are required" }, { status: 400 })

    const validStatuses = ["generated", "sent", "signed", "filed"]
    if (!validStatuses.includes(status))
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 })

    const { data, error } = await adminClient.from("generated_letters").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select().maybeSingle()
    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err) {
    logApiError(err as Error, request as unknown as Parameters<typeof logApiError>[1], { action: 'update_letter_status' })
    return NextResponse.json({ success: false, error: "Failed to update letter status" }, { status: 500 })
  }
}
