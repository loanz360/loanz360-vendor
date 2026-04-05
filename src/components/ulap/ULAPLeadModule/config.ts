/**
 * ULAP Lead Module Configuration
 * Role-based configuration for the reusable ULAP Lead Module
 */

import type { ULAPModuleConfig, ULAPModuleContext, ULAPSourceType } from './types'

// Default configuration
const DEFAULT_CONFIG: ULAPModuleConfig = {
  showSubmitLead: true,
  showShareLink: true,
  showLeadStatus: true,
  sourceType: 'ULAP_BA',
  labels: {
    moduleTitle: 'Leads Management',
    submitTabLabel: 'Submit a Lead',
    shareTabLabel: 'Share a Link',
    statusTabLabel: 'Lead Status',
    submitButtonLabel: 'Submit Lead',
    successMessage: 'Lead submitted successfully!',
  },
  shareLinkExpiry: 30, // days
  defaultTab: 'submit',
}

// Context to source type mapping
export const CONTEXT_SOURCE_MAP: Record<ULAPModuleContext, ULAPSourceType> = {
  BA: 'ULAP_BA',
  BP: 'ULAP_BP',
  CRO: 'ULAP_CRO',
  DSE: 'ULAP_DSE',
  DIGITAL_SALES: 'ULAP_DIGITAL_SALES',
  TELECALLER: 'ULAP_TELECALLER',
  FIELD_SALES: 'ULAP_FIELD_SALES',
  BDE: 'ULAP_BDE',
  CUSTOMER_SELF: 'ULAP_CUSTOMER',
  CUSTOMER_REFERRAL: 'ULAP_CUSTOMER_REFERRAL',
}

// Source type display names
export const SOURCE_TYPE_LABELS: Record<ULAPSourceType, string> = {
  ULAP_BA: 'Business Associate',
  ULAP_BP: 'Business Partner',
  ULAP_CRO: 'CRO',
  ULAP_DSE: 'Direct Sales Executive',
  ULAP_DIGITAL_SALES: 'Digital Sales',
  ULAP_TELECALLER: 'Telecaller',
  ULAP_FIELD_SALES: 'Field Sales',
  ULAP_BDE: 'Business Development Executive',
  ULAP_CUSTOMER: 'Customer Direct',
  ULAP_CUSTOMER_REFERRAL: 'Customer Referral',
}

// Role-based configurations
export const MODULE_CONFIGS: Record<ULAPModuleContext, Partial<ULAPModuleConfig>> = {
  // Partners
  BA: {
    showShareLink: true,
    sourceType: 'ULAP_BA',
    labels: {
      moduleTitle: 'Leads Management',
      submitTabLabel: 'Submit a Lead',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Lead Status',
      submitButtonLabel: 'Submit Lead',
      successMessage: 'Lead submitted successfully! The customer will receive the Phase 2 form link.',
    },
  },
  BP: {
    showShareLink: true,
    sourceType: 'ULAP_BP',
    labels: {
      moduleTitle: 'Leads Management',
      submitTabLabel: 'Submit a Lead',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Lead Status',
      submitButtonLabel: 'Submit Lead',
      successMessage: 'Lead submitted successfully! The customer will receive the Phase 2 form link.',
    },
  },

  // Employees
  CRO: {
    showShareLink: true,
    sourceType: 'ULAP_CRO',
    labels: {
      moduleTitle: 'Leads Management',
      submitTabLabel: 'Submit a Lead',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Lead Status',
      submitButtonLabel: 'Submit Lead',
      successMessage: 'Lead submitted successfully!',
    },
  },
  DSE: {
    showShareLink: true,
    sourceType: 'ULAP_DSE',
    labels: {
      moduleTitle: 'Leads Management',
      submitTabLabel: 'Submit a Lead',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Lead Status',
      submitButtonLabel: 'Submit Lead',
      successMessage: 'Lead submitted successfully!',
    },
  },
  DIGITAL_SALES: {
    showShareLink: true,
    sourceType: 'ULAP_DIGITAL_SALES',
    labels: {
      moduleTitle: 'Leads Management',
      submitTabLabel: 'Submit a Lead',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Lead Status',
      submitButtonLabel: 'Submit Lead',
      successMessage: 'Lead submitted successfully!',
    },
  },
  TELECALLER: {
    showShareLink: true,
    sourceType: 'ULAP_TELECALLER',
    labels: {
      moduleTitle: 'Leads Management',
      submitTabLabel: 'Submit a Lead',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Lead Status',
      submitButtonLabel: 'Submit Lead',
      successMessage: 'Lead submitted successfully!',
    },
  },
  FIELD_SALES: {
    showShareLink: true,
    sourceType: 'ULAP_FIELD_SALES',
    labels: {
      moduleTitle: 'Leads Management',
      submitTabLabel: 'Submit a Lead',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Lead Status',
      submitButtonLabel: 'Submit Lead',
      successMessage: 'Lead submitted successfully!',
    },
  },
  BDE: {
    showShareLink: true,
    sourceType: 'ULAP_BDE',
    labels: {
      moduleTitle: 'Leads Management',
      submitTabLabel: 'Submit a Lead',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Lead Status',
      submitButtonLabel: 'Submit Lead',
      successMessage: 'Lead submitted successfully!',
    },
  },

  // Customers
  CUSTOMER_SELF: {
    showShareLink: false, // NO share link for self-apply
    sourceType: 'ULAP_CUSTOMER',
    labels: {
      moduleTitle: 'My Applications',
      submitTabLabel: 'Apply for Loan',
      shareTabLabel: '', // Not shown
      statusTabLabel: 'Track Applications',
      submitButtonLabel: 'Submit Application',
      successMessage: 'Application submitted successfully! You will receive a link to complete the detailed form.',
    },
    defaultTab: 'submit',
  },
  CUSTOMER_REFERRAL: {
    showShareLink: true, // Has share link
    sourceType: 'ULAP_CUSTOMER_REFERRAL',
    labels: {
      moduleTitle: 'Refer a Customer',
      submitTabLabel: 'Submit a Referral',
      shareTabLabel: 'Share a Link',
      statusTabLabel: 'Status of Referrals',
      submitButtonLabel: 'Submit Referral',
      successMessage: 'Referral submitted successfully! The customer will receive the application link.',
    },
    defaultTab: 'submit',
  },
}

/**
 * Get the complete configuration for a given context
 * Merges default config with context-specific overrides
 */
export function getModuleConfig(context: ULAPModuleContext): ULAPModuleConfig {
  const contextConfig = MODULE_CONFIGS[context] || {}

  return {
    ...DEFAULT_CONFIG,
    ...contextConfig,
    sourceType: CONTEXT_SOURCE_MAP[context],
    labels: {
      ...DEFAULT_CONFIG.labels,
      ...(contextConfig.labels || {}),
    },
  }
}

/**
 * Get visible tabs based on configuration
 */
export function getVisibleTabs(config: ULAPModuleConfig): Array<'submit' | 'share' | 'status'> {
  const tabs: Array<'submit' | 'share' | 'status'> = []

  if (config.showSubmitLead) tabs.push('submit')
  if (config.showShareLink) tabs.push('share')
  if (config.showLeadStatus) tabs.push('status')

  return tabs
}

/**
 * Get source type display label
 */
export function getSourceTypeLabel(sourceType: ULAPSourceType): string {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType
}
