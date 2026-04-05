/**
 * useUserContext Hook
 * Retrieves user context from session for lead attribution
 */

'use client'

import { useState, useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { ULAPUserContext, ULAPModuleContext } from '../types'

interface UseUserContextOptions {
  context: ULAPModuleContext
}

interface UseUserContextReturn {
  userContext: ULAPUserContext | null
  isLoading: boolean
  error: string | null
}

export function useUserContext({ context }: UseUserContextOptions): UseUserContextReturn {
  const [userContext, setUserContext] = useState<ULAPUserContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUserContext() {
      setIsLoading(true)
      setError(null)

      try {
        const supabase = createSupabaseClient()

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          setError('User not authenticated')
          setIsLoading(false)
          return
        }

        // Base user context from auth
        const baseContext: ULAPUserContext = {
          userId: user.id,
          userName: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Unknown',
          userEmail: user.email,
          userMobile: user.user_metadata?.mobile || user.phone,
          userRole: determineUserRole(context),
          userSubrole: user.user_metadata?.subrole,
        }

        // Fetch additional context based on role type
        if (context === 'BA' || context === 'BP') {
          // Fetch partner details
          const { data: partner } = await supabase
            .from('partners')
            .select('id, full_name, partner_type, partner_code')
            .eq('user_id', user.id)
            .maybeSingle()

          if (partner) {
            baseContext.partnerId = partner.id
            baseContext.partnerName = partner.full_name
            baseContext.userName = partner.full_name || baseContext.userName
          }
        } else if (['CRO', 'DSE', 'DIGITAL_SALES', 'TELECALLER', 'FIELD_SALES', 'BDE'].includes(context)) {
          // Fetch employee details
          const { data: employee } = await supabase
            .from('employees')
            .select('id, full_name, employee_code, subrole')
            .eq('user_id', user.id)
            .maybeSingle()

          if (employee) {
            baseContext.employeeId = employee.id
            baseContext.userName = employee.full_name || baseContext.userName
            baseContext.userSubrole = employee.subrole
          }
        } else if (context === 'CUSTOMER_SELF' || context === 'CUSTOMER_REFERRAL') {
          // Fetch customer details
          const { data: customer } = await supabase
            .from('customers')
            .select('id, full_name, mobile, email, subrole')
            .eq('user_id', user.id)
            .maybeSingle()

          if (customer) {
            baseContext.customerId = customer.id
            baseContext.userName = customer.full_name || baseContext.userName
            baseContext.userMobile = customer.mobile || baseContext.userMobile
            baseContext.userSubrole = customer.subrole
          }
        }

        setUserContext(baseContext)
      } catch (err) {
        console.error('Error fetching user context:', err)
        setError('Failed to fetch user information')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserContext()
  }, [context])

  return { userContext, isLoading, error }
}

/**
 * Determine user role string from context
 */
function determineUserRole(context: ULAPModuleContext): string {
  const roleMap: Record<ULAPModuleContext, string> = {
    BA: 'PARTNER_BA',
    BP: 'PARTNER_BP',
    CRO: 'EMPLOYEE_CRO',
    DSE: 'EMPLOYEE_DSE',
    DIGITAL_SALES: 'EMPLOYEE_DIGITAL_SALES',
    TELECALLER: 'EMPLOYEE_TELECALLER',
    FIELD_SALES: 'EMPLOYEE_FIELD_SALES',
    BDE: 'EMPLOYEE_BDE',
    CUSTOMER_SELF: 'CUSTOMER',
    CUSTOMER_REFERRAL: 'CUSTOMER',
  }

  return roleMap[context] || 'UNKNOWN'
}

export default useUserContext
