'use client'

/**
 * Customer Configuration Context
 * Provides customer subrole configuration to all child components
 * Similar pattern to partner-config-context.tsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  type CustomerSubrole,
  type CustomerProfile,
  getSubroleByKey,
  getProfilesBySubrole,
  getProfileByKey,
  shouldShowEntityProfile,
  getSubroleRoute,
  CUSTOMER_SUBROLES,
  CUSTOMER_PROFILES
} from '@/lib/constants/customer-subroles'
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  CreditCard,
  Tag,
  Calculator,
  UserPlus,
  Wallet,
  FolderOpen,
  BookOpen,
  HardDrive,
  Bell,
  Ticket,
  User,
  Building2,
  type LucideIcon
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

// =====================================================
// INTERFACES
// =====================================================

export interface MenuItem {
  icon: LucideIcon
  label: string
  href: string
  exact?: boolean
  badge?: string | number
}

export interface MenuSection {
  title: string
  items: MenuItem[]
}

export interface CustomerConfig {
  subrole: CustomerSubrole
  profile: CustomerProfile | null
  menuItems: MenuItem[]
  menuSections: MenuSection[]
  showEntityProfile: boolean
  dashboardRoute: string
}

export interface CustomerConfigContextType {
  config: CustomerConfig | null
  loading: boolean
  error: string | null
  subroleKey: string | null
  profileKey: string | null
  refreshConfig: () => Promise<void>
}

// =====================================================
// UNIFIED MENU CONFIGURATION
// Same menu for ALL customer subroles
// =====================================================

function getUnifiedMenuItems(subroleRoute: string, showEntityProfile: boolean): MenuItem[] {
  const baseMenu: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', href: `/customers/${subroleRoute}`, exact: true },
    { icon: FileText, label: 'Apply for Loan', href: '/customers/apply' },
    { icon: ClipboardList, label: 'My Applications', href: '/customers/my-applications' },
    { icon: CreditCard, label: 'My Loans', href: '/customers/loans' },
    { icon: Tag, label: 'Offers to Customers', href: '/customers/offers' },
    { icon: Calculator, label: 'EMI Calculator', href: '/customers/emi-calculator' },
    { icon: UserPlus, label: 'Refer & Earn', href: '/customers/refer-a-customer' },
    { icon: Wallet, label: 'Digital Wallet', href: '/customers/wallet' },
    { icon: FolderOpen, label: 'Documents', href: '/customers/documents' },
    { icon: BookOpen, label: 'Knowledge Base', href: '/customers/knowledge-base' },
    { icon: HardDrive, label: 'WorkDrive', href: '/customers/workdrive' },
    { icon: Bell, label: 'Notifications', href: '/customers/notifications' },
    { icon: Ticket, label: 'Support Tickets', href: '/customers/support' }
  ]

  // Add profile link based on entity type
  if (showEntityProfile) {
    baseMenu.push({ icon: Building2, label: 'Entity Profile', href: '/customers/entity' })
  } else {
    baseMenu.push({ icon: User, label: 'My Profile', href: '/customers/my-profile' })
  }

  return baseMenu
}

function getUnifiedMenuSections(subroleRoute: string, showEntityProfile: boolean): MenuSection[] {
  return [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: `/customers/${subroleRoute}`, exact: true }
      ]
    },
    {
      title: 'LOANS',
      items: [
        { icon: FileText, label: 'Apply for Loan', href: '/customers/apply' },
        { icon: ClipboardList, label: 'My Applications', href: '/customers/my-applications' },
        { icon: CreditCard, label: 'My Loans', href: '/customers/loans' }
      ]
    },
    {
      title: 'OFFERS & REWARDS',
      items: [
        { icon: Tag, label: 'Offers to Customers', href: '/customers/offers' },
        { icon: UserPlus, label: 'Refer & Earn', href: '/customers/refer-a-customer' },
        { icon: Wallet, label: 'Digital Wallet', href: '/customers/wallet' }
      ]
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/customers/emi-calculator' },
        { icon: BookOpen, label: 'Knowledge Base', href: '/customers/knowledge-base' }
      ]
    },
    {
      title: 'DOCUMENTS',
      items: [
        { icon: FolderOpen, label: 'Documents', href: '/customers/documents' },
        { icon: HardDrive, label: 'WorkDrive', href: '/customers/workdrive' }
      ]
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/customers/notifications' },
        { icon: Ticket, label: 'Support Tickets', href: '/customers/support' }
      ]
    },
    {
      title: 'PROFILE',
      items: [
        showEntityProfile
          ? { icon: Building2, label: 'Entity Profile', href: '/customers/entity' }
          : { icon: User, label: 'My Profile', href: '/customers/my-profile' }
      ]
    }
  ]
}

// =====================================================
// CONTEXT
// =====================================================

const CustomerConfigContext = createContext<CustomerConfigContextType | null>(null)

// =====================================================
// PROVIDER COMPONENT
// =====================================================

interface CustomerConfigProviderProps {
  children: React.ReactNode
  subroleKey?: string // Optional: Can be passed directly or read from user
}

export function CustomerConfigProvider({ children, subroleKey: propSubroleKey }: CustomerConfigProviderProps) {
  const { user } = useAuth()
  const [config, setConfig] = useState<CustomerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Determine subrole key from prop or user
  const subroleKey = propSubroleKey || user?.sub_role || null
  const profileKey = (user as any)?.profile_key || null

  const loadConfig = useCallback(async () => {
    if (!subroleKey) {
      setLoading(false)
      setError('No subrole specified')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get subrole definition
      const subrole = getSubroleByKey(subroleKey)
      if (!subrole) {
        throw new Error(`Invalid subrole: ${subroleKey}`)
      }

      // Get profile if available
      const profile = profileKey ? getProfileByKey(profileKey) : null

      // Determine if entity profile should be shown
      const showEntity = shouldShowEntityProfile(subroleKey)

      // Get route for this subrole
      const route = getSubroleRoute(subroleKey)

      // Build config
      const customerConfig: CustomerConfig = {
        subrole,
        profile,
        menuItems: getUnifiedMenuItems(route, showEntity),
        menuSections: getUnifiedMenuSections(route, showEntity),
        showEntityProfile: showEntity,
        dashboardRoute: `/customers/${route}`
      }

      setConfig(customerConfig)
      clientLogger.debug('Customer config loaded', { subroleKey, profileKey, route })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load customer configuration'
      setError(message)
      clientLogger.error('Failed to load customer config', { error: message, subroleKey })
    } finally {
      setLoading(false)
    }
  }, [subroleKey, profileKey])

  // Load config on mount and when subrole changes
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const contextValue = useMemo<CustomerConfigContextType>(() => ({
    config,
    loading,
    error,
    subroleKey,
    profileKey,
    refreshConfig: loadConfig
  }), [config, loading, error, subroleKey, profileKey, loadConfig])

  return (
    <CustomerConfigContext.Provider value={contextValue}>
      {children}
    </CustomerConfigContext.Provider>
  )
}

// =====================================================
// HOOK
// =====================================================

export function useCustomerConfig(): CustomerConfigContextType {
  const context = useContext(CustomerConfigContext)
  if (!context) {
    throw new Error('useCustomerConfig must be used within a CustomerConfigProvider')
  }
  return context
}

// =====================================================
// UTILITY EXPORTS
// =====================================================

export {
  getUnifiedMenuItems,
  getUnifiedMenuSections,
  CUSTOMER_SUBROLES,
  CUSTOMER_PROFILES
}
