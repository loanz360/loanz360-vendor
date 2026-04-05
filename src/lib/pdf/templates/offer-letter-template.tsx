// Professional Offer Letter PDF Template
// Uses @react-pdf/renderer following payslip-template pattern

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { OfferLetterData, OfferLetterOptions } from '../types-offer-letter'
import { formatCurrencyINR, formatDateLong } from '../types-offer-letter'

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    lineHeight: 1.6,
  },
  header: {
    marginBottom: 30,
    paddingBottom: 15,
    borderBottom: '2 solid #FF6700',
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6700',
    fontFamily: 'Helvetica-Bold',
  },
  companyAddress: {
    fontSize: 9,
    color: '#666666',
    marginTop: 4,
  },
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  refText: {
    fontSize: 10,
    color: '#444444',
  },
  subject: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 20,
    textDecoration: 'underline',
    color: '#171717',
  },
  greeting: {
    marginBottom: 12,
  },
  paragraph: {
    marginBottom: 10,
    textAlign: 'justify',
    color: '#333333',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#FF6700',
    marginTop: 16,
    marginBottom: 8,
  },
  table: {
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #eeeeee',
    paddingVertical: 5,
  },
  tableRowHighlight: {
    flexDirection: 'row',
    borderBottom: '1 solid #cccccc',
    borderTop: '1 solid #cccccc',
    paddingVertical: 6,
    backgroundColor: '#FFF7ED',
  },
  tableLabel: {
    flex: 2,
    color: '#555555',
    fontSize: 10,
  },
  tableValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#171717',
  },
  bulletList: {
    marginBottom: 10,
    paddingLeft: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    width: 15,
    color: '#FF6700',
    fontFamily: 'Helvetica-Bold',
  },
  bulletText: {
    flex: 1,
    color: '#333333',
    fontSize: 10,
  },
  signatureSection: {
    marginTop: 40,
  },
  signatureLine: {
    width: 200,
    borderBottom: '1 solid #000000',
    marginTop: 40,
    marginBottom: 5,
  },
  signatureName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  signatureDesignation: {
    fontSize: 9,
    color: '#666666',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTop: '1 solid #eeeeee',
    paddingTop: 8,
  },
  confidential: {
    position: 'absolute',
    top: 30,
    right: 50,
    fontSize: 8,
    color: '#FF6700',
    fontFamily: 'Helvetica-Bold',
  },
})

interface Props {
  data: OfferLetterData
  options?: OfferLetterOptions
}

export function OfferLetterTemplate({ data, options = {} }: Props) {
  const showComp = options.includeCompensation !== false

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Confidential Mark */}
        <Text style={styles.confidential}>CONFIDENTIAL</Text>

        {/* Company Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyAddress}>{data.companyAddress}</Text>
        </View>

        {/* Reference & Date */}
        <View style={styles.refRow}>
          <Text style={styles.refText}>Ref: {data.referenceNumber}</Text>
          <Text style={styles.refText}>Date: {formatDateLong(data.letterDate)}</Text>
        </View>

        {/* Candidate Address */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{data.candidateName}</Text>
          <Text style={{ fontSize: 10, color: '#555555' }}>{data.candidateAddress}</Text>
        </View>

        {/* Subject */}
        <Text style={styles.subject}>OFFER OF EMPLOYMENT</Text>

        {/* Greeting */}
        <Text style={styles.greeting}>Dear {data.candidateName},</Text>

        {/* Body */}
        <Text style={styles.paragraph}>
          We are pleased to offer you the position of <Text style={{ fontFamily: 'Helvetica-Bold' }}>{data.designation}</Text> in
          the <Text style={{ fontFamily: 'Helvetica-Bold' }}>{data.department}</Text> department
          at {data.companyName}. We were impressed with your qualifications and believe you will be a valuable addition to our team.
        </Text>

        {/* Job Details */}
        <Text style={styles.sectionTitle}>Position Details</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Designation</Text>
            <Text style={styles.tableValue}>{data.designation}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Department</Text>
            <Text style={styles.tableValue}>{data.department}</Text>
          </View>
          {data.reportingManager && (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Reporting Manager</Text>
              <Text style={styles.tableValue}>{data.reportingManager}</Text>
            </View>
          )}
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Date of Joining</Text>
            <Text style={styles.tableValue}>{formatDateLong(data.dateOfJoining)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Work Location</Text>
            <Text style={styles.tableValue}>{data.workLocation}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Probation Period</Text>
            <Text style={styles.tableValue}>{data.probationPeriodMonths} months</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Notice Period</Text>
            <Text style={styles.tableValue}>{data.noticePeriodDays} days</Text>
          </View>
        </View>

        {/* Compensation */}
        {showComp && (
          <>
            <Text style={styles.sectionTitle}>Compensation Details (Per Annum)</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>Basic Salary</Text>
                <Text style={styles.tableValue}>{formatCurrencyINR(data.basicSalary)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>House Rent Allowance (HRA)</Text>
                <Text style={styles.tableValue}>{formatCurrencyINR(data.hra)}</Text>
              </View>
              {data.specialAllowance > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Special Allowance</Text>
                  <Text style={styles.tableValue}>{formatCurrencyINR(data.specialAllowance)}</Text>
                </View>
              )}
              {data.transportAllowance > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Transport Allowance</Text>
                  <Text style={styles.tableValue}>{formatCurrencyINR(data.transportAllowance)}</Text>
                </View>
              )}
              {data.medicalAllowance > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Medical Allowance</Text>
                  <Text style={styles.tableValue}>{formatCurrencyINR(data.medicalAllowance)}</Text>
                </View>
              )}
              {data.otherAllowances > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Other Allowances</Text>
                  <Text style={styles.tableValue}>{formatCurrencyINR(data.otherAllowances)}</Text>
                </View>
              )}
              <View style={styles.tableRowHighlight}>
                <Text style={{ ...styles.tableLabel, fontFamily: 'Helvetica-Bold', color: '#171717' }}>Gross Salary</Text>
                <Text style={styles.tableValue}>{formatCurrencyINR(data.grossSalary)}</Text>
              </View>
              {data.pfContribution > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>PF (Employee Contribution)</Text>
                  <Text style={{ ...styles.tableValue, color: '#dc2626' }}>- {formatCurrencyINR(data.pfContribution)}</Text>
                </View>
              )}
              {data.esiContribution > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>ESI (Employee Contribution)</Text>
                  <Text style={{ ...styles.tableValue, color: '#dc2626' }}>- {formatCurrencyINR(data.esiContribution)}</Text>
                </View>
              )}
              {data.professionalTax > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Professional Tax</Text>
                  <Text style={{ ...styles.tableValue, color: '#dc2626' }}>- {formatCurrencyINR(data.professionalTax)}</Text>
                </View>
              )}
              <View style={styles.tableRowHighlight}>
                <Text style={{ ...styles.tableLabel, fontFamily: 'Helvetica-Bold', color: '#171717' }}>Net Salary (Annual)</Text>
                <Text style={{ ...styles.tableValue, color: '#16a34a' }}>{formatCurrencyINR(data.netSalary)}</Text>
              </View>
              <View style={styles.tableRowHighlight}>
                <Text style={{ ...styles.tableLabel, fontFamily: 'Helvetica-Bold', color: '#FF6700' }}>Cost to Company (CTC)</Text>
                <Text style={{ ...styles.tableValue, color: '#FF6700' }}>{formatCurrencyINR(data.ctcAnnual)}</Text>
              </View>
            </View>
          </>
        )}

        {/* Terms */}
        <Text style={styles.sectionTitle}>Terms & Conditions</Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>1.</Text>
            <Text style={styles.bulletText}>
              You will be on probation for a period of {data.probationPeriodMonths} months from the date of joining.
              Confirmation will be subject to satisfactory performance.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>2.</Text>
            <Text style={styles.bulletText}>
              Either party may terminate this employment by providing {data.noticePeriodDays} days written notice
              or payment in lieu thereof.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>3.</Text>
            <Text style={styles.bulletText}>
              You are expected to maintain confidentiality regarding the company&apos;s proprietary information,
              business strategies, and client data during and after your employment.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>4.</Text>
            <Text style={styles.bulletText}>
              You will be required to complete your employee profile and submit all relevant documents
              within 7 days of joining.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>5.</Text>
            <Text style={styles.bulletText}>
              This offer is contingent upon the successful verification of your educational qualifications,
              previous employment, and background check.
            </Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          Please sign and return a copy of this letter as acceptance of the offer. We look forward to welcoming
          you to the {data.companyName} family.
        </Text>

        <Text style={{ ...styles.paragraph, marginTop: 8 }}>
          Warm Regards,
        </Text>

        {/* Signature */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureName}>{data.signatoryName}</Text>
          <Text style={styles.signatureDesignation}>{data.signatoryDesignation}</Text>
          <Text style={{ fontSize: 9, color: '#666666' }}>{data.companyName}</Text>
        </View>

        {/* Candidate Acceptance */}
        <View style={{ marginTop: 30 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
            ACCEPTANCE BY CANDIDATE
          </Text>
          <Text style={{ fontSize: 9, color: '#555555', marginBottom: 20 }}>
            I, {data.candidateName}, accept the above offer of employment and agree to the terms and conditions mentioned.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <View style={styles.signatureLine} />
              <Text style={{ fontSize: 9 }}>Signature</Text>
            </View>
            <View>
              <View style={styles.signatureLine} />
              <Text style={{ fontSize: 9 }}>Date</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This is a system-generated offer letter from {data.companyName}. This document is confidential and intended solely for the named recipient.
        </Text>
      </Page>
    </Document>
  )
}
