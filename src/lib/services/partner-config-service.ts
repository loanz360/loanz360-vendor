/**
 * Partner Configuration Service
 * Provides configuration for partner types
 * Uses static config as primary source since partner users can't access admin APIs
 */

import { clientLogger } from '@/lib/utils/client-logger'
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  CreditCard,
  DollarSign,
  Tag,
  FileText,
  BookOpen,
  Calculator,
  Bell,
  Ticket,
  Trophy,
  UsersRound,
  Wallet,
  Send,
  Share2,
  ClipboardList,
  Kanban,
  BarChart3,
  UserPlus,
  type LucideIcon
} from 'lucide-react'

export interface SubMenuItem {
  label: string
  href: string
  icon?: LucideIcon
}

export interface MenuItem {
  icon: LucideIcon
  label: string
  href: string
  exact?: boolean
  badge?: string | number
  subItems?: SubMenuItem[]
}

export interface MenuSection {
  title: string
  items: MenuItem[]
}

export interface PartnerConfig {
  key: string
  displayName: string
  shortCode: string
  route: string
  color: string
  menuItems: MenuItem[]
  menuSections?: MenuSection[]
}

/**
 * Default menu configurations for each partner type
 * These can be extended or overridden based on database configuration
 */
const MENU_CONFIGURATIONS: Record<string, MenuItem[]> = {
  BUSINESS_ASSOCIATE: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/partners/ba', exact: true },
    { icon: Send, label: 'Submit a Lead', href: '/partners/ba/leads/submit' },
    { icon: Share2, label: 'Share a Link', href: '/partners/ba/leads/share' },
    { icon: ClipboardList, label: 'Lead Status', href: '/partners/ba/leads/status' },
    { icon: Users, label: 'My Customers', href: '/partners/ba/customers' },
    { icon: CreditCard, label: 'Payout Grid', href: '/partners/ba/payout-grid' },
    { icon: Wallet, label: 'My Payouts', href: '/partners/ba/commissions' },
    { icon: DollarSign, label: 'Payout Status', href: '/partners/ba/payout-status' },
    { icon: Trophy, label: 'Contest Details', href: '/partners/ba/contest-details' },
    { icon: Tag, label: 'Offers to Customers', href: '/partners/ba/offers' },
    { icon: Calculator, label: 'EMI Calculator', href: '/partners/ba/emi-calculator' },
    { icon: BookOpen, label: 'Knowledge Base', href: '/partners/knowledge-base' },
    { icon: Bell, label: 'Notifications', href: '/partners/ba/notifications' },
    { icon: Ticket, label: 'Support Tickets', href: '/partners/ba/support-tickets' },
  ],
  BUSINESS_PARTNER: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/partners/bp', exact: true },
    { icon: Send, label: 'Submit a Lead', href: '/partners/bp/leads/submit' },
    { icon: Share2, label: 'Share a Link', href: '/partners/bp/leads/share' },
    { icon: ClipboardList, label: 'Lead Status', href: '/partners/bp/leads/status' },
    { icon: Users, label: 'My Customers', href: '/partners/bp/customers/my-customers' },
    { icon: BarChart3, label: 'Analytics', href: '/partners/bp/team/analytics' },
    { icon: UsersRound, label: 'Business Associates', href: '/partners/bp/team/business-associates' },
    { icon: UserPlus, label: 'Recruit Business Associate', href: '/partners/bp/team/recruit' },
    { icon: TrendingUp, label: 'My Team Performance', href: '/partners/bp/team/performance' },
    { icon: UsersRound, label: 'My Team Customers', href: '/partners/bp/customers/team-customers' },
    { icon: CreditCard, label: 'Payout Grid', href: '/partners/bp/payout-grid' },
    {
      icon: Wallet,
      label: 'Payouts',
      href: '/partners/bp/payouts',
      subItems: [
        { label: 'My Payouts', href: '/partners/bp/payouts/my-payouts', icon: Wallet },
        { label: "My Team's Payouts", href: '/partners/bp/payouts/team-payouts', icon: UsersRound },
      ]
    },
    { icon: DollarSign, label: 'Payout Status', href: '/partners/bp/payout-status' },
    { icon: Trophy, label: 'Contest Details', href: '/partners/bp/contest-details' },
    { icon: Tag, label: 'Offers to Customers', href: '/partners/bp/offers' },
    { icon: Calculator, label: 'EMI Calculator', href: '/partners/bp/emi-calculator' },
    { icon: BookOpen, label: 'Knowledge Base', href: '/partners/knowledge-base' },
    { icon: Bell, label: 'Notifications', href: '/partners/bp/notifications' },
    { icon: Ticket, label: 'Support Tickets', href: '/partners/bp/support-tickets' },
  ],
  CHANNEL_PARTNER: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/partners/cp', exact: true },
    { icon: FileText, label: 'My Applications', href: '/partners/cp/applications' },
    { icon: DollarSign, label: 'Payout Status', href: '/partners/cp/payout-status' },
    { icon: CreditCard, label: 'Payout Grid', href: '/partners/cp/payout-grid' },
    { icon: Trophy, label: 'Contest Details', href: '/partners/cp/contest-details' },
    { icon: Tag, label: 'Offers to Customers', href: '/partners/cp/offers' },
    { icon: BookOpen, label: 'Knowledge Base', href: '/partners/knowledge-base' },
    { icon: Calculator, label: 'EMI Calculator', href: '/partners/cp/emi-calculator' },
    { icon: Bell, label: 'Notifications', href: '/partners/cp/notifications' },
    { icon: Ticket, label: 'Support Tickets', href: '/partners/cp/support-tickets' },
  ],
}

/**
 * Menu sections for partner types that use sectioned navigation
 * Similar to Super Admin's sectioned menu structure
 */
const MENU_SECTION_CONFIGURATIONS: Record<string, MenuSection[]> = {
  BUSINESS_ASSOCIATE: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/partners/ba', exact: true },
      ],
    },
    {
      title: 'LEADS MANAGEMENT',
      items: [
        { icon: Send, label: 'Submit a Lead', href: '/partners/ba/leads/submit' },
        { icon: Share2, label: 'Share a Link', href: '/partners/ba/leads/share' },
        { icon: ClipboardList, label: 'Lead Status', href: '/partners/ba/leads/status' },
        { icon: Users, label: 'My Customers', href: '/partners/ba/customers' },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { icon: CreditCard, label: 'Payout Grid', href: '/partners/ba/payout-grid' },
        { icon: Wallet, label: 'My Payouts', href: '/partners/ba/commissions' },
        { icon: DollarSign, label: 'Payout Status', href: '/partners/ba/payout-status' },
        { icon: FileText, label: 'Payout Applications', href: '/partners/ba/payout-applications' },
      ],
    },
    {
      title: 'PROMOTIONS',
      items: [
        { icon: Trophy, label: 'Contest Details', href: '/partners/ba/contest-details' },
        { icon: Tag, label: 'Offers to Customers', href: '/partners/ba/offers' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/partners/ba/emi-calculator' },
        { icon: BookOpen, label: 'Knowledge Base', href: '/partners/knowledge-base' },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/partners/ba/notifications' },
        { icon: Ticket, label: 'Support Tickets', href: '/partners/ba/support-tickets' },
      ],
    },
  ],
  BUSINESS_PARTNER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/partners/bp', exact: true },
      ],
    },
    {
      title: 'LEADS MANAGEMENT',
      items: [
        { icon: Send, label: 'Submit a Lead', href: '/partners/bp/leads/submit' },
        { icon: Share2, label: 'Share a Link', href: '/partners/bp/leads/share' },
        { icon: ClipboardList, label: 'Lead Status', href: '/partners/bp/leads/status' },
        { icon: Users, label: 'My Customers', href: '/partners/bp/customers/my-customers' },
      ],
    },
    {
      title: 'TEAM MANAGEMENT',
      items: [
        { icon: BarChart3, label: 'Analytics', href: '/partners/bp/team/analytics' },
        { icon: UsersRound, label: 'Business Associates', href: '/partners/bp/team/business-associates' },
        { icon: UserPlus, label: 'Recruit Business Associate', href: '/partners/bp/team/recruit' },
        { icon: TrendingUp, label: 'My Team Performance', href: '/partners/bp/team/performance' },
        { icon: UsersRound, label: 'My Team Customers', href: '/partners/bp/customers/team-customers' },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { icon: CreditCard, label: 'Payout Grid', href: '/partners/bp/payout-grid' },
        {
          icon: Wallet,
          label: 'Payouts',
          href: '/partners/bp/payouts',
          subItems: [
            { label: 'My Payouts', href: '/partners/bp/payouts/my-payouts', icon: Wallet },
            { label: "My Team's Payouts", href: '/partners/bp/payouts/team-payouts', icon: UsersRound },
          ]
        },
        { icon: DollarSign, label: 'Payout Status', href: '/partners/bp/payout-status' },
        { icon: FileText, label: 'Payout Applications', href: '/partners/bp/payout-applications' },
      ],
    },
    {
      title: 'PROMOTIONS',
      items: [
        { icon: Trophy, label: 'Contest Details', href: '/partners/bp/contest-details' },
        { icon: Tag, label: 'Offers to Customers', href: '/partners/bp/offers' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/partners/bp/emi-calculator' },
        { icon: BookOpen, label: 'Knowledge Base', href: '/partners/knowledge-base' },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/partners/bp/notifications' },
        { icon: Ticket, label: 'Support Tickets', href: '/partners/bp/support-tickets' },
      ],
    },
  ],
  CHANNEL_PARTNER: [
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/partners/cp', exact: true },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { icon: FileText, label: 'My Applications', href: '/partners/cp/applications' },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { icon: DollarSign, label: 'Payout Status', href: '/partners/cp/payout-status' },
        { icon: CreditCard, label: 'Payout Grid', href: '/partners/cp/payout-grid' },
      ],
    },
    {
      title: 'PROMOTIONS',
      items: [
        { icon: Trophy, label: 'Contest Details', href: '/partners/cp/contest-details' },
        { icon: Tag, label: 'Offers to Customers', href: '/partners/cp/offers' },
      ],
    },
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: Calculator, label: 'EMI Calculator', href: '/partners/cp/emi-calculator' },
        { icon: BookOpen, label: 'Knowledge Base', href: '/partners/knowledge-base' },
      ],
    },
    {
      title: 'SUPPORT & ACCOUNT',
      items: [
        { icon: Bell, label: 'Notifications', href: '/partners/cp/notifications' },
        { icon: Ticket, label: 'Support Tickets', href: '/partners/cp/support-tickets' },
      ],
    },
  ],
}

/**
 * Static partner configurations with display names
 * This provides a reliable config source that doesn't require API calls
 */
const PARTNER_DISPLAY_NAMES: Record<string, string> = {
  'BUSINESS_ASSOCIATE': 'Business Associate',
  'BUSINESS_PARTNER': 'Business Partner',
  'CHANNEL_PARTNER': 'Channel Partner',
}

/**
 * Generate route prefix from role key
 */
function getRoutePrefix(roleKey: string): string {
  const routeMap: Record<string, string> = {
    'BUSINESS_ASSOCIATE': 'ba',
    'BUSINESS_PARTNER': 'bp',
    'CHANNEL_PARTNER': 'cp',
  }

  return routeMap[roleKey] || roleKey.toLowerCase().replace(/_/g, '-')
}

/**
 * Get menu items for a role from static configuration
 */
function getMenuItems(roleKey: string): MenuItem[] {
  // Get from MENU_CONFIGURATIONS
  if (MENU_CONFIGURATIONS[roleKey]) {
    return MENU_CONFIGURATIONS[roleKey]
  }

  // For unknown roles, generate a basic menu structure
  const routePrefix = getRoutePrefix(roleKey)
  return [
    { icon: LayoutDashboard, label: 'Dashboard', href: `/partners/${routePrefix}`, exact: true },
  ]
}

/**
 * Get menu sections for a role from static configuration
 */
function getMenuSections(roleKey: string): MenuSection[] | undefined {
  return MENU_SECTION_CONFIGURATIONS[roleKey]
}

/**
 * Get configuration for a specific partner type
 * Uses static configuration - no API calls needed
 */
export async function getPartnerConfig(roleKey: string): Promise<PartnerConfig | null> {
  clientLogger.debug('Loading config for partner type', { roleKey })

  // Validate that this is a known partner type
  const validPartnerTypes = ['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER']
  if (!validPartnerTypes.includes(roleKey)) {
    clientLogger.warn('Unknown partner type', { roleKey })
    return null
  }

  const shortCode = getRoutePrefix(roleKey)
  const menuItems = getMenuItems(roleKey)
  const menuSections = getMenuSections(roleKey)
  const displayName = PARTNER_DISPLAY_NAMES[roleKey] || roleKey

  clientLogger.debug('Config loaded successfully', { roleKey, shortCode, menuItemsCount: menuItems.length })

  return {
    key: roleKey,
    displayName,
    shortCode,
    route: `/partners/${shortCode}`,
    color: '#FF6700', // Default orange color
    menuItems,
    menuSections,
  }
}

/**
 * Get all active partner configurations
 * Returns static configurations for all known partner types
 */
export async function getAllPartnerConfigs(): Promise<PartnerConfig[]> {
  const partnerTypes = ['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER']

  const configs = await Promise.all(
    partnerTypes.map(type => getPartnerConfig(type))
  )

  return configs.filter((config): config is PartnerConfig => config !== null)
}

/**
 * Get partner config by short code (e.g., 'ba', 'bp', 'cp')
 */
export async function getPartnerConfigByShortCode(shortCode: string): Promise<PartnerConfig | null> {
  const shortCodeToKey: Record<string, string> = {
    'ba': 'BUSINESS_ASSOCIATE',
    'bp': 'BUSINESS_PARTNER',
    'cp': 'CHANNEL_PARTNER',
  }

  const roleKey = shortCodeToKey[shortCode]
  if (!roleKey) {
    return null
  }

  return getPartnerConfig(roleKey)
}

/**
 * Register a new menu configuration for a role
 * This allows extending menu items for newly created roles
 */
export function registerMenuConfiguration(roleKey: string, menuItems: MenuItem[]): void {
  MENU_CONFIGURATIONS[roleKey] = menuItems
}
