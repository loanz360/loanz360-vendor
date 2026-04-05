/**
 * Partner Configuration Registry
 *
 * Central configuration for all partner types.
 * This makes the system extensible - new partner types can be added
 * without modifying existing code.
 *
 * Note: Contest Details is only available for BA and BP partners, not CP.
 */

import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  Tag,
  FileText,
  BookOpen,
  TrendingUp,
  Trophy,
  Kanban,
  Medal,
  Upload,
  AlertTriangle,
  Network,
} from 'lucide-react'
import { PartnerType, PartnerConfig, MenuItem, MenuSection } from './types'

/**
 * Partner Configurations
 *
 * To add a new partner type:
 * 1. Import required icons from lucide-react
 * 2. Add new config object following the pattern below
 * 3. Create corresponding folder in src/app/partners/{shortCode}
 * 4. The sidebar and routing will work automatically!
 */
export const PARTNER_CONFIGS: Record<PartnerType, PartnerConfig> = {
  [PartnerType.BUSINESS_ASSOCIATE]: {
    type: PartnerType.BUSINESS_ASSOCIATE,
    displayName: 'Business Associate',
    shortCode: 'ba',
    route: '/partners/ba',
    color: '#FF6700',
    features: {
      hasLeads: true,
      hasCustomers: true,
      hasBanner: false,
    },
    permissions: [
      'leads:read',
      'leads:create',
      'customers:read',
      'payouts:read',
      'offers:read',
    ],
    menuItems: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        href: '/partners/ba',
        exact: true,
      },
      {
        icon: Kanban,
        label: 'Leads Management',
        href: '/partners/ba/leads-management',
      },
      {
        icon: TrendingUp,
        label: 'My Leads',
        href: '/partners/ba/leads',
      },
      {
        icon: Users,
        label: 'My Customers',
        href: '/partners/ba/customers',
      },
      {
        icon: CreditCard,
        label: 'Payout Grid',
        href: '/partners/ba/payout-grid',
      },
      {
        icon: DollarSign,
        label: 'Payout Status',
        href: '/partners/ba/payout-status',
      },
      {
        icon: Tag,
        label: 'Offers to Customers',
        href: '/partners/ba/offers',
      },
      {
        icon: Trophy,
        label: 'Contest Details',
        href: '/partners/ba/contest-details',
      },
      {
        icon: Medal,
        label: 'Leaderboard',
        href: '/partners/ba/leaderboard',
      },
      {
        icon: Upload,
        label: 'Bulk Upload',
        href: '/partners/ba/leads/bulk-upload',
      },
      {
        icon: BookOpen,
        label: 'Knowledge Base',
        href: '/partners/knowledge-base',
      },
    ],
    menuSections: [
      {
        title: 'MAIN',
        items: [
          {
            icon: LayoutDashboard,
            label: 'Dashboard',
            href: '/partners/ba',
            exact: true,
          },
        ],
      },
      {
        title: 'BUSINESS',
        items: [
          {
            icon: Kanban,
            label: 'Leads Management',
            href: '/partners/ba/leads-management',
          },
          {
            icon: TrendingUp,
            label: 'My Leads',
            href: '/partners/ba/leads',
          },
          {
            icon: Users,
            label: 'My Customers',
            href: '/partners/ba/customers',
          },
          {
            icon: Upload,
            label: 'Bulk Upload',
            href: '/partners/ba/leads/bulk-upload',
          },
        ],
      },
      {
        title: 'FINANCE',
        items: [
          {
            icon: CreditCard,
            label: 'Payout Grid',
            href: '/partners/ba/payout-grid',
          },
          {
            icon: DollarSign,
            label: 'Payout Status',
            href: '/partners/ba/payout-status',
          },
          {
            icon: FileText,
            label: 'Payout Applications',
            href: '/partners/ba/payout-applications',
          },
        ],
      },
      {
        title: 'PROMOTIONS',
        items: [
          {
            icon: Tag,
            label: 'Offers to Customers',
            href: '/partners/ba/offers',
          },
          {
            icon: Trophy,
            label: 'Contest Details',
            href: '/partners/ba/contest-details',
          },
          {
            icon: Medal,
            label: 'Leaderboard',
            href: '/partners/ba/leaderboard',
          },
        ],
      },
      {
        title: 'RESOURCES',
        items: [
          {
            icon: BookOpen,
            label: 'Knowledge Base',
            href: '/partners/knowledge-base',
          },
        ],
      },
    ],
  },

  [PartnerType.BUSINESS_PARTNER]: {
    type: PartnerType.BUSINESS_PARTNER,
    displayName: 'Business Partner',
    shortCode: 'bp',
    route: '/partners/bp',
    color: '#FF6700',
    features: {
      hasLeads: true,
      hasCustomers: true,
      hasBanner: false,
    },
    permissions: [
      'leads:read',
      'leads:create',
      'customers:read',
      'payouts:read',
      'offers:read',
    ],
    menuItems: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        href: '/partners/bp',
        exact: true,
      },
      {
        icon: Kanban,
        label: 'Leads Management',
        href: '/partners/bp/leads-management',
      },
      {
        icon: TrendingUp,
        label: 'My Leads',
        href: '/partners/bp/leads',
      },
      {
        icon: Users,
        label: 'My Customers',
        href: '/partners/bp/customers',
      },
      {
        icon: CreditCard,
        label: 'Payout Grid',
        href: '/partners/bp/payout-grid',
      },
      {
        icon: DollarSign,
        label: 'Payout Status',
        href: '/partners/bp/payout-status',
      },
      {
        icon: FileText,
        label: 'Payout Applications',
        href: '/partners/bp/payout-applications',
      },
      {
        icon: Tag,
        label: 'Offers to Customers',
        href: '/partners/bp/offers',
      },
      {
        icon: Trophy,
        label: 'Contest Details',
        href: '/partners/bp/contest-details',
      },
      {
        icon: Medal,
        label: 'Leaderboard',
        href: '/partners/bp/leaderboard',
      },
      {
        icon: Upload,
        label: 'Bulk Upload',
        href: '/partners/bp/leads/bulk-upload',
      },
      {
        icon: Network,
        label: 'Referral Tree',
        href: '/partners/bp/referral-tree',
      },
      {
        icon: BookOpen,
        label: 'Knowledge Base',
        href: '/partners/knowledge-base',
      },
    ],
    menuSections: [
      {
        title: 'MAIN',
        items: [
          {
            icon: LayoutDashboard,
            label: 'Dashboard',
            href: '/partners/bp',
            exact: true,
          },
        ],
      },
      {
        title: 'BUSINESS',
        items: [
          {
            icon: Kanban,
            label: 'Leads Management',
            href: '/partners/bp/leads-management',
          },
          {
            icon: TrendingUp,
            label: 'My Leads',
            href: '/partners/bp/leads',
          },
          {
            icon: Users,
            label: 'My Customers',
            href: '/partners/bp/customers',
          },
          {
            icon: Upload,
            label: 'Bulk Upload',
            href: '/partners/bp/leads/bulk-upload',
          },
        ],
      },
      {
        title: 'TEAM',
        items: [
          {
            icon: Network,
            label: 'Referral Tree',
            href: '/partners/bp/referral-tree',
          },
        ],
      },
      {
        title: 'FINANCE',
        items: [
          {
            icon: CreditCard,
            label: 'Payout Grid',
            href: '/partners/bp/payout-grid',
          },
          {
            icon: DollarSign,
            label: 'Payout Status',
            href: '/partners/bp/payout-status',
          },
          {
            icon: FileText,
            label: 'Payout Applications',
            href: '/partners/bp/payout-applications',
          },
        ],
      },
      {
        title: 'PROMOTIONS',
        items: [
          {
            icon: Tag,
            label: 'Offers to Customers',
            href: '/partners/bp/offers',
          },
          {
            icon: Trophy,
            label: 'Contest Details',
            href: '/partners/bp/contest-details',
          },
          {
            icon: Medal,
            label: 'Leaderboard',
            href: '/partners/bp/leaderboard',
          },
        ],
      },
      {
        title: 'RESOURCES',
        items: [
          {
            icon: BookOpen,
            label: 'Knowledge Base',
            href: '/partners/knowledge-base',
          },
        ],
      },
    ],
  },

  [PartnerType.CHANNEL_PARTNER]: {
    type: PartnerType.CHANNEL_PARTNER,
    displayName: 'Channel Partner',
    shortCode: 'cp',
    route: '/partners/cp',
    color: '#FF6700',
    features: {
      hasBanner: true,
      bannerDimensions: { width: 1200, height: 300 },
      hasApplications: true,
    },
    permissions: [
      'applications:read',
      'applications:create',
      'payouts:read',
      'offers:read',
      'knowledge-base:read',
    ],
    menuItems: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        href: '/partners/cp',
        exact: true,
      },
      {
        icon: FileText,
        label: 'My Applications',
        href: '/partners/cp/applications',
      },
      {
        icon: DollarSign,
        label: 'Payout Status',
        href: '/partners/cp/payout-status',
      },
      {
        icon: CreditCard,
        label: 'Payout Grid',
        href: '/partners/cp/payout-grid',
      },
      {
        icon: Tag,
        label: 'Offers to Customers',
        href: '/partners/cp/offers',
      },
      {
        icon: Medal,
        label: 'Leaderboard',
        href: '/partners/cp/leaderboard',
      },
      {
        icon: AlertTriangle,
        label: 'Disputes',
        href: '/partners/cp/disputes',
      },
      {
        icon: BookOpen,
        label: 'Knowledge Base',
        href: '/partners/knowledge-base',
      },
    ],
    menuSections: [
      {
        title: 'MAIN',
        items: [
          {
            icon: LayoutDashboard,
            label: 'Dashboard',
            href: '/partners/cp',
            exact: true,
          },
        ],
      },
      {
        title: 'BUSINESS',
        items: [
          {
            icon: FileText,
            label: 'My Applications',
            href: '/partners/cp/applications',
          },
        ],
      },
      {
        title: 'FINANCE',
        items: [
          {
            icon: CreditCard,
            label: 'Payout Grid',
            href: '/partners/cp/payout-grid',
          },
          {
            icon: DollarSign,
            label: 'Payout Status',
            href: '/partners/cp/payout-status',
          },
          {
            icon: AlertTriangle,
            label: 'Disputes',
            href: '/partners/cp/disputes',
          },
        ],
      },
      {
        title: 'PROMOTIONS',
        items: [
          {
            icon: Tag,
            label: 'Offers to Customers',
            href: '/partners/cp/offers',
          },
          {
            icon: Medal,
            label: 'Leaderboard',
            href: '/partners/cp/leaderboard',
          },
        ],
      },
      {
        title: 'RESOURCES',
        items: [
          {
            icon: BookOpen,
            label: 'Knowledge Base',
            href: '/partners/knowledge-base',
          },
        ],
      },
    ],
  },
}

/**
 * Helper Functions
 */

export function getPartnerConfig(type: PartnerType): PartnerConfig {
  return PARTNER_CONFIGS[type]
}

export function getPartnerConfigByShortCode(shortCode: string): PartnerConfig | undefined {
  return Object.values(PARTNER_CONFIGS).find(config => config.shortCode === shortCode)
}

export function getAllPartnerTypes(): PartnerType[] {
  return Object.values(PartnerType)
}

export function getPartnerRoute(type: PartnerType): string {
  return PARTNER_CONFIGS[type].route
}

export function getPartnerMenuItems(type: PartnerType): MenuItem[] {
  return PARTNER_CONFIGS[type].menuItems
}

export function hasPermission(type: PartnerType, permission: string): boolean {
  return PARTNER_CONFIGS[type].permissions.includes(permission)
}
