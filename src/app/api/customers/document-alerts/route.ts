/**
 * Customer Document Expiry Alerts API
 * GET /api/customers/document-alerts
 *
 * Fetches customer's KYC documents and uploaded documents,
 * computes expiry status for each, and returns summary counts
 * along with a detailed document list sorted by urgency.
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


// ─── Types ───────────────────────────────────────────────────────

interface DocumentAlert {
  id: string
  name: string
  type: 'identity' | 'financial' | 'license' | 'other'
  documentNumber: string | null       // masked: ****1234
  status: 'expired' | 'expiring_soon' | 'expiring' | 'valid' | 'no_expiry'
  daysUntilExpiry: number | null      // null for no-expiry docs
  expiryDate: string | null           // ISO date string
  issueDate: string | null
  uploadedAt: string | null
  isVerified: boolean
  notificationsEnabled: boolean
  hasDocument: boolean                 // whether user has this document on file
  validityPeriod: string              // human-readable: "No expiry", "10 years", etc.
}

interface AlertSummary {
  expired: number
  expiringSoon: number   // within 30 days
  expiring: number       // within 90 days
  valid: number          // valid + no-expiry docs that user has
  total: number
}

// ─── Document Definitions ────────────────────────────────────────

const DOCUMENT_DEFINITIONS = [
  {
    key: 'pan_card',
    name: 'PAN Card',
    type: 'identity' as const,
    profileField: 'pan_number',
    hasExpiry: false,
    validityPeriod: 'No expiry',
    defaultValidityYears: null,
  },
  {
    key: 'aadhaar_card',
    name: 'Aadhaar Card',
    type: 'identity' as const,
    profileField: 'aadhaar_number',
    hasExpiry: false,
    validityPeriod: 'No expiry',
    defaultValidityYears: null,
  },
  {
    key: 'passport',
    name: 'Passport',
    type: 'identity' as const,
    profileField: null,
    hasExpiry: true,
    validityPeriod: '10 years',
    defaultValidityYears: 10,
  },
  {
    key: 'driving_license',
    name: "Driver's License",
    type: 'license' as const,
    profileField: null,
    hasExpiry: true,
    validityPeriod: '5 years (varies by state)',
    defaultValidityYears: 5,
  },
  {
    key: 'voter_id',
    name: 'Voter ID',
    type: 'identity' as const,
    profileField: null,
    hasExpiry: false,
    validityPeriod: 'No expiry',
    defaultValidityYears: null,
  },
  {
    key: 'bank_statement',
    name: 'Bank Statement',
    type: 'financial' as const,
    profileField: null,
    hasExpiry: true,
    validityPeriod: '3 months (for loan applications)',
    defaultValidityMonths: 3,
  },
  {
    key: 'itr',
    name: 'Income Tax Return (ITR)',
    type: 'financial' as const,
    profileField: null,
    hasExpiry: true,
    validityPeriod: '1 year (current assessment year)',
    defaultValidityYears: null, // special handling: expires March 31
  },
  {
    key: 'gst_certificate',
    name: 'GST Certificate',
    type: 'financial' as const,
    profileField: null,
    hasExpiry: false,
    validityPeriod: 'No expiry (returns due quarterly)',
    defaultValidityYears: null,
  },
  {
    key: 'shop_license',
    name: 'Shop & Establishment License',
    type: 'license' as const,
    profileField: null,
    hasExpiry: true,
    validityPeriod: '1-5 years (varies by state)',
    defaultValidityYears: 1,
  },
  {
    key: 'fssai_license',
    name: 'FSSAI License',
    type: 'license' as const,
    profileField: null,
    hasExpiry: true,
    validityPeriod: '1-5 years',
    defaultValidityYears: 1,
  },
  {
    key: 'insurance',
    name: 'Insurance Policy',
    type: 'financial' as const,
    profileField: null,
    hasExpiry: true,
    validityPeriod: '1 year',
    defaultValidityYears: 1,
  },
  {
    key: 'vehicle_rc',
    name: 'Vehicle Registration Certificate (RC)',
    type: 'license' as const,
    profileField: null,
    hasExpiry: true,
    validityPeriod: '15 years',
    defaultValidityYears: 15,
  },
] as const

// ─── Helpers ─────────────────────────────────────────────────────

function maskDocumentNumber(num: string | null): string | null {
  if (!num) return null
  const cleaned = num.replace(/\s/g, '')
  if (cleaned.length <= 4) return `****${cleaned}`
  return `****${cleaned.slice(-4)}`
}

function computeITRExpiryDate(uploadDate: string | null): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed

  // Assessment year ends on March 31
  // If we're past March, the ITR expires on March 31 of next year
  // If we're before April, it expires March 31 of this year
  if (currentMonth >= 3) {
    // April onwards -> expires March 31 of next year
    return `${currentYear + 1}-03-31`
  } else {
    // Jan-March -> expires March 31 of this year
    return `${currentYear}-03-31`
  }
}

function computeExpiryDate(
  def: typeof DOCUMENT_DEFINITIONS[number],
  uploadedAt: string | null,
  storedExpiryDate: string | null
): string | null {
  // If there's a stored expiry date, use it
  if (storedExpiryDate) return storedExpiryDate

  // No expiry documents
  if (!def.hasExpiry) return null

  // ITR: special handling
  if (def.key === 'itr') {
    return computeITRExpiryDate(uploadedAt)
  }

  // Bank statement: 3 months from upload date
  if (def.key === 'bank_statement' && uploadedAt) {
    const date = new Date(uploadedAt)
    date.setMonth(date.getMonth() + (def.defaultValidityMonths || 3))
    return date.toISOString().split('T')[0]
  }

  // For other documents with years-based validity, compute from upload
  if (uploadedAt && 'defaultValidityYears' in def && def.defaultValidityYears) {
    const date = new Date(uploadedAt)
    date.setFullYear(date.getFullYear() + def.defaultValidityYears)
    return date.toISOString().split('T')[0]
  }

  return null
}

function computeStatus(
  expiryDate: string | null,
  hasExpiry: boolean
): { status: DocumentAlert['status']; daysUntilExpiry: number | null } {
  if (!hasExpiry || !expiryDate) {
    return { status: 'no_expiry', daysUntilExpiry: null }
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - now.getTime()
  const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) {
    return { status: 'expired', daysUntilExpiry }
  } else if (daysUntilExpiry <= 30) {
    return { status: 'expiring_soon', daysUntilExpiry }
  } else if (daysUntilExpiry <= 90) {
    return { status: 'expiring', daysUntilExpiry }
  } else {
    return { status: 'valid', daysUntilExpiry }
  }
}

// ─── Main Handler ────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Run queries in parallel
    const [profileResult, documentsResult] = await Promise.allSettled([
      // 1. Fetch customer profile for KYC document numbers
      supabaseAdmin
        .from('customer_profiles')
        .select(
          'id, pan_number, pan_verified, pan_verified_at, aadhaar_number, aadhaar_verified, aadhaar_verified_at, kyc_status, profile_completed, created_at, updated_at'
        )
        .eq('customer_id', user.id)
        .maybeSingle(),

      // 2. Fetch uploaded documents
      supabase
        .from('customer_documents')
        .select(
          'id, document_type, document_name, verification_status, created_at, updated_at'
        )
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    // Extract results
    const profile =
      profileResult.status === 'fulfilled' && profileResult.value.data
        ? profileResult.value.data
        : null

    const uploadedDocs =
      documentsResult.status === 'fulfilled' && documentsResult.value.data
        ? documentsResult.value.data
        : []

    // Build a map of uploaded documents by type (lowercase key)
    const uploadedDocMap = new Map<string, {
      id: string
      documentType: string
      documentName: string
      verificationStatus: string
      createdAt: string
      updatedAt: string | null
      expiryDate: string | null
    }>()

    for (const doc of uploadedDocs) {
      const key = (doc.document_type || '').toLowerCase().replace(/[\s-]/g, '_')
      // Keep the most recent upload per type
      if (!uploadedDocMap.has(key)) {
        uploadedDocMap.set(key, {
          id: doc.id,
          documentType: doc.document_type,
          documentName: doc.document_name,
          verificationStatus: doc.verification_status || 'PENDING',
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
          expiryDate: null, // customer_documents may not have expiry_date column
        })
      }
    }

    // Also map common variations
    const typeAliases: Record<string, string[]> = {
      pan_card: ['pan', 'pan_card', 'pancard'],
      aadhaar_card: ['aadhaar', 'aadhaar_card', 'aadhar', 'aadhar_card'],
      passport: ['passport'],
      driving_license: ['driving_license', 'drivers_license', 'dl'],
      voter_id: ['voter_id', 'voterid', 'voter_card'],
      bank_statement: ['bank_statement', 'bankstatement', 'bank_statements'],
      itr: ['itr', 'income_tax_return', 'itr_return'],
      gst_certificate: ['gst', 'gst_certificate', 'gstin'],
      shop_license: ['shop_license', 'shop_establishment', 'trade_license'],
      fssai_license: ['fssai', 'fssai_license', 'food_license'],
      insurance: ['insurance', 'insurance_policy', 'life_insurance', 'health_insurance'],
      vehicle_rc: ['vehicle_rc', 'rc', 'registration_certificate'],
    }

    function findUploadedDoc(defKey: string) {
      // Direct match
      if (uploadedDocMap.has(defKey)) return uploadedDocMap.get(defKey)

      // Check aliases
      const aliases = typeAliases[defKey] || []
      for (const alias of aliases) {
        if (uploadedDocMap.has(alias)) return uploadedDocMap.get(alias)
      }

      return null
    }

    // Build document alerts list
    const documents: DocumentAlert[] = DOCUMENT_DEFINITIONS.map((def) => {
      const uploaded = findUploadedDoc(def.key)
      let documentNumber: string | null = null
      let isVerified = false
      let hasDocument = !!uploaded
      let uploadedAt = uploaded?.createdAt || null
      let storedExpiryDate = uploaded?.expiryDate || null

      // For PAN and Aadhaar, pull from profile
      if (def.key === 'pan_card' && profile?.pan_number) {
        documentNumber = maskDocumentNumber(profile.pan_number)
        isVerified = profile.pan_verified === true
        hasDocument = true
        if (!uploadedAt) uploadedAt = profile.pan_verified_at || profile.created_at
      } else if (def.key === 'aadhaar_card' && profile?.aadhaar_number) {
        documentNumber = maskDocumentNumber(profile.aadhaar_number)
        isVerified = profile.aadhaar_verified === true
        hasDocument = true
        if (!uploadedAt) uploadedAt = profile.aadhaar_verified_at || profile.created_at
      }

      // If uploaded doc has a masked number in name, try to extract
      if (!documentNumber && uploaded?.documentName) {
        // Some documents may have numbers embedded in the name
        const numMatch = uploaded.documentName.match(/\d{4,}/)
        if (numMatch) {
          documentNumber = maskDocumentNumber(numMatch[0])
        }
      }

      // Compute expiry
      const expiryDate = computeExpiryDate(def, uploadedAt, storedExpiryDate)
      const { status, daysUntilExpiry } = computeStatus(expiryDate, def.hasExpiry)

      return {
        id: uploaded?.id || def.key,
        name: def.name,
        type: def.type,
        documentNumber,
        status: hasDocument ? status : 'no_expiry',
        daysUntilExpiry: hasDocument ? daysUntilExpiry : null,
        expiryDate,
        issueDate: uploadedAt,
        uploadedAt,
        isVerified: isVerified || uploaded?.verificationStatus === 'VERIFIED',
        notificationsEnabled: true, // default on; user toggles stored in localStorage
        hasDocument,
        validityPeriod: def.validityPeriod,
      }
    })

    // Sort: expired first, then by soonest expiry, no-expiry last
    documents.sort((a, b) => {
      const statusOrder = { expired: 0, expiring_soon: 1, expiring: 2, valid: 3, no_expiry: 4 }
      const aOrder = statusOrder[a.status]
      const bOrder = statusOrder[b.status]
      if (aOrder !== bOrder) return aOrder - bOrder

      // Within same status, sort by days until expiry (ascending)
      if (a.daysUntilExpiry !== null && b.daysUntilExpiry !== null) {
        return a.daysUntilExpiry - b.daysUntilExpiry
      }
      if (a.daysUntilExpiry !== null) return -1
      if (b.daysUntilExpiry !== null) return 1
      return 0
    })

    // Compute summary
    const summary: AlertSummary = {
      expired: documents.filter(d => d.hasDocument && d.status === 'expired').length,
      expiringSoon: documents.filter(d => d.hasDocument && d.status === 'expiring_soon').length,
      expiring: documents.filter(d => d.hasDocument && d.status === 'expiring').length,
      valid: documents.filter(
        d => d.hasDocument && (d.status === 'valid' || d.status === 'no_expiry')
      ).length,
      total: documents.filter(d => d.hasDocument).length,
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        documents,
        profileComplete: profile?.profile_completed === true,
        kycStatus: profile?.kyc_status || null,
      },
      message: 'Document alerts fetched successfully',
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/customers/document-alerts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
