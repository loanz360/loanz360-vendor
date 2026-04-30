import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      offer_id: z.string().uuid(),


      share_method: z.string().optional(),


      recipient: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { offer_id, share_method, recipient } = body

    if (!offer_id) {
      return NextResponse.json({ error: 'offer_id is required' }, { status: 400 })
    }

    // Record the share in offer_shares table
    const { error: shareError } = await supabase
      .from('offer_shares')
      .insert({
        offer_id,
        shared_by: user.id,
        share_method: share_method || 'unknown',
        recipient: recipient || null,
      })

    if (shareError) {
      // If offer_shares table doesn't exist, try offer_analytics or just log
      console.warn('Could not record share:', shareError.message)
      // Don't fail the request - the share action already happened
      return NextResponse.json({ success: true, tracked: false })
    }

    return NextResponse.json({ success: true, tracked: true })
  } catch (error) {
    console.error('Error recording share:', error)
    return NextResponse.json({ success: true, tracked: false })
  }
}
