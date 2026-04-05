'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  FileText, CheckCircle2, Circle, Share2, Copy, Check
} from 'lucide-react'

interface DocumentItem {
  name: string
  description: string
  mandatory: boolean
  category: string
}

const DOCUMENT_REQUIREMENTS: Record<string, Record<string, DocumentItem[]>> = {
  home_loan: {
    salaried: [
      { name: 'PAN Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Passport-size Photos', description: '2 recent photographs', mandatory: true, category: 'Identity' },
      { name: 'Salary Slips', description: 'Last 3 months', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Salary account - last 6 months', mandatory: true, category: 'Income' },
      { name: 'Form 16 / ITR', description: 'Last 2 years', mandatory: true, category: 'Income' },
      { name: 'Employment Letter', description: 'Appointment/Experience letter', mandatory: true, category: 'Employment' },
      { name: 'Current Address Proof', description: 'Utility bill/Rent agreement', mandatory: true, category: 'Address' },
      { name: 'Property Agreement', description: 'Sale deed/Agreement to sell', mandatory: true, category: 'Property' },
      { name: 'Property Documents', description: 'Title deed, Encumbrance certificate', mandatory: true, category: 'Property' },
      { name: 'Approved Building Plan', description: 'From municipal authority', mandatory: true, category: 'Property' },
      { name: 'NOC from Builder/Society', description: 'If applicable', mandatory: false, category: 'Property' },
      { name: 'Existing Loan Statements', description: 'If any existing loans', mandatory: false, category: 'Financial' },
      { name: 'CIBIL Report', description: 'Last 30 days', mandatory: false, category: 'Financial' },
    ],
    self_employed: [
      { name: 'PAN Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Passport-size Photos', description: '2 recent photographs', mandatory: true, category: 'Identity' },
      { name: 'ITR', description: 'Last 3 years with computation', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Business + Personal - last 12 months', mandatory: true, category: 'Income' },
      { name: 'Balance Sheet & P&L', description: 'Last 3 years (CA certified)', mandatory: true, category: 'Income' },
      { name: 'GST Returns', description: 'Last 2 years if GST registered', mandatory: true, category: 'Business' },
      { name: 'Business Registration', description: 'Shop Act/MSME/Company Registration', mandatory: true, category: 'Business' },
      { name: 'Business Proof', description: 'Trade license, GST certificate', mandatory: true, category: 'Business' },
      { name: 'Current Address Proof', description: 'Utility bill/Rent agreement', mandatory: true, category: 'Address' },
      { name: 'Property Agreement', description: 'Sale deed/Agreement to sell', mandatory: true, category: 'Property' },
      { name: 'Property Documents', description: 'Title deed, Encumbrance certificate', mandatory: true, category: 'Property' },
      { name: 'Approved Building Plan', description: 'From municipal authority', mandatory: true, category: 'Property' },
      { name: 'Business Vintage Proof', description: 'ITR/Registration showing 3+ years', mandatory: false, category: 'Business' },
    ],
  },
  personal_loan: {
    salaried: [
      { name: 'PAN Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Passport-size Photos', description: '2 recent photographs', mandatory: true, category: 'Identity' },
      { name: 'Salary Slips', description: 'Last 3 months', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Salary account - last 3 months', mandatory: true, category: 'Income' },
      { name: 'Form 16', description: 'Latest year', mandatory: true, category: 'Income' },
      { name: 'Current Address Proof', description: 'Utility bill/Rent agreement', mandatory: true, category: 'Address' },
      { name: 'Employee ID Card', description: 'Company ID proof', mandatory: false, category: 'Employment' },
    ],
    self_employed: [
      { name: 'PAN Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Passport-size Photos', description: '2 recent photographs', mandatory: true, category: 'Identity' },
      { name: 'ITR', description: 'Last 2 years', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Last 6 months', mandatory: true, category: 'Income' },
      { name: 'Business Registration', description: 'Shop Act/MSME/Company Registration', mandatory: true, category: 'Business' },
      { name: 'Current Address Proof', description: 'Utility bill/Rent agreement', mandatory: true, category: 'Address' },
      { name: 'GST Certificate', description: 'If GST registered', mandatory: false, category: 'Business' },
    ],
  },
  car_loan: {
    salaried: [
      { name: 'PAN Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Driving License', description: 'Valid DL', mandatory: true, category: 'Identity' },
      { name: 'Salary Slips', description: 'Last 3 months', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Last 3 months', mandatory: true, category: 'Income' },
      { name: 'Proforma Invoice', description: 'From dealer', mandatory: true, category: 'Vehicle' },
      { name: 'Current Address Proof', description: 'Utility bill/Rent agreement', mandatory: true, category: 'Address' },
    ],
    self_employed: [
      { name: 'PAN Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Driving License', description: 'Valid DL', mandatory: true, category: 'Identity' },
      { name: 'ITR', description: 'Last 2 years', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Last 6 months', mandatory: true, category: 'Income' },
      { name: 'Business Registration', description: 'Proof of business', mandatory: true, category: 'Business' },
      { name: 'Proforma Invoice', description: 'From dealer', mandatory: true, category: 'Vehicle' },
      { name: 'Current Address Proof', description: 'Utility bill/Rent agreement', mandatory: true, category: 'Address' },
    ],
  },
  business_loan: {
    self_employed: [
      { name: 'PAN Card', description: 'Applicant + Business', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'ITR', description: 'Last 3 years with computation', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Business account - last 12 months', mandatory: true, category: 'Income' },
      { name: 'Balance Sheet & P&L', description: 'Last 3 years (CA certified)', mandatory: true, category: 'Income' },
      { name: 'GST Returns', description: 'Last 2 years', mandatory: true, category: 'Business' },
      { name: 'Business Registration', description: 'MOA/AOA/Partnership Deed/MSME', mandatory: true, category: 'Business' },
      { name: 'Business Plan', description: 'For loan purpose', mandatory: false, category: 'Business' },
      { name: 'Collateral Documents', description: 'If secured loan', mandatory: false, category: 'Security' },
      { name: 'Current Address Proof', description: 'Business + Residence', mandatory: true, category: 'Address' },
    ],
    salaried: [],
  },
  education_loan: {
    salaried: [
      { name: 'Student PAN Card', description: 'If available', mandatory: false, category: 'Identity' },
      { name: 'Student Aadhaar', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Co-applicant PAN', description: 'Parent/Guardian PAN', mandatory: true, category: 'Identity' },
      { name: 'Co-applicant Aadhaar', description: 'Parent/Guardian Aadhaar', mandatory: true, category: 'Identity' },
      { name: 'Admission Letter', description: 'From university/college', mandatory: true, category: 'Education' },
      { name: 'Fee Structure', description: 'Complete fee breakdown', mandatory: true, category: 'Education' },
      { name: 'Mark Sheets', description: '10th, 12th, Graduation (if applicable)', mandatory: true, category: 'Education' },
      { name: 'GRE/GMAT/IELTS Scores', description: 'If studying abroad', mandatory: false, category: 'Education' },
      { name: 'Co-applicant Income Proof', description: 'Salary slips/ITR last 2 years', mandatory: true, category: 'Income' },
      { name: 'Co-applicant Bank Statements', description: 'Last 6 months', mandatory: true, category: 'Income' },
      { name: 'Passport', description: 'For foreign education', mandatory: false, category: 'Identity' },
      { name: 'Visa', description: 'Student visa if available', mandatory: false, category: 'Education' },
    ],
    self_employed: [],
  },
  gold_loan: {
    salaried: [
      { name: 'PAN Card', description: 'For loans above \u20B92 Lakhs', mandatory: false, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Gold/Jewelry', description: 'Physical gold to be pledged', mandatory: true, category: 'Security' },
      { name: 'Address Proof', description: 'Any one valid proof', mandatory: true, category: 'Address' },
      { name: 'Passport-size Photos', description: '2 recent photographs', mandatory: true, category: 'Identity' },
    ],
    self_employed: [],
  },
  loan_against_property: {
    salaried: [
      { name: 'PAN Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Salary Slips', description: 'Last 6 months', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Last 12 months', mandatory: true, category: 'Income' },
      { name: 'ITR', description: 'Last 3 years', mandatory: true, category: 'Income' },
      { name: 'Property Documents', description: 'Original title deed, chain of title', mandatory: true, category: 'Property' },
      { name: 'Encumbrance Certificate', description: 'Last 30 years', mandatory: true, category: 'Property' },
      { name: 'Property Tax Receipts', description: 'Latest', mandatory: true, category: 'Property' },
      { name: 'Valuation Report', description: 'From empaneled valuer', mandatory: false, category: 'Property' },
      { name: 'Current Address Proof', description: 'Utility bill/Rent agreement', mandatory: true, category: 'Address' },
    ],
    self_employed: [
      { name: 'PAN Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'Aadhaar Card', description: 'Self-attested copy', mandatory: true, category: 'Identity' },
      { name: 'ITR', description: 'Last 3 years with computation', mandatory: true, category: 'Income' },
      { name: 'Bank Statements', description: 'Last 12 months', mandatory: true, category: 'Income' },
      { name: 'Balance Sheet & P&L', description: 'Last 3 years', mandatory: true, category: 'Income' },
      { name: 'Business Registration', description: 'Shop Act/MSME/Company Registration', mandatory: true, category: 'Business' },
      { name: 'Property Documents', description: 'Original title deed, chain of title', mandatory: true, category: 'Property' },
      { name: 'Encumbrance Certificate', description: 'Last 30 years', mandatory: true, category: 'Property' },
      { name: 'Current Address Proof', description: 'Utility bill/Rent agreement', mandatory: true, category: 'Address' },
    ],
  },
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  home_loan: 'Home Loan',
  personal_loan: 'Personal Loan',
  car_loan: 'Car Loan',
  business_loan: 'Business Loan',
  education_loan: 'Education Loan',
  gold_loan: 'Gold Loan',
  loan_against_property: 'Loan Against Property',
}

export default function DocumentChecklist() {
  const [loanType, setLoanType] = useState('home_loan')
  const [employmentType, setEmploymentType] = useState<'salaried' | 'self_employed'>('salaried')
  const [customerName, setCustomerName] = useState('')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState('')
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const documents = useMemo(() => {
    const docs = DOCUMENT_REQUIREMENTS[loanType]?.[employmentType] || []
    if (docs.length === 0 && employmentType === 'salaried') {
      setFallbackNotice('Business Loan requires self-employed profile. Showing self-employed documents.')
      return DOCUMENT_REQUIREMENTS[loanType]?.self_employed || []
    }
    if (docs.length === 0 && employmentType === 'self_employed') {
      setFallbackNotice('Showing salaried documents for this loan type.')
      return DOCUMENT_REQUIREMENTS[loanType]?.salaried || []
    }
    setFallbackNotice('')
    return docs
  }, [loanType, employmentType])

  const categories = useMemo(() => {
    const cats = new Map<string, DocumentItem[]>()
    documents.forEach(doc => {
      if (!cats.has(doc.category)) cats.set(doc.category, [])
      cats.get(doc.category)!.push(doc)
    })
    return cats
  }, [documents])

  const mandatoryCount = useMemo(() => documents.filter(d => d.mandatory).length, [documents])
  const checkedMandatoryCount = useMemo(() => documents.filter(d => d.mandatory && checkedItems.has(`${loanType}-${d.category}-${d.name}`)).length, [documents, checkedItems, loanType])
  const progress = mandatoryCount > 0 ? Math.round((checkedMandatoryCount / mandatoryCount) * 100) : 0

  const getItemKey = useCallback((doc: DocumentItem) => `${loanType}-${doc.category}-${doc.name}`, [loanType])

  const toggleItem = useCallback((doc: DocumentItem) => {
    const key = `${loanType}-${doc.category}-${doc.name}`
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [loanType])

  const shareChecklist = useCallback(() => {
    const name = customerName.slice(0, 100) || 'Customer'
    let msg = `*Document Checklist - ${LOAN_TYPE_LABELS[loanType] || loanType}*\n`
    msg += `For: ${name} (${employmentType === 'salaried' ? 'Salaried' : 'Self-Employed'})\n\n`

    categories.forEach((docs, category) => {
      msg += `*${category}:*\n`
      docs.forEach(doc => {
        const checked = checkedItems.has(getItemKey(doc))
        msg += `${checked ? '\u2705' : '\u2B1C'} ${doc.name} - ${doc.description}${doc.mandatory ? ' *' : ''}\n`
      })
      msg += '\n'
    })

    msg += `Progress: ${checkedMandatoryCount}/${mandatoryCount} mandatory docs\n`
    msg += `\nGenerated via Loanz360`

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
    const win = window.open(url, '_blank')
    if (!win) {
      // Fallback: copy to clipboard if popup blocked
      navigator.clipboard.writeText(msg).catch(() => {})
    }
  }, [customerName, loanType, employmentType, categories, checkedItems, checkedMandatoryCount, mandatoryCount, getItemKey])

  const copyChecklist = useCallback(async () => {
    let text = `Document Checklist - ${LOAN_TYPE_LABELS[loanType] || loanType}\n`
    text += `Employment: ${employmentType === 'salaried' ? 'Salaried' : 'Self-Employed'}\n\n`

    categories.forEach((docs, category) => {
      text += `${category}:\n`
      docs.forEach(doc => {
        const checked = checkedItems.has(getItemKey(doc))
        text += `[${checked ? 'x' : ' '}] ${doc.name} - ${doc.description}${doc.mandatory ? ' (Required)' : ' (Optional)'}\n`
      })
      text += '\n'
    })

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
      return
    }
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }, [loanType, employmentType, categories, checkedItems, getItemKey])

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2 font-poppins">
          <FileText className="w-6 h-6 text-orange-500" />
          Document Checklist
        </h3>
        <p className="text-gray-400 text-sm mb-6">Generate document requirements for your customer&apos;s loan application</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="dc-loan-type" className="block text-sm font-semibold text-gray-300 mb-2">Loan Type</label>
            <select
              id="dc-loan-type"
              value={loanType}
              onChange={(e) => { setLoanType(e.target.value); setCheckedItems(new Set()) }}
              className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              aria-label="Select loan type"
            >
              {Object.keys(DOCUMENT_REQUIREMENTS).map(key => (
                <option key={key} value={key} className="bg-black text-white">{LOAN_TYPE_LABELS[key] || key}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dc-emp-type" className="block text-sm font-semibold text-gray-300 mb-2">Employment Type</label>
            <select
              id="dc-emp-type"
              value={employmentType}
              onChange={(e) => { setEmploymentType(e.target.value as 'salaried' | 'self_employed'); setCheckedItems(new Set()) }}
              className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              aria-label="Select employment type"
            >
              <option value="salaried" className="bg-black text-white">Salaried</option>
              <option value="self_employed" className="bg-black text-white">Self-Employed / Business</option>
            </select>
          </div>

          <div>
            <label htmlFor="dc-customer-name" className="block text-sm font-semibold text-gray-300 mb-2">Customer Name</label>
            <input
              id="dc-customer-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optional - for sharing"
              maxLength={100}
              className="w-full px-4 py-3 bg-black border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-gray-500"
              aria-label="Customer name for sharing"
            />
          </div>
        </div>

        {/* Fallback notice */}
        {fallbackNotice && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-sm">
            {fallbackNotice}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">
            Mandatory Documents: {checkedMandatoryCount}/{mandatoryCount}
          </span>
          <span className="text-sm font-semibold text-orange-400">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Document completion progress">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No documents found for this loan type and employment combination</p>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-4">
        {Array.from(categories.entries()).map(([category, docs]) => (
          <div key={category} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 bg-white/5 border-b border-white/10">
              <h4 className="text-sm font-semibold text-orange-400">{category}</h4>
            </div>
            <div className="divide-y divide-white/5">
              {docs.map(doc => {
                const itemKey = getItemKey(doc)
                const isChecked = checkedItems.has(itemKey)
                return (
                  <div
                    key={itemKey}
                    role="checkbox"
                    aria-checked={isChecked}
                    tabIndex={0}
                    onClick={() => toggleItem(doc)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(doc) } }}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isChecked ? 'bg-green-500/5' : 'hover:bg-white/5'
                    }`}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isChecked ? 'text-green-400 line-through' : 'text-white'}`}>
                        {doc.name}
                        {doc.mandatory && <span className="text-red-400 ml-1">*</span>}
                      </p>
                      <p className="text-xs text-gray-500">{doc.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {documents.length > 0 && (
        <div className="flex gap-3">
          <button
            onClick={shareChecklist}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            aria-label="Share checklist via WhatsApp"
          >
            <Share2 className="w-5 h-5" />
            Share via WhatsApp
          </button>
          <button
            onClick={copyChecklist}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2"
            aria-label="Copy checklist to clipboard"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}
