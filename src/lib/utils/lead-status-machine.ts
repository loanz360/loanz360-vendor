/**
 * Lead Status State Machine
 * Defines valid status transitions to prevent invalid state changes
 */

export const LEAD_STATUSES = [
  'NEW',
  'NEW_UNASSIGNED',
  'PENDING',
  'CONTACTED',
  'IN_PROGRESS',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_COLLECTED',
  'BANK_LOGIN',
  'CREDIT_MANAGER',
  'PROCESSING',
  'SANCTIONED',
  'DISBURSED',
  'REJECTED',
  'BANK_REJECTED',
  'DROPPED',
  'CANCELLED',
  'DEAD',
  'ON_HOLD',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

/**
 * Valid status transitions map
 * Key = current status, Value = array of allowed next statuses
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['NEW_UNASSIGNED', 'PENDING', 'CONTACTED', 'IN_PROGRESS', 'DROPPED', 'CANCELLED', 'DEAD'],
  NEW_UNASSIGNED: ['PENDING', 'CONTACTED', 'IN_PROGRESS', 'DROPPED', 'CANCELLED', 'DEAD'],
  PENDING: ['CONTACTED', 'IN_PROGRESS', 'DOCUMENTS_PENDING', 'DROPPED', 'CANCELLED', 'DEAD', 'ON_HOLD'],
  CONTACTED: ['IN_PROGRESS', 'DOCUMENTS_PENDING', 'DROPPED', 'CANCELLED', 'DEAD', 'ON_HOLD'],
  IN_PROGRESS: ['DOCUMENTS_PENDING', 'DOCUMENTS_COLLECTED', 'BANK_LOGIN', 'DROPPED', 'CANCELLED', 'DEAD', 'ON_HOLD'],
  DOCUMENTS_PENDING: ['DOCUMENTS_COLLECTED', 'IN_PROGRESS', 'DROPPED', 'CANCELLED', 'DEAD', 'ON_HOLD'],
  DOCUMENTS_COLLECTED: ['BANK_LOGIN', 'PROCESSING', 'DROPPED', 'CANCELLED', 'ON_HOLD'],
  BANK_LOGIN: ['CREDIT_MANAGER', 'PROCESSING', 'SANCTIONED', 'REJECTED', 'BANK_REJECTED', 'DROPPED', 'ON_HOLD'],
  CREDIT_MANAGER: ['PROCESSING', 'SANCTIONED', 'REJECTED', 'BANK_REJECTED', 'ON_HOLD'],
  PROCESSING: ['SANCTIONED', 'REJECTED', 'BANK_REJECTED', 'ON_HOLD'],
  SANCTIONED: ['DISBURSED', 'CANCELLED', 'ON_HOLD'],
  DISBURSED: [], // Terminal state
  REJECTED: ['IN_PROGRESS', 'DEAD'], // Can be re-initiated
  BANK_REJECTED: ['IN_PROGRESS', 'DEAD'], // Can be re-initiated with different bank
  DROPPED: ['IN_PROGRESS', 'DEAD'], // Can be revived
  CANCELLED: ['DEAD'], // Near-terminal
  DEAD: [], // Terminal state
  ON_HOLD: ['IN_PROGRESS', 'DOCUMENTS_PENDING', 'BANK_LOGIN', 'PROCESSING', 'DROPPED', 'CANCELLED'],
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(currentStatus: string, newStatus: string): boolean {
  const validNextStatuses = VALID_TRANSITIONS[currentStatus]
  if (!validNextStatuses) return false
  return validNextStatuses.includes(newStatus)
}

/**
 * Get allowed next statuses for a given current status
 */
export function getNextStatuses(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] || []
}

/**
 * Status display labels and colors
 */
export const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  NEW: { label: 'New', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  NEW_UNASSIGNED: { label: 'Unassigned', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  PENDING: { label: 'Pending', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  CONTACTED: { label: 'Contacted', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  DOCUMENTS_PENDING: { label: 'Docs Pending', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  DOCUMENTS_COLLECTED: { label: 'Docs Collected', color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
  BANK_LOGIN: { label: 'Bank Login', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  CREDIT_MANAGER: { label: 'Credit Manager', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  PROCESSING: { label: 'Processing', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  SANCTIONED: { label: 'Sanctioned', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  DISBURSED: { label: 'Disbursed', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  REJECTED: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  BANK_REJECTED: { label: 'Bank Rejected', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  DROPPED: { label: 'Dropped', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-600/20' },
  DEAD: { label: 'Dead', color: 'text-gray-600', bgColor: 'bg-gray-700/20' },
  ON_HOLD: { label: 'On Hold', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
}
