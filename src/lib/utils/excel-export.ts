/**
 * Excel Export Utility
 * Provides functions to export data to Excel format
 */

interface TeamProposalExportData {
  deal_id: string
  customer_name: string
  phone: string
  email: string | null
  location: string | null
  loan_type: string
  loan_amount: number
  loan_purpose: string | null
  current_stage: string
  current_status: string
  dse_name: string
  bde_name: string
  assigned_at: string | null
  last_update_at: string | null
  sanctioned_amount: number | null
  disbursed_amount: number | null
  days_since_assignment: number
  is_overdue: boolean
  created_at: string
}

/**
 * Convert team proposals data to CSV format
 */
export function exportTeamProposalsToCSV(proposals: TeamProposalExportData[]): string {
  const headers = [
    'Deal ID',
    'Customer Name',
    'Phone',
    'Email',
    'Location',
    'Loan Type',
    'Loan Amount (₹)',
    'Loan Purpose',
    'Current Stage',
    'Current Status',
    'Created By (DSE)',
    'Assigned BDE',
    'Assigned Date',
    'Last Update',
    'Sanctioned Amount (₹)',
    'Disbursed Amount (₹)',
    'Days Active',
    'Overdue',
    'Created Date'
  ]

  const rows = proposals.map(proposal => [
    proposal.deal_id,
    proposal.customer_name,
    proposal.phone,
    proposal.email || '',
    proposal.location || '',
    proposal.loan_type,
    proposal.loan_amount.toString(),
    proposal.loan_purpose || '',
    formatStageLabel(proposal.current_stage),
    formatStatusLabel(proposal.current_status),
    proposal.dse_name,
    proposal.bde_name,
    proposal.assigned_at ? formatDate(proposal.assigned_at) : '',
    proposal.last_update_at ? formatDate(proposal.last_update_at) : '',
    proposal.sanctioned_amount?.toString() || '',
    proposal.disbursed_amount?.toString() || '',
    proposal.days_since_assignment.toString(),
    proposal.is_overdue ? 'Yes' : 'No',
    formatDate(proposal.created_at)
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export team proposals to Excel (CSV)
 */
export function exportTeamProposalsToExcel(
  proposals: TeamProposalExportData[],
  filename: string = `team-proposals-${new Date().toISOString().split('T')[0]}.csv`
) {
  const csvContent = exportTeamProposalsToCSV(proposals)
  downloadCSV(csvContent, filename)
}

/**
 * Export team statistics to Excel (CSV)
 */
export function exportTeamStatsToExcel(
  stats: Array<{
    dse_name: string
    dse_email: string
    total_proposals: number
    in_progress: number
    sanctioned: number
    disbursed: number
    dropped: number
    overdue: number
    total_loan_amount: number
    total_sanctioned_amount: number
    total_disbursed_amount: number
  }>,
  filename: string = `team-statistics-${new Date().toISOString().split('T')[0]}.csv`
) {
  const headers = [
    'DSE Name',
    'Email',
    'Total Proposals',
    'In Progress',
    'Sanctioned',
    'Disbursed',
    'Dropped',
    'Overdue',
    'Total Loan Amount (₹)',
    'Total Sanctioned (₹)',
    'Total Disbursed (₹)'
  ]

  const rows = stats.map(stat => [
    stat.dse_name,
    stat.dse_email,
    stat.total_proposals.toString(),
    stat.in_progress.toString(),
    stat.sanctioned.toString(),
    stat.disbursed.toString(),
    stat.dropped.toString(),
    stat.overdue.toString(),
    stat.total_loan_amount.toString(),
    stat.total_sanctioned_amount.toString(),
    stat.total_disbursed_amount.toString()
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  downloadCSV(csvContent, filename)
}

// Helper functions
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatStageLabel(stage: string): string {
  const stageLabels: Record<string, string> = {
    docs_collected: 'Documents Collected',
    finalized_bank: 'Bank Finalized',
    login_complete: 'Login Completed',
    post_login_pending_cleared: 'Pendings Cleared',
    process_started_at_bank: 'Bank Processing',
    case_assessed_by_banker: 'Case Assessed',
    pd_complete: 'PD Complete',
    sanctioned: 'Sanctioned',
    disbursed: 'Disbursed',
    dropped: 'Dropped'
  }
  return stageLabels[stage] || stage
}

function formatStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    in_progress: 'In Progress',
    sanctioned: 'Sanctioned',
    disbursed: 'Disbursed',
    dropped: 'Dropped'
  }
  return statusLabels[status] || status
}
