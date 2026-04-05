// Professional Payslip PDF Template
// Uses @react-pdf/renderer for PDF generation

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font
} from '@react-pdf/renderer'
import type { PayslipData, PayslipGenerationOptions } from '../types'
import { formatCurrency, formatDate, getMonthName } from '../types'

// Register fonts (optional - for better typography)
// Font.register({
//   family: 'Roboto',
//   src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular.ttf'
// })

// Styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    fontSize: 60,
    color: '#f0f0f0',
    opacity: 0.3,
    transform: 'rotate(-45deg)',
    zIndex: -1,
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: '2 solid #2563eb',
  },
  companyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyLogo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
  },
  companyDetails: {
    flex: 1,
    marginLeft: 15,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  companyAddress: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  payslipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1e40af',
    marginTop: 10,
    marginBottom: 5,
  },
  payslipSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 15,
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 5,
  },
  infoColumn: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    fontSize: 9,
    color: '#6b7280',
    width: 120,
  },
  infoValue: {
    fontSize: 9,
    color: '#111827',
    fontWeight: 'bold',
    flex: 1,
  },
  attendanceSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 5,
    borderLeft: '4 solid #f59e0b',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  attendanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceItem: {
    alignItems: 'center',
  },
  attendanceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  attendanceLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  salarySection: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  earningsSection: {
    flex: 1,
    marginRight: 10,
  },
  deductionsSection: {
    flex: 1,
  },
  salaryTable: {
    border: '1 solid #e5e7eb',
    borderRadius: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  tableHeaderAmount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    width: 80,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '1 solid #e5e7eb',
  },
  tableRowEven: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 9,
    color: '#374151',
    flex: 1,
  },
  tableCellAmount: {
    fontSize: 9,
    color: '#374151',
    width: 80,
    textAlign: 'right',
  },
  tableFooter: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#dbeafe',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  tableFooterText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e40af',
    flex: 1,
  },
  tableFooterAmount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e40af',
    width: 80,
    textAlign: 'right',
  },
  netSalarySection: {
    padding: 15,
    backgroundColor: '#dcfce7',
    borderRadius: 5,
    border: '2 solid #16a34a',
    marginBottom: 15,
  },
  netSalaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netSalaryLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#166534',
  },
  netSalaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#166534',
  },
  netSalaryWords: {
    fontSize: 9,
    color: '#166534',
    marginTop: 5,
    fontStyle: 'italic',
  },
  employerContributionsSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 5,
    borderLeft: '4 solid #0284c7',
  },
  ytdSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 5,
  },
  ytdGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  ytdItem: {
    flex: 1,
  },
  remarksSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 5,
    borderLeft: '4 solid #fbbf24',
  },
  remarksText: {
    fontSize: 9,
    color: '#92400e',
    lineHeight: 1.4,
  },
  footer: {
    marginTop: 20,
    paddingTop: 15,
    borderTop: '1 solid #e5e7eb',
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  signatureBox: {
    width: 150,
    alignItems: 'center',
  },
  signatureImage: {
    width: 100,
    height: 40,
    marginBottom: 5,
  },
  signatureLine: {
    width: '100%',
    borderTop: '1 solid #9ca3af',
    marginBottom: 5,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
  },
  signatureDesignation: {
    fontSize: 8,
    color: '#6b7280',
  },
  disclaimer: {
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 1.4,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 15,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#9ca3af',
  },
})

interface PayslipTemplateProps {
  data: PayslipData
  options?: PayslipGenerationOptions
}

export const PayslipTemplate: React.FC<PayslipTemplateProps> = ({ data, options = {} }) => {
  // Convert number to words (Indian format)
  const numberToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']

    if (num === 0) return 'Zero Rupees Only'

    const crores = Math.floor(num / 10000000)
    const lakhs = Math.floor((num % 10000000) / 100000)
    const thousands = Math.floor((num % 100000) / 1000)
    const hundreds = Math.floor((num % 1000) / 100)
    const remainder = Math.floor(num % 100)

    let words = ''

    if (crores > 0) words += ones[crores] + ' Crore '
    if (lakhs > 0) words += (lakhs < 10 ? ones[lakhs] : tens[Math.floor(lakhs / 10)] + ' ' + ones[lakhs % 10]) + ' Lakh '
    if (thousands > 0) words += (thousands < 10 ? ones[thousands] : tens[Math.floor(thousands / 10)] + ' ' + ones[thousands % 10]) + ' Thousand '
    if (hundreds > 0) words += ones[hundreds] + ' Hundred '
    if (remainder >= 20) words += tens[Math.floor(remainder / 10)] + ' ' + ones[remainder % 10]
    else if (remainder >= 10) words += teens[remainder - 10]
    else if (remainder > 0) words += ones[remainder]

    return words.trim() + ' Rupees Only'
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark */}
        {(options.includeWatermark || data.isDraft) && (
          <Text style={styles.watermark}>
            {options.watermarkText || (data.isDraft ? 'DRAFT' : 'CONFIDENTIAL')}
          </Text>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            {options.includeCompanyLogo && data.companyLogo && (
              <Image src={data.companyLogo} style={styles.companyLogo} />
            )}
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{data.companyName}</Text>
              <Text style={styles.companyAddress}>{data.companyAddress}</Text>
            </View>
          </View>
          <Text style={styles.payslipTitle}>SALARY SLIP</Text>
          <Text style={styles.payslipSubtitle}>
            {getMonthName(data.month)} {data.year}
          </Text>
        </View>

        {/* Employee Information */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Employee Name:</Text>
              <Text style={styles.infoValue}>{data.employeeName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Employee ID:</Text>
              <Text style={styles.infoValue}>{data.employeeId}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Designation:</Text>
              <Text style={styles.infoValue}>{data.designation}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Department:</Text>
              <Text style={styles.infoValue}>{data.department}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date of Joining:</Text>
              <Text style={styles.infoValue}>{formatDate(data.dateOfJoining)}</Text>
            </View>
          </View>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payslip No:</Text>
              <Text style={styles.infoValue}>{data.payslipNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pay Period:</Text>
              <Text style={styles.infoValue}>
                {formatDate(data.periodStartDate)} to {formatDate(data.periodEndDate)}
              </Text>
            </View>
            {data.paymentDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Date:</Text>
                <Text style={styles.infoValue}>{formatDate(data.paymentDate)}</Text>
              </View>
            )}
            {data.panNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>PAN:</Text>
                <Text style={styles.infoValue}>{data.panNumber}</Text>
              </View>
            )}
            {data.uanNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>UAN:</Text>
                <Text style={styles.infoValue}>{data.uanNumber}</Text>
              </View>
            )}
            {data.bankAccountNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bank A/C:</Text>
                <Text style={styles.infoValue}>
                  {data.bankAccountNumber.replace(/^(.{4})(.*)(.{4})$/, '$1****$3')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Attendance Summary */}
        <View style={styles.attendanceSection}>
          <Text style={styles.sectionTitle}>Attendance Summary</Text>
          <View style={styles.attendanceGrid}>
            <View style={styles.attendanceItem}>
              <Text style={styles.attendanceValue}>{data.totalWorkingDays}</Text>
              <Text style={styles.attendanceLabel}>Working Days</Text>
            </View>
            <View style={styles.attendanceItem}>
              <Text style={styles.attendanceValue}>{data.daysPresent}</Text>
              <Text style={styles.attendanceLabel}>Present</Text>
            </View>
            <View style={styles.attendanceItem}>
              <Text style={styles.attendanceValue}>{data.leavesTaken}</Text>
              <Text style={styles.attendanceLabel}>Leaves</Text>
            </View>
            <View style={styles.attendanceItem}>
              <Text style={styles.attendanceValue}>{data.lopDays}</Text>
              <Text style={styles.attendanceLabel}>LOP Days</Text>
            </View>
          </View>
        </View>

        {/* Earnings and Deductions */}
        <View style={styles.salarySection}>
          {/* Earnings */}
          <View style={styles.earningsSection}>
            <View style={styles.salaryTable}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderText}>EARNINGS</Text>
                <Text style={styles.tableHeaderAmount}>AMOUNT</Text>
              </View>
              {Object.entries(data.earnings).map(([key, value], index) => {
                if (!value || value === 0) return null
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                return (
                  <View key={key} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                    <Text style={styles.tableCell}>{label}</Text>
                    <Text style={styles.tableCellAmount}>{formatCurrency(value)}</Text>
                  </View>
                )
              })}
              <View style={styles.tableFooter}>
                <Text style={styles.tableFooterText}>Gross Salary</Text>
                <Text style={styles.tableFooterAmount}>{formatCurrency(data.grossSalary)}</Text>
              </View>
            </View>
          </View>

          {/* Deductions */}
          <View style={styles.deductionsSection}>
            <View style={styles.salaryTable}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderText}>DEDUCTIONS</Text>
                <Text style={styles.tableHeaderAmount}>AMOUNT</Text>
              </View>
              {Object.entries(data.deductions).map(([key, value], index) => {
                if (!value || value === 0 || key.includes('Employer')) return null
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                return (
                  <View key={key} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                    <Text style={styles.tableCell}>{label}</Text>
                    <Text style={styles.tableCellAmount}>{formatCurrency(value)}</Text>
                  </View>
                )
              })}
              <View style={styles.tableFooter}>
                <Text style={styles.tableFooterText}>Total Deductions</Text>
                <Text style={styles.tableFooterAmount}>{formatCurrency(data.totalDeductions)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Net Salary */}
        <View style={styles.netSalarySection}>
          <View style={styles.netSalaryRow}>
            <Text style={styles.netSalaryLabel}>Net Salary (Take Home)</Text>
            <Text style={styles.netSalaryAmount}>{formatCurrency(data.netSalary)}</Text>
          </View>
          <Text style={styles.netSalaryWords}>{numberToWords(data.netSalary)}</Text>
        </View>

        {/* Employer Contributions */}
        {options.showEmployerContributions && (
          <View style={styles.employerContributionsSection}>
            <Text style={styles.sectionTitle}>Employer Contributions (Not deducted from salary)</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Employer PF Contribution:</Text>
              <Text style={styles.infoValue}>{formatCurrency(data.employerContributions.pfEmployer)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Employer ESI Contribution:</Text>
              <Text style={styles.infoValue}>{formatCurrency(data.employerContributions.esiEmployer)}</Text>
            </View>
            {options.showCtc && data.ctc && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cost to Company (CTC):</Text>
                <Text style={styles.infoValue}>{formatCurrency(data.ctc)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Year-to-Date */}
        {options.showYTD && data.ytd && (
          <View style={styles.ytdSection}>
            <Text style={styles.sectionTitle}>Year-to-Date (YTD) Summary</Text>
            <View style={styles.ytdGrid}>
              <View style={styles.ytdItem}>
                <Text style={styles.infoLabel}>YTD Gross:</Text>
                <Text style={styles.infoValue}>{formatCurrency(data.ytd.grossSalary)}</Text>
              </View>
              <View style={styles.ytdItem}>
                <Text style={styles.infoLabel}>YTD Deductions:</Text>
                <Text style={styles.infoValue}>{formatCurrency(data.ytd.totalDeductions)}</Text>
              </View>
              <View style={styles.ytdItem}>
                <Text style={styles.infoLabel}>YTD Net:</Text>
                <Text style={styles.infoValue}>{formatCurrency(data.ytd.netSalary)}</Text>
              </View>
              <View style={styles.ytdItem}>
                <Text style={styles.infoLabel}>YTD TDS:</Text>
                <Text style={styles.infoValue}>{formatCurrency(data.ytd.tds)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Remarks */}
        {data.remarks && (
          <View style={styles.remarksSection}>
            <Text style={styles.sectionTitle}>Remarks</Text>
            <Text style={styles.remarksText}>{data.remarks}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {/* Digital Signature */}
          {options.includeDigitalSignature && (
            <View style={styles.signatureSection}>
              <View style={styles.signatureBox}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>Employee Signature</Text>
              </View>
              <View style={styles.signatureBox}>
                {options.signatureImageUrl && (
                  <Image src={options.signatureImageUrl} style={styles.signatureImage} />
                )}
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>
                  {options.signatoryName || 'Authorized Signatory'}
                </Text>
                {options.signatoryDesignation && (
                  <Text style={styles.signatureDesignation}>{options.signatoryDesignation}</Text>
                )}
              </View>
            </View>
          )}

          <Text style={styles.disclaimer}>
            This is a system-generated payslip and does not require a physical signature.
            For any queries, please contact the HR department.
          </Text>
        </View>

        {/* Page Number */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Page ${pageNumber} of ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  )
}
