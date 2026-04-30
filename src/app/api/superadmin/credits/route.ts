import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * Credits API
 * Enterprise credit balance management
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Verify Super Admin authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || (auth.role !== 'SUPER_ADMIN' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('communication_credits')
      .select(`
        *,
        provider:provider_id (
          id,
          name
        )
      `)
      .order('credit_type')

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    const credits = (data || []).map((credit: Record<string, unknown>) => {
      const available = credit.total_credits - credit.used_credits - credit.reserved_credits
      return {
        providerId: credit.provider_id,
        providerName: credit.provider?.name || 'Unknown',
        creditType: credit.credit_type,
        totalCredits: credit.total_credits,
        usedCredits: credit.used_credits,
        reservedCredits: credit.reserved_credits,
        availableCredits: available,
        costPerUnit: credit.cost_per_unit,
        currency: credit.currency,
        lowBalanceThreshold: credit.low_balance_threshold,
        criticalBalanceThreshold: credit.critical_balance_threshold,
        isLowBalance: available <= credit.low_balance_threshold,
        isCriticalBalance: available <= credit.critical_balance_threshold,
        lastSyncedAt: credit.last_synced_at,
        expiresAt: credit.expires_at
      }
    })

    return NextResponse.json({
      success: true,
      data: credits
    })
  } catch (error: unknown) {
    apiLogger.error('[Credits API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify Super Admin authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || (auth.role !== 'SUPER_ADMIN' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const bodySchema = z.object({

      providerId: z.string().uuid().optional(),

      creditType: z.string().optional(),

      amount: z.number().optional(),

      transactionType: z.string().optional(),

      description: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { providerId, creditType, amount, transactionType, description } = body

    if (!providerId || !creditType || !amount) {
      return NextResponse.json(
        { success: false, error: 'providerId, creditType, and amount are required' },
        { status: 400 }
      )
    }

    // Get current credit record
    const { data: credit, error: creditError } = await supabase
      .from('communication_credits')
      .select('id, total_credits, used_credits, reserved_credits')
      .eq('provider_id', providerId)
      .eq('credit_type', creditType)
      .maybeSingle()

    if (creditError && creditError.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: creditError.message }, { status: 500 })
    }

    if (!credit) {
      // Create new credit record
      const { data: newCredit, error: createError } = await supabase
        .from('communication_credits')
        .insert({
          provider_id: providerId,
          credit_type: creditType,
          total_credits: amount,
          used_credits: 0,
          reserved_credits: 0,
          cost_per_unit: 0,
          currency: 'INR',
          low_balance_threshold: 1000,
          critical_balance_threshold: 100
        })
        .select()
        .maybeSingle()

      if (createError) {
        return NextResponse.json({ success: false, error: createError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Credit record created',
        data: newCredit
      })
    }

    // Update existing credit
    const newTotal = transactionType === 'deduct'
      ? credit.total_credits
      : credit.total_credits + amount

    const newUsed = transactionType === 'deduct'
      ? credit.used_credits + amount
      : credit.used_credits

    const { error: updateError } = await supabase
      .from('communication_credits')
      .update({
        total_credits: newTotal,
        used_credits: newUsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', credit.id)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // Log transaction
    await supabase
      .from('credit_transactions')
      .insert({
        credit_id: credit.id,
        transaction_type: transactionType || 'adjustment',
        amount: amount,
        balance_before: credit.total_credits - credit.used_credits,
        balance_after: newTotal - newUsed,
        description: description || `Manual ${transactionType || 'adjustment'}`
      })

    return NextResponse.json({
      success: true,
      message: 'Credit updated successfully',
      newBalance: newTotal - newUsed
    })
  } catch (error: unknown) {
    apiLogger.error('[Credits API] POST Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
