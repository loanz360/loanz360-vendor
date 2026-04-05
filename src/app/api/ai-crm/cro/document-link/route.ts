import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import crypto from 'crypto'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const generateLinkSchema = z.object({
  lead_id: z.string().uuid(),
  customer_name: z.string().min(1),
  customer_phone: z.string().min(10).max(15),
  loan_type: z.string().optional(),
  expires_in_hours: z.number().min(1).max(720).default(72), // default 3 days
})

/**
 * POST /api/ai-crm/cro/document-link
 *
 * Generates a unique, time-limited token for customer document upload.
 * The token allows public (no-auth) access to a document upload page.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = generateLinkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { lead_id, customer_name, customer_phone, loan_type, expires_in_hours } = parsed.data

    // Verify CRO owns this lead
    const { data: lead } = await supabase
      .from('crm_leads')
      .select('id')
      .eq('id', lead_id)
      .eq('cro_id', user.id)
      .maybeSingle()

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found or unauthorized' },
        { status: 404 }
      )
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000)

    // Store the upload token
    const { error: insertError } = await supabase.from('document_upload_tokens').insert({
      token,
      lead_id,
      cro_id: user.id,
      customer_name,
      customer_phone,
      loan_type: loan_type || null,
      expires_at: expiresAt.toISOString(),
      max_uploads: 20,
      upload_count: 0,
    })

    if (insertError) {
      apiLogger.error('Error creating upload token:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate upload link' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.loanz360.com'
    const uploadUrl = `${baseUrl}/upload/${token}`

    return NextResponse.json({
      success: true,
      data: {
        token,
        url: uploadUrl,
        expires_at: expiresAt.toISOString(),
        expires_in_hours,
      },
      message: 'Document upload link generated successfully',
    })
  } catch (error) {
    apiLogger.error('Error generating document link:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
