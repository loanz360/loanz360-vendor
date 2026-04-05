export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from "next/server"
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/middleware/rateLimit"
import { csrfProtection } from "@/lib/middleware/csrf"
import { logApiError } from "@/lib/monitoring/errorLogger"
import { sendEmail } from "@/lib/email/email-service"
import { checkHRAccess } from '@/lib/auth/hr-access'

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
    if (!isHR) return NextResponse.json({ success: false, error: "Forbidden: HR access required" }, { status: 403 })

    const body = await request.json()
    const { letter_id } = body
    if (!letter_id) return NextResponse.json({ success: false, error: "letter_id is required" }, { status: 400 })

    // Fetch letter with employee details
    const { data: letter } = await adminClient.from("generated_letters")
      .select("*, employee_profile!generated_letters_employee_id_fkey(email, first_name, last_name)")
      .eq("id", letter_id).maybeSingle()
    if (!letter) return NextResponse.json({ success: false, error: "Letter not found" }, { status: 404 })

    // Extract employee info from joined data
    const employeeProfile = letter.employee_profile as { email: string; first_name: string; last_name: string } | null
    const employeeEmail = employeeProfile?.email
    const employeeName = employeeProfile ? `${employeeProfile.first_name} ${employeeProfile.last_name}`.trim() : "Employee"

    let emailSent = false
    if (employeeEmail) {
      emailSent = await sendEmail({
        to: employeeEmail,
        subject: `Letter: ${letter.letter_type || "Official Letter"} - Loanz360`,
        html: letter.content || `<p>Dear ${employeeName},</p><p>You have received an official letter. Please log in to your Loanz360 dashboard to view it.</p>`,
      })
    }

    // Update letter status regardless — mark as sent if email succeeded, or mark as delivered (status updated) if no email
    const newStatus = emailSent ? "sent" : "delivered"
    const { data, error } = await adminClient.from("generated_letters").update({ status: newStatus, sent_at: new Date().toISOString() }).eq("id", letter_id).select().maybeSingle()
    if (error) throw error

    const message = emailSent
      ? "Letter emailed to employee successfully"
      : !employeeEmail
        ? "Letter status updated but no employee email found — email not sent"
        : "Letter status updated but email delivery could not be confirmed"

    return NextResponse.json({ success: true, data, message, email_sent: emailSent })
  } catch (err) {
    logApiError(err, "POST /api/hr/letters/send")
    return NextResponse.json({ success: false, error: "Failed to send letter" }, { status: 500 })
  }
}
