import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { smsService } from '@/lib/communication/unified-sms-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/superadmin/send-test-sms
 * Send a test SMS from Super Admin dashboard
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Verify super admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { phone, templateCode, variables, rawMessage, senderId } = body

    // Validation
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      )
    }

    let result

    if (rawMessage) {
      // Send raw SMS
      result = await smsService.sendRaw({
        to: phone,
        message: rawMessage,
        senderId,
        userId: user.id
      })
    } else if (templateCode) {
      // Send templated SMS
      if (!variables || Object.keys(variables).length === 0) {
        return NextResponse.json(
          { success: false, error: 'Template variables are required' },
          { status: 400 }
        )
      }

      result = await smsService.send({
        to: phone,
        templateCode,
        variables,
        senderId,
        userId: user.id
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Either templateCode or rawMessage is required' },
        { status: 400 }
      )
    }

    // Return first result (single phone number)
    const deliveryResult = result[0]

    if (!deliveryResult.success) {
      return NextResponse.json(
        { success: false, error: deliveryResult.description || 'Failed to send SMS' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: deliveryResult
    })
  } catch (error) {
    apiLogger.error('Send test SMS error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
