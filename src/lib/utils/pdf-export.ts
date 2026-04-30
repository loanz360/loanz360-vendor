import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface AttendanceData {
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  totalHours: number | null
  isLate: boolean
  lateByMinutes?: number
}

interface LeaveData {
  leaveType: string
  fromDate: string
  toDate: string
  totalDays: number
  status: string
  appliedOn: string
  reason: string
}

interface EmployeeInfo {
  name: string
  employeeId: string
  department: string
  designation: string
}

export const exportAttendanceReport = (
  data: AttendanceData[],
  employeeInfo: EmployeeInfo,
  month: string,
  year: number
) => {
  const doc = new jsPDF()

  // Add title
  doc.setFontSize(18)
  doc.text('Attendance Report', 14, 20)

  // Add employee info
  doc.setFontSize(11)
  doc.text(`Employee: ${employeeInfo.name} (${employeeInfo.employeeId})`, 14, 30)
  doc.text(`Department: ${employeeInfo.department}`, 14, 36)
  doc.text(`Designation: ${employeeInfo.designation}`, 14, 42)
  doc.text(`Period: ${month} ${year}`, 14, 48)

  // Calculate statistics
  const totalDays = data.length
  const presentDays = data.filter(d => d.status === 'present' || d.status === 'half_day').length
  const lateDays = data.filter(d => d.isLate).length
  const absentDays = data.filter(d => d.status === 'absent').length

  doc.text(`Total Working Days: ${totalDays}`, 14, 58)
  doc.text(`Present Days: ${presentDays}`, 14, 64)
  doc.text(`Late Days: ${lateDays}`, 14, 70)
  doc.text(`Absent Days: ${absentDays}`, 14, 76)

  // Add attendance table
  const tableData = data.map(record => [
    new Date(record.date).toLocaleDateString(),
    record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }) : '-',
    record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }) : '-',
    record.totalHours ? `${record.totalHours.toFixed(2)}h` : '-',
    record.status.toUpperCase(),
    record.isLate ? `Late (${record.lateByMinutes || 0}m)` : 'On Time'
  ])

  autoTable(doc, {
    startY: 85,
    head: [['Date', 'Check In', 'Check Out', 'Hours', 'Status', 'Punctuality']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [255, 107, 0] },
    styles: { fontSize: 9 }
  })

  // Add footer
  const pageCount = (doc as unknown).internal.getNumberOfPages()
  doc.setFontSize(8)
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    14,
    doc.internal.pageSize.height - 10
  )
  doc.text(
    `Page ${pageCount}`,
    doc.internal.pageSize.width - 30,
    doc.internal.pageSize.height - 10
  )

  // Save the PDF
  doc.save(`Attendance_${employeeInfo.employeeId}_${month}_${year}.pdf`)
}

export const exportLeaveReport = (
  data: LeaveData[],
  employeeInfo: EmployeeInfo,
  year: number
) => {
  const doc = new jsPDF()

  // Add title
  doc.setFontSize(18)
  doc.text('Leave History Report', 14, 20)

  // Add employee info
  doc.setFontSize(11)
  doc.text(`Employee: ${employeeInfo.name} (${employeeInfo.employeeId})`, 14, 30)
  doc.text(`Department: ${employeeInfo.department}`, 14, 36)
  doc.text(`Designation: ${employeeInfo.designation}`, 14, 42)
  doc.text(`Year: ${year}`, 14, 48)

  // Calculate statistics
  const totalLeaves = data.reduce((sum, l) => sum + l.totalDays, 0)
  const approvedLeaves = data.filter(l => l.status === 'approved').length
  const pendingLeaves = data.filter(l => l.status === 'pending').length
  const rejectedLeaves = data.filter(l => l.status === 'rejected').length

  doc.text(`Total Leave Requests: ${data.length}`, 14, 58)
  doc.text(`Total Leave Days: ${totalLeaves}`, 14, 64)
  doc.text(`Approved: ${approvedLeaves} | Pending: ${pendingLeaves} | Rejected: ${rejectedLeaves}`, 14, 70)

  // Add leave table
  const tableData = data.map(leave => [
    leave.leaveType,
    new Date(leave.fromDate).toLocaleDateString(),
    new Date(leave.toDate).toLocaleDateString(),
    leave.totalDays.toString(),
    leave.status.toUpperCase(),
    leave.reason.substring(0, 40) + (leave.reason.length > 40 ? '...' : '')
  ])

  autoTable(doc, {
    startY: 80,
    head: [['Type', 'From Date', 'To Date', 'Days', 'Status', 'Reason']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [255, 107, 0] },
    styles: { fontSize: 9 },
    columnStyles: {
      5: { cellWidth: 60 }
    }
  })

  // Add footer
  const pageCount = (doc as unknown).internal.getNumberOfPages()
  doc.setFontSize(8)
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    14,
    doc.internal.pageSize.height - 10
  )
  doc.text(
    `Page ${pageCount}`,
    doc.internal.pageSize.width - 30,
    doc.internal.pageSize.height - 10
  )

  // Save the PDF
  doc.save(`Leave_History_${employeeInfo.employeeId}_${year}.pdf`)
}

export const exportMonthlyReport = (
  attendanceData: AttendanceData[],
  leaveData: LeaveData[],
  employeeInfo: EmployeeInfo,
  month: string,
  year: number
) => {
  const doc = new jsPDF()

  // Add title
  doc.setFontSize(18)
  doc.text('Monthly Summary Report', 14, 20)

  // Add employee info
  doc.setFontSize(11)
  doc.text(`Employee: ${employeeInfo.name} (${employeeInfo.employeeId})`, 14, 30)
  doc.text(`Department: ${employeeInfo.department}`, 14, 36)
  doc.text(`Designation: ${employeeInfo.designation}`, 14, 42)
  doc.text(`Period: ${month} ${year}`, 14, 48)

  // Attendance Summary
  doc.setFontSize(14)
  doc.text('Attendance Summary', 14, 60)

  const totalDays = attendanceData.length
  const presentDays = attendanceData.filter(d => d.status === 'present' || d.status === 'half_day').length
  const lateDays = attendanceData.filter(d => d.isLate).length
  const absentDays = attendanceData.filter(d => d.status === 'absent').length
  const totalHours = attendanceData.reduce((sum, d) => sum + (d.totalHours || 0), 0)

  doc.setFontSize(10)
  doc.text(`Working Days: ${totalDays}`, 20, 68)
  doc.text(`Present: ${presentDays}`, 20, 74)
  doc.text(`Late: ${lateDays}`, 20, 80)
  doc.text(`Absent: ${absentDays}`, 20, 86)
  doc.text(`Total Hours: ${totalHours.toFixed(2)}h`, 20, 92)
  doc.text(`Average Hours/Day: ${(totalHours / presentDays || 0).toFixed(2)}h`, 20, 98)

  // Leave Summary
  const monthLeaves = leaveData.filter(l => {
    const fromDate = new Date(l.fromDate)
    return fromDate.getMonth() === new Date(`${month} 1, ${year}`).getMonth() &&
           fromDate.getFullYear() === year
  })

  if (monthLeaves.length > 0) {
    doc.setFontSize(14)
    doc.text('Leave Summary', 14, 110)

    const totalLeaveDays = monthLeaves.reduce((sum, l) => sum + l.totalDays, 0)

    doc.setFontSize(10)
    doc.text(`Leave Requests: ${monthLeaves.length}`, 20, 118)
    doc.text(`Total Leave Days: ${totalLeaveDays}`, 20, 124)

    // Leave table
    const leaveTableData = monthLeaves.map(leave => [
      leave.leaveType,
      new Date(leave.fromDate).toLocaleDateString(),
      new Date(leave.toDate).toLocaleDateString(),
      leave.totalDays.toString(),
      leave.status.toUpperCase()
    ])

    autoTable(doc, {
      startY: 130,
      head: [['Type', 'From', 'To', 'Days', 'Status']],
      body: leaveTableData,
      theme: 'striped',
      headStyles: { fillColor: [255, 107, 0] },
      styles: { fontSize: 9 }
    })
  }

  // Add footer
  const pageCount = (doc as unknown).internal.getNumberOfPages()
  doc.setFontSize(8)
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    14,
    doc.internal.pageSize.height - 10
  )
  doc.text(
    `Page ${pageCount}`,
    doc.internal.pageSize.width - 30,
    doc.internal.pageSize.height - 10
  )

  // Save the PDF
  doc.save(`Monthly_Report_${employeeInfo.employeeId}_${month}_${year}.pdf`)
}

// ============================================================================
// PROPOSAL PDF EXPORT
// ============================================================================

interface ProposalDetailForPDF {
  deal_id: string
  customer_name: string
  phone: string
  email: string | null
  location: string | null
  loan_type: string
  loan_amount: number
  loan_purpose: string | null
  business_name: string | null
  current_stage: string
  current_status: string
  dse_name?: string
  bde_name: string
  assigned_at: string | null
  last_update_at: string | null
  sanctioned_amount: number | null
  disbursed_amount: number | null
  days_since_assignment: number
  created_at: string
  sanctioned_at: string | null
  disbursed_at: string | null
  dropped_at: string | null
  drop_reason: string | null
  updates: Array<{
    bde_name: string
    notes_original: string | null
    activity_type: string | null
    created_at: string
  }>
  stage_history: Array<{
    from_stage: string | null
    to_stage: string
    changed_by_name: string | null
    created_at: string
  }>
}

export const exportProposalToPDF = (proposal: ProposalDetailForPDF) => {
  const doc = new jsPDF()

  const formatCurrency = (value: number | null) => {
    if (!value) return '₹0'
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)} K`
    return `₹${value}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatStageLabel = (stage: string): string => {
    const labels: Record<string, string> = {
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
    return labels[stage] || stage
  }

  const formatStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      in_progress: 'In Progress',
      sanctioned: 'Sanctioned',
      disbursed: 'Disbursed',
      dropped: 'Dropped'
    }
    return labels[status] || status
  }

  let yPos = 20

  // Add title
  doc.setFontSize(18)
  doc.setTextColor(255, 107, 0) // Orange
  doc.text('Proposal Details Report', 14, yPos)
  yPos += 10

  // Add customer name
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text(proposal.customer_name, 14, yPos)
  yPos += 6

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Deal ID: ${proposal.deal_id}`, 14, yPos)
  yPos += 10

  // Customer Information
  doc.setFontSize(12)
  doc.setTextColor(255, 107, 0)
  doc.text('Customer Information', 14, yPos)
  yPos += 7

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(`Phone: ${proposal.phone}`, 14, yPos)
  yPos += 5
  if (proposal.email) {
    doc.text(`Email: ${proposal.email}`, 14, yPos)
    yPos += 5
  }
  if (proposal.location) {
    doc.text(`Location: ${proposal.location}`, 14, yPos)
    yPos += 5
  }
  if (proposal.business_name) {
    doc.text(`Business: ${proposal.business_name}`, 14, yPos)
    yPos += 5
  }
  yPos += 5

  // Loan Information
  doc.setFontSize(12)
  doc.setTextColor(255, 107, 0)
  doc.text('Loan Information', 14, yPos)
  yPos += 7

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(`Type: ${proposal.loan_type}`, 14, yPos)
  yPos += 5
  doc.text(`Amount: ${formatCurrency(proposal.loan_amount)}`, 14, yPos)
  yPos += 5
  if (proposal.loan_purpose) {
    doc.text(`Purpose: ${proposal.loan_purpose}`, 14, yPos)
    yPos += 5
  }
  doc.text(`Status: ${formatStatusLabel(proposal.current_status)}`, 14, yPos)
  yPos += 5
  doc.text(`Stage: ${formatStageLabel(proposal.current_stage)}`, 14, yPos)
  yPos += 5

  if (proposal.sanctioned_amount) {
    doc.setTextColor(0, 150, 100)
    doc.text(`Sanctioned: ${formatCurrency(proposal.sanctioned_amount)}`, 14, yPos)
    yPos += 5
  }
  if (proposal.disbursed_amount) {
    doc.text(`Disbursed: ${formatCurrency(proposal.disbursed_amount)}`, 14, yPos)
    yPos += 5
  }
  yPos += 5

  // Team Information
  doc.setFontSize(12)
  doc.setTextColor(255, 107, 0)
  doc.text('Team Information', 14, yPos)
  yPos += 7

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  if (proposal.dse_name) {
    doc.text(`Created By (DSE): ${proposal.dse_name}`, 14, yPos)
    yPos += 5
  }
  doc.text(`Assigned BDE: ${proposal.bde_name || 'Not Assigned'}`, 14, yPos)
  yPos += 5
  doc.text(`Assigned On: ${formatDate(proposal.assigned_at)}`, 14, yPos)
  yPos += 5
  doc.text(`Last Update: ${formatDate(proposal.last_update_at)}`, 14, yPos)
  yPos += 5
  doc.text(`Days Active: ${proposal.days_since_assignment} days`, 14, yPos)
  yPos += 10

  // Important Dates
  doc.setFontSize(12)
  doc.setTextColor(255, 107, 0)
  doc.text('Important Dates', 14, yPos)
  yPos += 7

  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(`Created: ${formatDate(proposal.created_at)}`, 14, yPos)
  yPos += 5
  if (proposal.sanctioned_at) {
    doc.text(`Sanctioned: ${formatDate(proposal.sanctioned_at)}`, 14, yPos)
    yPos += 5
  }
  if (proposal.disbursed_at) {
    doc.text(`Disbursed: ${formatDate(proposal.disbursed_at)}`, 14, yPos)
    yPos += 5
  }
  if (proposal.dropped_at) {
    doc.text(`Dropped: ${formatDate(proposal.dropped_at)}`, 14, yPos)
    yPos += 5
  }
  yPos += 5

  // Drop Reason
  if (proposal.drop_reason) {
    doc.setFontSize(12)
    doc.setTextColor(200, 0, 0)
    doc.text('Drop Reason', 14, yPos)
    yPos += 7

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    const dropReasonLines = doc.splitTextToSize(proposal.drop_reason, 180)
    doc.text(dropReasonLines, 14, yPos)
    yPos += (dropReasonLines.length * 5) + 5
  }

  // BDE Updates Table
  if (proposal.updates && proposal.updates.length > 0) {
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(12)
    doc.setTextColor(255, 107, 0)
    doc.text('BDE Updates Timeline', 14, yPos)
    yPos += 7

    const updatesTableData = proposal.updates.slice(0, 10).map((update) => [
      formatDate(update.created_at),
      update.bde_name,
      update.activity_type || '-',
      (update.notes_original || '-').substring(0, 50) + (update.notes_original && update.notes_original.length > 50 ? '...' : '')
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'BDE', 'Activity', 'Notes']],
      body: updatesTableData,
      theme: 'striped',
      headStyles: { fillColor: [255, 107, 0] },
      styles: { fontSize: 8 },
      columnStyles: {
        3: { cellWidth: 80 }
      }
    })

    yPos = (doc as unknown).lastAutoTable.finalY + 10
  }

  // Stage History Table
  if (proposal.stage_history && proposal.stage_history.length > 0) {
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(12)
    doc.setTextColor(255, 107, 0)
    doc.text('Stage History', 14, yPos)
    yPos += 7

    const historyTableData = proposal.stage_history.map((history) => [
      formatDate(history.created_at),
      history.from_stage ? formatStageLabel(history.from_stage) : '-',
      formatStageLabel(history.to_stage),
      history.changed_by_name || 'System'
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'From Stage', 'To Stage', 'Changed By']],
      body: historyTableData,
      theme: 'striped',
      headStyles: { fillColor: [255, 107, 0] },
      styles: { fontSize: 8 }
    })
  }

  // Add footer
  const pageCount = (doc as unknown).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      14,
      doc.internal.pageSize.height - 10
    )
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 30,
      doc.internal.pageSize.height - 10
    )
  }

  // Save the PDF
  doc.save(`Proposal_${proposal.customer_name.replace(/\s+/g, '_')}_${proposal.deal_id.substring(0, 8)}.pdf`)
}
