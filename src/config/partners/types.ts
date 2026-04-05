/**
 * Partner Type Definitions
 *
 * This file defines all partner types and their configurations.
 * To add a new partner type:
 * 1. Add new entry to PartnerType enum
 * 2. Add configuration to PARTNER_CONFIGS
 * 3. Create folder in src/app/partners/{type}
 * 4. No changes to existing code needed!
 */

import { LucideIcon } from 'lucide-react'

export enum PartnerType {
  BUSINESS_ASSOCIATE = 'BUSINESS_ASSOCIATE',
  BUSINESS_PARTNER = 'BUSINESS_PARTNER',
  CHANNEL_PARTNER = 'CHANNEL_PARTNER',
  // Future partner types can be added here:
  // FRANCHISE_PARTNER = 'FRANCHISE_PARTNER',
  // REGIONAL_PARTNER = 'REGIONAL_PARTNER',
}

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

export interface PartnerConfig {
  type: PartnerType
  displayName: string
  shortCode: string // 'ba', 'bp', 'cp'
  route: string // '/partners/ba'
  color: string // Primary color for this partner type
  menuItems: MenuItem[]
  menuSections?: MenuSection[] // Optional: grouped menu structure like Super Admin
  features: {
    hasBanner?: boolean
    bannerDimensions?: { width: number; height: number }
    hasApplications?: boolean
    hasLeads?: boolean
    hasCustomers?: boolean
  }
  permissions: string[]
}

export const PARTNER_ROUTES = {
  [PartnerType.BUSINESS_ASSOCIATE]: '/partners/ba',
  [PartnerType.BUSINESS_PARTNER]: '/partners/bp',
  [PartnerType.CHANNEL_PARTNER]: '/partners/cp',
} as const

export const PARTNER_SHORT_CODES = {
  [PartnerType.BUSINESS_ASSOCIATE]: 'ba',
  [PartnerType.BUSINESS_PARTNER]: 'bp',
  [PartnerType.CHANNEL_PARTNER]: 'cp',
} as const
