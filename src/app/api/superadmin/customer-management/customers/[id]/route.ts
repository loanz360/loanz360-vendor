import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/customer-management/customers/[id]
 * Fetch detailed information for a single customer
 *
 * Rate Limit: 60 requests per minute
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return readRateLimiter(request, async (req) => {
    return await getCustomerDetailHandler(req, params.id)
  })
}

async function getCustomerDetailHandler(request: NextRequest, customerId: string) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch customer with all related data
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select(`
        *,
        users!inner(
          id,
          email,
          full_name,
          sub_role,
          status,
          created_at,
          last_login,
          email_verified,
          mobile_verified
        ),
        profiles(
          mobile,
          date_of_birth,
          gender,
          pan_number,
          aadhaar_number,
          address_current,
          address_permanent
        )
      `)
      .eq('id', customerId)
      .maybeSingle()

    if (customerError) {
      apiLogger.error('Error fetching customer', customerError)

      if (customerError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Customer not found'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch customer details'
      }, { status: 500 })
    }

    // Fetch loan applications
    const { data: loansData } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    // Fetch activities
    const { data: activitiesData } = await supabase
      .from('customer_activities')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50)

    // Fetch support tickets (if table exists)
    const { data: ticketsData } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)

    // Fetch documents (if table exists)
    const { data: documentsData } = await supabase
      .from('customer_documents')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    // Build comprehensive customer object
    const customer = {
      id: customerData.id,
      user_id: customerData.user_id,
      name: customerData.users?.full_name || 'N/A',
      email: customerData.users?.email || 'N/A',
      mobile: customerData.profiles?.mobile || null,
      sub_role: customerData.users?.sub_role || 'INDIVIDUAL',
      status: customerData.users?.status || 'PENDING_VERIFICATION',
      kyc_status: customerData.kyc_status || 'PENDING',
      credit_score: customerData.credit_score || null,
      created_at: customerData.created_at,
      last_login: customerData.users?.last_login || null,
      email_verified: customerData.users?.email_verified || false,
      mobile_verified: customerData.users?.mobile_verified || false,

      // Personal Details
      date_of_birth: customerData.profiles?.date_of_birth || null,
      gender: customerData.profiles?.gender || null,
      pan_number: customerData.profiles?.pan_number || null,
      aadhaar_number: customerData.profiles?.aadhaar_number || null,

      // Address
      address_current: customerData.profiles?.address_current || null,
      address_permanent: customerData.profiles?.address_permanent || null,

      // Financial Details
      income_details: customerData.income_details || null,
      employment_details: customerData.employment_details || null,
      financial_information: customerData.financial_information || null,
      loan_eligibility: customerData.loan_eligibility || null,

      // Related Data
      loan_applications: loansData || [],
      activities: activitiesData || [],
      support_tickets: ticketsData || [],
      documents: documentsData || [],

      // Statistics
      total_loans: loansData?.length || 0,
      active_loans: loansData?.filter((l: unknown) =>
        ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(l.application_status)
      ).length || 0,
      total_loan_amount: loansData?.reduce((sum: number, l: unknown) =>
        sum + (parseFloat(l.loan_amount) || 0), 0
      ) || 0,
      total_activities: activitiesData?.length || 0,
      total_tickets: ticketsData?.length || 0,
    }

    return NextResponse.json({
      success: true,
      customer
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in customer detail API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
