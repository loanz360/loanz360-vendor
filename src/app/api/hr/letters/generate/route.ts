
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from "next/server"
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/middleware/rateLimit"
import { csrfProtection } from "@/lib/middleware/csrf"
import { logApiError } from "@/lib/monitoring/errorLogger"
import { checkHRAccess } from '@/lib/auth/hr-access'

function replaceVars(body: string, values: Record<string, string>): string {
  return body.replace(/{{([^}]+)}}/g, (_, key) => values[key.trim()] || "[" + key.trim() + "]")
}

export async function POST(request: Request) {
  const csrf = await csrfProtection(request as Parameters<typeof csrfProtection>[0])
  if (csrf) return csrf
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: "Access denied. HR only." }, { status: 403 })
    const { data: profile } = await adminClient.from("employee_profile").select("first_name, last_name").eq("user_id", user.id).maybeSingle()

    const body = await request.json()
    const { template_id, employee_id, variable_values } = body
    if (!template_id || !employee_id)
      return NextResponse.json({ success: false, error: "template_id and employee_id are required" }, { status: 400 })

    // Fetch template
    const { data: template, error: tmplErr } = await adminClient.from("letter_templates").select("*").eq("id", template_id).maybeSingle()
    if (tmplErr || !template) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 })

    // Fetch employee
    const { data: employee, error: empErr } = await adminClient.from("employee_profile").select("*").eq("user_id", employee_id).maybeSingle()
    if (empErr || !employee) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 })

    // Merge auto-fill values with provided values
    const mergedValues: Record<string, string> = {
      employee_name: (employee.first_name + " " + employee.last_name).trim(),
      full_name: (employee.first_name + " " + employee.last_name).trim(),
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      employee_id: employee.employee_id || "",
      designation: employee.designation || "",
      department: employee.department || "",
      email: employee.email || "",
      joining_date: employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString("en-IN") : "",
      date: new Date().toLocaleDateString("en-IN"),
      ...variable_values
    }

    // Sanitize all values before template rendering to prevent HTML injection
    const sanitizedValues: Record<string, string> = {}
    for (const [key, val] of Object.entries(mergedValues)) {
      sanitizedValues[key] = String(val || '').replace(/[<>"'&]/g, (c) => {
        const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }
        return entities[c] || c
      })
    }

    const rendered_body = replaceVars(template.body, sanitizedValues)
    const rendered_subject = replaceVars(template.subject || "", sanitizedValues)

    const generated_by_name = ((profile?.first_name || '') + " " + (profile?.last_name || '')).trim() || 'HR'

    const { data: generated, error: genErr } = await adminClient.from("generated_letters").insert({
      template_id, employee_id, letter_type: template.letter_type,
      template_name: template.name, subject: rendered_subject,
      rendered_body, variable_values: sanitizedValues,
      status: "generated", generated_by: user.id, generated_by_name
    }).select().maybeSingle()

    if (genErr) throw genErr

    return NextResponse.json({ success: true, data: { id: generated.id, rendered_body, subject: rendered_subject } })
  } catch (err) {
    logApiError(err, "POST /api/hr/letters/generate")
    return NextResponse.json({ success: false, error: "Failed to generate letter" }, { status: 500 })
  }
}
