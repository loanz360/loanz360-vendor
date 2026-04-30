import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from "next/server"
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/middleware/rateLimit"
import { csrfProtection } from "@/lib/middleware/csrf"
import { logApiError } from "@/lib/monitoring/errorLogger"
import { checkHRAccess } from '@/lib/auth/hr-access'

/** Strip script tags and event handlers from HTML template body */
function sanitizeTemplateBody(body: string): string {
  return body
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript\s*:/gi, '')
}

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
    const letter_type = searchParams.get("letter_type")
    let query = adminClient.from("letter_templates").select("*").order("created_at", { ascending: false })
    if (letter_type) query = query.eq("letter_type", letter_type)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data: data || [] })
  } catch (err) {
    logApiError(err, "GET /api/hr/letters/templates")
    return NextResponse.json({ success: false, error: "Failed to load templates" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const csrf = await csrfProtection(request as Parameters<typeof csrfProtection>[0])
    if (csrf) return csrf

    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: "Access denied. HR only." }, { status: 403 })
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { name, letter_type, subject, body: templateBody, variables } = body
    if (!name || !letter_type || !templateBody)
      return NextResponse.json({ success: false, error: "name, letter_type, and body are required" }, { status: 400 })
    const sanitizedName = name.trim()
    const sanitizedSubject = subject ? subject.trim() : ""
    const sanitizedBody = sanitizeTemplateBody(templateBody)
    const { data, error } = await adminClient.from("letter_templates").insert({
      name: sanitizedName, letter_type, subject: sanitizedSubject, body: sanitizedBody,
      variables: variables || [], is_active: true, created_by: user.id
    }).select().maybeSingle()
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (err) {
    logApiError(err, "POST /api/hr/letters/templates")
    return NextResponse.json({ success: false, error: "Failed to create template" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const csrf = await csrfProtection(request as Parameters<typeof csrfProtection>[0])
    if (csrf) return csrf

    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: "Access denied. HR only." }, { status: 403 })
    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 })
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.name !== undefined) updatePayload.name = updates.name.trim()
    if (updates.letter_type !== undefined) updatePayload.letter_type = updates.letter_type
    if (updates.subject !== undefined) updatePayload.subject = updates.subject.trim()
    if (updates.body !== undefined) updatePayload.body = sanitizeTemplateBody(updates.body)
    if (updates.variables !== undefined) updatePayload.variables = updates.variables
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active
    const { data, error } = await adminClient.from("letter_templates").update(updatePayload).eq("id", id).select().maybeSingle()
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (err) {
    logApiError(err, "PATCH /api/hr/letters/templates")
    return NextResponse.json({ success: false, error: "Failed to update template" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const csrf = await csrfProtection(request as Parameters<typeof csrfProtection>[0])
    if (csrf) return csrf

    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: "Access denied. HR only." }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 })

    // Soft-delete by setting is_active = false
    const { data, error } = await adminClient
      .from("letter_templates")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data, message: "Template deleted" })
  } catch (err) {
    logApiError(err, "DELETE /api/hr/letters/templates")
    return NextResponse.json({ success: false, error: "Failed to delete template" }, { status: 500 })
  }
}
