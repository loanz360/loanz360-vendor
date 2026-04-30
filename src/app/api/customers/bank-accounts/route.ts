import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/bank-accounts
 *
 * Fetches bank accounts for the authenticated user (individual or entity).
 * Can filter by owner_type and owner_id.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ownerType = searchParams.get('ownerType') // 'INDIVIDUAL' or 'ENTITY'
    const ownerId = searchParams.get('ownerId')

    // Get customer identity
    const { data: customerIdentity } = await supabase
      .from('customer_identities')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    let query = supabase
      .from('bank_accounts')
      .select('*')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })

    if (ownerType && ownerId) {
      // Verify access to the specified owner
      if (ownerType === 'ENTITY') {
        const hasAccess = await verifyEntityAccess(supabase, user.id, ownerId)
        if (!hasAccess) {
          return NextResponse.json(
            { success: false, error: 'You do not have access to this entity' },
            { status: 403 }
          )
        }
      } else if (ownerType === 'INDIVIDUAL') {
        // Can only access own bank accounts
        if (!customerIdentity || customerIdentity.id !== ownerId) {
          return NextResponse.json(
            { success: false, error: 'You can only access your own bank accounts' },
            { status: 403 }
          )
        }
      }

      query = query.eq('owner_type', ownerType).eq('owner_id', ownerId)
    } else if (customerIdentity) {
      // Default: fetch user's own bank accounts
      query = query.eq('owner_type', 'INDIVIDUAL').eq('owner_id', customerIdentity.id)
    } else {
      return NextResponse.json({
        success: true,
        accounts: []
      })
    }

    const { data: accounts, error } = await query

    if (error) {
      apiLogger.error('Error fetching bank accounts', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bank accounts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      accounts: accounts || []
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/customers/bank-accounts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/bank-accounts
 *
 * Creates a new bank account for the authenticated user (individual or entity).
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const bodySchema = z.object({


      ownerType: z.string().optional(),


      ownerId: z.string().uuid().optional(),


      accountHolderName: z.string().optional(),


      accountNumber: z.string().optional(),


      bankName: z.string().optional(),


      branchName: z.string().optional(),


      ifscCode: z.string().optional(),


      accountType: z.string().optional(),


      isPrimary: z.string().optional(),


      accountId: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      ownerType,
      ownerId,
      accountHolderName,
      accountNumber,
      bankName,
      branchName,
      ifscCode,
      accountType,
      isPrimary
    } = body

    // Validate required fields
    if (!accountHolderName || !accountNumber || !bankName || !ifscCode) {
      return NextResponse.json(
        { success: false, error: 'Account holder name, account number, bank name, and IFSC code are required' },
        { status: 400 }
      )
    }

    // Get customer identity
    const { data: customerIdentity } = await supabase
      .from('customer_identities')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    let finalOwnerType = ownerType || 'INDIVIDUAL'
    let finalOwnerId = ownerId

    if (finalOwnerType === 'ENTITY') {
      if (!finalOwnerId) {
        return NextResponse.json(
          { success: false, error: 'Entity ID is required for entity bank accounts' },
          { status: 400 }
        )
      }

      // Verify admin access to entity
      const isAdmin = await verifyEntityAdmin(supabase, user.id, finalOwnerId)
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'You do not have admin access to this entity' },
          { status: 403 }
        )
      }
    } else {
      // Individual - use customer identity
      if (!customerIdentity) {
        return NextResponse.json(
          { success: false, error: 'Customer profile not found' },
          { status: 404 }
        )
      }
      finalOwnerId = customerIdentity.id
    }

    // If setting as primary, unset other primary accounts
    if (isPrimary) {
      await supabase
        .from('bank_accounts')
        .update({ is_primary: false })
        .eq('owner_type', finalOwnerType)
        .eq('owner_id', finalOwnerId)
    }

    // Create bank account
    const { data: account, error: accountError } = await supabase
      .from('bank_accounts')
      .insert({
        owner_type: finalOwnerType,
        owner_id: finalOwnerId,
        account_holder_name: accountHolderName,
        account_number: accountNumber,
        bank_name: bankName,
        branch_name: branchName || null,
        ifsc_code: ifscCode.toUpperCase(),
        account_type: accountType || 'SAVINGS',
        is_primary: isPrimary || false,
        verification_status: 'PENDING'
      })
      .select()
      .maybeSingle()

    if (accountError) {
      apiLogger.error('Error creating bank account', accountError)

      // Check for duplicate account
      if (accountError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'This bank account already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to create bank account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account added successfully',
      account
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/bank-accounts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/bank-accounts
 *
 * Updates an existing bank account.
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const bodySchema2 = z.object({


      isPrimary: z.string().optional(),


      accountId: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { accountId, isPrimary, ...updateFields } = body

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Get the account to verify ownership
    const { data: existingAccount, error: fetchError } = await supabase
      .from('bank_accounts')
      .select('id, owner_type, owner_id')
      .eq('id', accountId)
      .maybeSingle()

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      )
    }

    // Verify access
    const hasAccess = await verifyOwnerAccess(
      supabase,
      user.id,
      existingAccount.owner_type,
      existingAccount.owner_id
    )

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this bank account' },
        { status: 403 }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (updateFields.accountHolderName !== undefined) updateData.account_holder_name = updateFields.accountHolderName
    if (updateFields.bankName !== undefined) updateData.bank_name = updateFields.bankName
    if (updateFields.branchName !== undefined) updateData.branch_name = updateFields.branchName
    if (updateFields.ifscCode !== undefined) updateData.ifsc_code = updateFields.ifscCode.toUpperCase()
    if (updateFields.accountType !== undefined) updateData.account_type = updateFields.accountType

    // Handle primary flag
    if (isPrimary !== undefined) {
      if (isPrimary) {
        // Unset other primary accounts
        await supabase
          .from('bank_accounts')
          .update({ is_primary: false })
          .eq('owner_type', existingAccount.owner_type)
          .eq('owner_id', existingAccount.owner_id)
      }
      updateData.is_primary = isPrimary
    }

    // Update account
    const { data: account, error: updateError } = await supabase
      .from('bank_accounts')
      .update(updateData)
      .eq('id', accountId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating bank account', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update bank account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account updated successfully',
      account
    })
  } catch (error) {
    apiLogger.error('Unexpected error in PUT /api/customers/bank-accounts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/bank-accounts
 *
 * Deletes a bank account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Get the account to verify ownership
    const { data: existingAccount, error: fetchError } = await supabase
      .from('bank_accounts')
      .select('id, owner_type, owner_id, is_primary')
      .eq('id', accountId)
      .maybeSingle()

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      )
    }

    // Verify access
    const hasAccess = await verifyOwnerAccess(
      supabase,
      user.id,
      existingAccount.owner_type,
      existingAccount.owner_id
    )

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this bank account' },
        { status: 403 }
      )
    }

    // Delete the account
    const { error: deleteError } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', accountId)

    if (deleteError) {
      apiLogger.error('Error deleting bank account', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete bank account' },
        { status: 500 }
      )
    }

    // If deleted account was primary, set another account as primary
    if (existingAccount.is_primary) {
      const { data: otherAccounts } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('owner_type', existingAccount.owner_type)
        .eq('owner_id', existingAccount.owner_id)
        .limit(1)
        .maybeSingle()

      if (otherAccounts) {
        await supabase
          .from('bank_accounts')
          .update({ is_primary: true })
          .eq('id', otherAccounts.id)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Unexpected error in DELETE /api/customers/bank-accounts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to verify if user has access to an entity (member or admin)
 */
async function verifyEntityAccess(
  supabase: SupabaseClient,
  userId: string,
  entityId: string
): Promise<boolean> {
  // Check direct admin ownership
  const { data: directAdmin } = await supabase
    .from('business_entities')
    .select('id')
    .eq('id', entityId)
    .eq('admin_user_id', userId)
    .maybeSingle()

  if (directAdmin) {
    return true
  }

  // Check membership
  const { data: customerIdentity } = await supabase
    .from('customer_identities')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (customerIdentity) {
    const { data: membership } = await supabase
      .from('entity_members')
      .select('id')
      .eq('entity_id', entityId)
      .eq('individual_id', customerIdentity.id)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (membership) {
      return true
    }
  }

  return false
}

/**
 * Helper function to verify if user is an admin of an entity
 */
async function verifyEntityAdmin(
  supabase: SupabaseClient,
  userId: string,
  entityId: string
): Promise<boolean> {
  // Check direct admin ownership
  const { data: directAdmin } = await supabase
    .from('business_entities')
    .select('id')
    .eq('id', entityId)
    .eq('admin_user_id', userId)
    .maybeSingle()

  if (directAdmin) {
    return true
  }

  // Check membership admin status
  const { data: customerIdentity } = await supabase
    .from('customer_identities')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (customerIdentity) {
    const { data: membership } = await supabase
      .from('entity_members')
      .select('is_admin')
      .eq('entity_id', entityId)
      .eq('individual_id', customerIdentity.id)
      .eq('is_admin', true)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (membership) {
      return true
    }
  }

  return false
}

/**
 * Helper function to verify owner access based on owner type
 */
async function verifyOwnerAccess(
  supabase: SupabaseClient,
  userId: string,
  ownerType: string,
  ownerId: string
): Promise<boolean> {
  if (ownerType === 'ENTITY') {
    return verifyEntityAdmin(supabase, userId, ownerId)
  } else {
    // Individual - verify it's the user's own identity
    const { data: customerIdentity } = await supabase
      .from('customer_identities')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    return customerIdentity?.id === ownerId
  }
}
