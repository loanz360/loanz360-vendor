import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface EmployeeProfile {
  id: string
  first_name: string | null
  last_name: string | null
  designation: string | null
  department: string | null
}

interface CertRecord {
  id: string
  employee_id: string
  expiry_date: string | null
  [key: string]: unknown
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
    const page = parseInt(sp.get('page') || '1', 10)
    const pageSize = parseInt(sp.get('page_size') || '20', 10)
    const offset = (page - 1) * pageSize
    const employeeId = sp.get('employee_id')
    const expiryFilter = sp.get('expiry')
    const certStatus = sp.get('status')

    let query = adminClient
      .from('employee_certifications')
      .select('*', { count: 'exact' })
      .order('issued_date', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (employeeId) query = query.eq('employee_id', employeeId)
    if (certStatus) query = query.eq('status', certStatus)

    if (expiryFilter === 'expiring_soon') {
      const now = new Date()
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      query = query
        .not('expiry_date', 'is', null)
        .gte('expiry_date', now.toISOString().split('T')[0])
        .lte('expiry_date', thirtyDaysLater.toISOString().split('T')[0])
    } else if (expiryFilter === 'expired') {
      const now = new Date().toISOString().split('T')[0]
      query = query.not('expiry_date', 'is', null).lt('expiry_date', now)
    }

    const { data: certs, error: certErr, count } = await query
    if (certErr) throw certErr

    if (!certs || certs.length === 0) {
      return NextResponse.json({ success: true, data: [], meta: { total: 0, page, page_size: pageSize } })
    }

    const empIds = [...new Set(certs.map((c: CertRecord) => c.employee_id))]
    const { data: empProfiles } = await adminClient
      .from('employee_profile')
      .select('id, first_name, last_name, designation, department')
      .in('id', empIds)

    const empMap = new Map((empProfiles || []).map((e: EmployeeProfile) => [e.id, e]))

    const now = new Date()
    const soonDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const result = certs.map((c: CertRecord) => {
      const emp = empMap.get(c.employee_id)
      let expiryStatus: string | null = null
      if (c.expiry_date) {
        const expiry = new Date(c.expiry_date)
        if (expiry < now) expiryStatus = 'expired'
        else if (expiry <= soonDate) expiryStatus = 'expiring_soon'
        else expiryStatus = 'valid'
      }
      return {
        ...c,
        employee_name: emp ? ((emp.first_name || '') + ' ' + (emp.last_name || '')).trim() : 'Unknown',
        employee_designation: emp?.designation || null,
        employee_department: emp?.department || null,
        expiry_status: expiryStatus,
      }
    })

    const { count: expiringCount } = await adminClient
      .from('employee_certifications')
      .select('id', { count: 'exact', head: true })
      .not('expiry_date', 'is', null)
      .gte('expiry_date', now.toISOString().split('T')[0])
      .lte('expiry_date', soonDate.toISOString().split('T')[0])

    return NextResponse.json({
      success: true,
      data: result,
      meta: { total: count || 0, page, page_size: pageSize },
      stats: { expiring_soon_count: expiringCount || 0 },
    })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/learning/certifications', { errorId, error: err })
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

    const bodySchema = z.object({


      employee_id: z.string().uuid(),


      certification_name: z.string(),


      issuing_body: z.string(),


      certificate_number: z.string().optional(),


      issued_date: z.string(),


      expiry_date: z.string().optional(),


      document_url: z.string().optional(),


      trim: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { employee_id, certification_name, issuing_body, certificate_number, issued_date, expiry_date, document_url } = body

    if (!employee_id) return NextResponse.json({ success: false, error: 'Employee ID is required' }, { status: 400 })
    if (!certification_name) return NextResponse.json({ success: false, error: 'Certification name is required' }, { status: 400 })
    if (!issuing_body) return NextResponse.json({ success: false, error: 'Issuing body is required' }, { status: 400 })
    if (!issued_date) return NextResponse.json({ success: false, error: 'Issue date is required' }, { status: 400 })

    // Validate employee exists
    const { data: employee } = await adminClient
      .from('employee_profile')
      .select('id')
      .eq('id', employee_id)
      .maybeSingle()

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    // Validate dates
    if (expiry_date && new Date(expiry_date) <= new Date(issued_date)) {
      return NextResponse.json({ success: false, error: 'Expiry date must be after issue date' }, { status: 400 })
    }

    const now = new Date()
    let certStatus = 'active'
    if (expiry_date) {
      const expiry = new Date(expiry_date)
      if (expiry < now) certStatus = 'expired'
      // Note: 'expiring_soon' is not a valid DB status - use 'active' and let the GET endpoint
      // compute expiry_status dynamically for display
    }

    const { data: cert, error: createErr } = await adminClient
      .from('employee_certifications')
      .insert({
        employee_id,
        certification_name: certification_name.trim(),
        issuing_body: issuing_body.trim(),
        certificate_number: certificate_number?.trim() || null,
        issued_date,
        expiry_date: expiry_date || null,
        status: certStatus,
        document_url: document_url || null,
        added_by: user.id,
      })
      .select()
      .maybeSingle()

    if (createErr) throw createErr
    if (!cert) return NextResponse.json({ success: false, error: 'Certification was created but could not be retrieved' }, { status: 500 })

    apiLogger.info('Employee certification added', { certId: cert.id, employeeId: employee_id })
    return NextResponse.json({ success: true, data: cert, message: 'Certification added successfully' }, { status: 201 })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('POST /api/hr/learning/certifications', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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
    const id = sp.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Certification ID is required' }, { status: 400 })

    // Check if certification exists
    const { data: cert, error: fetchErr } = await adminClient
      .from('employee_certifications')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) throw fetchErr

    if (!cert) {
      return NextResponse.json({ success: false, error: 'Certification not found' }, { status: 404 })
    }

    if (cert.status === 'revoked') {
      return NextResponse.json({ success: false, error: 'Certification is already revoked' }, { status: 400 })
    }

    // Check if certification is linked to any active training enrollments
    const { count: linkedEnrollments } = await adminClient
      .from('training_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('certification_id', id)
      .not('status', 'eq', 'dropped')

    if (linkedEnrollments && linkedEnrollments > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot revoke: certification is linked to ${linkedEnrollments} active training enrollment(s). Remove enrollments first.`
      }, { status: 409 })
    }

    const { error: deleteErr } = await adminClient
      .from('employee_certifications')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteErr) throw deleteErr

    apiLogger.info('Employee certification revoked', { certId: id })
    return NextResponse.json({ success: true, message: 'Certification revoked successfully' })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('DELETE /api/hr/learning/certifications', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
