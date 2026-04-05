/**
 * ULAP Lead Module - Main Export
 * Reusable lead management module for all stakeholder portals
 */

// Main component
export { ULAPLeadModule, default } from './ULAPLeadModule'

// Types
export type {
  ULAPModuleContext,
  ULAPModuleConfig,
  ULAPLeadModuleProps,
  ULAPUserContext,
  ULAPLeadSubmission,
  ULAPSubmitResponse,
  ULAPShareLink,
  ULAPLeadStatusItem,
  ULAPLeadFilters,
  ULAPLeadsResponse,
  ULAPSourceType,
  ULAPTab,
} from './types'

// Configuration
export { getModuleConfig, getVisibleTabs, getSourceTypeLabel, MODULE_CONFIGS, CONTEXT_SOURCE_MAP, SOURCE_TYPE_LABELS } from './config'

// Hooks
export { useUserContext } from './hooks/useUserContext'
export { useLeadModule } from './hooks/useLeadModule'
export { useShareLink } from './hooks/useShareLink'

// Tab components (for custom implementations)
export { SubmitLeadTab, ShareLinkTab, LeadStatusTab } from './tabs'
