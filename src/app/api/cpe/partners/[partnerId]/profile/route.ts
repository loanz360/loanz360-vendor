export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/partners/[partnerId]/profile
 *
 * Get detailed profile of a specific partner
 *
 * Returns:
 *   - Basic details (name, contact, type, status)
 *   - KYC documents status
 *   - Business metrics
 *   - Recent activity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const supabase = await createClient()

    // Get authenticated user
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

    // Verify user is a Channel Partner Executive
    const isCPE = await verifyCPERole(supabase, user)

    if (!isCPE) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Channel Partner Executive role required.' },
        { status: 403 }
      )
    }

    const { partnerId } = params

    // Fetch partner details
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('*')
      .eq('id', partnerId)
      .eq('recruited_by_cpe', user.id) // Ensure CPE owns this partner
      .maybeSingle()

    if (partnerError || !partner) {
      apiLogger.error('Error fetching partner', partnerError)
      return NextResponse.json(
        { success: false, error: 'Partner not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch partner's KYC documents status
    const { data: kycDocuments, error: kycError } = await supabase
      .from('partner_kyc_documents')
      .select('document_type, status, verified_at, rejection_reason')
      .eq('partner_id', partnerId)

    if (kycError && kycError.code !== 'PGRST116') {
      apiLogger.error('Error fetching KYC documents', kycError)
    }

    // Group KYC documents by status
    const kycSummary = {
      total: kycDocuments?.length || 0,
      verified: kycDocuments?.filter((doc) => doc.status === 'VERIFIED').length || 0,
      pending: kycDocuments?.filter((doc) => doc.status === 'PENDING').length || 0,
      rejected: kycDocuments?.filter((doc) => doc.status === 'REJECTED').length || 0,
      documents: kycDocuments || [],
    }

    // Fetch partner's bank details
    const { data: bankDetails, error: bankError } = await supabase
      .from('partner_bank_details')
      .select('account_holder_name, bank_name, account_number, ifsc_code, is_verified')
      .eq('partner_id', partnerId)
      .maybeSingle()

    if (bankError && bankError.code !== 'PGRST116') {
      apiLogger.error('Error fetching bank details', bankError)
    }

    // Fetch recent activity (last 10 activities)
    const { data: recentActivity, error: activityError } = await supabase
      .from('partner_activity_log')
      .select('activity_type, activity_description, created_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (activityError && activityError.code !== 'PGRST116') {
      apiLogger.error('Error fetching activity log', activityError)
    }

    // Fetch partner's commission summary
    const { data: commissionSummary, error: commissionError } = await supabase
      .from('partner_commissions')
      .select('commission_amount, commission_status, created_at')
      .eq('partner_id', partnerId)

    if (commissionError && commissionError.code !== 'PGRST116') {
      apiLogger.error('Error fetching commissions', commissionError)
    }

    const totalEarned = commissionSummary?.reduce((sum, comm) => sum + (parseFloat(comm.commission_amount) || 0), 0) || 0
    const totalPaid = commissionSummary?.filter((c) => c.commission_status === 'PAID').reduce((sum, comm) => sum + (parseFloat(comm.commission_amount) || 0), 0) || 0
    const totalPending = commissionSummary?.filter((c) => c.commission_status === 'PENDING').reduce((sum, comm) => sum + (parseFloat(comm.commission_amount) || 0), 0) || 0

    // Format response
    const response = {
      success: true,
      data: {
        basicDetails: {
          id: partner.id,
          fullName: partner.full_name,
          mobileNumber: partner.mobile_number,
          email: partner.email,
          partnerType: partner.partner_type,
          partnerTypeDisplay: partner.partner_type?.replace(/_/g, ' ') || 'N/A',
          status: partner.status,
          registeredAt: partner.created_at,
          registrationDate: new Date(partner.created_at).toLocaleDateString('en-IN'),
          lastActiveAt: partner.last_active_at,
          profilePictureUrl: partner.profile_picture_url,
          address: partner.address,
          city: partner.city,
          state: partner.state,
          pincode: partner.pincode,
          panNumber: partner.pan_number,
          aadhaarNumber: partner.aadhaar_number ? `XXXX-XXXX-${partner.aadhaar_number.slice(-4)}` : null,
        },
        businessMetrics: {
          totalBusinessSourced: partner.total_business_sourced || 0,
          totalApplicationsSourced: partner.total_applications_sourced || 0,
          averageBusinessPerApplication: partner.total_applications_sourced
            ? (partner.total_business_sourced || 0) / partner.total_applications_sourced
            : 0,
          daysSinceRegistration: Math.floor(
            (new Date().getTime() - new Date(partner.created_at).getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
        kycStatus: kycSummary,
        bankDetails: bankDetails
          ? {
              accountHolderName: bankDetails.account_holder_name,
              bankName: bankDetails.bank_name,
              accountNumber: bankDetails.account_number ? `XXXX${bankDetails.account_number.slice(-4)}` : null,
              ifscCode: bankDetails.ifsc_code,
              isVerified: bankDetails.is_verified,
            }
          : null,
        earnings: {
          totalEarned,
          totalPaid,
          totalPending,
          commissionCount: commissionSummary?.length || 0,
        },
        recentActivity: recentActivity?.map((activity) => ({
          type: activity.activity_type,
          description: activity.activity_description,
          timestamp: activity.created_at,
          timeAgo: getTimeAgo(new Date(activity.created_at)),
        })) || [],
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in partner profile API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + ' years ago'

  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + ' months ago'

  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + ' days ago'

  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + ' hours ago'

  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + ' minutes ago'

  return Math.floor(seconds) + ' seconds ago'
}
