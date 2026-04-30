import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, checkPermission } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sendEmployeeCredentialsWhatsApp } from '@/lib/communication/whatsapp-service'

export const runtime = 'nodejs'

/**
 * POST /api/superadmin/employee-management/send-whatsapp
 * Send employee login credentials via WhatsApp
 * Body: { employee_name, employee_id, work_email, mobile_number, temporary_password }
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'ADD_EMPLOYEE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      employee_name: z.string().optional(),


      employee_id: z.string().uuid().optional(),


      work_email: z.string().email().optional(),


      mobile_number: z.string().min(10).optional(),


      temporary_password: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { employee_name, employee_id, work_email, mobile_number, temporary_password } = body

    if (!employee_name || !employee_id || !work_email || !mobile_number || !temporary_password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'}/employees/auth/login`

    const result = await sendEmployeeCredentialsWhatsApp({
      employeePhone: mobile_number,
      employeeName: employee_name,
      employeeId: employee_id,
      workEmail: work_email,
      temporaryPassword: temporary_password,
      loginUrl,
    })

    if (result.success) {
      logger.info(`WhatsApp credentials sent to ${employee_id} by ${auth.userId}`)
      return NextResponse.json({
        success: true,
        message: 'Credentials sent via WhatsApp',
        data: { messageId: result.messageId },
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send WhatsApp message',
      }, { status: 502 })
    }
  } catch (error) {
    logger.error('Error in POST /api/superadmin/employee-management/send-whatsapp:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
