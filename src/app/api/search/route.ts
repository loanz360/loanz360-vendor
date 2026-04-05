import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

interface SearchResult {
  id: string
  type: 'loan' | 'document' | 'notification' | 'lead' | 'customer' | 'employee' | 'partner' | 'application'
  title: string
  subtitle?: string
  description?: string
  status?: string
  url: string
  icon?: string
  metadata?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')?.trim().toLowerCase()
    const portal = searchParams.get('portal') || 'customer' // customer, employee, partner, superadmin
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], message: 'Query too short' })
    }

    const results: SearchResult[] = []

    // Get user's role and profile info
    const { data: userData } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Search based on portal type
    switch (portal) {
      case 'customer':
        await searchCustomerPortal(supabase, user.id, query, results, limit)
        break
      case 'employee':
        await searchEmployeePortal(supabase, user.id, userData.sub_role, query, results, limit)
        break
      case 'partner':
        await searchPartnerPortal(supabase, user.id, query, results, limit)
        break
      case 'superadmin':
        await searchSuperAdminPortal(supabase, query, results, limit)
        break
      default:
        await searchCustomerPortal(supabase, user.id, query, results, limit)
    }

    return NextResponse.json({
      results,
      query,
      portal,
      count: results.length
    })

  } catch (error) {
    apiLogger.error('Search error', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}

// Customer Portal Search
async function searchCustomerPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  query: string,
  results: SearchResult[],
  limit: number
) {
  // Get customer record
  const { data: customer } = await supabase
    .from('customers')
    .select('id, customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!customer) return

  // Search loan applications
  const { data: loans } = await supabase
    .from('loan_applications')
    .select('id, loan_type, loan_amount, application_status, created_at')
    .eq('customer_id', customer.id)
    .or(`loan_type.ilike.%${query}%,application_status.ilike.%${query}%`)
    .limit(limit)

  if (loans) {
    loans.forEach(loan => {
      results.push({
        id: loan.id,
        type: 'loan',
        title: `${formatLoanType(loan.loan_type)} Application`,
        subtitle: `Amount: ₹${formatAmount(loan.loan_amount)}`,
        status: loan.application_status,
        url: `/customers/${customer.customer_id}/loans/${loan.id}`,
        icon: 'FileText'
      })
    })
  }

  // Search partner leads (customer's loan applications via partners)
  const { data: leads } = await supabase
    .from('leads')
    .select('id, lead_id, loan_type, loan_amount, lead_status, customer_name, bank_name')
    .eq('customer_id', customer.id)
    .or(`lead_id.ilike.%${query}%,loan_type.ilike.%${query}%,bank_name.ilike.%${query}%`)
    .limit(limit)

  if (leads) {
    leads.forEach(lead => {
      results.push({
        id: lead.id,
        type: 'lead',
        title: `Loan Application ${lead.lead_id}`,
        subtitle: lead.bank_name ? `Bank: ${lead.bank_name}` : formatLoanType(lead.loan_type),
        status: lead.lead_status,
        url: `/customers/${customer.customer_id}/applications/${lead.id}`,
        icon: 'CreditCard'
      })
    })
  }

  // Search documents
  const { data: documents } = await supabase
    .from('customer_profile_documents')
    .select('id, document_type, document_category, file_name, is_active, created_at')
    .eq('customer_id', customer.id)
    .eq('is_active', true)
    .or(`document_type.ilike.%${query}%,file_name.ilike.%${query}%,document_category.ilike.%${query}%`)
    .limit(limit)

  if (documents) {
    documents.forEach(doc => {
      results.push({
        id: doc.id,
        type: 'document',
        title: formatDocumentType(doc.document_type),
        subtitle: doc.file_name,
        status: 'Uploaded',
        url: `/customers/${customer.customer_id}/documents`,
        icon: 'File'
      })
    })
  }

  // Search notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, message, type, status, created_at')
    .eq('user_id', userId)
    .or(`title.ilike.%${query}%,message.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (notifications) {
    notifications.forEach(notif => {
      results.push({
        id: notif.id,
        type: 'notification',
        title: notif.title,
        subtitle: notif.message?.substring(0, 50) + '...',
        status: notif.status,
        url: `/customers/${customer.customer_id}/notifications`,
        icon: 'Bell'
      })
    })
  }
}

// Employee Portal Search
async function searchEmployeePortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  subRole: string | null,
  query: string,
  results: SearchResult[],
  limit: number
) {
  // Get employee profile
  const { data: employee } = await supabase
    .from('employee_profile')
    .select('id, employee_id, subrole')
    .eq('user_id', userId)
    .maybeSingle()

  const employeeId = employee?.employee_id || 'dashboard'
  const subrole = employee?.subrole || subRole

  // Search leads assigned to this employee (for BDE, CRO, etc.)
  if (subrole && ['BDE', 'CRO', 'CUSTOMER_RELATIONSHIP_MANAGER'].includes(subrole)) {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, lead_id, customer_name, customer_phone, loan_type, lead_status, loan_amount')
      .eq('assigned_bde_id', employee?.id)
      .or(`lead_id.ilike.%${query}%,customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%,loan_type.ilike.%${query}%`)
      .limit(limit)

    if (leads) {
      leads.forEach(lead => {
        results.push({
          id: lead.id,
          type: 'lead',
          title: lead.customer_name || `Lead ${lead.lead_id}`,
          subtitle: `${lead.lead_id} | ${formatLoanType(lead.loan_type)}`,
          description: lead.customer_phone,
          status: lead.lead_status,
          url: `/employees/${employeeId}/leads/${lead.id}`,
          icon: 'Users'
        })
      })
    }
  }

  // Search all leads for HR/Admin roles
  if (subrole && ['HR_TEAM', 'ADMIN', 'ACCOUNTS_TEAM'].includes(subrole)) {
    const { data: employees } = await supabase
      .from('employee_profile')
      .select('id, employee_id, name, email, phone, subrole, is_active')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,employee_id.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(limit)

    if (employees) {
      employees.forEach(emp => {
        results.push({
          id: emp.id,
          type: 'employee',
          title: emp.name || 'Employee',
          subtitle: `${emp.employee_id} | ${emp.subrole}`,
          description: emp.email,
          status: emp.is_active ? 'ACTIVE' : 'INACTIVE',
          url: `/employees/${employeeId}/team/${emp.id}`,
          icon: 'User'
        })
      })
    }
  }

  // Search notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, message, type, status, created_at')
    .eq('user_id', userId)
    .or(`title.ilike.%${query}%,message.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (notifications) {
    notifications.forEach(notif => {
      results.push({
        id: notif.id,
        type: 'notification',
        title: notif.title,
        subtitle: notif.message?.substring(0, 50) + '...',
        status: notif.status,
        url: `/employees/${employeeId}/notifications`,
        icon: 'Bell'
      })
    })
  }
}

// Partner Portal Search
async function searchPartnerPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  query: string,
  results: SearchResult[],
  limit: number
) {
  // Get partner profile
  const { data: partner } = await supabase
    .from('partners')
    .select('id, partner_type, business_name')
    .eq('user_id', userId)
    .maybeSingle()

  // Determine partner type path
  let partnerPath = 'ba'
  if (partner?.partner_type === 'BUSINESS_PARTNER') partnerPath = 'bp'
  else if (partner?.partner_type === 'CHANNEL_PARTNER') partnerPath = 'cp'

  // Search leads submitted by this partner
  const { data: leads } = await supabase
    .from('leads')
    .select('id, lead_id, customer_name, customer_phone, loan_type, lead_status, loan_amount, created_at')
    .eq('partner_id', partner?.id)
    .or(`lead_id.ilike.%${query}%,customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%,loan_type.ilike.%${query}%`)
    .limit(limit)

  if (leads) {
    leads.forEach(lead => {
      results.push({
        id: lead.id,
        type: 'lead',
        title: lead.customer_name || `Lead ${lead.lead_id}`,
        subtitle: `${lead.lead_id} | ₹${formatAmount(lead.loan_amount)}`,
        status: lead.lead_status,
        url: `/partners/${partnerPath}/leads/${lead.id}`,
        icon: 'Users'
      })
    })
  }

  // Search payouts
  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, payout_amount, payout_type, payout_status, created_at')
    .eq('partner_id', partner?.id)
    .or(`payout_type.ilike.%${query}%,payout_status.ilike.%${query}%`)
    .limit(limit)

  if (payouts) {
    payouts.forEach(payout => {
      results.push({
        id: payout.id,
        type: 'application',
        title: `Payout - ₹${formatAmount(payout.payout_amount)}`,
        subtitle: payout.payout_type,
        status: payout.payout_status,
        url: `/partners/${partnerPath}/payouts/${payout.id}`,
        icon: 'DollarSign'
      })
    })
  }

  // Search notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, message, type, status, created_at')
    .eq('user_id', userId)
    .or(`title.ilike.%${query}%,message.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (notifications) {
    notifications.forEach(notif => {
      results.push({
        id: notif.id,
        type: 'notification',
        title: notif.title,
        subtitle: notif.message?.substring(0, 50) + '...',
        status: notif.status,
        url: `/partners/${partnerPath}/notifications`,
        icon: 'Bell'
      })
    })
  }
}

// Super Admin Portal Search
async function searchSuperAdminPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  results: SearchResult[],
  limit: number
) {
  // Search all users
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, status')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(limit)

  if (users) {
    users.forEach(user => {
      results.push({
        id: user.id,
        type: 'customer',
        title: user.full_name || user.email,
        subtitle: `${user.role} | ${user.email}`,
        status: user.status,
        url: `/superadmin/users/${user.id}`,
        icon: 'User'
      })
    })
  }

  // Search all leads
  const { data: leads } = await supabase
    .from('leads')
    .select('id, lead_id, customer_name, customer_phone, loan_type, lead_status, loan_amount')
    .or(`lead_id.ilike.%${query}%,customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%`)
    .limit(limit)

  if (leads) {
    leads.forEach(lead => {
      results.push({
        id: lead.id,
        type: 'lead',
        title: lead.customer_name || `Lead ${lead.lead_id}`,
        subtitle: `${lead.lead_id} | ${formatLoanType(lead.loan_type)}`,
        status: lead.lead_status,
        url: `/superadmin/leads/${lead.id}`,
        icon: 'FileText'
      })
    })
  }

  // Search employees
  const { data: employees } = await supabase
    .from('employee_profile')
    .select('id, employee_id, name, email, subrole, is_active')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%,employee_id.ilike.%${query}%`)
    .limit(limit)

  if (employees) {
    employees.forEach(emp => {
      results.push({
        id: emp.id,
        type: 'employee',
        title: emp.name || 'Employee',
        subtitle: `${emp.employee_id} | ${emp.subrole}`,
        status: emp.is_active ? 'ACTIVE' : 'INACTIVE',
        url: `/superadmin/employees/${emp.id}`,
        icon: 'Users'
      })
    })
  }

  // Search partners
  const { data: partners } = await supabase
    .from('partners')
    .select('id, business_name, partner_type, status, user_id')
    .or(`business_name.ilike.%${query}%`)
    .limit(limit)

  if (partners) {
    partners.forEach(partner => {
      results.push({
        id: partner.id,
        type: 'partner',
        title: partner.business_name || 'Partner',
        subtitle: partner.partner_type,
        status: partner.status,
        url: `/superadmin/partners/${partner.id}`,
        icon: 'Briefcase'
      })
    })
  }
}

// Helper functions
function formatLoanType(type: string): string {
  if (!type) return 'Loan'
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatAmount(amount: number | string | null): string {
  if (!amount) return '0'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`
  if (num >= 100000) return `${(num / 100000).toFixed(2)} L`
  if (num >= 1000) return `${(num / 1000).toFixed(1)} K`
  return num.toLocaleString('en-IN')
}

function formatDocumentType(type: string): string {
  if (!type) return 'Document'
  const typeMap: Record<string, string> = {
    'AADHAAR': 'Aadhaar Card',
    'PAN': 'PAN Card',
    'BANK_STATEMENT': 'Bank Statement',
    'SALARY_SLIP': 'Salary Slip',
    'ITR': 'Income Tax Return',
    'FORM_16': 'Form 16',
    'PROPERTY_DOCUMENTS': 'Property Documents',
    'PHOTO': 'Photograph',
    'SIGNATURE': 'Signature'
  }
  return typeMap[type] || type.replace(/_/g, ' ').split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
