
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// PUT /api/hr/payroll/investment-proofs/[id]/verify
// Verify or reject investment proof (HR/Superadmin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  try {
    const { id } = await params
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can verify investment proofs' },
        { status: 403 }
      )
    }

    const proofId = id
    const body = await request.json()
    const { action, verified_amount, remarks } = body // action: 'verify' or 'reject'

    if (!action || (action !== 'verify' && action !== 'reject')) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "verify" or "reject"' },
        { status: 400 }
      )
    }

    // Get the proof
    const { data: proof, error: fetchError } = await adminClient
      .from('investment_proofs')
      .select('*')
      .eq('id', proofId)
      .maybeSingle()

    if (fetchError || !proof) {
      return NextResponse.json(
        { success: false, error: 'Investment proof not found' },
        { status: 404 }
      )
    }

    // Cannot modify already verified/rejected proofs
    if (proof.verification_status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot modify proof with status: ${proof.verification_status}`
        },
        { status: 400 }
      )
    }

    const newStatus = action === 'verify' ? 'verified' : 'rejected'
    const finalAmount = action === 'verify' ? (verified_amount || proof.amount) : 0

    // Update proof status
    const { data: updated, error: updateError } = await adminClient
      .from('investment_proofs')
      .update({
        verification_status: newStatus,
        verified_amount: finalAmount,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        verification_remarks: remarks
      })
      .eq('id', proofId)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Investment proof ${action === 'verify' ? 'verified' : 'rejected'} successfully`
    })

  } catch (error) {
    apiLogger.error('Verify/reject investment proof error', error)
    logApiError(error as Error, request, { action: 'put' })
    return NextResponse.json(
      { success: false, error: 'Failed to process investment proof' },
      { status: 500 }
    )
  }
}
