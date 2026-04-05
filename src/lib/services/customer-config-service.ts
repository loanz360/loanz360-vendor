/**
 * Customer Configuration Service
 * Provides dynamic configuration for customer types based on database role definitions
 *
 * Menu Structure for Basic Customer Portal (after registration):
 * - MAIN: Dashboard
 * - LOANS: Apply for Loan, My Applications, My Loans
 * - MY PROFILE: My Profile, (Individual Profiles), (My Business Profiles), Add a New Profile
 * - CREDIT ASSESSMENT: Credit Score, Loan Details, Upcoming EMIs
 * - TOOLS & RESOURCES: EMI Calculator, Offers, Refer & Earn, Knowledge Base
 * - DOCUMENTS & STORAGE: Documents, Digital Wallet
 * - ACCOUNTS: Notifications, Support Tickets
 */

import { fetchRoleDefinitionsByType, fetchRoleDefinitionByKey } from '@/lib/api/role-definitions-api'
import type { RoleDefinition } from '@/lib/constants/role-definitions'
import { clientLogger } from '@/lib/utils/client-logger'
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Calculator,
  FolderOpen,
  User,
  Bell,
  Ticket,
  Building2,
  Tag,
  BookOpen,
  UserPlus,
  Wallet,
  ClipboardList,
  Shield,
  BarChart3,
  FileSearch,
  Receipt,
  AlertTriangle,
  BanknoteIcon,
  Landmark,
  CalendarClock,
  Clock,
  Search,
  Heart,
  GitCompareArrows,
  FileCheck,
  Gauge,
  HeartPulse,
  BrainCircuit,
  BellRing,
  CalendarDays,
  FileWarning,
  Users,
  Scale,
  type LucideIcon
} from 'lucide-react'

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
  key: string
  displayName: string
  shortCode: string
  route: string
  color: string
  menuItems: MenuItem[]
  menuSections?: MenuSection[]
  roleDefinition: RoleDefinition
}

/**
 * Unified base menu for all customer subroles
 * This is the single source of truth for customer sidebar menu
 */
function getUnifiedBaseMenu(subroleKey: string): MenuItem[] {
  // Get the route prefix based on subrole
  const route = SUBROLE_ROUTE_MAP[subroleKey] || subroleKey.toLowerCase().replace(/_/g, '-')

  // Determine if this is a business-type subrole (shows Entity Profile instead of My Profile)
  const isBusinessSubrole = subroleKey === 'BUSINESS' || subroleKey === 'INSTITUTIONAL'

  return [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/customers/dashboard', exact: true },
    { icon: FileText, label: 'Apply for Loan', href: '/customers/apply' },
    { icon: CreditCard, label: 'My Loans', href: '/customers/loans' },
    { icon: Calculator, label: 'EMI Calculator', href: '/customers/emi-calculator' },
    { icon: FolderOpen, label: 'Documents', href: '/customers/documents' },
    { icon: Bell, label: 'Notifications', href: '/customers/notifications' },
    { icon: Ticket, label: 'Support Tickets', href: '/customers/support' },
    isBusinessSubrole
      ? { icon: Building2, label: 'Entity Profile', href: '/customers/entity' }
      : { icon: User, label: 'My Profile', href: '/customers/my-profile' },
  ]
}

/**
 * Subrole to route mapping for 15 customer subroles
 */
const SUBROLE_ROUTE_MAP: Record<string, string> = {
  'INDIVIDUAL': 'individual',
  'SALARIED': 'salaried',
  'PROFESSIONAL': 'professional',
  'MANUFACTURER': 'manufacturer',
  'TRADER': 'trader',
  'SERVICE': 'service',
  'AGRICULTURE': 'agriculture',
  'PENSIONER': 'pensioner',
  'RETIRED': 'retired',
  'NRI': 'nri',
  'WOMEN': 'women',
  'STUDENT': 'student',
  'GIG_ECONOMY': 'gig-economy',
  'INSTITUTIONAL': 'institutional',
  'SPECIAL': 'special',
  // Legacy mappings for backward compatibility
  'BUSINESS': 'business',
}

/**
 * Default menu configurations for each customer type
 * Now uses unified base menu for all 13 subroles
 * Legacy subroles are mapped to new subroles for backward compatibility
 */
const MENU_CONFIGURATIONS: Record<string, MenuItem[]> = {
  // 15 active subroles - all use unified base menu (generated dynamically)
  INDIVIDUAL: getUnifiedBaseMenu('INDIVIDUAL'),
  SALARIED: getUnifiedBaseMenu('SALARIED'),
  PROFESSIONAL: getUnifiedBaseMenu('PROFESSIONAL'),
  MANUFACTURER: getUnifiedBaseMenu('MANUFACTURER'),
  TRADER: getUnifiedBaseMenu('TRADER'),
  SERVICE: getUnifiedBaseMenu('SERVICE'),
  AGRICULTURE: getUnifiedBaseMenu('AGRICULTURE'),
  PENSIONER: getUnifiedBaseMenu('PENSIONER'),
  RETIRED: getUnifiedBaseMenu('RETIRED'),
  NRI: getUnifiedBaseMenu('NRI'),
  WOMEN: getUnifiedBaseMenu('WOMEN'),
  STUDENT: getUnifiedBaseMenu('STUDENT'),
  GIG_ECONOMY: getUnifiedBaseMenu('GIG_ECONOMY'),
  INSTITUTIONAL: getUnifiedBaseMenu('INSTITUTIONAL'),
  SPECIAL: getUnifiedBaseMenu('SPECIAL'),
  // Legacy subrole mappings (for backward compatibility with existing users)
  BUSINESS: getUnifiedBaseMenu('MANUFACTURER'),  // Map old BUSINESS to MANUFACTURER
  MSME: getUnifiedBaseMenu('MANUFACTURER'),  // Map old MSME to MANUFACTURER
  PROPRIETOR: getUnifiedBaseMenu('TRADER'),
  PARTNERSHIP: getUnifiedBaseMenu('TRADER'),
  PRIVATE_LIMITED_COMPANY: getUnifiedBaseMenu('MANUFACTURER'),
  PUBLIC_LIMITED_COMPANY: getUnifiedBaseMenu('MANUFACTURER'),
  LLP: getUnifiedBaseMenu('SERVICE'),
  HUF: getUnifiedBaseMenu('TRADER'),
  DOCTOR: getUnifiedBaseMenu('PROFESSIONAL'),
  LAWYER: getUnifiedBaseMenu('PROFESSIONAL'),
  CHARTERED_ACCOUNTANT: getUnifiedBaseMenu('PROFESSIONAL'),
  COMPANY_SECRETARY: getUnifiedBaseMenu('PROFESSIONAL'),
  PURE_RENTAL: getUnifiedBaseMenu('INDIVIDUAL'),
}

/**
 * Generate route prefix from role key
 * Uses the SUBROLE_ROUTE_MAP for new 13 subroles
 * Falls back to legacy mapping for backward compatibility
 */
function getRoutePrefix(roleKey: string): string {
  // First check new subrole map
  if (SUBROLE_ROUTE_MAP[roleKey]) {
    return SUBROLE_ROUTE_MAP[roleKey]
  }

  // Legacy route mapping for backward compatibility
  const legacyRouteMap: Record<string, string> = {
    'PROPRIETOR': 'business',
    'PARTNERSHIP': 'business',
    'PRIVATE_LIMITED_COMPANY': 'business',
    'PUBLIC_LIMITED_COMPANY': 'business',
    'LLP': 'business',
    'HUF': 'business',
    'DOCTOR': 'professional',
    'LAWYER': 'professional',
    'CHARTERED_ACCOUNTANT': 'professional',
    'COMPANY_SECRETARY': 'professional',
    'PURE_RENTAL': 'individual',
  }

  return legacyRouteMap[roleKey] || roleKey.toLowerCase().replace(/_/g, '-')
}

/**
 * Add "Refer & Earn" link to menu items (new ULAP referral module)
 * Inserts after "EMI Calculator" if found, otherwise after "Offers to Customers"
 */
function addReferAFriendToMenu(menuItems: MenuItem[]): MenuItem[] {
  const referLink: MenuItem = {
    icon: UserPlus,
    label: 'Refer & Earn',
    href: '/customers/refer-a-customer'
  }

  // Find index to insert (after EMI Calculator or after Offers)
  const emiIndex = menuItems.findIndex(item => item.label === 'EMI Calculator')
  const offersIndex = menuItems.findIndex(item => item.label === 'Offers to Customers')
  const insertIndex = emiIndex !== -1 ? emiIndex + 1 : (offersIndex !== -1 ? offersIndex + 1 : menuItems.length - 2)

  // Insert refer-a-friend link
  const newMenuItems = [...menuItems]
  newMenuItems.splice(insertIndex, 0, referLink)
  return newMenuItems
}

/**
 * Add "My Applications" link to menu items (new ULAP module)
 * Inserts after "Apply for Loan" to allow customers to track and manage their applications
 */
function addMyApplicationsToMenu(menuItems: MenuItem[]): MenuItem[] {
  const myApplicationsLink: MenuItem = {
    icon: ClipboardList,
    label: 'My Applications',
    href: '/customers/my-applications'
  }

  // Find index to insert (after Apply for Loan)
  const applyIndex = menuItems.findIndex(item => item.label.includes('Apply for'))
  const insertIndex = applyIndex !== -1 ? applyIndex + 1 : 2 // Default after Dashboard

  // Insert my applications link
  const newMenuItems = [...menuItems]
  newMenuItems.splice(insertIndex, 0, myApplicationsLink)
  return newMenuItems
}

/**
 * Add "Offers to Customers" link to menu items
 * Inserts before "EMI Calculator" if found, otherwise before "Notifications"
 */
function addOffersToMenu(menuItems: MenuItem[]): MenuItem[] {
  const offersLink: MenuItem = {
    icon: Tag,
    label: 'Offers to Customers',
    href: '/customers/offers'
  }

  // Find index to insert (before EMI Calculator or Notifications)
  const emiIndex = menuItems.findIndex(item => item.label === 'EMI Calculator')
  const notifIndex = menuItems.findIndex(item => item.label === 'Notifications')
  const insertIndex = emiIndex !== -1 ? emiIndex : (notifIndex !== -1 ? notifIndex : menuItems.length - 2)

  // Insert offers link
  const newMenuItems = [...menuItems]
  newMenuItems.splice(insertIndex, 0, offersLink)
  return newMenuItems
}

/**
 * Add "Knowledge Base" link to menu items
 * Inserts after "Documents" if found, otherwise before "Notifications"
 */
function addKnowledgeBaseToMenu(menuItems: MenuItem[]): MenuItem[] {
  const knowledgeBaseLink: MenuItem = {
    icon: BookOpen,
    label: 'Knowledge Base',
    href: '/customers/knowledge-base'
  }

  // Find index to insert (after Documents or before Notifications)
  const docsIndex = menuItems.findIndex(item => item.label === 'Documents')
  const notifIndex = menuItems.findIndex(item => item.label === 'Notifications')
  const insertIndex = docsIndex !== -1 ? docsIndex + 1 : (notifIndex !== -1 ? notifIndex : menuItems.length - 2)

  // Insert knowledge base link
  const newMenuItems = [...menuItems]
  newMenuItems.splice(insertIndex, 0, knowledgeBaseLink)
  return newMenuItems
}

/**
 * Add "Digital Wallet" link to menu items
 * Inserts after "Refer-a-Friend" if found, otherwise after "EMI Calculator"
 */
function addDigitalWalletToMenu(menuItems: MenuItem[]): MenuItem[] {
  const walletLink: MenuItem = {
    icon: Wallet,
    label: 'Digital Wallet',
    href: '/customers/wallet'
  }

  // Find index to insert (after Refer-a-Friend or after EMI Calculator)
  const referIndex = menuItems.findIndex(item => item.label === 'Refer-a-Friend')
  const emiIndex = menuItems.findIndex(item => item.label === 'EMI Calculator')
  const insertIndex = referIndex !== -1 ? referIndex + 1 : (emiIndex !== -1 ? emiIndex + 1 : menuItems.length - 2)

  // Insert digital wallet link
  const newMenuItems = [...menuItems]
  newMenuItems.splice(insertIndex, 0, walletLink)
  return newMenuItems
}

/**
 * Generate menu sections for a customer subrole
 * Follows BA/BP Partner Sidebar pattern with clean section headings
 *
 * Section Structure (matching Partner sidebar style):
 * - MAIN: Dashboard only
 * - LOANS: Apply for Loan, My Applications, My Loans
 * - MY PROFILE: Profile management
 * - CREDIT ASSESSMENT: Credit analysis tools
 * - TOOLS & RESOURCES: Calculators, offers, resources
 * - DOCUMENTS & STORAGE: File management
 * - ACCOUNTS: Notifications, Support Tickets
 *
 * @param subroleKey - The subrole key (e.g., 'INDIVIDUAL', 'BUSINESS')
 * @param isBusinessType - Whether this subrole shows Entity Profile (BUSINESS, MSME, INSTITUTIONAL)
 * @param includeGST - Whether to include GST Analytics (for business/professional subroles)
 */
function generateMenuSections(
  subroleKey: string,
  isBusinessType: boolean = false,
  includeGST: boolean = false
): MenuSection[] {
  const route = SUBROLE_ROUTE_MAP[subroleKey] || subroleKey.toLowerCase().replace(/_/g, '-')

  // Credit Assessment items - comprehensive credit analysis tools
  // Shows: Credit Score, Loan Details, Upcoming EMIs, Credit Insights (tabbed: Payment History + Enquiries + Health)
  const creditAssessmentItems: MenuItem[] = [
    { icon: Shield, label: 'Credit Score', href: '/customers/credit-assessment/credit-score' },
    { icon: Gauge, label: 'Eligibility Score', href: '/customers/eligibility-score', badge: 'New' },
    { icon: HeartPulse, label: 'Financial Health', href: '/customers/financial-health', badge: 'New' },
    { icon: FileSearch, label: 'Loan Details', href: '/customers/credit-assessment/loan-details' },
    { icon: CalendarClock, label: 'Upcoming EMIs', href: '/customers/credit-assessment/upcoming-emis' },
    { icon: BarChart3, label: 'Credit Insights', href: '/customers/credit-assessment/credit-insights' },
  ]

  const sections: MenuSection[] = [
    // MAIN Section - Dashboard only
    {
      title: 'MAIN',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/customers/dashboard', exact: true },
      ],
    },
    // LOANS Section - Core loan actions
    {
      title: 'LOANS',
      items: [
        { icon: FileText, label: 'Apply for Loan', href: '/customers/apply' },
        { icon: ClipboardList, label: 'My Applications', href: '/customers/my-applications' },
        { icon: CreditCard, label: 'My Loans', href: '/customers/loans' },
      ],
    },
    // MY PROFILE Section - Customer's profile + dynamically loaded profiles
    // Individual and business profiles will be dynamically rendered in CustomerSidebar
    {
      title: 'MY PROFILE',
      items: [
        isBusinessType
          ? { icon: Landmark, label: 'Entity Profile', href: '/customers/entity' }
          : { icon: User, label: 'My Profile', href: '/customers/my-profile' },
        { icon: UserPlus, label: 'Add a New Profile', href: '/customers/add-profile' },
      ],
    },
    // CREDIT ASSESSMENT Section - Credit analysis tools
    {
      title: 'CREDIT ASSESSMENT',
      items: creditAssessmentItems,
    },
    // TOOLS & RESOURCES Section - Calculators, offers, resources
    {
      title: 'TOOLS & RESOURCES',
      items: [
        { icon: GitCompareArrows, label: 'Loan Comparison', href: '/customers/loan-comparison' },
        { icon: Calculator, label: 'EMI Calculator', href: '/customers/emi-calculator' },
        { icon: CalendarDays, label: 'EMI Calendar', href: '/customers/emi-calendar', badge: 'New' },
        { icon: BrainCircuit, label: 'Credit Advisor', href: '/customers/credit-advisor', badge: 'New' },
        { icon: BellRing, label: 'Rate Alerts', href: '/customers/rate-alerts', badge: 'New' },
        { icon: Scale, label: 'Credit Dispute', href: '/customers/credit-dispute', badge: 'New' },
        { icon: Users, label: 'Family Loans', href: '/customers/family-loans', badge: 'New' },
        { icon: Tag, label: 'Offers', href: '/customers/offers' },
        { icon: UserPlus, label: 'Refer & Earn', href: '/customers/refer-a-customer' },
        { icon: Heart, label: 'Community', href: '/customers/community', badge: 'New' },
        { icon: BookOpen, label: 'Knowledge Base', href: '/customers/knowledge-base' },
      ],
    },
    // DOCUMENTS & STORAGE Section - File management
    {
      title: 'DOCUMENTS & STORAGE',
      items: [
        { icon: FileCheck, label: 'Document Readiness', href: '/customers/document-readiness' },
        { icon: FileWarning, label: 'Document Alerts', href: '/customers/document-alerts', badge: 'New' },
        { icon: FolderOpen, label: 'Documents', href: '/customers/documents' },
        { icon: Wallet, label: 'Digital Wallet', href: '/customers/wallet' },
      ],
    },
    // ACCOUNTS Section - Support (My Profile moved to MY PROFILE section)
    {
      title: 'ACCOUNTS',
      items: [
        { icon: Bell, label: 'Notifications', href: '/customers/notifications' },
        { icon: Ticket, label: 'Support Tickets', href: '/customers/support' },
      ],
    },
  ]

  return sections
}

/**
 * Menu section configurations for customer subroles
 * Organized similar to BA/BP Partner sidebar patterns
 * Groups menu items under logical section headings
 *
 * Configuration key:
 * - isBusinessType: true = shows Entity Profile (for business entities)
 * - includeGST: true = shows GST Analytics (for GST-registered businesses/professionals)
 */
const MENU_SECTION_CONFIGURATIONS: Record<string, MenuSection[]> = {
  // ==========================================
  // PRIMARY 15 SUBROLES (Active)
  // ==========================================

  // Individual - Personal customers, no GST, personal profile
  INDIVIDUAL: generateMenuSections('INDIVIDUAL', false, false),

  // Salaried - Employed individuals, no GST, personal profile
  SALARIED: generateMenuSections('SALARIED', false, false),

  // Professional - Self-employed professionals (Doctors, CAs, Lawyers), with GST, personal profile
  PROFESSIONAL: generateMenuSections('PROFESSIONAL', false, true),

  // Manufacturer - Manufacturing business owners, with GST, ENTITY profile
  MANUFACTURER: generateMenuSections('MANUFACTURER', true, true),

  // Trader - Trading and retail business owners, with GST, ENTITY profile
  TRADER: generateMenuSections('TRADER', true, true),

  // Service - Service business owners, with GST, ENTITY profile
  SERVICE: generateMenuSections('SERVICE', true, true),

  // Agriculture - Farmers and agricultural activities, no GST typically, personal profile
  AGRICULTURE: generateMenuSections('AGRICULTURE', false, false),

  // Pensioner - Retired individuals with pension, no GST, personal profile
  PENSIONER: generateMenuSections('PENSIONER', false, false),

  // Retired - Retired individuals without pension, no GST, personal profile
  RETIRED: generateMenuSections('RETIRED', false, false),

  // NRI - Non-Resident Indians, may have GST for business NRIs, personal profile
  NRI: generateMenuSections('NRI', false, true),

  // Women - Women entrepreneurs and professionals, may have GST, personal profile
  WOMEN: generateMenuSections('WOMEN', false, true),

  // Student - Students pursuing education, no GST, personal profile
  STUDENT: generateMenuSections('STUDENT', false, false),

  // Gig Economy - Freelancers and gig workers, with GST (freelancers), personal profile
  GIG_ECONOMY: generateMenuSections('GIG_ECONOMY', false, true),

  // Institutional - Schools, Hospitals, NGOs, Trusts, with GST, ENTITY profile
  INSTITUTIONAL: generateMenuSections('INSTITUTIONAL', true, true),

  // Special - Special categories (Homemaker, Rental Income, Senior Citizen), no GST, personal profile
  SPECIAL: generateMenuSections('SPECIAL', false, false),

  // ==========================================
  // LEGACY SUBROLE MAPPINGS (Backward Compatibility)
  // ==========================================

  // Old BUSINESS and MSME -> mapped to new categories
  BUSINESS: generateMenuSections('MANUFACTURER', true, true),
  MSME: generateMenuSections('MANUFACTURER', true, true),

  // Business entity types -> appropriate new categories
  PROPRIETOR: generateMenuSections('TRADER', true, true),
  PARTNERSHIP: generateMenuSections('TRADER', true, true),
  PRIVATE_LIMITED_COMPANY: generateMenuSections('MANUFACTURER', true, true),
  PUBLIC_LIMITED_COMPANY: generateMenuSections('MANUFACTURER', true, true),
  LLP: generateMenuSections('SERVICE', true, true),
  HUF: generateMenuSections('TRADER', true, true),

  // Professional types -> PROFESSIONAL menu
  DOCTOR: generateMenuSections('PROFESSIONAL', false, true),
  LAWYER: generateMenuSections('PROFESSIONAL', false, true),
  CHARTERED_ACCOUNTANT: generateMenuSections('PROFESSIONAL', false, true),
  COMPANY_SECRETARY: generateMenuSections('PROFESSIONAL', false, true),

  // Special types -> appropriate menus
  PURE_RENTAL: generateMenuSections('SPECIAL', false, false),
}

/**
 * Get menu sections for a customer subrole
 */
function getMenuSections(subroleKey: string): MenuSection[] | undefined {
  return MENU_SECTION_CONFIGURATIONS[subroleKey]
}

/**
 * Get menu items for a role
 * Priority: Database config > Default config > Auto-generated
 */
function getMenuItems(roleDefinition: RoleDefinition): MenuItem[] {
  let menuItems: MenuItem[]

  // First, try to get from MENU_CONFIGURATIONS
  if (MENU_CONFIGURATIONS[roleDefinition.key]) {
    menuItems = MENU_CONFIGURATIONS[roleDefinition.key]
  } else {
    // For new roles, generate a basic menu structure with common routes
    menuItems = [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/customers/dashboard', exact: true },
      { icon: FileText, label: 'Apply for Loan', href: '/customers/apply' },
      { icon: CreditCard, label: 'My Loans', href: '/customers/loans' },
      { icon: Calculator, label: 'EMI Calculator', href: '/customers/emi-calculator' },
      { icon: FolderOpen, label: 'Documents', href: '/customers/documents' },
      { icon: Bell, label: 'Notifications', href: '/customers/notifications' },
      { icon: Ticket, label: 'Support Tickets', href: '/customers/support' },
      { icon: User, label: 'My Profile', href: '/customers/my-profile' },
    ]
  }

  // Add "My Applications", "Offers to Customers", "Refer-a-Friend", "Digital Wallet", and "Knowledge Base" links to all customer menus
  let enhancedMenu = addMyApplicationsToMenu(menuItems) // Track loan applications
  enhancedMenu = addOffersToMenu(enhancedMenu)
  enhancedMenu = addReferAFriendToMenu(enhancedMenu)
  enhancedMenu = addDigitalWalletToMenu(enhancedMenu)
  enhancedMenu = addKnowledgeBaseToMenu(enhancedMenu)
  return enhancedMenu
}

/**
 * Get configuration for a specific customer type
 */
export async function getCustomerConfig(roleKey: string): Promise<CustomerConfig | null> {
  clientLogger.debug('Fetching config for customer role', { roleKey })

  // Try to fetch from database
  const roleDefinition = await fetchRoleDefinitionByKey(roleKey)
  clientLogger.debug('Role definition fetched', { roleDefinition })

  // If role exists in database and is active, use it
  if (roleDefinition && roleDefinition.isActive) {
    const shortCode = getRoutePrefix(roleDefinition.key)
    const menuItems = getMenuItems(roleDefinition)
    const menuSections = getMenuSections(roleDefinition.key)

    clientLogger.debug('Generated customer config from database', { shortCode, menuItemsCount: menuItems.length, hasSections: !!menuSections })

    return {
      key: roleDefinition.key,
      displayName: roleDefinition.name,
      shortCode,
      route: `/customers/${shortCode}`,
      color: '#FF6700', // Default orange color
      menuItems,
      menuSections,
      roleDefinition
    }
  }

  // Fallback: If not in database, check if we have hardcoded config
  if (MENU_CONFIGURATIONS[roleKey]) {
    clientLogger.info('Using hardcoded config for customer role', { roleKey })

    const shortCode = getRoutePrefix(roleKey)
    // Apply the same enhancements as getMenuItems to add all menu extensions
    let menuItems = addMyApplicationsToMenu(MENU_CONFIGURATIONS[roleKey])
    menuItems = addOffersToMenu(menuItems)
    menuItems = addReferAFriendToMenu(menuItems)
    menuItems = addDigitalWalletToMenu(menuItems)
    menuItems = addKnowledgeBaseToMenu(menuItems)

    // Create a mock role definition
    const mockRoleDefinition: RoleDefinition = {
      key: roleKey,
      name: roleKey.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' '),
      type: 'CUSTOMER',
      description: `${roleKey} Customer`,
      isActive: true,
      displayOrder: 0
    }

    const menuSections = getMenuSections(roleKey)

    return {
      key: roleKey,
      displayName: mockRoleDefinition.name,
      shortCode,
      route: `/customers/${shortCode}`,
      color: '#FF6700',
      menuItems,
      menuSections,
      roleDefinition: mockRoleDefinition
    }
  }

  clientLogger.warn('Customer role not found and no hardcoded config', { roleKey })
  return null
}

/**
 * Get all active customer configurations
 */
export async function getAllCustomerConfigs(): Promise<CustomerConfig[]> {
  const roleDefinitions = await fetchRoleDefinitionsByType('CUSTOMER')

  const configs = await Promise.all(
    roleDefinitions
      .filter(role => role.isActive)
      .map(role => getCustomerConfig(role.key))
  )

  return configs.filter((config): config is CustomerConfig => config !== null)
}

/**
 * Get customer config by short code (e.g., 'individual', 'salaried', 'pvt-ltd')
 */
export async function getCustomerConfigByShortCode(shortCode: string): Promise<CustomerConfig | null> {
  const allConfigs = await getAllCustomerConfigs()
  return allConfigs.find(config => config.shortCode === shortCode) || null
}

/**
 * Register a new menu configuration for a role
 * This allows extending menu items for newly created roles
 */
export function registerMenuConfiguration(roleKey: string, menuItems: MenuItem[]): void {
  MENU_CONFIGURATIONS[roleKey] = menuItems
}
